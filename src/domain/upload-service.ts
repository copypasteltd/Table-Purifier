import { type Readable } from 'node:stream';
import { fileTypeFromBuffer } from 'file-type';
import { insertRow,type Database,type Transaction } from '../db/database.js';
import type { Config } from '../shared/config.js';
import type { Body } from '../shared/contracts.js';
import { constantTimeEqual,newId,opaquePayload,readOpaquePayload,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { get,sourceView,type Actor,type SourceRow,type UploadRow } from './models.js';
import { TaskService } from './task-service.js';

interface UploadGrant {purpose:'UPLOAD';owner:string;upload:string;expires:number;}
export class UploadService {
 constructor(readonly config:Config,readonly db:Database,readonly tasks:TaskService){}
 async issue(tx:Transaction,actor:Actor,taskId:string,body:Body<'04'>){
  const {session}=await this.tasks.editable(tx,taskId);
  invariant(body.bytes<=(body.role==='TEMPLATE'?5_000_000:20_000_000),'LIMIT_EXCEEDED','文件超过当前大小限制。',413);
  const sources=(await tx.query<SourceRow>('SELECT * FROM p07.source_files WHERE session_id=$1 AND deleted_at IS NULL',[session.id])).rows;
  const pending=await tx.query<{n:number;bytes:number}>(`SELECT count(*) FILTER(WHERE role=$2)::integer n,coalesce(sum(expected_bytes),0)::bigint bytes FROM p07.upload_sessions
    WHERE task_id=$1 AND status IN ('ISSUED','RECEIVING','RECEIVED') AND expires_at>now()`,[taskId,body.role]);
  const same=sources.filter(s=>s.role===body.role);const count=body.role==='SOURCE'?10:1;
  invariant(same.length+pending.rows[0]!.n<count&&sources.reduce((a,s)=>a+s.byte_count,0)+pending.rows[0]!.bytes+body.bytes<=50_000_000,
   'LIMIT_EXCEEDED','文件数量或总大小超过本次限制。',413);
  const id=newId(),expires=new Date(Date.now()+300_000);const token=opaquePayload(this.config.P07_TOKEN_SECRET,{purpose:'UPLOAD',owner:actor.owner,upload:id,expires:expires.getTime()});
  await insertRow(tx,'upload_sessions',{id,owner_id:actor.owner,task_id:taskId,role:body.role,expected_bytes:body.bytes,expected_sha256:body.sha256,
   expected_mime:body.mime,display_name:body.name,token_hash:sha256(token),expires_at:expires,status:'ISSUED'});
  return {upload_id:id,method:'POST' as const,limited_upload_target:this.config.P07_PUBLIC_URL+'/transport/v1/uploads/'+id,
   upload_token:token,expires_at:expires.toISOString(),limits:{bytes:body.bytes,mime:body.mime,sha256:body.sha256}};
 }
 async stage(uploadId:string,token:string,stream:Readable,assertEnvelope?:()=>Promise<void>):Promise<{upload_id:string;observed_bytes:number;observed_sha256:string}>{
  const grant=readOpaquePayload<UploadGrant>(this.config.P07_TOKEN_SECRET,token);
  invariant(grant.purpose==='UPLOAD'&&grant.upload===uploadId&&grant.expires>Date.now(),'UPLOAD_GRANT_EXPIRED','上传许可已过期。',403);
  return this.db.withOwner(grant.owner,async tx=>{
   const row=await get<UploadRow>(tx,'upload_sessions',uploadId);
   const {session}=await this.tasks.editable(tx,row.task_id);
   invariant(constantTimeEqual(row.token_hash,sha256(token))&&row.expires_at.getTime()>Date.now(),'UPLOAD_GRANT_EXPIRED','上传许可无效或过期。',403);
   invariant(row.status==='ISSUED','UPLOAD_ALREADY_RECEIVED','该上传许可已被使用。');
   await tx.query("SET LOCAL idle_in_transaction_session_timeout='60s'");
   await tx.query("UPDATE p07.upload_sessions SET status='RECEIVING' WHERE id=$1",[uploadId]);
   const key=`intake/${session.id}/${uploadId}.bin`;
   // Recover a staged object whose transaction never committed; no accepted upload can enter this branch.
   await this.tasks.store.removeObject(key);
   const timeout=setTimeout(()=>stream.destroy(new Error('Upload deadline exceeded.')),30_000);timeout.unref();
   try{await this.tasks.store.writeStream(key,stream,row.expected_bytes,{bytes:row.expected_bytes,sha256:row.expected_sha256});await assertEnvelope?.();}
   catch(error){await this.tasks.store.removeObject(key);throw error;}
   finally{clearTimeout(timeout);}
   await tx.query("UPDATE p07.upload_sessions SET status='RECEIVED',received_object_key=$2 WHERE id=$1",[uploadId,key]);
   return {upload_id:uploadId,observed_bytes:row.expected_bytes,observed_sha256:row.expected_sha256};
  });
 }
 async complete(tx:Transaction,actor:Actor,id:string,body:Body<'05'>){
  const upload=await get<UploadRow>(tx,'upload_sessions',id);
  const {session}=await this.tasks.editable(tx,upload.task_id);
  if(upload.status==='COMPLETED'&&upload.source_id)return sourceView(await get<SourceRow>(tx,'source_files',upload.source_id));
  invariant(upload.status==='RECEIVED'&&upload.received_object_key&&upload.expires_at.getTime()>Date.now(),'UPLOAD_NOT_RECEIVED','文件尚未完整上传或许可已过期。');
  const content=await this.tasks.store.read(upload.received_object_key,upload.expected_bytes);
  invariant(sha256(content)===body.observed_hash&&body.observed_hash===upload.expected_sha256,'UPLOAD_HASH_MISMATCH','上传文件摘要不匹配。',422);
  const sourceId=newId(),role=upload.role==='SOURCE'?'source':'template',key=`sessions/${session.id}/inputs/${role}/${sourceId}.bin`;
  await this.tasks.store.write(key,content);
  const detected=await fileTypeFromBuffer(content).catch(()=>undefined);
  await insertRow(tx,'source_files',{id:sourceId,owner_id:actor.owner,session_id:session.id,role:upload.role,kind:'FILE',display_name:upload.display_name,
   media_type:detected?.mime??upload.expected_mime,byte_count:content.length,content_sha256:upload.expected_sha256,object_key:key,status:'RECEIVED',
   expires_at:session.idle_expires_at,measurement:{detected_extension:detected?.ext??null}});
  await tx.query("UPDATE p07.upload_sessions SET status='COMPLETED',source_id=$2 WHERE id=$1",[id,sourceId]);
  return sourceView(await get<SourceRow>(tx,'source_files',sourceId));
 }
}
