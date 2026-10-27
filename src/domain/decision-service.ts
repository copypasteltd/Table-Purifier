import type { Transaction } from '../db/database.js';
import { insertRow,one } from '../db/database.js';
import type { Body,Schema } from '../shared/contracts.js';
import { contentHash,newId } from '../shared/crypto.js';
import { invariant,notFound } from '../shared/errors.js';
import { validateValue } from '../validation/schema.js';
import { assertReadyInput } from '../shared/lifecycle.js';
import { get,operationView,type Actor,type BindingRow,type OperationRow,type PlanRow,type RunRow,type SessionRow,type TaskRow } from './models.js';
import type { TaskService } from './task-service.js';
import type { ResultService } from './result-service.js';
import type { CommerceService } from './commerce-service.js';

interface Preview {id:string;session_id:string;run_id:string;result_id:string;expected_result_version:number;preview_sha256:string;decisions:Schema['Decision'][];scope:Body<'24'>['scope'];expires_at:Date;}
export class DecisionService {
 constructor(readonly tasks:TaskService,readonly results:ResultService,readonly commerce:CommerceService){}
 async prepare(tx:Transaction,actor:Actor,id:string,body:Body<'54'>){
  const result=await this.results.result(tx,id);await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.owner+':rework:'+id]);
  const pending=await one<SessionRow>(tx,`SELECT s.* FROM p07.revision_intents r JOIN p07.agent_sessions s ON s.id=r.session_id
   WHERE r.parent_run_id=$1 AND r.parent_result_id=$2 AND r.billing_class='USER_REVISION' AND r.batch_id IS NULL AND s.status IN('INITIALIZING','READY_FOR_INPUT') ORDER BY r.created_at DESC LIMIT 1`,[id,result.id]);
  if(pending)return {session_id:pending.id,status:pending.status,operation_id:pending.operation_id};
  const session=await this.tasks.session(tx,actor,body);
  await insertRow(tx,'revision_intents',{id:newId(),owner_id:actor.owner,parent_run_id:id,parent_result_id:result.id,session_id:session.session_id});return session;
 }
 async preview(tx:Transaction,actor:Actor,id:string,body:Body<'24'>):Promise<Schema['Data24']>{
  const result=await this.results.result(tx,id,body.expected_result_version),binding=await get<BindingRow>(tx,'schema_bindings',result.binding_id);
  const session=await one<SessionRow>(tx,`SELECT s.* FROM p07.revision_intents r JOIN p07.agent_sessions s ON s.id=r.session_id
   WHERE r.parent_run_id=$1 AND r.parent_result_id=$2 AND r.billing_class='USER_REVISION' AND r.batch_id IS NULL AND s.status='READY_FOR_INPUT' ORDER BY r.created_at DESC LIMIT 1 FOR UPDATE OF s`,[id,result.id]);
  invariant(session,'REWORK_SESSION_REQUIRED','请先新建调整会话，并等待完整技能加载。',409);assertReadyInput(session.status,session.preload_receipt,session.skill_manifest_sha256);
  const targets=new Set(body.scope.target_record_ids),issues=new Set<string>();invariant(targets.size===body.scope.target_record_ids.length,'DECISION_SCOPE_INVALID','目标记录不能重复。',400);
  const affected=new Set<string>(),fields=new Set<string>();
  for(const decision of body.decisions){
   invariant(!issues.has(decision.issue_id)&&targets.has(decision.record_id),'DECISION_SCOPE_INVALID','决定必须对应已选择的唯一问题和记录。',400);issues.add(decision.issue_id);
   const issue=await one<{record_id:string|null;field_id:string|null;allowed_decisions:string[];details:{evidence_ids:string[]}}>(tx,'SELECT * FROM p07.issues WHERE id=$1 AND result_id=$2',[decision.issue_id,result.id]);
   invariant(issue&&issue.record_id===decision.record_id&&issue.field_id===decision.field_id&&issue.allowed_decisions.includes(decision.action),'DECISION_NOT_ALLOWED','当前问题不支持此决定。',409);
   const field=binding.content.fields.find(f=>f.field_id===decision.field_id);invariant(field,'DECISION_FIELD_INVALID','所选字段不在规范中。',400);
   if(decision.action==='USER_VALUE')validateValue(field,decision.user_value!);
   if(decision.action==='CHOOSE_EVIDENCE')invariant(issue.details.evidence_ids.includes(decision.evidence_id!)&&await one(tx,'SELECT id FROM p07.evidence WHERE id=$1 AND run_id=$2',[decision.evidence_id,id]),'DECISION_EVIDENCE_INVALID','只能选择该问题关联的来源证据。',400);
   affected.add(decision.record_id);fields.add(decision.field_id);
  }
  invariant([...targets].every(t=>affected.has(t)),'DECISION_SCOPE_INVALID','目标范围中存在未关联决定的记录。',400);
  const impact:Schema['ChangePreview']={changed_field_ids:[...fields].sort(),affected_record_ids:[...affected].sort(),unmapped_important:[],new_issues:['修改后的数据仍需完整分析和独立验收。'],requires_recompute:true};
  const previewId=newId(),expires=new Date(Date.now()+900_000),hash=contentHash({run_id:id,result_id:result.id,result_version:result.version,decisions:body.decisions,scope:body.scope,impact});
  if(body.scope.predicate_hash)invariant(body.scope.predicate_hash===contentHash([...targets].sort()),'DECISION_SCOPE_STALE','筛选范围摘要已变化。',409);
  await insertRow(tx,'decision_previews',{id:previewId,owner_id:actor.owner,session_id:session.id,run_id:id,result_id:result.id,expected_result_version:result.version,preview_sha256:hash,decisions:JSON.stringify(body.decisions),scope:body.scope,impact,expires_at:expires});
  return {preview_id:previewId,preview_hash:hash,expires_at:expires.toISOString(),affected_records:affected.size,exceptions:[],impact,will_reserve_rounds:0,billing_class:'USER_REVISION'};
 }
 async submit(tx:Transaction,actor:Actor,id:string,body:Body<'25'>):Promise<Schema['Data25']>{
  const result=await this.results.result(tx,id,body.expected_result_version),preview=await get<Preview>(tx,'decision_previews',body.preview_id,true);
  invariant(preview.run_id===id&&preview.result_id===result.id&&preview.expected_result_version===result.version&&preview.preview_sha256===body.preview_hash&&preview.expires_at.getTime()>Date.now(),
   'DECISION_PREVIEW_STALE','决定预览已失效，请重新检查影响。');
  const old=await one<{id:string;session_id:string}>(tx,'SELECT id,session_id FROM p07.revision_intents WHERE batch_id IN(SELECT id FROM p07.decision_batches WHERE preview_id=$1)',[preview.id]);
  if(old){const session=await get<SessionRow>(tx,'agent_sessions',old.session_id);return {operation_id:session.operation_id,new_session_id:session.id,revision_intent_id:old.id,requires_seven_step_flow:true};}
  const session=await get<SessionRow>(tx,'agent_sessions',preview.session_id,true);assertReadyInput(session.status,session.preload_receipt,session.skill_manifest_sha256);
  invariant(session.status==='READY_FOR_INPUT','REWORK_SESSION_REQUIRED','该调整会话已经接收其他任务，请重新预览。',409);
  const pending=await one<{id:string}>(tx,'SELECT id FROM p07.revision_intents WHERE session_id=$1 AND parent_run_id=$2 AND batch_id IS NULL FOR UPDATE',[session.id,id]);
  invariant(pending,'REWORK_SESSION_REQUIRED','请重新创建调整会话。',409);
  const batch=pending.id,intent=batch;await insertRow(tx,'decision_batches',{id:batch,owner_id:actor.owner,preview_id:preview.id,parent_run_id:id,parent_result_id:result.id,preview_sha256:preview.preview_sha256,billing_class:'USER_REVISION'});
  for(const d of preview.decisions)await insertRow(tx,'decisions',{id:newId(),owner_id:actor.owner,batch_id:batch,issue_id:d.issue_id,action:d.action,evidence_id:d.evidence_id??null,user_value:d.user_value===undefined?null:JSON.stringify(d.user_value),note:d.note??null});
  await tx.query('UPDATE p07.revision_intents SET batch_id=$2 WHERE id=$1',[intent,batch]);
  return {operation_id:session.operation_id,new_session_id:session.id,revision_intent_id:intent,requires_seven_step_flow:true};
 }
 async revision(tx:Transaction,actor:Actor,id:string,body:Body<'27'>):Promise<Schema['Data27']>{
  await this.results.result(tx,id,body.expected_result_version);
  const intent=await one<{id:string;task_id:string|null;session_id:string;parent_result_id:string}>(tx,'SELECT * FROM p07.revision_intents WHERE batch_id=$1 AND parent_run_id=$2',[body.decision_batch_id,id]);if(!intent)notFound();
  invariant(intent.task_id,'SEVEN_STEP_FLOW_REQUIRED','请先等待新会话就绪并提交父结果作为资料。',409,{operation_id:(await get<SessionRow>(tx,'agent_sessions',intent.session_id)).operation_id});
  const task=await get<TaskRow>(tx,'tasks',intent.task_id),plan=task.current_plan_id?await get<PlanRow>(tx,'execution_plans',task.current_plan_id):null;
  const contract=plan?await one<{id:string}>(tx,'SELECT id FROM p07.processing_contracts WHERE task_id=$1 AND confirmed_plan_id=$2 ORDER BY version DESC LIMIT 1',[task.id,plan.id]):null;
  const order=contract?await one<{id:string}>(tx,'SELECT id FROM p07.orders WHERE contract_id=$1',[contract.id]):null;
  invariant(plan&&contract&&order,'SEVEN_STEP_FLOW_REQUIRED','请先完成新方案的分析、确认与原订单付款核验。',409);
  const child=await this.commerce.createRun(tx,actor,task.id,{session_id:intent.session_id,contract_id:contract.id,order_id:order.id,confirmed_plan_hash:plan.plan_sha256});
  await tx.query('UPDATE p07.runs SET parent_run_id=$2,parent_result_id=$3 WHERE id=$1 AND parent_run_id IS NULL',[child.run_id,id,intent.parent_result_id]);
  await tx.query("UPDATE p07.revision_intents SET status='QUEUED' WHERE id=$1",[intent.id]);
  const op=await one<OperationRow>(tx,"SELECT * FROM p07.operations WHERE run_id=$1 AND kind='BATCH' ORDER BY created_at DESC LIMIT 1",[child.run_id]);
  // Initial batch operations store the task before the run exists; resolve the queued job if needed.
  const resolved=op??await one<OperationRow>(tx,'SELECT o.* FROM p07.jobs j JOIN p07.operations o ON o.id=j.operation_id WHERE j.run_id=$1 ORDER BY j.created_at DESC LIMIT 1',[child.run_id]);
  invariant(resolved,'OPERATION_NOT_FOUND','生产操作暂不可查询。',503);return {operation:operationView(resolved),child_run_id:child.run_id,authorized_retry:false};
 }
}
