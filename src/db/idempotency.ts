import { type Transaction,insertRow,one } from './database.js';
import { contentHash,newId,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';

export async function idempotent<T>(tx:Transaction,owner:string,route:string,key:string,payload:unknown,action:()=>Promise<T>,sessionId?:string):Promise<T>{
  invariant(key.length>=16&&key.length<=128,'IDEMPOTENCY_KEY_REQUIRED','请提供稳定的操作标识。',400);
  const keyHash=sha256(key),requestHash=contentHash(payload);
  // Serializes the exact logical action, including first insert. Rollback never leaves an in-progress reservation.
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[owner+route+keyHash]);
  const old=await one<{request_sha256:string;response_body:T|null}>(tx,
    'SELECT request_sha256,response_body FROM p07.idempotency_records WHERE owner_id=$1 AND route_id=$2 AND key_hash=$3',[owner,route,keyHash]);
  if(old){invariant(old.request_sha256===requestHash,'IDEMPOTENCY_CONFLICT','同一操作标识不能提交不同内容。');
    invariant(old.response_body!==null,'IDEMPOTENCY_EXPIRED','此操作的正文已清理，请读取当前资源状态。',410);return old.response_body;}
  const response=await action();
  const data=response as Record<string,unknown>|null;
  const linkedSession=sessionId??(data&&typeof data==='object'?(typeof data.session_id==='string'?data.session_id:
    typeof data.agent_session_id==='string'?data.agent_session_id:undefined):undefined);
  await insertRow(tx,'idempotency_records',{id:newId(),owner_id:owner,route_id:route,key_hash:keyHash,request_sha256:requestHash,
    response_body:response,state:'COMPLETED',response_status:200,session_id:linkedSession??null,expires_at:new Date(Date.now()+86400_000)});
  return response;
}
