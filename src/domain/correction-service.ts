import type { Transaction } from '../db/database.js';
import { insertRow,one } from '../db/database.js';
import type { Body,Schema } from '../shared/contracts.js';
import { newId } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { get,type Actor,type ContractRow,type OrderRow,type PlanRow,type QuoteRow,type RunRow,type SessionRow,type TaskRow } from './models.js';
import type { TaskService } from './task-service.js';
import type { ResultService } from './result-service.js';
import type { CommerceService } from './commerce-service.js';

interface Authorization {id:string;contract_id:string;original_order_id:string;budget_contract_id:string;plan_sha256:string;source_scope_sha256:string;
 status:'APPROVED'|'USED'|'REVOKED';used_run_id:string|null;expires_at:Date;}
export interface CorrectionApproval {owner_id:string;ticket_id:string;parent_run_id:string;contract_id:string;plan_hash:string;
 reason_code:'OMITTED_FIELD'|'EXTRACTION_ERROR';review_receipt_ref:string;}

/** Trusted human review binds a new confirmed contract to a genuine original payment. */
export class CorrectionService {
 constructor(readonly tasks:TaskService,readonly results:ResultService,readonly commerce:CommerceService){}
 async prepare(tx:Transaction,actor:Actor,parentId:string,body:Body<'54'>){
  const parent=await this.results.result(tx,parentId);await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[actor.owner+':correction:'+parentId]);
  const existing=await one<SessionRow>(tx,`SELECT s.* FROM p07.revision_intents ri JOIN p07.agent_sessions s ON s.id=ri.session_id WHERE ri.parent_run_id=$1
   AND ri.billing_class='PLATFORM_CORRECTION' AND s.status IN('INITIALIZING','READY_FOR_INPUT') ORDER BY ri.created_at DESC LIMIT 1`,[parentId]);
  if(existing)return {session_id:existing.id,status:existing.status,operation_id:existing.operation_id};
  const run=await get<RunRow>(tx,'runs',parentId),grant=await one<{order_id:string}>(tx,"SELECT order_id FROM p07.entitlement_grants WHERE id=$1 AND kind='PAID' AND revoked_at IS NULL",[run.grant_id]);
  invariant(grant,'ORIGINAL_PAYMENT_REQUIRED','原任务没有可核实的实付纠错权益。',403);
  const order=await get<OrderRow>(tx,'orders',grant.order_id);this.paid(order,actor);
  const session=await this.tasks.session(tx,actor,body);await insertRow(tx,'revision_intents',{id:newId(),owner_id:actor.owner,parent_run_id:parentId,parent_result_id:parent.id,
   session_id:session.session_id,billing_class:'PLATFORM_CORRECTION'});return session;
 }
 private paid(order:OrderRow,actor?:Actor):void{invariant(order.payment_status==='CONFIRMED'&&order.amount_minor>0&&order.refunded_minor+order.refund_reserved_minor===0&&!order.reconciliation_required,
  'ORIGINAL_PAYMENT_REQUIRED','原订单须已核实付款，且没有退款或待对账事项。',403);
  if(actor)invariant(order.provider===actor.provider&&order.app_alias===actor.appAlias,'ORIGIN_MISMATCH','请在原支付平台处理纠错。',403);
 }
 async approve(tx:Transaction,approval:CorrectionApproval,operatorHash:string){
  const contract=await get<ContractRow>(tx,'processing_contracts',approval.contract_id),task=await get<TaskRow>(tx,'tasks',contract.task_id,true),session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);
  const intent=await one<{parent_run_id:string;parent_result_id:string}>(tx,"SELECT * FROM p07.revision_intents WHERE task_id=$1 AND billing_class='PLATFORM_CORRECTION'",[task.id]);
  invariant(intent?.parent_run_id===approval.parent_run_id&&!task.deleted_at&&task.current_plan_id===contract.confirmed_plan_id&&session.status==='QUOTABLE','CORRECTION_SCOPE_INVALID','请先完成新会话的分析、规范采用、方案确认与估费。',409);
  const plan=await get<PlanRow>(tx,'execution_plans',contract.confirmed_plan_id);invariant(plan.plan_sha256===approval.plan_hash&&plan.status==='CONFIRMED','PLAN_STALE','待审核方案已改变。',409);
  const ticket=await get<{task_id:string|null;category:string}>(tx,'support_tickets',approval.ticket_id);
  const parent=await get<RunRow>(tx,'runs',intent.parent_run_id);invariant(ticket.task_id===task.id,'TICKET_SCOPE_MISMATCH','请在当前新任务中提交纠错售后单。',403);
  invariant(await one(tx,'SELECT id FROM p07.support_access_grants WHERE ticket_id=$1 AND task_id=$2 AND revoked_at IS NULL AND expires_at>now()',[approval.ticket_id,task.id]),'SUPPORT_CONSENT_REQUIRED','请先明确授权售后在限时范围内核对当前任务。',403);
  const oldGrant=await one<{order_id:string}>(tx,"SELECT order_id FROM p07.entitlement_grants WHERE id=$1 AND kind='PAID' AND revoked_at IS NULL",[parent.grant_id]);invariant(oldGrant,'ORIGINAL_PAYMENT_REQUIRED','原实付权益已撤销。',403);
  const order=await get<OrderRow>(tx,'orders',oldGrant.order_id);this.paid(order);
  const original=await get<ContractRow>(tx,'processing_contracts',order.contract_id),budget=original.budget_contract_id??original.id;
  invariant(contract.budget_contract_id===budget,'CORRECTION_BUDGET_MISMATCH','当前确认合同没有绑定原订单累计预算。',409);
  await tx.query('SELECT id FROM p07.processing_contracts WHERE id=$1 FOR UPDATE',[budget]);
  this.paid(await get<OrderRow>(tx,'orders',order.id,true));
  // Corrections can only use the immutable original sources and the selected parent result.
  const originals=(await tx.query<{content_sha256:string}>(`SELECT s.content_sha256 FROM p07.source_set_items i JOIN p07.source_files s ON s.id=i.source_id AND s.owner_id=i.owner_id WHERE i.source_set_id=$1 AND i.included AND s.role='SOURCE'`,[original.source_set_id])).rows;
  const parentFiles=(await tx.query<{sha256:string}>("SELECT a.sha256 FROM p07.artifacts a JOIN p07.artifact_sets s ON s.id=a.artifact_set_id WHERE s.result_id=$1 AND a.name IN('result.json','provenance.jsonl') AND s.revoked_at IS NULL",[intent.parent_result_id])).rows;
  const newSources=(await tx.query<{content_sha256:string}>(`SELECT s.content_sha256 FROM p07.source_set_items i JOIN p07.source_files s ON s.id=i.source_id AND s.owner_id=i.owner_id WHERE i.source_set_id=$1 AND i.included AND s.role='SOURCE'`,[contract.source_set_id])).rows;
  const hashes=new Set([...originals.map(s=>s.content_sha256),...parentFiles.map(s=>s.sha256)]);
  invariant(newSources.every(s=>hashes.has(s.content_sha256))&&newSources.some(s=>originals.some(o=>o.content_sha256===s.content_sha256)),
   'CORRECTION_REQUIRES_ORIGINALS','请重传实际需要纠错的原始资料；新增事实应另行确认费用。',409);
  const quote=await one<QuoteRow>(tx,'SELECT * FROM p07.quotes WHERE contract_id=$1 AND expires_at>now() ORDER BY created_at DESC LIMIT 1',[contract.id]);invariant(quote,'QUOTE_REQUIRED','请先查看当前方案的估费。',409);
  const consumed=await this.spent(tx,budget);invariant(consumed<this.tasks.config.P07_AGENT_BATCH_MS,'COMPUTE_BUDGET_EXCEEDED','原订单累计处理预算已耗尽，请走售后退款核对。',409);
  const old=await one<Authorization>(tx,'SELECT * FROM p07.correction_authorizations WHERE contract_id=$1',[contract.id]);if(old)return this.view(old);
  const id=newId();await insertRow(tx,'correction_authorizations',{id,owner_id:approval.owner_id,ticket_id:approval.ticket_id,parent_run_id:parent.id,parent_result_id:intent.parent_result_id,
   contract_id:contract.id,original_order_id:order.id,budget_contract_id:budget,estimated_quote_id:quote.id,plan_sha256:plan.plan_sha256,source_scope_sha256:plan.source_set_sha256,
   approved_by_sha256:operatorHash,review_receipt_ref:approval.review_receipt_ref,reason_code:approval.reason_code,expires_at:new Date(Date.now()+86400_000)});
  return this.view(await get<Authorization>(tx,'correction_authorizations',id));
 }
 async spent(tx:Transaction,root:string):Promise<number>{return (await one<{spent:number}>(tx,"SELECT coalesce(sum(CASE WHEN kind IN('RESERVE','CONSUME') THEN compute_ms ELSE -compute_ms END),0)::bigint spent FROM p07.run_budget_events WHERE contract_id=$1",[root]))!.spent;}
 view(row:Authorization){return {authorization_id:row.id,original_order_id:row.original_order_id,status:row.status==='APPROVED'&&row.expires_at.getTime()<=Date.now()?'EXPIRED':row.status,
  expires_at:row.expires_at.toISOString(),used_run_id:row.used_run_id};}
 async context(tx:Transaction,taskId:string){const task=await get<TaskRow>(tx,'tasks',taskId);invariant(!task.deleted_at,'RESOURCE_NOT_FOUND','任务已删除。',404);
  const intent=await one<{parent_run_id:string}>(tx,"SELECT parent_run_id FROM p07.revision_intents WHERE task_id=$1 AND billing_class='PLATFORM_CORRECTION'",[taskId]);
  if(!intent)return {is_correction:false};
  const authorization=await one<Authorization>(tx,'SELECT a.* FROM p07.correction_authorizations a JOIN p07.processing_contracts c ON c.id=a.contract_id WHERE c.task_id=$1 AND c.confirmed_plan_id=$2',[taskId,task.current_plan_id]);
  return {is_correction:true,parent_run_id:intent.parent_run_id,authorization:authorization?this.view(authorization):null};
 }
 async start(tx:Transaction,actor:Actor,id:string,body:{session_id:string;contract_id:string;plan_hash:string;quote_id:string}):Promise<Schema['Run']>{
  const authorization=await get<Authorization>(tx,'correction_authorizations',id,true),contract=await get<ContractRow>(tx,'processing_contracts',body.contract_id),task=await get<TaskRow>(tx,'tasks',contract.task_id,true),session=await get<SessionRow>(tx,'agent_sessions',body.session_id,true);
  invariant(authorization.contract_id===contract.id&&authorization.plan_sha256===body.plan_hash&&task.agent_session_id===session.id&&task.current_plan_id===contract.confirmed_plan_id&&!task.deleted_at,'CORRECTION_SCOPE_INVALID','本次纠错授权与当前方案不匹配。',409);
  await tx.query('SELECT id FROM p07.processing_contracts WHERE id=$1 FOR UPDATE',[authorization.budget_contract_id]);
  const order=await get<OrderRow>(tx,'orders',authorization.original_order_id,true);this.paid(order,actor);
  if(authorization.status==='USED'&&authorization.used_run_id)return this.commerce.runView(tx,authorization.used_run_id);
  invariant(authorization.status==='APPROVED'&&authorization.expires_at.getTime()>Date.now()&&session.status==='QUOTABLE','CORRECTION_AUTHORIZATION_EXPIRED','纠错授权已失效，请重新核对。',409);
  const quote=await get<QuoteRow>(tx,'quotes',body.quote_id);invariant(quote.contract_id===contract.id&&quote.expires_at.getTime()>Date.now(),'QUOTE_STALE','请先重新查看本次估费。',409);
  const plan=await get<PlanRow>(tx,'execution_plans',contract.confirmed_plan_id);invariant(plan.source_set_sha256===authorization.source_scope_sha256,'PLAN_STALE','纠错资料范围已改变。',409);
  invariant(await this.spent(tx,authorization.budget_contract_id)<this.tasks.config.P07_AGENT_BATCH_MS,'COMPUTE_BUDGET_EXCEEDED','原订单累计处理预算已耗尽。',409);
  if(!await one(tx,'SELECT id FROM p07.entitlement_grants WHERE contract_id=$1',[contract.id]))await insertRow(tx,'entitlement_grants',{id:newId(),owner_id:actor.owner,contract_id:contract.id,order_id:order.id,kind:'PAID',policy_snapshot:contract.policy_snapshot,revision_limit:0});
  await tx.query("UPDATE p07.agent_sessions SET status='AWAITING_PAYMENT' WHERE id=$1",[session.id]);
  const run=await this.commerce.createRun(tx,actor,task.id,{session_id:session.id,contract_id:contract.id,order_id:order.id,confirmed_plan_hash:body.plan_hash});
  await tx.query("UPDATE p07.correction_authorizations SET status='USED',used_run_id=$2 WHERE id=$1",[authorization.id,run.run_id]);return run;
 }
}
