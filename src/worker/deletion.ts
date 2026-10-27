import type { Database } from '../db/database.js';
import { one } from '../db/database.js';
import { assertFence,type Job } from '../db/queue.js';
import { get } from '../domain/models.js';
import type { DeletionRow } from '../domain/privacy-service.js';
import type { LocalStore } from '../storage/local-store.js';
import { invariant } from '../shared/errors.js';

export class DeletionWorker {
 constructor(readonly db:Database,readonly store:LocalStore){}
 async execute(job:Job):Promise<void>{
  invariant(job.payload.deletion_id,'DELETION_SCOPE_MISSING','删除请求范围缺失。',503);
  const plan=await this.db.withOwner(job.owner_id,async tx=>{
   const row=await get<DeletionRow>(tx,'deletion_requests',job.payload.deletion_id!,true);await assertFence(tx,job);
   if(row.status==='COMPLETED')return null;
   const taskIds=row.scope.kind==='PRIVATE_TEMPLATE'?[]:(await tx.query<{id:string}>(`SELECT id FROM p07.tasks WHERE ($1::boolean OR id=ANY($2::uuid[])) ORDER BY id`,[row.scope.kind==='ACCOUNT',row.scope.resource_ids])).rows.map(t=>t.id);
   const pending=await one(tx,`SELECT id FROM p07.agent_sessions WHERE ($1::boolean OR task_id=ANY($2::uuid[])) AND (status<>'CLOSED' OR cleanup_status<>'SUCCEEDED') LIMIT 1`,[row.scope.kind==='ACCOUNT',taskIds]);
   if(pending){
    const exhausted=await one(tx,`SELECT j.id FROM p07.jobs j JOIN p07.agent_sessions s ON j.dedupe_key='cleanup:'||s.id::text
     WHERE ($1::boolean OR s.task_id=ANY($2::uuid[])) AND s.cleanup_status='FAILED' AND j.status='DEAD' LIMIT 1`,[row.scope.kind==='ACCOUNT',taskIds]);
    if(exhausted){
     await tx.query("UPDATE p07.deletion_requests SET status='PARTIAL_FAILED',remaining_categories='[\"TASK_RUNTIME\",\"REQUESTED_CONTENT\"]' WHERE id=$1",[row.id]);
     await tx.query("UPDATE p07.operations SET status='FAILED',error_code='RUNTIME_CLEANUP_INCOMPLETE',finished_at=now() WHERE id=$1",[row.operation_id]);
     await tx.query("UPDATE p07.jobs SET status='DEAD',lease_owner=NULL,lease_until=NULL,last_error_code='RUNTIME_CLEANUP_INCOMPLETE' WHERE id=$1",[job.id]);
    }else await tx.query("UPDATE p07.jobs SET status='READY',attempts=greatest(attempts-1,0),available_at=now()+interval '5 seconds',lease_owner=NULL,lease_until=NULL WHERE id=$1",[job.id]);
    return {waiting:true as const};
   }
   await tx.query("UPDATE p07.deletion_requests SET status='PURGING' WHERE id=$1",[row.id]);
   const results=taskIds.length?(await tx.query<{id:string}>('SELECT v.id FROM p07.result_versions v JOIN p07.runs r ON r.id=v.run_id WHERE r.task_id=ANY($1::uuid[])',[taskIds])).rows:[];
   const notes=(await tx.query<{id:string;note_object_key:string}>(`SELECT id,note_object_key FROM p07.support_tickets WHERE note_object_key IS NOT NULL AND($1::boolean OR task_id=ANY($2::uuid[]))`,[row.scope.kind==='ACCOUNT',taskIds])).rows;
   return {waiting:false as const,row,taskIds,results,notes};
  });
  if(plan?.waiting)return;
  if(plan){for(const result of plan.results)await this.store.deleteRequestedResult(job.owner_id,result.id);
   for(const note of plan.notes)await this.store.removeObject(note.note_object_key);
   await this.db.withOwner(job.owner_id,async tx=>{
    await assertFence(tx,job);const {row,taskIds}=plan;
    if(taskIds.length){
     await tx.query(`UPDATE p07.decisions SET user_value=CASE WHEN action='USER_VALUE' THEN '""'::jsonb ELSE NULL END,note=NULL
      WHERE issue_id IN(SELECT i.id FROM p07.issues i JOIN p07.result_versions v ON v.id=i.result_id JOIN p07.runs r ON r.id=v.run_id WHERE r.task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`DELETE FROM p07.field_evidence WHERE field_value_id IN(SELECT f.id FROM p07.field_values f JOIN p07.records c ON c.id=f.record_id JOIN p07.result_versions v ON v.id=c.result_id JOIN p07.runs r ON r.id=v.run_id WHERE r.task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`DELETE FROM p07.field_values WHERE record_id IN(SELECT c.id FROM p07.records c JOIN p07.result_versions v ON v.id=c.result_id JOIN p07.runs r ON r.id=v.run_id WHERE r.task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`UPDATE p07.issues SET details='{}' WHERE result_id IN(SELECT v.id FROM p07.result_versions v JOIN p07.runs r ON r.id=v.run_id WHERE r.task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`UPDATE p07.records SET exclusion_reason=NULL WHERE result_id IN(SELECT v.id FROM p07.result_versions v JOIN p07.runs r ON r.id=v.run_id WHERE r.task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`UPDATE p07.evidence SET excerpt_object_key=NULL,relation_note=NULL,locator='{}' WHERE run_id IN(SELECT id FROM p07.runs WHERE task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`UPDATE p07.source_units SET locator='{}',text_object_key=NULL WHERE source_id IN(SELECT s.id FROM p07.source_files s JOIN p07.agent_sessions x ON x.id=s.session_id WHERE x.task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query(`UPDATE p07.schema_bindings SET content='{}' WHERE task_id=ANY($1::uuid[])`,[taskIds]);
     await tx.query(`UPDATE p07.runs SET result_summary='{}' WHERE task_id=ANY($1::uuid[])`,[taskIds]);
     await tx.query(`UPDATE p07.decision_previews SET decisions='[]',scope='{}',impact='{}' WHERE run_id IN(SELECT id FROM p07.runs WHERE task_id=ANY($1::uuid[]))`,[taskIds]);
     await tx.query('UPDATE p07.tombstones SET purged_at=now() WHERE resource_kind=\'TASK\' AND resource_id=ANY($1::uuid[])',[taskIds]);
    }
    if(row.scope.kind!=='TASK_CONTENT'){
     await tx.query(`UPDATE p07.idempotency_records SET response_body=NULL WHERE ($1::boolean OR response_body->>'template_id'=ANY($2::text[]))`,[row.scope.kind==='ACCOUNT',row.scope.resource_ids]);
     await tx.query(`UPDATE p07.private_template_versions SET content='{}' WHERE ($1::boolean OR template_id=ANY($2::uuid[]))`,[row.scope.kind==='ACCOUNT',row.scope.resource_ids]);
     await tx.query(`UPDATE p07.private_templates SET name='已删除规范' WHERE ($1::boolean OR id=ANY($2::uuid[]))`,[row.scope.kind==='ACCOUNT',row.scope.resource_ids]);
    }
    await tx.query("UPDATE p07.support_tickets SET note_object_key=NULL,category='已删除工单' WHERE id=ANY($1::uuid[])",[plan.notes.map(n=>n.id)]);
    if(row.scope.kind==='ACCOUNT'){
     await tx.query("UPDATE p07.platform_identities SET subject_cipher_ref='PURGED'");
     await tx.query('UPDATE p07.idempotency_records SET response_body=NULL');
     await tx.query("UPDATE p07.accounts SET status='CLOSED',version=version+1 WHERE id=$1",[job.owner_id]);
     await tx.query("UPDATE p07.sessions SET expires_at=least(expires_at,now()+interval '24 hours') WHERE revoked_at IS NULL");
    }
    await tx.query("UPDATE p07.deletion_requests SET status='COMPLETED',remaining_categories='[]',finished_at=now() WHERE id=$1",[row.id]);
    await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now() WHERE id=$1",[row.operation_id,{id:row.id,kind:'DELETION_REQUEST'}]);
   });
  }
  await this.db.withOwner(job.owner_id,async tx=>{await assertFence(tx,job);await tx.query("UPDATE p07.jobs SET status='DONE',lease_owner=NULL,lease_until=NULL WHERE id=$1",[job.id]);});
 }
}
