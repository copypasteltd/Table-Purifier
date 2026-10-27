import type { Database } from '../db/database.js';
import { one } from '../db/database.js';
import { assertFence,type Job } from '../db/queue.js';
import type { AgentRuntime } from '../agent/runner.js';
import { get,type SessionRow,type TaskRow } from '../domain/models.js';
import { invariant } from '../shared/errors.js';
import { sha256 } from '../shared/crypto.js';
import type { LocalStore } from '../storage/local-store.js';

/** Whole-task destruction. Final files and their necessary result projections are independent. */
export class RuntimeCleaner {
 constructor(private readonly db:Database,private readonly store:LocalStore,private readonly runtime:Pick<AgentRuntime,'stop'>){}
 async execute(job:Job):Promise<void>{
  const id=job.payload.session_id;invariant(id,'CLEANUP_SCOPE_MISSING','清理任务缺少会话。',503);
  const session=await this.db.withOwner(job.owner_id,async tx=>{
   const initial=await get<SessionRow>(tx,'agent_sessions',id);if(initial.task_id)await get<TaskRow>(tx,'tasks',initial.task_id,true);
   const row=await get<SessionRow>(tx,'agent_sessions',id,true);await assertFence(tx,job);
   if(row.status==='CLOSED'&&row.cleanup_status==='SUCCEEDED')return row;
   invariant(['RELEASING_RUNTIME','FAILED','CANCELED','INITIALIZATION_FAILED'].includes(row.status),'CLEANUP_PHASE_INVALID','当前会话尚不能销毁。',409);
   if(row.status!=='RELEASING_RUNTIME')await tx.query("UPDATE p07.agent_sessions SET status='RELEASING_RUNTIME' WHERE id=$1",[id]);
   await tx.query("UPDATE p07.agent_sessions SET cleanup_status='STOPPING' WHERE id=$1",[id]);
   await tx.query("UPDATE p07.runtime_cleanup_jobs SET status='STOPPING',attempts=attempts+1,revoked_at=coalesce(revoked_at,now()) WHERE session_id=$1",[id]);
   await tx.query("UPDATE p07.agent_workspaces SET status='REVOKED',revoked_at=coalesce(revoked_at,now()) WHERE id=$1",[row.workspace_id]);
   return row;
  });
  if(session.status==='CLOSED')return;
  // This is mandatory even if a prior turn/worker reported that it had already exited.
  await this.runtime.stop(id,true);
  const orphan=await this.db.withOwner(job.owner_id,async tx=>{
   await assertFence(tx,job);if(!session.run_id||session.result_id)return null;
   const row=await one<{publication_reservation:{resultId?:string}|null}>(tx,`SELECT r.publication_reservation FROM p07.runs r
    WHERE r.id=$1 AND NOT EXISTS(SELECT 1 FROM p07.result_versions v WHERE v.run_id=r.id)`,[session.run_id]);
   return row?.publication_reservation?.resultId??null;
  });
  if(orphan)await this.store.discardUnpublishedResult(job.owner_id,orphan);
  await this.db.withOwner(job.owner_id,async tx=>{await assertFence(tx,job);
   await tx.query("UPDATE p07.agent_sessions SET cleanup_status='DELETING' WHERE id=$1",[id]);
   await tx.query("UPDATE p07.runtime_cleanup_jobs SET status='DELETING' WHERE session_id=$1",[id]);});
  const disk=await this.store.destroySession(id);
  await this.db.withOwner(job.owner_id,async tx=>{
   if(session.task_id)await get<TaskRow>(tx,'tasks',session.task_id,true);
   const current=await get<SessionRow>(tx,'agent_sessions',id,true);await assertFence(tx,job);
   // Purge body-bearing control-plane copies. Necessary result/schema/evidence remains in the independent result store.
   await tx.query('UPDATE p07.tasks SET goal=NULL,standard_definition=NULL,standard_reference=NULL WHERE agent_session_id=$1',[id]);
   await tx.query(`UPDATE p07.source_files SET object_key='purged/'||id::text,display_name='原始资料已清理',measurement='{}',
    readability_reason=NULL,status='DELETED',deleted_at=now() WHERE session_id=$1`,[id]);
   await tx.query(`UPDATE p07.upload_sessions SET display_name='已清理',token_hash='purged:'||id::text,received_object_key=NULL,status='EXPIRED'
    WHERE task_id=$1`,[session.task_id]);
   await tx.query("UPDATE p07.preflights SET report='{}' WHERE agent_session_id=$1",[id]);
   await tx.query("UPDATE p07.schema_proposals SET content='{}',coverage='{}',unmapped='[]',preview_object_key=NULL WHERE task_id=$1",[session.task_id]);
   await tx.query("UPDATE p07.execution_plans SET summary='{}',content_ref=NULL WHERE session_id=$1",[id]);
   await tx.query(`UPDATE p07.schema_bindings b SET content='{}' WHERE b.task_id=$1
    AND NOT EXISTS(SELECT 1 FROM p07.result_versions r WHERE r.binding_id=b.id)`,[session.task_id]);
   await tx.query(`UPDATE p07.agent_turns SET completion_ref=NULL WHERE session_id=$1`,[id]);
   await tx.query(`UPDATE p07.agent_events SET private_event_ref=NULL WHERE turn_id IN(SELECT id FROM p07.agent_turns WHERE session_id=$1)`,[id]);
   await tx.query(`UPDATE p07.agent_tool_invocations SET result_ref=NULL WHERE turn_id IN(SELECT id FROM p07.agent_turns WHERE session_id=$1)`,[id]);
   await tx.query('DELETE FROM p07.agent_checkpoints WHERE session_id=$1',[id]);
   await tx.query(`UPDATE p07.decisions SET user_value=CASE WHEN action='USER_VALUE' THEN '""'::jsonb ELSE NULL END,note=NULL
    WHERE batch_id IN(SELECT batch_id FROM p07.revision_intents WHERE session_id=$1)`,[id]);
   await tx.query("UPDATE p07.decision_previews SET decisions='[]',scope='{}',impact='{}' WHERE session_id=$1",[id]);
   await tx.query("UPDATE p07.revision_intents SET status=CASE WHEN $2::uuid IS NOT NULL THEN 'COMPLETED' ELSE 'CANCELED' END WHERE session_id=$1",[id,current.result_id]);
   await tx.query('UPDATE p07.idempotency_records SET response_body=NULL WHERE session_id=$1',[id]);
   await tx.query("UPDATE p07.agent_workspaces SET status='DELETED',isolation_receipt=NULL WHERE id=$1",[session.workspace_id]);
   const receipt={protocol:'P07-CLEANUP-1',session_id:id,result_id:current.result_id,result_files_preserved:true,
    process_tree_stopped:true,body_projections_purged:true,...disk,finished_at:new Date().toISOString()};
   await tx.query("UPDATE p07.runtime_cleanup_jobs SET status='SUCCEEDED',receipt=$2,last_error_code=NULL,finished_at=now() WHERE session_id=$1",[id,receipt]);
   await tx.query(`UPDATE p07.agent_sessions SET cleanup_status='SUCCEEDED',status='CLOSED',closed_at=now(),codex_thread_id=NULL,
    active_job_id=NULL,process_id=NULL,process_started_at=NULL WHERE id=$1`,[id]);
   await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now(),version=version+1 WHERE id=$1",[job.operation_id,{id,kind:'SESSION'}]);
   await tx.query("UPDATE p07.outbox_events SET sent_at=now() WHERE topic='RESULT_DURABLE_CLEANUP' AND payload->>'session_id'=$1",[id]);
  });
 }
}
