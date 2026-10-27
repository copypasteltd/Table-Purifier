import { z } from 'zod';
import type { Transaction } from '../db/database.js';
import { one,insertRow } from '../db/database.js';
import type { Config } from '../shared/config.js';
import type { Body,Schema } from '../shared/contracts.js';
import { contentHash,constantTimeEqual,newId,opaquePayload,readOpaquePayload,sha256 } from '../shared/crypto.js';
import { assertVersion,invariant,notFound } from '../shared/errors.js';
import { cleanup,operation } from '../db/queue.js';
import type { LocalStore,ResultFileName } from '../storage/local-store.js';
import { get,operationView,type Actor,type OperationRow,type RunRow,type SessionRow,type TaskRow } from './models.js';

export interface Page {limit?:number;cursor?:string;result_version?:number;disposition?:string;fields?:string;severity?:string;type?:string;}
interface ResultRow {id:string;version:number;run_id:string;binding_id:string;quality_status:Schema['QualityStatus'];candidate_count:number;}
interface ArtifactRow {id:string;artifact_set_id:string;name:ResultFileName;object_key:string;sha256:string;byte_count:number;media_type:string;}
interface RecordRow {id:string;ordinal:number;disposition:Schema['Record']['disposition'];exclusion_reason:string|null;}
interface ValueRow {id:string;record_id:string;field_id:string;raw_text:string|null;typed_value:Schema['FieldValue']['typed_value'];status:Schema['FieldValue']['status'];unit:string|null;transform_chain:Schema['FieldValue']['transform_chain'];evidence_ids:string[];}
interface IssueRow {id:string;record_id:string|null;field_id:string|null;code:string;severity:Schema['Issue']['severity'];status:Schema['Issue']['status'];allowed_decisions:Schema['Issue']['allowed_decisions'];details:{message:string;evidence_ids:string[]};}
const issueView=(r:IssueRow):Schema['Issue']=>({issue_id:r.id,record_id:r.record_id,field_id:r.field_id,code:r.code,severity:r.severity,status:r.status,
 allowed_decisions:r.allowed_decisions,message:r.details.message,evidence_ids:r.details.evidence_ids});
const cursorSchema=z.object({owner:z.uuid(),scope:z.string(),after:z.union([z.string(),z.number().int().nonnegative()]),expires:z.number().int()}).strict();

export class ResultService {
 constructor(readonly config:Config,readonly store:LocalStore){}
 cursor(owner:string,scope:unknown,after:string|number):string{return opaquePayload(this.config.P07_TOKEN_SECRET,{owner,scope:contentHash(scope),after,expires:Date.now()+86400_000});}
 after(owner:string,scope:unknown,cursor?:string):string|number|null{
  if(!cursor)return null;const value=cursorSchema.parse(readOpaquePayload(this.config.P07_TOKEN_SECRET,cursor));
  invariant(value.owner===owner&&value.scope===contentHash(scope)&&value.expires>Date.now(),'CURSOR_SCOPE_MISMATCH','翻页位置已失效，请重新加载。',409);return value.after;
 }
 async result(tx:Transaction,id:string,version?:number):Promise<ResultRow>{
  const run=await get<RunRow>(tx,'runs',id);const task=await get<TaskRow>(tx,'tasks',run.task_id);if(task.deleted_at)notFound();
  const row=await one<ResultRow>(tx,'SELECT * FROM p07.result_versions WHERE run_id=$1 AND($2::bigint IS NULL OR version=$2)',[id,version??null]);
  invariant(row,'RESULT_NOT_READY','指定版本的结果尚不可用。',409);return row;
 }
 async records(tx:Transaction,actor:Actor,id:string,page:Page):Promise<Schema['Data21']>{
  const result=await this.result(tx,id,page.result_version);const selected=page.fields?.split(',');
  const binding=await one<{content:Schema['SchemaDefinition']}>(tx,'SELECT content FROM p07.schema_bindings WHERE id=$1',[result.binding_id]);
  invariant(binding&&(!selected||selected.every(f=>binding.content.fields.some(s=>s.field_id===f))),'FIELD_SELECTION_INVALID','所选字段不在结果规范中。',400);
  const scope={kind:'records',result:result.id,disposition:page.disposition??null,fields:selected??null};
  const after=this.after(actor.owner,scope,page.cursor);invariant(after===null||typeof after==='number','CURSOR_SCOPE_MISMATCH','翻页位置无效。',400);
  const limit=page.limit??20;
  const rows=(await tx.query<RecordRow>(`SELECT * FROM p07.records WHERE result_id=$1 AND ordinal>$2
   AND($3::text IS NULL OR disposition=$3) ORDER BY ordinal LIMIT $4`,[result.id,after??-1,page.disposition??null,limit+1])).rows;
  const slice=rows.slice(0,limit),ids=slice.map(r=>r.id);
  const fields=(await tx.query<ValueRow>(`SELECT v.*,coalesce(array_agg(e.evidence_id ORDER BY e.evidence_id) FILTER(WHERE e.evidence_id IS NOT NULL),'{}'::uuid[]) evidence_ids
   FROM p07.field_values v LEFT JOIN p07.field_evidence e ON e.field_value_id=v.id AND e.owner_id=v.owner_id
   WHERE v.record_id=ANY($1::uuid[]) AND($2::text[] IS NULL OR v.field_id=ANY($2)) GROUP BY v.id ORDER BY v.field_id`,[ids,selected??null])).rows;
  const issues=(await tx.query<{id:string;record_id:string}>("SELECT id,record_id FROM p07.issues WHERE result_id=$1 AND record_id=ANY($2::uuid[]) ORDER BY id",[result.id,ids])).rows;
  const summary=(await one<{result_summary:{counts:Schema['Counts']}}>(tx,'SELECT result_summary FROM p07.runs WHERE id=$1',[id]))!;
  return {result_version:result.version,records:slice.map(r=>({record_id:r.id,ordinal:r.ordinal,disposition:r.disposition,exclusion_reason:r.exclusion_reason,
   fields:fields.filter(f=>f.record_id===r.id).map(f=>({field_id:f.field_id,raw_text:f.raw_text,typed_value:f.typed_value,status:f.status,
    unit:f.unit,transform_chain:f.transform_chain,evidence_ids:f.evidence_ids})),issue_ids:issues.filter(i=>i.record_id===r.id).map(i=>i.id)})),
   counts:summary.result_summary.counts,next_cursor:rows.length>limit?this.cursor(actor.owner,scope,slice.at(-1)!.ordinal):null};
 }
 async issues(tx:Transaction,actor:Actor,id:string,page:Page):Promise<Schema['Data22']>{
  const result=await this.result(tx,id,page.result_version),limit=page.limit??20;
  const scope={kind:'issues',result:result.id,severity:page.severity??null,type:page.type??null};const after=this.after(actor.owner,scope,page.cursor);
  invariant(after===null||typeof after==='string'&&z.uuid().safeParse(after).success,'CURSOR_SCOPE_MISMATCH','问题翻页位置无效。',400);
  const rows=(await tx.query<IssueRow>(`SELECT * FROM p07.issues WHERE result_id=$1 AND($2::uuid IS NULL OR id>$2)
   AND($3::text IS NULL OR severity=$3) AND($4::text IS NULL OR code=$4) ORDER BY id LIMIT $5`,[result.id,after,page.severity??null,page.type??null,limit+1])).rows;
  const affected=(await one<{n:number}>(tx,`SELECT CASE WHEN coalesce(bool_or(record_id IS NULL),false) THEN $4 ELSE count(DISTINCT record_id)::integer END n
   FROM p07.issues WHERE result_id=$1 AND($2::text IS NULL OR severity=$2) AND($3::text IS NULL OR code=$3)`,[result.id,page.severity??null,page.type??null,result.candidate_count]))!.n;
  return {result_version:result.version,issues:rows.slice(0,limit).map(issueView),affected_records:affected,
   next_cursor:rows.length>limit?this.cursor(actor.owner,scope,rows[limit-1]!.id):null};
 }
 async evidence(tx:Transaction,id:string):Promise<Schema['Data23']>{
  const row=await one<{id:string;run_id:string;source_id:string;source_unit_id:string;locator:Schema['Locator'];excerpt_object_key:string|null}>(tx,
   'SELECT e.*,u.source_id FROM p07.evidence e JOIN p07.source_units u ON u.id=e.source_unit_id AND u.owner_id=e.owner_id WHERE e.id=$1',[id]);if(!row)notFound();
  await this.result(tx,row.run_id);
  const file=await one<ArtifactRow>(tx,'SELECT * FROM p07.artifacts WHERE object_key=$1',[row.excerpt_object_key]);invariant(file,'EVIDENCE_NOT_AVAILABLE','保留的证据摘录不可用。',410);
  const bytes=await this.store.read(file.object_key);invariant(sha256(bytes)===file.sha256,'ARTIFACT_HASH_MISMATCH','保留摘录摘要不符。',503);
  let excerpt:string|null=null;for(const line of bytes.toString('utf8').split('\n')){if(!line)continue;const e=JSON.parse(line);if(e.evidence_id===id){excerpt=e.excerpt;break;}}
  invariant(excerpt!==null,'EVIDENCE_NOT_AVAILABLE','没有找到保留的证据摘录。',410);
  return {evidence_id:id,source_id:row.source_id,source_unit_id:row.source_unit_id,excerpt,locator:row.locator,authorized_page_url:null,expires_at:null,
   limitations:['仅提供结果包保留的来源摘录与定位；原始资料不提供长期在线访问。']};
 }
 async artifacts(tx:Transaction,id:string):Promise<Schema['Data28']>{
  const result=await this.result(tx,id);
  const set=await one<{id:string;status:Schema['ArtifactStatus'];manifest_sha256:string;revoked_at:Date|null}>(tx,'SELECT * FROM p07.artifact_sets WHERE result_id=$1',[result.id]);
  invariant(set&&set.status==='READY'&&!set.revoked_at,'ARTIFACT_NOT_READY','结果文件尚未准备完成或访问已撤销。',409);
  const rows=(await tx.query<ArtifactRow>('SELECT * FROM p07.artifacts WHERE artifact_set_id=$1 ORDER BY name',[set.id])).rows;
  invariant(rows.length===9,'ARTIFACT_SET_INCOMPLETE','完整结果包文件数量不符。',503);
  return {artifact_set_id:set.id,result_version:result.version,status:set.status,quality:result.quality_status,manifest_hash:set.manifest_sha256,
   artifacts:rows.map(f=>({artifact_id:f.id,name:f.name,sha256:f.sha256,bytes:f.byte_count,media_type:f.media_type,expires_at:null})),expires_at:null};
 }
 private async artifact(tx:Transaction,id:string){const artifact=await get<ArtifactRow>(tx,'artifacts',id);
  const set=await get<{run_id:string;status:string;revoked_at:Date|null}>(tx,'artifact_sets',artifact.artifact_set_id);
  invariant(set.status==='READY'&&!set.revoked_at,'ARTIFACT_NOT_READY','文件访问已撤销或尚未完成。',410);const result=await this.result(tx,set.run_id);return {artifact,result};}
 async downloadLink(tx:Transaction,actor:Actor,id:string,expectedVersion?:number):Promise<Schema['Data29']>{
  const {artifact,result}=await this.artifact(tx,id);if(expectedVersion!==undefined)assertVersion(result.version,expectedVersion);const grantId=newId(),expires=new Date(Date.now()+300_000);
  const token=opaquePayload(this.config.P07_TOKEN_SECRET,{purpose:'DOWNLOAD',owner:actor.owner,grant:grantId,artifact:id,expires:expires.getTime()});
  await insertRow(tx,'download_grants',{id:grantId,owner_id:actor.owner,purpose:'ARTIFACT',artifact_id:id,token_hash:sha256(token),expires_at:expires,result_version:result.version});
  return {signed_url:this.config.P07_PUBLIC_URL+'/transport/v1/downloads/'+grantId+'?token='+encodeURIComponent(token),ttl_seconds:300,sha256:artifact.sha256,bytes:artifact.byte_count};
 }
 downloadOwner(id:string,token:string):string{const grant=this.decodeDownload(id,token);return grant.owner;}
 private decodeDownload(id:string,token:string){const grant=z.object({purpose:z.literal('DOWNLOAD'),owner:z.uuid(),grant:z.uuid(),artifact:z.uuid(),expires:z.number().int()}).strict().parse(readOpaquePayload(this.config.P07_TOKEN_SECRET,token));
  invariant(grant.grant===id&&grant.expires>Date.now(),'DOWNLOAD_GRANT_EXPIRED','领取链接已过期，请重新领取。',403);return grant;}
 async download(tx:Transaction,id:string,token:string):Promise<ArtifactRow>{
  const grant=this.decodeDownload(id,token);const row=await one<{token_hash:string;artifact_id:string;expires_at:Date;revoked_at:Date|null}>(tx,'SELECT * FROM p07.download_grants WHERE id=$1',[id]);
  invariant(row&&row.artifact_id===grant.artifact&&!row.revoked_at&&row.expires_at.getTime()>Date.now()&&constantTimeEqual(row.token_hash,sha256(token)),
   'DOWNLOAD_GRANT_EXPIRED','领取链接已失效，请重新领取。',403);return (await this.artifact(tx,row.artifact_id)).artifact;
 }
 async observe(tx:Transaction,actor:Actor,id:string,body:Body<'33'>):Promise<Schema['Data33']>{
  await this.artifact(tx,id);invariant(body.environment.provider===actor.provider&&body.environment.app_alias===actor.appAlias,'ORIGIN_MISMATCH','设备观察的平台不匹配。',403);
  invariant(!['ARTIFACT_READY','PLATFORM_CONFIRMED'].includes(body.observed_action),'EXPORT_OBSERVATION_FORBIDDEN','客户端不能声明平台已确认取用。',403);
  const old=await one<{id:string}>(tx,'SELECT id FROM p07.export_attempts WHERE client_attempt_id=$1 AND observed_action=$2',[body.client_attempt_id,body.observed_action]);
  const attemptId=old?.id??newId();if(!old)await insertRow(tx,'export_attempts',{id:attemptId,owner_id:actor.owner,artifact_id:id,client_attempt_id:body.client_attempt_id,
   observed_action:body.observed_action,receipt_source:body.receipt_source,environment:body.environment,observed_at:new Date(body.observed_at),receipt_ref:body.receipt_ref??null});
  return {export_attempt_id:attemptId,accepted_observation:body.observed_action};
 }
 async cancel(tx:Transaction,actor:Actor,id:string,body:Body<'30'>):Promise<Schema['Data30']>{
  const initial=await get<RunRow>(tx,'runs',id),task=await get<TaskRow>(tx,'tasks',initial.task_id,true);
  const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);const run=await get<RunRow>(tx,'runs',id,true);assertVersion(run.version,body.expected_run_version);
  const op=await operation(tx,actor.owner,'CANCEL',task.id,id);
  if(!['QUEUED','RUNNING'].includes(run.execution_status)){
   await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now() WHERE id=$1",[op,{id,kind:'RUN'}]);
   return {operation:operationView(await get<OperationRow>(tx,'operations',op)),resolved_status:run.execution_status};}
  await tx.query("UPDATE p07.runs SET cancel_requested_at=now(),execution_status='CANCELED',finished_at=now(),version=version+1 WHERE id=$1",[id]);
  await tx.query("UPDATE p07.agent_sessions SET status='CANCELED' WHERE id=$1",[session.id]);
  await cleanup(tx,actor.owner,session,op);return {operation:operationView(await get<OperationRow>(tx,'operations',op)),resolved_status:'CANCELED'};
 }
}
