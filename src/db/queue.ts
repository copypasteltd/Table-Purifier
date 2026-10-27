import { newId } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { type Transaction,one,insertRow } from './database.js';

export interface Job {id:string;owner_id:string;run_id:string|null;operation_id:string|null;kind:string;
  payload:{session_id?:string;refund_id?:string;deletion_id?:string;order_id?:string};fence:number;lease_owner:string;attempts:number;}
export async function enqueue(tx:Transaction,owner:string,kind:string,dedupe:string,payload:Job['payload'],operationId?:string,runId?:string):Promise<string>{
  const id=newId();const row=await one<{id:string}>(tx,`INSERT INTO p07.jobs(id,owner_id,kind,status,dedupe_key,payload,operation_id,run_id,priority)
    VALUES($1,$2,$3,'READY',$4,$5,$6,$7,$8) ON CONFLICT(owner_id,dedupe_key) DO NOTHING RETURNING id`,
  [id,owner,kind,dedupe,payload,operationId??null,runId??null,kind==='CLEANUP'?100:10]);
  return row?.id??(await one<{id:string}>(tx,'SELECT id FROM p07.jobs WHERE owner_id=$1 AND dedupe_key=$2',[owner,dedupe]))!.id;
}
export async function assertFence(tx:Transaction,job:Job):Promise<void>{
  const row=await one(tx,`SELECT id FROM p07.jobs WHERE id=$1 AND status='LEASED' AND lease_owner=$2 AND fence=$3
    AND lease_until>clock_timestamp() FOR UPDATE`,[job.id,job.lease_owner,job.fence]);
  invariant(row,'WORKER_FENCE_LOST','处理权限已交接，旧进程不得继续发布。',409);
}
export async function operation(tx:Transaction,owner:string,kind:string,taskId?:string,runId?:string):Promise<string>{
  const id=newId();await insertRow(tx,'operations',{id,owner_id:owner,kind,task_id:taskId??null,run_id:runId??null,status:'PENDING'});return id;
}
export async function cleanup(tx:Transaction,owner:string,session:{id:string;workspace_id:string;result_id:string|null},operationId?:string):Promise<string>{
  const previous=await one<{operation_id:string|null;status:string}>(tx,'SELECT operation_id,status FROM p07.runtime_cleanup_jobs WHERE session_id=$1 FOR UPDATE',[session.id]);
  if(previous?.status==='SUCCEEDED'&&previous.operation_id)return previous.operation_id;
  const op=previous?.operation_id??operationId??await operation(tx,owner,'CLEANUP');
  await tx.query(`INSERT INTO p07.runtime_cleanup_jobs(id,owner_id,session_id,workspace_id,result_id,status,dedupe_key,operation_id)
    VALUES($1,$2,$3,$4,$5,'PENDING',$6,$7) ON CONFLICT(owner_id,dedupe_key) DO NOTHING`,
  [newId(),owner,session.id,session.workspace_id,session.result_id,'cleanup:'+session.id,op]);
  await tx.query("UPDATE p07.agent_sessions SET cleanup_status='PENDING' WHERE id=$1 AND cleanup_status<>'SUCCEEDED'",[session.id]);
  const job=await enqueue(tx,owner,'CLEANUP','cleanup:'+session.id,{session_id:session.id},op);
  if(previous?.status==='FAILED'){
    await tx.query("UPDATE p07.runtime_cleanup_jobs SET status='PENDING',last_error_code=NULL WHERE session_id=$1",[session.id]);
    await tx.query("UPDATE p07.jobs SET status='READY',attempts=0,available_at=now(),lease_owner=NULL,lease_until=NULL,fence=fence+1 WHERE id=$1 AND status='DEAD'",[job]);
    await tx.query("UPDATE p07.operations SET status='PENDING',finished_at=NULL,error_code=NULL WHERE id=$1",[op]);
  }
  return op;
}
