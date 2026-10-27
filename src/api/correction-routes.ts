import type { FastifyInstance,FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Application } from '../application.js';
import type { Body } from '../shared/contracts.js';
import { constantTimeEqual,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { get,type ContractRow,type PlanRow,type TaskRow } from '../domain/models.js';
import { one } from '../db/database.js';
import { idempotent } from '../db/idempotency.js';

export function registerCorrectionRoutes(app:FastifyInstance,a:Application,bearer:(req:FastifyRequest)=>string){
 const operator=(req:FastifyRequest)=>invariant(a.config.P07_OPERATOR_TOKEN_HASH&&constantTimeEqual(sha256(bearer(req)),a.config.P07_OPERATOR_TOKEN_HASH),'OPERATOR_AUTH_REQUIRED','需要独立的售后运营身份。',403);
 const approvalSchema=z.object({owner_id:z.uuid(),ticket_id:z.uuid(),parent_run_id:z.uuid(),contract_id:z.uuid(),plan_hash:z.string().regex(/^[a-f0-9]{64}$/),
  reason_code:z.enum(['OMITTED_FIELD','EXTRACTION_ERROR']),review_receipt_ref:z.string().regex(/^[A-Za-z0-9_./:-]{8,200}$/)}).strict();
 app.post('/transport/v1/operator/corrections',async req=>{operator(req);const body=approvalSchema.parse(req.body),key=String(req.headers['idempotency-key']??'');
  const data=await a.db.withOwner(body.owner_id,tx=>idempotent(tx,body.owner_id,'operator:approve-correction',key,body,()=>a.corrections.approve(tx,body,a.config.P07_OPERATOR_TOKEN_HASH)));
  return {request_id:req.id,data};
 });
 app.get('/transport/v1/operator/tasks/:task_id/review',async req=>{operator(req);const id=z.uuid().parse((req.params as {task_id:string}).task_id),q=z.object({owner_id:z.uuid(),ticket_id:z.uuid()}).strict().parse(req.query);
  const data=await a.db.withOwner(q.owner_id,async tx=>{
   const grant=await one(tx,'SELECT id FROM p07.support_access_grants WHERE task_id=$1 AND ticket_id=$2 AND revoked_at IS NULL AND expires_at>now()',[id,q.ticket_id]);
   invariant(grant,'SUPPORT_CONSENT_REQUIRED','该任务没有有效的限时售后资料授权。',403);const task=await get<TaskRow>(tx,'tasks',id);
   invariant(!task.deleted_at&&task.current_plan_id,'REVIEW_CONTENT_UNAVAILABLE','任务已删除或分析尚未完成。',409);
   const plan=await get<PlanRow>(tx,'execution_plans',task.current_plan_id),contract=await one<ContractRow>(tx,'SELECT * FROM p07.processing_contracts WHERE confirmed_plan_id=$1 ORDER BY version DESC LIMIT 1',[plan.id]);
   const ticket=await get<{note_object_key:string|null;category:string}>(tx,'support_tickets',q.ticket_id);
   return {task_id:id,contract_id:contract?.id??null,plan_hash:plan.plan_sha256,source_scope_sha256:plan.source_set_sha256,
    original_runtime_available:!!plan.content_ref,analysis:plan.content_ref?JSON.parse((await a.store.read(plan.content_ref)).toString('utf8')):null,
    ticket:{category:ticket.category,note:ticket.note_object_key?(await a.store.read(ticket.note_object_key,100_000)).toString('utf8'):null}};
  });return {request_id:req.id,data};
 });
 app.post('/transport/v1/runs/:run_id/correction-sessions',async req=>{const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {run_id:string}).run_id);
  a.contracts.validate('Request54',req.body);const key=String(req.headers['idempotency-key']??'');
  const data=await a.db.withOwner(actor.owner,async tx=>{const account=await get<{status:string}>(tx,'accounts',actor.owner);invariant(account.status==='ACTIVE','ACCOUNT_UNAVAILABLE','账号当前不能新建会话。',403);
   return idempotent(tx,actor.owner,'transport:correction-session:'+id,key,req.body,()=>a.corrections.prepare(tx,actor,id,req.body as Body<'54'>));});return {request_id:req.id,data};
 });
 app.get('/transport/v1/tasks/:task_id/correction',async req=>{const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {task_id:string}).task_id);
  return {request_id:req.id,data:await a.db.withOwner(actor.owner,tx=>a.corrections.context(tx,id))};
 });
 app.post('/transport/v1/corrections/:authorization_id/runs',async req=>{const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {authorization_id:string}).authorization_id);
  const body=z.object({session_id:z.uuid(),contract_id:z.uuid(),plan_hash:z.string().regex(/^[a-f0-9]{64}$/),quote_id:z.uuid()}).strict().parse(req.body),key=String(req.headers['idempotency-key']??'');
  const data=await a.db.withOwner(actor.owner,async tx=>{const account=await get<{status:string}>(tx,'accounts',actor.owner);invariant(account.status==='ACTIVE','ACCOUNT_UNAVAILABLE','账号当前不能生产。',403);
   return idempotent(tx,actor.owner,'transport:correction-run:'+id,key,body,()=>a.corrections.start(tx,actor,id,body),body.session_id);});return {request_id:req.id,data:a.contracts.validate('Run',data,true)};
 });
}
