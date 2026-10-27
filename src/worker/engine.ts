import { setTimeout as delay } from 'node:timers/promises';
import type { Database,Transaction } from '../db/database.js';
import { one,insertRow } from '../db/database.js';
import { assertFence,cleanup,enqueue,type Job } from '../db/queue.js';
import type { Config } from '../shared/config.js';
import type { Contracts,Schema } from '../shared/contracts.js';
import { contentHash,newId } from '../shared/crypto.js';
import { AppError,invariant } from '../shared/errors.js';
import { assertPaidPermit } from '../shared/lifecycle.js';
import type { AgentOutput,AgentRuntime } from '../agent/runner.js';
import { validateAnalysis } from '../agent/protocol.js';
import type { SourceUnit } from '../validation/result.js';
import { validateResult } from '../validation/result.js';
import { freshCandidate } from '../validation/identities.js';
import { assertConfirmedDecisions,type ConfirmedDecision } from '../validation/decisions.js';
import type { Scalar } from '../validation/schema.js';
import type { LocalStore } from '../storage/local-store.js';
import { BUDGET,get,type BindingRow,type ContractRow,type PlanRow,type RunRow,type SessionRow,type SourceRow,type SourceSetRow,type TaskRow } from '../domain/models.js';
import type { CommerceService } from '../domain/commerce-service.js';
import { Publisher } from './publication.js';
import { RuntimeCleaner } from './cleanup.js';
import type { PaymentService } from '../platforms/payments.js';
import { DeletionWorker } from './deletion.js';

interface Context {session:SessionRow;task:TaskRow|null;sources:SourceRow[];set:SourceSetRow|null;run:RunRow|null;
 contract:ContractRow|null;plan:PlanRow|null;binding:BindingRow|null;attemptId:string;turnId:string;control:Record<string,unknown>;computeMs?:number;
 permit?:{kind:'PAID';payment_status:'CONFIRMED';order_id:string;contract_id:string;plan_sha256:string;amount_minor:number;amount_unit:string;revoked:boolean};}
interface SavedPlan {protocol:'P07-SAVED-PLAN-1';analysis:unknown;units:SourceUnit[];}

export class WorkerEngine {
 readonly publisher:Publisher;readonly cleaner:RuntimeCleaner;
 constructor(readonly db:Database,readonly config:Config,readonly contracts:Contracts,readonly store:LocalStore,
  readonly runtime:AgentRuntime,readonly commerce:CommerceService,private readonly reportError?:(error:unknown)=>void,
  private readonly payments?:PaymentService){this.publisher=new Publisher(db,store);this.cleaner=new RuntimeCleaner(db,store,runtime);}
 async claim(worker:string):Promise<Job|null>{return (await this.db.pool.query<Job>('SELECT * FROM p07.claim_job($1,60)',[worker])).rows[0]??null;}
 private async locked<T>(tx:Transaction,job:Job,action:(session:SessionRow,task:TaskRow|null)=>Promise<T>):Promise<T>{
  const initial=await get<SessionRow>(tx,'agent_sessions',job.payload.session_id!);
  const task=initial.task_id?await get<TaskRow>(tx,'tasks',initial.task_id,true):null;
  const session=await get<SessionRow>(tx,'agent_sessions',initial.id,true);await assertFence(tx,job);return action(session,task);
 }
 async process(job:Job,shutdown:AbortSignal):Promise<void>{
  if(['PAYMENT_QUERY','REFUND','REFUND_QUERY','DELETION'].includes(job.kind)){
   try{if(job.kind==='DELETION')await new DeletionWorker(this.db,this.store).execute(job);
    else{invariant(this.payments,'PAYMENT_NOT_CONFIGURED','资金处理服务尚未配置。',503);await this.payments.process(job);}}
   catch(error){this.reportError?.(error);await this.db.withOwner(job.owner_id,async tx=>{await assertFence(tx,job);
    if(job.kind==='DELETION'&&job.attempts>=3){
     await tx.query("UPDATE p07.deletion_requests SET status='PARTIAL_FAILED',remaining_categories='[\"REQUESTED_CONTENT\"]' WHERE id=$1",[job.payload.deletion_id]);
     await tx.query("UPDATE p07.operations SET status='FAILED',error_code='DELETION_PURGE_FAILED',finished_at=now() WHERE id=$1",[job.operation_id]);
    }
    await tx.query("UPDATE p07.jobs SET status=CASE WHEN attempts<3 THEN 'READY' ELSE 'DEAD' END,available_at=now()+interval '30 seconds',lease_owner=NULL,lease_until=NULL,last_error_code=$2 WHERE id=$1",
     [job.id,error instanceof AppError?error.code:'PAYMENT_QUERY_FAILED']);});}return;
  }
  const sessionId=job.payload.session_id;invariant(sessionId,'JOB_SCOPE_MISSING','处理任务缺少会话。',503);
  const lock=await this.db.pool.connect();const key='p07-session:'+sessionId;let acquired=false;
  const controller=new AbortController();let heartbeat:ReturnType<typeof setInterval>|undefined;let beating=false;
  const signal=AbortSignal.any([shutdown,controller.signal]);
  try{
   acquired=(await lock.query<{ok:boolean}>('SELECT pg_try_advisory_lock(hashtextextended($1,0)) ok',[key])).rows[0]!.ok;
   if(!acquired){await this.db.withOwner(job.owner_id,async tx=>{await assertFence(tx,job);await tx.query("UPDATE p07.jobs SET status='READY',lease_owner=NULL,lease_until=NULL,available_at=now()+interval '2 seconds',attempts=greatest(attempts-1,0) WHERE id=$1",[job.id]);});return;}
   heartbeat=setInterval(()=>{if(beating)return;beating=true;
    void this.heartbeat(job).then(ok=>{if(!ok)controller.abort();}).catch(()=>controller.abort()).finally(()=>{beating=false;});},10_000);
   if(job.kind==='CLEANUP'){await this.cleaner.execute(job);await this.refundUndelivered(job);}
   else{
    const context=await this.begin(job);
    if(context){
     const started=Date.now();let output:AgentOutput|undefined;
     try{
      let saved:SavedPlan|null=null;
      if(context.plan?.content_ref)saved=JSON.parse((await this.store.read(context.plan.content_ref)).toString('utf8')) as SavedPlan;
      if(context.run){
       const receipt=await this.publisher.resume(context.session,context.run);
       if(receipt){await this.publisher.publish(job,context.session,context.run,context.contract!,context.binding!,context.sources,receipt);
        await this.finishTurn(job,context,0);await this.done(job);return;}
      }
      const control={...context.control,previous_analysis:saved?.analysis??null,
       ...(job.kind==='ADJUST'?{adjustment:JSON.parse((await this.store.read(`sessions/${sessionId}/control/adjust-${job.operation_id}.json`)).toString('utf8'))}:{}),
       ...(context.permit?{paid_permit:context.permit,schema:context.binding!.content,schema_sha256:context.binding!.content_sha256,
        confirmed_plan:context.plan!.summary}:{}),};
      output=await this.runtime.run({sessionId,phase:job.kind as 'BOOTSTRAP'|'ANALYZE'|'ADJUST'|'BATCH',threadId:context.session.codex_thread_id,
       sources:context.sources,control,units:saved?.units??[],signal,budgetMs:context.computeMs,
       onThread:async threadId=>{await this.db.withOwner(job.owner_id,tx=>this.locked(tx,job,async session=>{
        invariant(!['CLOSED','CANCELED','RELEASING_RUNTIME'].includes(session.status),'SESSION_REVOKED','会话授权已撤销。',409);
        await tx.query('UPDATE p07.agent_sessions SET codex_thread_id=$2 WHERE id=$1',[sessionId,threadId]);}));}});
      if(job.kind==='BOOTSTRAP')await this.bootstrap(job,context,output);
      else if(job.kind==='ANALYZE'||job.kind==='ADJUST')await this.analysis(job,context,output);
      else if(job.kind==='BATCH'){
       const sourceIds=new Set(context.sources.filter(s=>s.role==='SOURCE').map(s=>s.id));
       const units=output.units.filter(u=>sourceIds.has(u.source_id));
       invariant(saved&&contentHash(saved.units.filter(u=>sourceIds.has(u.source_id)).map(u=>({id:u.unit_id,hash:u.sha256})))===contentHash(units.map(u=>({id:u.unit_id,hash:u.sha256}))),
        'SOURCE_ANALYSIS_CHANGED','批量处理的资料计量与确认时不同。',422);
       const decisions=(context.control.confirmed_decisions??[]) as ConfirmedDecision[];
       assertConfirmedDecisions(this.contracts,output.data,decisions,units);
       const approved=new Map<string,Scalar>(decisions.filter(d=>d.action==='USER_VALUE').map(d=>[d.record_id+':'+d.field_id,d.user_value!]));
       const remapped=freshCandidate(this.contracts,output.data,approved);
       const validated=validateResult(this.contracts,context.binding!.content,units,remapped.candidate,remapped.userValues,context.plan!.estimated_records);
       const receipt=await this.publisher.prepare(job,context.session,context.run!,context.contract!,context.plan!,context.binding!,validated,context.attemptId,this.config.P07_CODEX_MODEL||null);
       await this.publisher.publish(job,context.session,context.run!,context.contract!,context.binding!,context.sources,receipt);
      }else invariant(false,'JOB_KIND_UNSUPPORTED','处理任务类型不受支持。',503);
      await this.finishTurn(job,context,Date.now()-started,output.usage);
     }catch(error){await this.finishTurn(job,context,Date.now()-started,output?.usage,true).catch(()=>undefined);throw error;}
    }
   }
   await this.done(job);
  }catch(error){this.reportError?.(error);await this.failed(job,error).catch(e=>this.reportError?.(e));}
  finally{if(heartbeat)clearInterval(heartbeat);controller.abort();
   if(acquired){await this.runtime.stop(sessionId).catch(()=>undefined);await lock.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[key]).catch(()=>undefined);}lock.release();}
 }
 private async heartbeat(job:Job):Promise<boolean>{return this.db.withOwner(job.owner_id,async tx=>{
  const alive=await tx.query(`UPDATE p07.jobs SET lease_until=clock_timestamp()+interval '60 seconds'
   WHERE id=$1 AND lease_owner=$2 AND fence=$3 AND status='LEASED' AND lease_until>clock_timestamp() RETURNING id`,[job.id,job.lease_owner,job.fence]);
  if(!alive.rowCount)return false;
  if(job.kind==='CLEANUP')return true;
  const session=await get<SessionRow>(tx,'agent_sessions',job.payload.session_id!);
  if(session.run_id&&!await one(tx,`SELECT g.id FROM p07.runs r JOIN p07.entitlement_grants g ON g.id=r.grant_id JOIN p07.orders o ON o.id=g.order_id
   WHERE r.id=$1 AND g.revoked_at IS NULL AND NOT o.reconciliation_required AND o.payment_status='CONFIRMED' AND o.refunded_minor+o.refund_reserved_minor=0`,[session.run_id]))return false;
  return !['CANCELED','FAILED','INITIALIZATION_FAILED','CLOSED'].includes(session.status)&&session.cleanup_status==='NOT_REQUESTED';
 });}
 private async begin(job:Job):Promise<Context|null>{
  // Stop stale descendants before a new fenced turn, including recovery after a crashed worker.
  await this.runtime.stop(job.payload.session_id!);
  return this.db.withOwner(job.owner_id,tx=>this.locked(tx,job,async(session,task)=>{
   if(['CLOSED','RELEASING_RUNTIME','CANCELED','FAILED','INITIALIZATION_FAILED'].includes(session.status))return null;
   invariant(session.skill_manifest_sha256===this.runtime.skill.manifestHash,'SKILL_RELEASE_CHANGED','会话绑定的完整技能版本当前不可用。',503);
   const batch=job.kind==='BATCH';
   invariant(job.kind==='BOOTSTRAP'?session.status==='INITIALIZING':batch?['BATCH_QUEUED','BATCH_RUNNING','PERSISTING_RESULTS'].includes(session.status):session.status==='ANALYZING',
    'JOB_PHASE_INVALID','任务阶段已改变。',409);
   const set=task?.current_source_set_id?await get<SourceSetRow>(tx,'source_sets',task.current_source_set_id):null;
   const sources=set?(await tx.query<SourceRow>(`SELECT s.* FROM p07.source_set_items i JOIN p07.source_files s ON s.id=i.source_id AND s.owner_id=i.owner_id
    WHERE i.source_set_id=$1 AND i.included ORDER BY i.ordinal`,[set.id])).rows:[];
   const run=batch?await get<RunRow>(tx,'runs',job.run_id!,true):null;
   const contract=run?await get<ContractRow>(tx,'processing_contracts',run.contract_id):null;
   const plan=contract?await get<PlanRow>(tx,'execution_plans',contract.confirmed_plan_id):task&&set?
    await one<PlanRow>(tx,'SELECT * FROM p07.execution_plans WHERE task_id=$1 AND source_set_id=$2 ORDER BY version DESC LIMIT 1',[task.id,set.id])??null:null;
   const binding=contract?await get<BindingRow>(tx,'schema_bindings',contract.schema_binding_id):null;
   const attemptId=newId(),turnId=newId();let permit:Context['permit'],computeMs:number|undefined;
   if(run&&contract&&plan){
    const budgetRoot=contract.budget_contract_id??contract.id;
    await tx.query('SELECT id FROM p07.processing_contracts WHERE id=$1 FOR UPDATE',[budgetRoot]);
    const paid=await one<{order_id:string;payment_status:'CONFIRMED';amount_minor:number;amount_unit:string;kind:'PAID';revoked_at:Date|null}>(tx,
     `SELECT o.id order_id,o.payment_status,o.amount_minor,o.amount_unit,g.kind,g.revoked_at FROM p07.entitlement_grants g
      JOIN p07.orders o ON o.id=g.order_id AND o.owner_id=g.owner_id WHERE g.id=$1 AND NOT o.reconciliation_required AND o.refunded_minor+o.refund_reserved_minor=0
      AND(g.expires_at IS NULL OR g.expires_at>now()) FOR UPDATE OF o,g`,[run.grant_id]);
    permit=paid?{kind:paid.kind,payment_status:paid.payment_status,order_id:paid.order_id,contract_id:contract.id,plan_sha256:plan.plan_sha256,
     amount_minor:paid.amount_minor,amount_unit:paid.amount_unit,revoked:!!paid.revoked_at}:undefined;
    assertPaidPermit(permit??null,contract.id,plan.plan_sha256);
    invariant(!run.cancel_requested_at&&['QUEUED','RUNNING'].includes(run.execution_status)&&task?.epoch===run.epoch,'RUN_REVOKED','本次生产已停止。',409);
    const budget=await one<{spent:number}>(tx,`SELECT coalesce(sum(CASE WHEN kind IN('RESERVE','CONSUME') THEN compute_ms ELSE -compute_ms END),0)::bigint spent
     FROM p07.run_budget_events WHERE contract_id=$1`,[budgetRoot]);
    computeMs=Math.max(0,this.config.P07_AGENT_BATCH_MS-(budget?.spent??0));
    invariant(session.status==='PERSISTING_RESULTS'||(budget?.spent??0)<this.config.P07_AGENT_BATCH_MS,'COMPUTE_BUDGET_EXCEEDED','本合同的处理预算已耗尽。',429);
    if(session.status==='BATCH_QUEUED')await tx.query("UPDATE p07.agent_sessions SET status='BATCH_RUNNING' WHERE id=$1",[session.id]);
    await tx.query("UPDATE p07.runs SET execution_status='RUNNING',current_stage='AGENT_BATCH',version=version+1 WHERE id=$1",[run.id]);
    await insertRow(tx,'stage_attempts',{id:attemptId,owner_id:job.owner_id,run_id:run.id,job_id:job.id,stage:'AGENT_BATCH',attempt_no:job.attempts,fence:job.fence,
     input_sha256:contentHash({contract:contract.contract_sha256,plan:plan.plan_sha256}),status:'RUNNING',versions:{skill:session.skill_manifest_sha256},started_at:new Date()});
    await insertRow(tx,'run_budget_events',{id:newId(),owner_id:job.owner_id,contract_id:budgetRoot,run_id:run.id,attempt_id:attemptId,
     event_key:'reserve:'+attemptId,kind:'RESERVE',compute_ms:session.status==='PERSISTING_RESULTS'?0:computeMs});
   }
   await tx.query("UPDATE p07.agent_turns SET status='INTERRUPTED',finished_at=now() WHERE session_id=$1 AND status IN('QUEUED','RUNNING')",[session.id]);
   const ordinal=(await one<{n:number}>(tx,'SELECT coalesce(max(ordinal),0)+1 n FROM p07.agent_turns WHERE session_id=$1',[session.id]))!.n;
   if(task)await this.commerce.tasks.processingConsent(tx);
   const confirmedDecisions=task?(await tx.query(`SELECT d.action,d.evidence_id,d.user_value,d.note,pd->>'record_id' record_id,pd->>'field_id' field_id
    FROM p07.revision_intents ri JOIN p07.decision_batches b ON b.id=ri.batch_id JOIN p07.decision_previews p ON p.id=b.preview_id
    CROSS JOIN LATERAL jsonb_array_elements(p.decisions) pd JOIN p07.decisions d ON d.batch_id=b.id AND d.issue_id=(pd->>'issue_id')::uuid WHERE ri.task_id=$1`,[task.id])).rows:[];
   const provenance=new Map<string,{evidence_id:string;excerpt:string}[]>();
   for(const decision of confirmedDecisions.filter(d=>d.action==='CHOOSE_EVIDENCE')){
    const evidence=await one<{excerpt_object_key:string;excerpt_sha256:string}>(tx,'SELECT excerpt_object_key,excerpt_sha256 FROM p07.evidence WHERE id=$1',[decision.evidence_id]);
    invariant(evidence?.excerpt_object_key,'PARENT_EVIDENCE_UNAVAILABLE','用户选定的来源摘录已不可用。',409);
    if(!provenance.has(evidence.excerpt_object_key))provenance.set(evidence.excerpt_object_key,(await this.store.read(evidence.excerpt_object_key)).toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line)));
    const selected=provenance.get(evidence.excerpt_object_key)!.find(e=>e.evidence_id===decision.evidence_id);
    invariant(selected&&contentHash(selected.excerpt)===evidence.excerpt_sha256,'PARENT_EVIDENCE_UNAVAILABLE','来源摘录完整性校验失败。',503);decision.selected_excerpt=selected.excerpt;
   }
   const control={analysis_scope:'FULL_SUBMITTED_SCOPE',mode:task?.mode??null,goal:task?.goal??null,
    schema:task?.standard_definition??null,source_set_sha256:set?.content_sha256??null,limits:BUDGET,confirmed_decisions:confirmedDecisions,
    revision_note:confirmedDecisions.length?'父结果是本次新提交资料；保留父记录的候选本地标识以匹配用户决定，Host 发布时重新编号。原件已清理，仅能分析本次实际输入。':null};
   await insertRow(tx,'agent_turns',{id:turnId,owner_id:job.owner_id,session_id:session.id,ordinal,job_id:job.id,attempt_id:attemptId,fence:job.fence,
    input_sha256:contentHash(control),status:'RUNNING',started_at:new Date()});
   await tx.query('UPDATE p07.agent_sessions SET active_job_id=$2,last_turn_ordinal=$3 WHERE id=$1',[session.id,job.id,ordinal]);
   return {session,task,sources,set,run,contract,plan,binding,attemptId,turnId,control,computeMs,...(permit?{permit}:{})};
  }));
 }
 private async bootstrap(job:Job,ctx:Context,out:AgentOutput){await this.db.withOwner(job.owner_id,tx=>this.locked(tx,job,async session=>{
  invariant(session.status==='INITIALIZING'&&out.receipt.skill_manifest_sha256===session.skill_manifest_sha256,'BOOTSTRAP_INVALID','会话初始化回执不符。',503);
  await tx.query("UPDATE p07.agent_workspaces SET status='READY',isolation_receipt=$2 WHERE id=$1",[session.workspace_id,out.isolationReceipt]);
  await tx.query("UPDATE p07.agent_sessions SET status='READY_FOR_INPUT',preload_receipt=$2,idle_expires_at=now()+make_interval(secs=>$3) WHERE id=$1",[session.id,out.receipt,this.config.P07_AGENT_IDLE_SECONDS]);
  await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now() WHERE id=$1",[job.operation_id,{id:session.id,kind:'SESSION'}]);
 }));}
 private async analysis(job:Job,ctx:Context,out:AgentOutput){
  const factIds=new Set(ctx.sources.filter(s=>s.role==='SOURCE').map(s=>s.id));const units=out.units.filter(u=>factIds.has(u.source_id));
  const requested=job.kind==='ADJUST'?JSON.parse((await this.store.read(`sessions/${ctx.session.id}/control/adjust-${job.operation_id}.json`)).toString('utf8')).requested_schema as Schema['SchemaDefinition']|undefined:undefined;
  const analysis=validateAnalysis(this.contracts,out.data,units,requested??(job.kind==='ADJUST'?null:ctx.task!.standard_definition));
  const contentRef=`sessions/${ctx.session.id}/control/plan-${job.id}-${job.fence}.json`;
  const saved:SavedPlan={protocol:'P07-SAVED-PLAN-1',analysis,units:out.units};await this.store.write(contentRef,Buffer.from(JSON.stringify(saved)));
  await this.db.withOwner(job.owner_id,tx=>this.locked(tx,job,async(session,task)=>{
   invariant(session.status==='ANALYZING'&&task?.current_source_set_id===ctx.set!.id&&task.goal_version===ctx.task!.goal_version,'ANALYSIS_STALE','资料或目标已改变。',409);
   if(job.kind==='ADJUST'&&task.mode==='PROVIDED')await tx.query('UPDATE p07.tasks SET standard_definition=$2 WHERE id=$1',[task.id,analysis.schema]);
   const version=(await one<{n:number}>(tx,'SELECT coalesce(max(version),0)+1 n FROM p07.execution_plans WHERE session_id=$1',[session.id]))!.n;
   const proposalVersion=(await one<{n:number}>(tx,'SELECT coalesce(max(version),0)+1 n FROM p07.schema_proposals WHERE task_id=$1',[task.id]))!.n;
   const planId=newId(),proposalId=newId();const summary={strategy_summary:analysis.strategy_summary,limitations:analysis.limitations,preview_record_count:analysis.preview_records.length};
   const planHash=contentHash({source_set_sha256:ctx.set!.content_sha256,schema:analysis.schema,skill_sha256:session.skill_manifest_sha256,
    summary,estimated_records:analysis.estimated_records,coverage:analysis.coverage});
   await insertRow(tx,'execution_plans',{id:planId,owner_id:job.owner_id,session_id:session.id,task_id:task.id,version,status:'DRAFT',plan_sha256:planHash,
    source_set_sha256:ctx.set!.content_sha256,skill_manifest_sha256:session.skill_manifest_sha256,content_ref:contentRef,summary,
    estimated_records:analysis.estimated_records,measured_units:units.length,source_set_id:ctx.set!.id,goal_version:task.goal_version});
   const proposal:Schema['Proposal']={proposal_id:proposalId,version:proposalVersion,status:'FULL_DRAFT',source_set_version:ctx.set!.version,goal_version:task.goal_version,
    schema:analysis.schema,suggestions:analysis.suggestions,coverage:analysis.coverage,preview_is_sample:true,preview_records:analysis.preview_records,
    unmapped_important:analysis.unmapped_important,change_preview:null};this.contracts.validate('Proposal',proposal,true);
   await insertRow(tx,'schema_proposals',{id:proposalId,owner_id:job.owner_id,task_id:task.id,source_set_id:ctx.set!.id,goal_version:task.goal_version,
    version:proposalVersion,status:'FULL_DRAFT',content:proposal,coverage:analysis.coverage,unmapped:JSON.stringify(analysis.unmapped_important),content_sha256:contentHash(proposal),plan_id:planId});
   const preflight=await one<{id:string}>(tx,'SELECT id FROM p07.preflights WHERE task_id=$1 AND operation_id=$2',[task.id,job.operation_id]);
   const report:Schema['PreflightReport']={preflight_id:preflight?.id??newId(),status:'SUCCEEDED',source_set_version:ctx.set!.version,goal_version:task.goal_version,
    processing_units:units.length,readability:ctx.sources.map(s=>{const scoped=out.units.filter(u=>u.source_id===s.id);return {source_id:s.id,
     status:scoped.every(u=>u.readability==='READABLE')?'READABLE':scoped.every(u=>u.readability==='UNREADABLE')?'UNREADABLE':'PARTIAL',limitations:[...new Set(scoped.flatMap(u=>u.limitations))]};}),
    coverage:analysis.coverage,limits:BUDGET,blocking_reasons:[],current_proposal_id:proposalId,session_id:session.id,analysis_scope:'FULL_SUBMITTED_SCOPE',batch_allowed:false};
   this.contracts.validate('PreflightReport',report,true);
   if(preflight)await tx.query("UPDATE p07.preflights SET status='SUCCEEDED',semantic_units_used=$2,report=$3 WHERE id=$1",[preflight.id,units.length,report]);
   else await insertRow(tx,'preflights',{id:report.preflight_id,owner_id:job.owner_id,task_id:task.id,source_set_id:ctx.set!.id,goal_version:task.goal_version,
    status:'SUCCEEDED',semantic_units_used:units.length,report,operation_id:job.operation_id,agent_session_id:session.id});
   await tx.query('UPDATE p07.tasks SET current_plan_id=$2,version=version+1,updated_at=now() WHERE id=$1',[task.id,planId]);
   await tx.query("UPDATE p07.agent_sessions SET status='WAITING_CONFIRMATION',idle_expires_at=now()+make_interval(secs=>$2) WHERE id=$1",[session.id,this.config.P07_AGENT_IDLE_SECONDS]);
   await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now() WHERE id=$1",[job.operation_id,{id:proposalId,kind:'PROPOSAL'}]);
  }));
 }
 private async finishTurn(job:Job,ctx:Context,elapsed:number,usage:unknown={},failed=false){await this.db.withOwner(job.owner_id,async tx=>{
  await assertFence(tx,job);
  await tx.query('UPDATE p07.agent_turns SET status=$2,usage=$3,finished_at=now() WHERE id=$1',[ctx.turnId,failed?'FAILED':'COMPLETED',usage??{}]);
  if(ctx.run){const budgetRoot=ctx.contract?.budget_contract_id??ctx.run.contract_id;
   const reserved=(await one<{compute_ms:number}>(tx,"SELECT compute_ms FROM p07.run_budget_events WHERE event_key=$1 AND contract_id=$2",['reserve:'+ctx.attemptId,budgetRoot]))!.compute_ms;
   await insertRow(tx,'run_budget_events',{id:newId(),owner_id:job.owner_id,contract_id:budgetRoot,run_id:ctx.run.id,attempt_id:ctx.attemptId,event_key:'release:'+ctx.attemptId,kind:'RELEASE',compute_ms:reserved});
   await insertRow(tx,'run_budget_events',{id:newId(),owner_id:job.owner_id,contract_id:budgetRoot,run_id:ctx.run.id,attempt_id:ctx.attemptId,event_key:'consume:'+ctx.attemptId,kind:'CONSUME',compute_ms:Math.min(elapsed,reserved),usage:usage??{}});
   await tx.query('UPDATE p07.stage_attempts SET status=$2,finished_at=now() WHERE id=$1',[ctx.attemptId,failed?'FAILED':'SUCCEEDED']);}
 });}
 private async done(job:Job){await this.db.withOwner(job.owner_id,tx=>this.locked(tx,job,async session=>{
  await tx.query("UPDATE p07.jobs SET status='DONE',lease_owner=NULL,lease_until=NULL WHERE id=$1",[job.id]);
  await tx.query('UPDATE p07.agent_sessions SET active_job_id=NULL WHERE id=$1 AND active_job_id=$2',[session.id,job.id]);}));}
 private async failed(job:Job,error:unknown){
  const code=error instanceof AppError?error.code:'PROCESSING_FAILED';
  if(code==='WORKER_FENCE_LOST')return;
  await this.db.withOwner(job.owner_id,tx=>this.locked(tx,job,async(session,task)=>{
   const completed=job.operation_id?await one<{status:string}>(tx,'SELECT status FROM p07.operations WHERE id=$1',[job.operation_id]):null;
   if(completed?.status==='SUCCEEDED'&&job.kind!=='CLEANUP'){
    await tx.query("UPDATE p07.jobs SET status='DONE',lease_owner=NULL,lease_until=NULL WHERE id=$1",[job.id]);return;
   }
   if(job.kind==='CLEANUP'){
    await tx.query("UPDATE p07.agent_sessions SET cleanup_status='FAILED' WHERE id=$1",[session.id]);
    await tx.query("UPDATE p07.runtime_cleanup_jobs SET status='FAILED',last_error_code=$2 WHERE session_id=$1",[session.id,code]);
    await tx.query(`UPDATE p07.jobs SET status=CASE WHEN attempts<100 THEN 'READY' ELSE 'DEAD' END,available_at=now()+interval '30 seconds',
     lease_owner=NULL,lease_until=NULL,last_error_code=$2 WHERE id=$1`,[job.id,code]);return;
   }
   // Durable publication can be retried without rerunning the Agent or charging again.
   if(session.status==='PERSISTING_RESULTS'&&job.attempts<3){await tx.query("UPDATE p07.jobs SET status='READY',available_at=now()+interval '3 seconds',lease_owner=NULL,lease_until=NULL,last_error_code=$2 WHERE id=$1",[job.id,code]);return;}
   if(!['CLOSED','RELEASING_RUNTIME','CANCELED','FAILED','INITIALIZATION_FAILED'].includes(session.status))
    await tx.query('UPDATE p07.agent_sessions SET status=$2 WHERE id=$1',[session.id,session.status==='INITIALIZING'?'INITIALIZATION_FAILED':
     ['READY_FOR_INPUT','WAITING_CONFIRMATION','QUOTABLE','AWAITING_PAYMENT'].includes(session.status)?'CANCELED':'FAILED']);
   if(job.run_id)await tx.query("UPDATE p07.runs SET execution_status='FAILED',finished_at=now(),version=version+1 WHERE id=$1 AND execution_status IN('QUEUED','RUNNING')",[job.run_id]);
   await tx.query("UPDATE p07.preflights SET status='FAILED',report='{}' WHERE operation_id=$1 AND status<>'SUCCEEDED'",[job.operation_id]);
   await tx.query("UPDATE p07.operations SET status='FAILED',error_code=$2,finished_at=now() WHERE id=$1 AND status='PENDING'",[job.operation_id,code]);
   await tx.query("UPDATE p07.jobs SET status='DEAD',lease_owner=NULL,lease_until=NULL,last_error_code=$2 WHERE id=$1",[job.id,code]);
   if(session.status!=='CLOSED')await cleanup(tx,job.owner_id,session);
  }));
  await this.refundUndelivered(job);
 }
 private async refundUndelivered(job:Job){await this.db.withOwner(job.owner_id,async tx=>{
  const session=await get<SessionRow>(tx,'agent_sessions',job.payload.session_id!);if(session.result_id||!session.task_id)return;
  const orders=(await tx.query<{id:string;provider:'ALIPAY'|'DOUYIN';app_alias:string}>(`SELECT o.id,o.provider,o.app_alias FROM p07.orders o JOIN p07.processing_contracts c ON c.id=o.contract_id AND c.owner_id=o.owner_id
   WHERE c.task_id=$1 AND o.payment_status='CONFIRMED' AND o.refunded_minor+o.refund_reserved_minor<o.amount_minor
   AND NOT EXISTS(SELECT 1 FROM p07.runs r WHERE r.contract_id=c.id AND r.execution_status IN('QUEUED','RUNNING'))`,[session.task_id])).rows;
  for(const order of orders)await this.commerce.requestRefund(tx,{owner:job.owner_id,identity:'',provider:order.provider,appAlias:order.app_alias},order.id,
   {reason:'本次会话未产出可领取的完整结果，退回原订单剩余金额。',operation_reference:newId()});
 });}
 async run(signal:AbortSignal,worker='worker-'+newId()):Promise<void>{
  let maintained=0;
  while(!signal.aborted){
   if(Date.now()-maintained>15_000){await this.maintain();maintained=Date.now();}
   const job=await this.claim(worker);if(job)await this.process(job,signal);else await delay(500,undefined,{signal}).catch(()=>undefined);
  }
 }
 async maintain():Promise<void>{
  const candidates=(await this.db.pool.query<{kind:string;owner_id:string;resource_id:string}>('SELECT * FROM p07.maintenance_candidates()')).rows;
  for(const candidate of candidates)await this.db.withOwner(candidate.owner_id,async tx=>{
   await enqueue(tx,candidate.owner_id,candidate.kind,`poll:${candidate.kind}:${candidate.resource_id}:${Math.floor(Date.now()/30_000)}`,
    candidate.kind==='PAYMENT_QUERY'?{order_id:candidate.resource_id}:{refund_id:candidate.resource_id});
  });
  const expired=(await this.db.pool.query<{owner_id:string;session_id:string}>('SELECT * FROM p07.expired_sessions(20)')).rows;
  for(const item of expired)await this.db.withOwner(item.owner_id,async tx=>{
   const initial=await get<SessionRow>(tx,'agent_sessions',item.session_id);if(initial.task_id)await get<TaskRow>(tx,'tasks',initial.task_id,true);
   const session=await get<SessionRow>(tx,'agent_sessions',item.session_id,true);
   if(!['READY_FOR_INPUT','INPUT_RECEIVED','WAITING_CONFIRMATION','QUOTABLE','AWAITING_PAYMENT'].includes(session.status)
    ||!session.idle_expires_at||session.idle_expires_at.getTime()>Date.now())return;
   await tx.query("UPDATE p07.agent_sessions SET status='CANCELED' WHERE id=$1",[session.id]);await cleanup(tx,item.owner_id,session);
  });
  const dead=(await this.db.pool.query<Job>('SELECT * FROM p07.reap_exhausted_jobs()')).rows;
  for(const job of dead){if(!job.payload.session_id)continue;await this.db.withOwner(job.owner_id,async tx=>{
   const initial=await get<SessionRow>(tx,'agent_sessions',job.payload.session_id!);if(initial.task_id)await get<TaskRow>(tx,'tasks',initial.task_id,true);
   const session=await get<SessionRow>(tx,'agent_sessions',initial.id,true);
   const stillDead=await one(tx,"SELECT id FROM p07.jobs WHERE id=$1 AND status='DEAD' AND fence=$2 FOR UPDATE",[job.id,job.fence]);if(!stillDead)return;
   if(job.kind==='CLEANUP'){
    await tx.query("UPDATE p07.agent_sessions SET cleanup_status='FAILED' WHERE id=$1",[session.id]);
    await tx.query("UPDATE p07.runtime_cleanup_jobs SET status='FAILED',last_error_code='LEASE_EXHAUSTED' WHERE session_id=$1",[session.id]);return;}
   if(['CLOSED','RELEASING_RUNTIME'].includes(session.status))return;
   if(!['CANCELED','FAILED','INITIALIZATION_FAILED'].includes(session.status))await tx.query('UPDATE p07.agent_sessions SET status=$2 WHERE id=$1',
    [session.id,session.status==='INITIALIZING'?'INITIALIZATION_FAILED':['ANALYZING','BATCH_QUEUED','BATCH_RUNNING','PERSISTING_RESULTS','INPUT_RECEIVED'].includes(session.status)?'FAILED':'CANCELED']);
   if(session.run_id)await tx.query("UPDATE p07.runs SET execution_status='FAILED',finished_at=now() WHERE id=$1 AND execution_status IN('QUEUED','RUNNING')",[session.run_id]);
   await tx.query("UPDATE p07.operations SET status='FAILED',error_code='LEASE_EXHAUSTED',finished_at=now() WHERE id=$1 AND status='PENDING'",[job.operation_id]);
   await cleanup(tx,job.owner_id,session);
  });}
 }
}
