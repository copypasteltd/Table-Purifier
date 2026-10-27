import type { Transaction } from '../db/database.js';
import { insertRow,one } from '../db/database.js';
import { cleanup,enqueue,operation } from '../db/queue.js';
import type { Config } from '../shared/config.js';
import { validateSchema } from '../validation/schema.js';
import { applySchemaPatch } from '../validation/schema-patch.js';
import type { Body,Schema } from '../shared/contracts.js';
import { contentHash,hmac,newId,opaquePayload,sha256 } from '../shared/crypto.js';
import { assertVersion,invariant,notFound } from '../shared/errors.js';
import { assertReadyInput } from '../shared/lifecycle.js';
import { LocalStore } from '../storage/local-store.js';
import { action,BUDGET,EMPTY_COVERAGE,get,iso,operationView,planView,sessionView,sourceView,
 type Actor,type BindingRow,type ContractRow,type OperationRow,type PlanRow,type ProposalRow,type SessionRow,type SourceRow,type SourceSetRow,type TaskRow } from './models.js';

export interface RuntimeRelease {enabled:boolean;skillReleaseId:string;skillHash:string;profileId:string;}
export class TaskService {
  constructor(readonly config:Config,readonly store:LocalStore,readonly runtime:RuntimeRelease){}
  async session(tx:Transaction,actor:Actor,body:Body<'54'>){
    invariant(this.runtime.enabled,'AGENT_NOT_CONFIGURED','会话服务尚未配置专用模型和原生隔离环境。',503);
    invariant(body.skill_release_id===this.runtime.skillReleaseId,'SKILL_RELEASE_UNAVAILABLE','所选业务技能版本不可用。',409);
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.owner+':new-session']);
    const same=await one<SessionRow>(tx,'SELECT * FROM p07.agent_sessions WHERE client_request_id=$1',[body.client_request_id]);
    if(same){invariant(same.status==='INITIALIZING','SESSION_ALREADY_CREATED','会话已创建，请读取会话状态。');
      return {session_id:same.id,status:'INITIALIZING' as const,operation_id:same.operation_id};}
    const active=await one<{n:number}>(tx,"SELECT count(*)::integer n FROM p07.agent_sessions WHERE status NOT IN ('CLOSED','FAILED','CANCELED','INITIALIZATION_FAILED')");
    invariant(active!.n<2,'ACTIVE_SESSION_LIMIT','请先完成或关闭已有整理会话。',429);
    const session=newId(),workspace=newId(),op=await operation(tx,actor.owner,'BOOTSTRAP');
    await insertRow(tx,'agent_workspaces',{id:workspace,owner_id:actor.owner,operation_id:op,workspace_ref:'sessions/'+session,
      permission_profile_ref:this.runtime.profileId,status:'PREPARING'});
    await insertRow(tx,'agent_sessions',{id:session,owner_id:actor.owner,operation_id:op,workspace_id:workspace,
      runtime_profile_id:this.runtime.profileId,versions:{business:'3.2',development:'3.0.0'},status:'INITIALIZING',
      skill_manifest_sha256:this.runtime.skillHash,client_request_id:body.client_request_id,
      idle_expires_at:new Date(Date.now()+this.config.P07_AGENT_IDLE_SECONDS*1000)});
    await enqueue(tx,actor.owner,'BOOTSTRAP','bootstrap:'+session,{session_id:session},op);
    return {session_id:session,status:'INITIALIZING' as const,operation_id:op};
  }
  async readSession(tx:Transaction,id:string){return sessionView(await get<SessionRow>(tx,'agent_sessions',id));}
  async closeSession(tx:Transaction,actor:Actor,id:string,body:Body<'56'>){
    const snapshot=await get<SessionRow>(tx,'agent_sessions',id);
    if(snapshot.task_id)await get<TaskRow>(tx,'tasks',snapshot.task_id,true);
    const session=await get<SessionRow>(tx,'agent_sessions',id,true);assertVersion(session.version,body.expected_version);
    if(session.status==='CLOSED'){const completed=await one<{operation_id:string}>(tx,'SELECT operation_id FROM p07.runtime_cleanup_jobs WHERE session_id=$1',[session.id]);return {operation_id:completed?.operation_id??session.operation_id,cleanup_status:session.cleanup_status,result_files_preserved:true as const};}
    if(session.status!=='RELEASING_RUNTIME'&&!['FAILED','INITIALIZATION_FAILED','CANCELED'].includes(session.status))
      await tx.query("UPDATE p07.agent_sessions SET status='CANCELED' WHERE id=$1",[id]);
    if(session.run_id)await tx.query(`UPDATE p07.runs SET cancel_requested_at=now(),execution_status=CASE WHEN execution_status IN ('QUEUED','RUNNING')
      THEN 'CANCELED' ELSE execution_status END,version=version+1 WHERE id=$1`,[session.run_id]);
    const op=await cleanup(tx,actor.owner,session);
    return {operation_id:op,cleanup_status:'PENDING' as const,result_files_preserved:true as const};
  }
  async create(tx:Transaction,actor:Actor,body:Body<'03'>){
    const session=await get<SessionRow>(tx,'agent_sessions',body.agent_session_id,true);
    assertReadyInput(session.status,session.preload_receipt,session.skill_manifest_sha256);
    invariant(session.task_id===null&&session.status==='READY_FOR_INPUT','SESSION_ALREADY_USED','此会话已关联整理任务。');
    const id=newId();await insertRow(tx,'tasks',{id,owner_id:actor.owner,mode:body.mode,goal:body.optional_goal??null,agent_session_id:session.id});
    await tx.query("UPDATE p07.agent_sessions SET task_id=$2,status='INPUT_RECEIVED' WHERE id=$1",[session.id,id]);
    const task=await get<TaskRow>(tx,'tasks',id,true);
    const revision=await one<{id:string;batch_id:string|null;parent_result_id:string;billing_class:string}>(tx,'SELECT * FROM p07.revision_intents WHERE session_id=$1',[session.id]);
    if(revision){
      invariant(revision.batch_id||revision.billing_class==='PLATFORM_CORRECTION','DECISIONS_NOT_CONFIRMED','请先在新会话中预览并确认调整决定。',409);
      const parent=await one<{binding_id:string;deleted_at:Date|null}>(tx,'SELECT v.binding_id,t.deleted_at FROM p07.result_versions v JOIN p07.tasks t ON t.id=v.task_id WHERE v.id=$1',[revision.parent_result_id]);
      invariant(parent&&!parent.deleted_at,'PARENT_RESULT_UNAVAILABLE','父结果已被删除，无法作为新资料。',410);
      const files=(await tx.query<{name:string;object_key:string;sha256:string;byte_count:number;media_type:string}>(`SELECT a.* FROM p07.artifacts a JOIN p07.artifact_sets s ON s.id=a.artifact_set_id
        WHERE s.result_id=$1 AND s.status='READY' AND s.revoked_at IS NULL AND a.name IN('result.json','provenance.jsonl') ORDER BY a.name`,[revision.parent_result_id])).rows;
      invariant(files.length===2&&files.every(f=>f.byte_count<=20_000_000),'PARENT_RESULT_REINPUT_REQUIRED','父结果不可直接导入，请在新会话重新提供需要整理的资料。',409);
      for(const [index,file]of files.entries()){
        const bytes=await this.store.read(file.object_key);invariant(sha256(bytes)===file.sha256,'PARENT_RESULT_HASH_MISMATCH','父结果完整性校验失败。',503);
        const sourceId=newId(),key=`sessions/${session.id}/inputs/source/${sourceId}.txt`;await this.store.write(key,bytes,20_000_000);
        await insertRow(tx,'source_files',{id:sourceId,owner_id:actor.owner,session_id:session.id,role:'SOURCE',kind:'FILE',display_name:'父结果-'+file.name,
          media_type:'text/plain',byte_count:bytes.length,content_sha256:file.sha256,object_key:key,status:'RECEIVED',expires_at:session.idle_expires_at});
        await insertRow(tx,'task_source_links',{id:newId(),owner_id:actor.owner,task_id:id,source_id:sourceId,role:'SOURCE',ordinal:index});
      }
      if(body.mode==='PROVIDED'){const binding=await get<BindingRow>(tx,'schema_bindings',parent.binding_id);await tx.query('UPDATE p07.tasks SET standard_definition=$2 WHERE id=$1',[id,binding.content]);}
      await tx.query("UPDATE p07.revision_intents SET task_id=$2,status='INPUT_READY' WHERE id=$1",[revision.id,id]);
    }
    await this.newSourceSet(tx,actor,task);
    return this.view(tx,id);
  }
  async editable(tx:Transaction,id:string,expected?:number):Promise<{task:TaskRow;session:SessionRow}>{
    const task=await get<TaskRow>(tx,'tasks',id,true);if(task.deleted_at)notFound();
    // Keep one lock order across input/confirm/run/close and worker mutations: task, then session.
    const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);
    assertReadyInput(session.status,session.preload_receipt,session.skill_manifest_sha256);
    if(expected!==undefined)assertVersion(task.version,expected);
    return {task,session};
  }
  async sources(tx:Transaction,taskId:string):Promise<SourceRow[]>{return (await tx.query<SourceRow>(`SELECT s.* FROM p07.task_source_links l
    JOIN p07.source_files s ON s.id=l.source_id AND s.owner_id=l.owner_id WHERE l.task_id=$1 AND l.removed_at IS NULL ORDER BY l.ordinal,l.id`,[taskId])).rows;}
  async newSourceSet(tx:Transaction,actor:Actor,task:TaskRow):Promise<SourceSetRow>{
    const sources=await this.sources(tx,task.id);const previous=task.current_source_set_id?await get<SourceSetRow>(tx,'source_sets',task.current_source_set_id):null;
    const summary=sources.map((s,index)=>({source_id:s.id,role:s.role,sha256:s.content_sha256,bytes:s.byte_count,ordinal:index}));
    const id=newId(),version=(previous?.version??0)+1,hash=contentHash(summary);
    await insertRow(tx,'source_sets',{id,owner_id:actor.owner,task_id:task.id,version,content_sha256:hash,unitizer_version:'p07-agent-tools-1',scope_summary:{sources:summary}});
    for(const [index,s] of sources.entries())await insertRow(tx,'source_set_items',{id:newId(),owner_id:actor.owner,source_set_id:id,source_id:s.id,
      role:s.role,ordinal:index,included:true,source_sha256:s.content_sha256});
    await tx.query("UPDATE p07.execution_plans SET status='SUPERSEDED' WHERE task_id=$1 AND status<>'SUPERSEDED'",[task.id]);
    await tx.query('UPDATE p07.tasks SET current_source_set_id=$2,current_plan_id=NULL,version=version+1,updated_at=now() WHERE id=$1',[task.id,id]);
    // Input edits invalidate confirmation. ANALYZE is scheduled explicitly by preflight, never by a file upload.
    return {id,task_id:task.id,version,content_sha256:hash,scope_summary:{sources:summary}};
  }
  async addSource(tx:Transaction,actor:Actor,id:string,body:Body<'06'>){
    const {task,session}=await this.editable(tx,id,body.expected_task_version);let source:SourceRow;
    if(body.text!==undefined){
      invariant(Array.from(body.text).length<=50_000,'LIMIT_EXCEEDED','文字不得超过五万字。',413);
      const budget=await one<{n:number;bytes:number;points:number}>(tx,`SELECT count(*) FILTER(WHERE role='SOURCE')::integer n,coalesce(sum(byte_count),0)::bigint bytes,
        coalesce(sum(coalesce((measurement->>'text_codepoints')::bigint,0)),0)::bigint points FROM p07.source_files WHERE session_id=$1 AND deleted_at IS NULL`,[session.id]);
      invariant(budget&&budget.n<10&&budget.bytes+Buffer.byteLength(body.text)<=50_000_000&&budget.points+Array.from(body.text).length<=50_000,
        'LIMIT_EXCEEDED','本次会话的资料或文字预算已用完，请关闭后新建会话。',413);
      const sourceId=newId(),data=Buffer.from(body.text),key=`sessions/${session.id}/inputs/source/${sourceId}.txt`;
      await this.store.write(key,data);
      await insertRow(tx,'source_files',{id:sourceId,owner_id:actor.owner,session_id:session.id,role:'SOURCE',kind:'TEXT',display_name:'粘贴资料.txt',
        media_type:'text/plain',byte_count:data.length,content_sha256:sha256(data),object_key:key,status:'RECEIVED',expires_at:session.idle_expires_at,measurement:{text_codepoints:Array.from(body.text).length}});
      source=await get(tx,'source_files',sourceId);
    }else source=await get(tx,'source_files',body.source_id!);
    invariant(source.session_id===session.id&&source.role==='SOURCE'&&source.deleted_at===null,'SOURCE_SCOPE_MISMATCH','资料不属于本次会话。',403);
    const existing=await this.sources(tx,id);
    invariant(!existing.some(s=>s.content_sha256===source.content_sha256&&s.role==='SOURCE'),'DUPLICATE_SOURCE','此资料已添加，无需重复提交。');
    invariant(existing.filter(s=>s.role==='SOURCE').length<10&&existing.reduce((a,s)=>a+s.byte_count,0)+source.byte_count<=50_000_000,
      'LIMIT_EXCEEDED','本次资料数量或总大小超过限制。',413);
    await insertRow(tx,'task_source_links',{id:newId(),owner_id:actor.owner,task_id:id,source_id:source.id,role:'SOURCE',ordinal:existing.length});
    const set=await this.newSourceSet(tx,actor,task);const updated=await get<TaskRow>(tx,'tasks',id);
    return {source_set_version:set.version,task_version:updated.version,received_source:sourceView(source)};
  }
  async removeSource(tx:Transaction,actor:Actor,id:string,sourceId:string,expected:number){
    const {task}=await this.editable(tx,id,expected);
    const removed=await tx.query('UPDATE p07.task_source_links SET removed_at=now() WHERE task_id=$1 AND source_id=$2 AND removed_at IS NULL RETURNING id',[id,sourceId]);
    if(!removed.rowCount)notFound();const set=await this.newSourceSet(tx,actor,task);
    return {task_version:(await get<TaskRow>(tx,'tasks',id)).version,source_set_version:set.version,removed_source_id:sourceId};
  }
  async standard(tx:Transaction,actor:Actor,id:string,body:Body<'07'>){
    const {task,session}=await this.editable(tx,id,body.expected_task_version);let schema:Schema['SchemaDefinition']|null=null;
    let reference:TaskRow['standard_reference']=null;
    await tx.query("UPDATE p07.task_source_links SET removed_at=now() WHERE task_id=$1 AND role='TEMPLATE' AND removed_at IS NULL",[id]);
    if(body.fields_schema){schema=body.fields_schema;}
    else if(body.private_template_version_id){
      const row=await one<{content:Schema['SchemaDefinition'];id:string}>(tx,`SELECT v.* FROM p07.private_template_versions v JOIN p07.private_templates t
        ON t.id=v.template_id AND t.owner_id=v.owner_id WHERE v.id=$1 AND t.deleted_at IS NULL`,[body.private_template_version_id]);
      if(!row)notFound();schema=row.content;reference={template_version_id:row.id};
    }else{
      const source=await get<SourceRow>(tx,'source_files',body.template_source_id!);
      invariant(source.session_id===session.id&&source.role==='TEMPLATE'&&source.byte_count<=5_000_000,'TEMPLATE_SCOPE_MISMATCH','请选择本会话的规范文件。',403);
      reference={source_id:source.id};
      await tx.query("UPDATE p07.task_source_links SET removed_at=now() WHERE task_id=$1 AND role='TEMPLATE'",[id]);
      await tx.query(`INSERT INTO p07.task_source_links(id,owner_id,task_id,source_id,role,ordinal) VALUES($1,$2,$3,$4,'TEMPLATE',10)
        ON CONFLICT(task_id,source_id,role) DO UPDATE SET removed_at=NULL`,[newId(),actor.owner,id,source.id]);
    }
    if(schema)validateSchema(schema);
    await tx.query('UPDATE p07.tasks SET standard_definition=$2,standard_reference=$3 WHERE id=$1',[id,schema,reference]);
    await this.newSourceSet(tx,actor,task);
    return {draft_id:task.id,version:(await get<TaskRow>(tx,'tasks',id)).version,schema,clarifications:schema?[]:['Agent 将完整读取规范文件后生成字段定义供你确认。'],status:schema?'FULL_DRAFT' as const:'PARTIAL_DRAFT' as const};
  }
  async readStandard(tx:Transaction,id:string){const task=await get<TaskRow>(tx,'tasks',id);if(task.deleted_at)notFound();
    return {draft_id:id,version:task.version,schema:task.standard_definition,clarifications:[],status:task.standard_definition?'FULL_DRAFT' as const:'PARTIAL_DRAFT' as const};}
  async analyze(tx:Transaction,actor:Actor,id:string,body:Body<'09'>){
    const task=await get<TaskRow>(tx,'tasks',id,true);const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);
    invariant(task.agent_session_id===body.agent_session_id&&!task.deleted_at,'SESSION_SCOPE_MISMATCH','会话与任务不匹配。',403);
    await this.processingConsent(tx);
    invariant(['INPUT_RECEIVED','WAITING_CONFIRMATION','QUOTABLE'].includes(session.status),'INVALID_SESSION_PHASE','当前不能重新分析资料。');
    const set=await get<SourceSetRow>(tx,'source_sets',task.current_source_set_id!);
    assertVersion(set.version,body.source_set_version);assertVersion(task.goal_version,body.goal_version);
    const sources=await this.sources(tx,id);invariant(sources.some(s=>s.role==='SOURCE'),'SOURCE_REQUIRED','请先提交需要整理的资料。',400);
    invariant(task.mode!=='PROVIDED'||task.standard_definition||task.standard_reference,'STANDARD_REQUIRED','请提供规范表或改用推荐规范模式。',400);
    invariant(session.adjustment_rounds<this.config.P07_AGENT_ADJUSTMENT_ROUNDS,'ANALYSIS_BUDGET_EXCEEDED','已达到本次会话的分析调整次数。',429);
    const op=await operation(tx,actor.owner,'ANALYZE',id);
    await tx.query("UPDATE p07.execution_plans SET status='SUPERSEDED' WHERE task_id=$1 AND status<>'SUPERSEDED'",[id]);
    await tx.query('UPDATE p07.tasks SET current_plan_id=NULL WHERE id=$1',[id]);
    await insertRow(tx,'preflights',{id:newId(),owner_id:actor.owner,task_id:id,source_set_id:set.id,goal_version:task.goal_version,
      status:'PENDING',operation_id:op,agent_session_id:session.id});
    await tx.query("UPDATE p07.agent_sessions SET status='ANALYZING',adjustment_rounds=adjustment_rounds+1 WHERE id=$1",[session.id]);
    await enqueue(tx,actor.owner,'ANALYZE','analyze:'+op,{session_id:session.id},op);
    return {operation_id:op,session_id:session.id,analysis_scope:'FULL_SUBMITTED_SCOPE' as const,batch_allowed:false as const};
  }
  async proposal(tx:Transaction,id:string){const task=await get<TaskRow>(tx,'tasks',id);if(task.deleted_at)notFound();
    const row=await one<ProposalRow>(tx,'SELECT * FROM p07.schema_proposals WHERE task_id=$1 AND source_set_id=$2 ORDER BY version DESC LIMIT 1',[id,task.current_source_set_id]);
    if(!row)notFound();return row.content;}
  async revise(tx:Transaction,actor:Actor,id:string,body:Body<'19'>){
    const {task,session}=await this.editable(tx,id);
    await this.processingConsent(tx);
    invariant(['WAITING_CONFIRMATION','QUOTABLE'].includes(session.status),'INVALID_SESSION_PHASE','请先等待资料分析完成。');
    const current=await one<ProposalRow>(tx,'SELECT * FROM p07.schema_proposals WHERE task_id=$1 ORDER BY version DESC LIMIT 1',[id]);
    if(!current)notFound();assertVersion(current.version,body.expected_proposal_version);
    invariant(session.adjustment_rounds<this.config.P07_AGENT_ADJUSTMENT_ROUNDS,'ANALYSIS_BUDGET_EXCEEDED','已达到本次会话的分析调整次数。',429);
    const op=await operation(tx,actor.owner,'ADJUST',id);
    const requested=body.patch?applySchemaPatch(current.content.schema,body.patch):null;
    await this.store.write(`sessions/${session.id}/control/adjust-${op}.json`,Buffer.from(JSON.stringify({...body,...(requested?{requested_schema:requested}:{})})));
    await tx.query("UPDATE p07.execution_plans SET status='SUPERSEDED' WHERE task_id=$1 AND status<>'SUPERSEDED'",[id]);
    await tx.query('UPDATE p07.tasks SET current_plan_id=NULL,version=version+1,updated_at=now() WHERE id=$1',[id]);
    await tx.query("UPDATE p07.agent_sessions SET status='ANALYZING',adjustment_rounds=adjustment_rounds+1 WHERE id=$1",[session.id]);
    await enqueue(tx,actor.owner,'ADJUST','adjust:'+op,{session_id:session.id},op);
    return {operation:operationView(await get<OperationRow>(tx,'operations',op)),proposal_id:current.id};
  }
  async adopt(tx:Transaction,actor:Actor,id:string,body:Body<'20'>){
    const {task,session}=await this.editable(tx,id);invariant(session.id===body.session_id&&session.status==='WAITING_CONFIRMATION','INVALID_SESSION_PHASE','请先完成本次资料分析。');
    const set=await get<SourceSetRow>(tx,'source_sets',task.current_source_set_id!);assertVersion(set.version,body.expected_source_set_version);
    assertVersion(task.goal_version,body.expected_goal_version);
    const proposal=await one<ProposalRow>(tx,'SELECT * FROM p07.schema_proposals WHERE task_id=$1 AND plan_id=$2 ORDER BY version DESC LIMIT 1',[id,task.current_plan_id]);
    if(!proposal)notFound();assertVersion(proposal.version,body.expected_proposal_version);
    const schema=proposal.content.schema,binding=newId(),hash=contentHash(schema);
    await insertRow(tx,'schema_bindings',{id:binding,owner_id:actor.owner,task_id:id,source_set_id:set.id,proposal_id:proposal.id,
      proposal_version:proposal.version,goal_version:task.goal_version,content:schema,content_sha256:hash,adopted_at:new Date()});
    await tx.query('UPDATE p07.execution_plans SET binding_id=$2 WHERE id=$1 AND status=\'DRAFT\'',[task.current_plan_id,binding]);
    return {binding_id:binding,schema_version:schema.version,session_id:session.id,batch_started:false as const};
  }
  async confirm(tx:Transaction,actor:Actor,id:string,body:Body<'10'>){
    const {task,session}=await this.editable(tx,id);invariant(session.id===body.session_id&&session.status==='WAITING_CONFIRMATION','INVALID_SESSION_PHASE','请确认当前分析方案。');
    assertVersion(task.version,body.expected_versions.task_version);assertVersion(task.goal_version,body.expected_versions.goal_version);
    const set=await get<SourceSetRow>(tx,'source_sets',task.current_source_set_id!);assertVersion(set.version,body.expected_versions.source_set_version);
    const plan=await get<PlanRow>(tx,'execution_plans',body.plan_id,true),binding=await get<BindingRow>(tx,'schema_bindings',body.binding_id);
    invariant(plan.id===task.current_plan_id&&plan.task_id===id&&plan.status==='DRAFT'&&plan.plan_sha256===body.plan_hash
      &&plan.source_set_id===set.id&&plan.binding_id===binding.id&&binding.source_set_id===set.id&&binding.goal_version===task.goal_version,
    'PLAN_STALE','资料、规范或方案已经变化，请重新确认。');assertVersion(plan.version,body.plan_version);
    const consent=await one(tx,`SELECT c.id FROM p07.consents c JOIN p07.privacy_policies p ON p.id=c.policy_id
      WHERE c.id=$1 AND c.action='GRANT' AND c.scope='PROCESS_DATA' AND p.policy_version=$2
      AND NOT EXISTS(SELECT 1 FROM p07.consents newer WHERE newer.owner_id=c.owner_id AND newer.scope=c.scope AND newer.effective_at>c.effective_at AND newer.action='WITHDRAW')`,
    [body.policy_consent_id,this.config.P07_POLICY_VERSION]);invariant(consent,'CONSENT_REQUIRED','请先确认资料处理说明。',403);
    await tx.query("UPDATE p07.execution_plans SET status='CONFIRMED',confirmed_at=now() WHERE id=$1",[plan.id]);
    const policy=this.policy(),contractId=newId();
    const correctionBudget=await one<{budget_contract_id:string}>(tx,`SELECT o.contract_id budget_contract_id FROM p07.revision_intents ri
      JOIN p07.runs r ON r.id=ri.parent_run_id JOIN p07.entitlement_grants g ON g.id=r.grant_id JOIN p07.orders o ON o.id=g.order_id
      WHERE ri.task_id=$1 AND ri.billing_class='PLATFORM_CORRECTION' AND g.kind='PAID'`,[id]);
    const contractHash=contentHash({task_id:id,source_set_sha256:set.content_sha256,goal_version:task.goal_version,binding_sha256:binding.content_sha256,
      plan_sha256:plan.plan_sha256,skill_sha256:session.skill_manifest_sha256,policy,budget:BUDGET,budget_contract_id:correctionBudget?.budget_contract_id??null});
    const version=(await one<{n:number}>(tx,'SELECT coalesce(max(version),0)+1 n FROM p07.processing_contracts WHERE task_id=$1',[id]))!.n;
    await insertRow(tx,'processing_contracts',{id:contractId,owner_id:actor.owner,task_id:id,version,source_set_id:set.id,goal_version:task.goal_version,
      mode:task.mode,schema_binding_id:binding.id,contract_sha256:contractHash,policy_snapshot:policy,budget_snapshot:BUDGET,
      confirmed_at:new Date(),confirmed_plan_id:plan.id,budget_contract_id:correctionBudget?.budget_contract_id??null});
    await tx.query("UPDATE p07.agent_sessions SET status='QUOTABLE',contract_sha256=$2,binding_sha256=$3 WHERE id=$1",[session.id,contractHash,binding.content_sha256]);
    const confirmed=planView({...plan,status:'CONFIRMED'},binding.content_sha256);
    return {contract_id:contractId,contract_hash:contractHash,confirmed_plan:confirmed};
  }
  policy():Schema['PolicySnapshot']{return {policy_id:this.config.P07_POLICY_VERSION,runtime_cleanup:'AFTER_DURABLE_RESULT_PUBLISH',
    result_retention:'PERSIST_UNTIL_OWNER_REQUEST',result_auto_delete:false,delivery_summary:'完整九文件及可追溯结果；最终结果持续保留，任务环境整体销毁。',
    refund_summary:'失败按原订单核验退款；支付状态未知先查单，不重复支付。',approved_sku_id:null,effective_at:'2026-10-27T00:00:00.000Z'};}
  async processingConsent(tx:Transaction):Promise<void>{
    const consent=await one(tx,`SELECT c.id FROM p07.consents c JOIN p07.privacy_policies p ON p.id=c.policy_id
      WHERE c.scope='PROCESS_DATA' AND c.action='GRANT' AND p.policy_version=$1 AND NOT EXISTS(
       SELECT 1 FROM p07.consents n WHERE n.scope=c.scope AND n.effective_at>c.effective_at AND n.action='WITHDRAW') LIMIT 1`,[this.config.P07_POLICY_VERSION]);
    invariant(consent,'CONSENT_REQUIRED','请先确认资料处理说明，再开始分析。',403);
  }
  async view(tx:Transaction,id:string):Promise<Schema['Task']>{
    const task=await get<TaskRow>(tx,'tasks',id);if(task.deleted_at)notFound();const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id);
    const set=task.current_source_set_id?await get<SourceSetRow>(tx,'source_sets',task.current_source_set_id):null;
    const report=await one<{report:Schema['PreflightReport']}>(tx,"SELECT report FROM p07.preflights WHERE task_id=$1 AND status='SUCCEEDED' AND source_set_id=$2 AND report ? 'preflight_id' ORDER BY created_at DESC LIMIT 1",[id,set?.id]);
    const result=task.current_result_id?await one<{version:number}>(tx,'SELECT version FROM p07.result_versions WHERE id=$1',[task.current_result_id]):null;
    const editable=['INPUT_RECEIVED','WAITING_CONFIRMATION','QUOTABLE'].includes(session.status);
    return {task_id:id,version:task.version,mode:task.mode,goal:task.goal,goal_version:task.goal_version,source_set_version:set?.version??1,
      current_run_id:task.current_run_id,current_result_version:result?.version??null,latest_preflight:report?.report??null,
      sources:(await this.sources(tx,id)).map(sourceView),allowed_actions:[action('ADD_SOURCE','添加资料',editable),
        action('ANALYZE','分析资料',editable),action('CONFIRM_PLAN','确认方案',session.status==='WAITING_CONFIRMATION'),
        action('QUOTE','查看费用',session.status==='QUOTABLE'&&!!task.current_plan_id),action('VIEW_RESULT','查看结果',!!result)],
      updated_at:task.updated_at.toISOString(),agent_session_id:task.agent_session_id};
  }
}
