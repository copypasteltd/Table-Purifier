import type { Transaction } from '../db/database.js';
import { insertRow,one } from '../db/database.js';
import { cleanup,enqueue,operation } from '../db/queue.js';
import type { Body,Schema } from '../shared/contracts.js';
import type { Config } from '../shared/config.js';
import { newId } from '../shared/crypto.js';
import { invariant,notFound } from '../shared/errors.js';
import { get,type Actor,type SessionRow,type TaskRow } from './models.js';

export interface DeletionRow {id:string;operation_id:string;scope:Body<'37'>['resource_scope'];status:Schema['DeletionJob']['status'];
 remaining_categories:string[];progress:{access_revoked_at?:string};}
export const deletionView=(row:DeletionRow):Schema['DeletionJob']=>({deletion_request_id:row.id,operation_id:row.operation_id,status:row.status,
 access_revoked_at:row.progress.access_revoked_at??null,remaining_categories:row.remaining_categories,
 limitations:['必要的支付、退款、结果摘要和删除回执按已告知用途保留；已领取到用户设备的副本无法撤回。']});
const SCOPES=new Set(['PROCESS_DATA','SAVE_PRIVATE_TEMPLATE','SUPPORT_CONTENT']);
export class PrivacyService {
 constructor(readonly config:Config){}
 async policy(tx:Transaction,version=this.config.P07_POLICY_VERSION,environment=this.config.P07_ENV as string):Promise<Schema['Data35']>{
  const row=await one<{id:string;policy_version:string;content:Omit<Schema['Data35'],'policy_id'|'policy_version'>}>(tx,
   "SELECT * FROM p07.privacy_policies WHERE policy_version=$1 AND environment IN($2,'ALL') AND effective_at<=now() ORDER BY (environment=$2) DESC LIMIT 1",
   [version,environment]);invariant(row,'POLICY_UNAVAILABLE','资料处理说明尚未发布。',503);
  return {policy_id:row.id,policy_version:row.policy_version,...row.content};
 }
 async recordConsent(tx:Transaction,actor:Actor,body:Body<'36'>):Promise<Schema['Data36']>{
  const policy=await this.policy(tx);invariant(body.policy_version===policy.policy_version,'POLICY_STALE','资料处理说明已更新，请重新阅读。');
  invariant(new Set(body.scopes).size===body.scopes.length&&body.scopes.every(s=>SCOPES.has(s)),'CONSENT_SCOPE_INVALID','用途选择无效。',400);
  const now=new Date();let id='';for(const scope of body.scopes){id=newId();await insertRow(tx,'consents',{id,owner_id:actor.owner,policy_id:policy.policy_id,scope,action:body.action,effective_at:now});}
  if(body.action==='WITHDRAW'&&body.scopes.includes('PROCESS_DATA')){
   const tasks=(await tx.query<TaskRow>(`SELECT t.* FROM p07.tasks t JOIN p07.agent_sessions s ON s.id=t.agent_session_id
    WHERE t.deleted_at IS NULL AND s.status NOT IN('CLOSED','RELEASING_RUNTIME','FAILED','CANCELED','INITIALIZATION_FAILED') ORDER BY t.id FOR UPDATE OF t`)).rows;
   for(const task of tasks)await this.stopTask(tx,actor,task);
  }
  if(body.action==='WITHDRAW'&&body.scopes.includes('SUPPORT_CONTENT'))await tx.query('UPDATE p07.support_access_grants SET revoked_at=now() WHERE revoked_at IS NULL');
  return {consent_id:id,effect:body.action==='WITHDRAW'?'NEW_PROCESSING_STOPPED':'RECORDED',effective_at:now.toISOString()};
 }
 async stopTask(tx:Transaction,actor:Actor,task:TaskRow){
  const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);if(session.status==='CLOSED')return;
  await tx.query(`UPDATE p07.runs SET cancel_requested_at=now(),execution_status='CANCELED',finished_at=now(),version=version+1
   WHERE task_id=$1 AND execution_status IN('QUEUED','RUNNING')`,[task.id]);
  if(!['RELEASING_RUNTIME','FAILED','CANCELED','INITIALIZATION_FAILED'].includes(session.status))await tx.query("UPDATE p07.agent_sessions SET status='CANCELED' WHERE id=$1",[session.id]);
  await cleanup(tx,actor.owner,session);
 }
 async request(tx:Transaction,actor:Actor,body:Body<'37'>):Promise<Schema['DeletionJob']>{
  const scope=body.resource_scope;
  invariant(scope.kind==='ACCOUNT'?scope.resource_ids.length===0||scope.resource_ids.length===1&&scope.resource_ids[0]===actor.owner:scope.resource_ids.length>0,
   'DELETION_SCOPE_INVALID','请选择需要删除的资料。',400);
  const id=newId(),op=await operation(tx,actor.owner,'DATA_DELETION'),revoked=new Date().toISOString();
  await insertRow(tx,'deletion_requests',{id,owner_id:actor.owner,scope,status:'REQUESTED',operation_id:op,
   remaining_categories:JSON.stringify(['REVOKE_ACCESS','TASK_RUNTIME','REQUESTED_CONTENT']),progress:{access_revoked_at:revoked}});
  if(scope.kind==='PRIVATE_TEMPLATE'){
   for(const templateId of scope.resource_ids){await get(tx,'private_templates',templateId,true);await tx.query('UPDATE p07.private_templates SET deleted_at=coalesce(deleted_at,now()) WHERE id=$1',[templateId]);}
  }else{
   const tasks=scope.kind==='ACCOUNT'?(await tx.query<TaskRow>('SELECT * FROM p07.tasks ORDER BY id FOR UPDATE')).rows:[];
   if(scope.kind==='TASK_CONTENT')for(const taskId of [...new Set(scope.resource_ids)].sort())tasks.push(await get<TaskRow>(tx,'tasks',taskId,true));
   for(const task of tasks){
    await this.stopTask(tx,actor,task);
    await tx.query('UPDATE p07.tasks SET deleted_at=coalesce(deleted_at,now()),epoch=epoch+1,version=version+1 WHERE id=$1',[task.id]);
    await tx.query(`INSERT INTO p07.tombstones(id,owner_id,deletion_request_id,resource_kind,resource_id,epoch,effective_at)
     VALUES($1,$2,$3,'TASK',$4,$5,now()) ON CONFLICT(owner_id,resource_kind,resource_id) DO NOTHING`,[newId(),actor.owner,id,task.id,task.epoch+1]);
    await tx.query(`UPDATE p07.artifact_sets SET status='REVOKED',revoked_at=coalesce(revoked_at,now()) WHERE run_id IN(SELECT id FROM p07.runs WHERE task_id=$1)`,[task.id]);
    await tx.query(`UPDATE p07.download_grants SET revoked_at=coalesce(revoked_at,now()) WHERE artifact_id IN(SELECT a.id FROM p07.artifacts a JOIN p07.artifact_sets s ON s.id=a.artifact_set_id JOIN p07.runs r ON r.id=s.run_id WHERE r.task_id=$1)`,[task.id]);
    await tx.query('UPDATE p07.support_access_grants SET revoked_at=coalesce(revoked_at,now()) WHERE task_id=$1',[task.id]);
   }
   if(scope.kind==='ACCOUNT'){
    const standalone=(await tx.query<SessionRow>("SELECT * FROM p07.agent_sessions WHERE task_id IS NULL AND status<>'CLOSED' ORDER BY id FOR UPDATE")).rows;
    for(const session of standalone){if(!['RELEASING_RUNTIME','FAILED','CANCELED','INITIALIZATION_FAILED'].includes(session.status))await tx.query("UPDATE p07.agent_sessions SET status='CANCELED' WHERE id=$1",[session.id]);await cleanup(tx,actor.owner,session);}
    await tx.query("UPDATE p07.accounts SET status='DELETION_PENDING',version=version+1 WHERE id=$1",[actor.owner]);
    // Keep the current login solely for deletion status/refund history. Business writes check ACTIVE in auth_session.
    await tx.query('UPDATE p07.sessions SET revoked_at=now() WHERE id IS DISTINCT FROM $1::uuid',[actor.loginSessionId??null]);
    await tx.query('UPDATE p07.private_templates SET deleted_at=coalesce(deleted_at,now())');
   }
  }
  await tx.query("UPDATE p07.deletion_requests SET status='ACCESS_REVOKED',remaining_categories=$2 WHERE id=$1",[id,JSON.stringify(['TASK_RUNTIME','REQUESTED_CONTENT'])]);
  await enqueue(tx,actor.owner,'DELETION','deletion:'+id,{deletion_id:id},op);return this.read(tx,id);
 }
 async read(tx:Transaction,id:string):Promise<Schema['DeletionJob']>{return deletionView(await get<DeletionRow>(tx,'deletion_requests',id));}
 async retry(tx:Transaction,actor:Actor,id:string):Promise<Schema['DeletionJob']>{
  const row=await get<DeletionRow>(tx,'deletion_requests',id,true);
  if(row.status!=='PARTIAL_FAILED')return deletionView(row);
  const sessions=(await tx.query<SessionRow>(`SELECT * FROM p07.agent_sessions WHERE ($1::boolean OR task_id=ANY($2::uuid[])) AND cleanup_status='FAILED' ORDER BY id FOR UPDATE`,
   [row.scope.kind==='ACCOUNT',row.scope.kind==='TASK_CONTENT'?row.scope.resource_ids:[]])).rows;
  for(const session of sessions)await cleanup(tx,actor.owner,session);
  const job=await one(tx,`UPDATE p07.jobs SET status='READY',attempts=0,available_at=now(),lease_owner=NULL,lease_until=NULL,fence=fence+1,last_error_code=NULL
   WHERE dedupe_key=$1 AND status='DEAD' RETURNING id`,['deletion:'+id]);
  invariant(job,'DELETION_RETRY_NOT_READY','删除任务尚未进入可重试状态，请先查询进度。',409);
  await tx.query("UPDATE p07.deletion_requests SET status='ACCESS_REVOKED',finished_at=NULL WHERE id=$1",[id]);
  await tx.query("UPDATE p07.operations SET status='PENDING',finished_at=NULL,error_code=NULL WHERE id=$1",[row.operation_id]);
  return this.read(tx,id);
 }
}
