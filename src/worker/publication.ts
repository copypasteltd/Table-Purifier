import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import type { Database,Transaction } from '../db/database.js';
import { one,insertRow,sqlIdentifier } from '../db/database.js';
import { assertFence,cleanup,type Job } from '../db/queue.js';
import { contentHash,newId } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { PROJECT_ROOT } from '../shared/config.js';
import type { Schema } from '../shared/contracts.js';
import { buildArtifacts,MEDIA } from '../storage/artifacts.js';
import { RESULT_FILES,type LocalStore,type ResultFileName } from '../storage/local-store.js';
import { validatePackage } from '../validation/package.js';
import type { ValidatedResult } from '../validation/result.js';
import { get,type BindingRow,type ContractRow,type PlanRow,type RunRow,type SessionRow,type SourceRow,type TaskRow } from '../domain/models.js';

export interface Reservation {resultId:string;artifactSetId:string;resultVersion:number;createdAt:string;}
interface Publication {protocol:'P07-PUBLICATION-1';reservation:Reservation;attemptId:string;validated:ValidatedResult;
 expected:{name:ResultFileName;bytes:number;sha256:string}[];}

async function insertMany(tx:Transaction,table:string,rows:Record<string,unknown>[]):Promise<void>{
 if(!rows.length)return;const columns=Object.keys(rows[0]!);
 for(let start=0;start<rows.length;start+=100){const group=rows.slice(start,start+100);const values:unknown[]=[];
  const tuples=group.map(row=>'('+columns.map(column=>{values.push(row[column]);return '$'+values.length;}).join(',')+')');
  await tx.query(`INSERT INTO p07.${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(',')}) VALUES ${tuples.join(',')}`,values);
 }
}

export class Publisher {
 constructor(private readonly db:Database,private readonly store:LocalStore){}
 async reserve(job:Job,session:SessionRow,run:RunRow):Promise<Reservation>{return this.db.withOwner(job.owner_id,async tx=>{
  const task=await get<TaskRow>(tx,'tasks',run.task_id,true);const current=await get<SessionRow>(tx,'agent_sessions',session.id,true);await assertFence(tx,job);
  invariant(current.status==='BATCH_RUNNING'||current.status==='PERSISTING_RESULTS','INVALID_SESSION_PHASE','本次任务已停止。',409);
  const row=await one<{publication_reservation:Reservation|null}>(tx,'SELECT publication_reservation FROM p07.runs WHERE id=$1 FOR UPDATE',[run.id]);
  if(row?.publication_reservation)return row.publication_reservation;
  const version=(await one<{version:number}>(tx,'SELECT coalesce(max(version),0)+1 AS version FROM p07.result_versions WHERE task_id=$1',[task.id]))!.version;
  const reservation={resultId:newId(),artifactSetId:newId(),resultVersion:version,createdAt:new Date().toISOString()};
  await tx.query('UPDATE p07.runs SET publication_reservation=$2 WHERE id=$1',[run.id,reservation]);return reservation;
 });}
 async prepare(job:Job,session:SessionRow,run:RunRow,contract:ContractRow,plan:PlanRow,binding:BindingRow,
  validated:ValidatedResult,attemptId:string,model:string|null):Promise<Publication>{
  invariant(validated.counts.total_candidates>0,'ZERO_CANDIDATE_DELIVERY','未整理出有效候选记录，不能作为正常成表交付。',422);
  const reservation=await this.reserve(job,session,run);
  const key=`sessions/${session.id}/control/publication-${run.id}.json`;
  const existing=await this.store.read(key).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(existing){const saved=JSON.parse(existing.toString('utf8')) as Publication;
   invariant(saved.protocol==='P07-PUBLICATION-1'&&saved.reservation.resultId===reservation.resultId&&saved.validated.contentHash===validated.contentHash,
    'PUBLICATION_RESUME_MISMATCH','持久结果恢复记录与本次验收不一致。',503);await this.markPersisting(job,session.id);return saved;}
  // No permanent result can be written before the full Host receipt exists.
  // An interrupted build is therefore safe to rebuild here after all Agent processes stop.
  for(const name of RESULT_FILES)await this.store.removeObject(`sessions/${session.id}/candidate/${name}`);
  const expected=await buildArtifacts(this.store,session.id,reservation.resultId,validated,binding.content_sha256,plan.plan_sha256,
   {artifactSetId:reservation.artifactSetId,taskId:run.task_id,runId:run.id,resultVersion:reservation.resultVersion,
    sourceSetHash:plan.source_set_sha256,createdAt:reservation.createdAt,model});
  const ajv=new Ajv2020({strict:false});(formats as unknown as (a:Ajv2020)=>void)(ajv);
  const schema=JSON.parse(await readFile(join(PROJECT_ROOT,'assets/development/v3.0.0/artifact-manifest.schema.json'),'utf8'));
  const manifest=JSON.parse((await this.store.read(`sessions/${session.id}/candidate/manifest.json`)).toString('utf8'));
  invariant(ajv.validate(schema,manifest),'ARTIFACT_MANIFEST_INVALID','结果文件清单不符合封存契约。',422);
  await validatePackage(this.store,session.id,validated);
  const publication:Publication={protocol:'P07-PUBLICATION-1',reservation,attemptId,validated,expected};
  await this.store.write(key,Buffer.from(JSON.stringify(publication)));await this.markPersisting(job,session.id);return publication;
 }
 private async markPersisting(job:Job,id:string){await this.db.withOwner(job.owner_id,async tx=>{
  const initial=await get<SessionRow>(tx,'agent_sessions',id);if(initial.task_id)await get<TaskRow>(tx,'tasks',initial.task_id,true);
  const session=await get<SessionRow>(tx,'agent_sessions',id,true);await assertFence(tx,job);
  invariant(['BATCH_RUNNING','PERSISTING_RESULTS'].includes(session.status),'PUBLICATION_REVOKED','当前处理已停止。',409);
  if(session.status==='BATCH_RUNNING')await tx.query("UPDATE p07.agent_sessions SET status='PERSISTING_RESULTS' WHERE id=$1",[id]);
 });}
 async resume(session:SessionRow,run:RunRow):Promise<Publication|null>{
  const content=await this.store.read(`sessions/${session.id}/control/publication-${run.id}.json`).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(!content)return null;const publication=JSON.parse(content.toString('utf8')) as Publication;
  invariant(publication.protocol==='P07-PUBLICATION-1','PUBLICATION_RESUME_MISMATCH','结果恢复凭据无效。',503);return publication;
 }
 async publish(job:Job,session:SessionRow,run:RunRow,contract:ContractRow,binding:BindingRow,sources:SourceRow[],publication:Publication):Promise<void>{
  const {reservation:r,validated:v,expected}=publication;
  const stored=await this.store.persistResults(session.id,job.owner_id,r.resultId,expected);
  await this.db.withOwner(job.owner_id,async tx=>{
   const task=await get<TaskRow>(tx,'tasks',run.task_id,true);const current=await get<SessionRow>(tx,'agent_sessions',session.id,true);await assertFence(tx,job);
   const already=await one(tx,'SELECT id FROM p07.result_versions WHERE run_id=$1',[run.id]);if(already)return;
   invariant(['BATCH_RUNNING','PERSISTING_RESULTS'].includes(current.status)&&!task.deleted_at,'PUBLICATION_REVOKED','本次任务已停止，不允许发布。',409);
   const paid=await one(tx,`SELECT o.id FROM p07.orders o JOIN p07.entitlement_grants g ON g.order_id=o.id AND g.owner_id=o.owner_id
    WHERE g.id=$1 AND g.kind='PAID' AND g.revoked_at IS NULL AND o.payment_status='CONFIRMED' AND o.refunded_minor+o.refund_reserved_minor=0`,[run.grant_id]);
   invariant(paid,'PAYMENT_REQUIRED','原订单授权已撤销，不允许发布。',403);
   if(current.status==='BATCH_RUNNING')await tx.query("UPDATE p07.agent_sessions SET status='PERSISTING_RESULTS' WHERE id=$1",[session.id]);
   const base=`results/${job.owner_id}/${r.resultId}`;
   for(const source of sources){const units=v.units.filter(u=>u.source_id===source.id);if(!units.length)continue;
    const manifestId=newId();await insertRow(tx,'parse_manifests',{id:manifestId,owner_id:job.owner_id,source_id:source.id,source_set_id:contract.source_set_id,
     attempt_id:publication.attemptId,parser_version:'p07-agent-tools-1',unitizer_version:'p07-agent-tools-1',object_key:'PURGED',
     unit_count:units.length,manifest_sha256:contentHash(units.map(u=>({id:u.unit_id,sha256:u.sha256})))});
    await insertMany(tx,'source_units',units.map(u=>({id:u.unit_id,owner_id:job.owner_id,manifest_id:manifestId,source_id:source.id,ordinal:u.ordinal,
     unit_kind:u.kind,locator:u.locator,content_sha256:u.sha256,text_object_key:null,readability:u.readability})));
   }
   await insertRow(tx,'result_versions',{id:r.resultId,owner_id:job.owner_id,task_id:task.id,run_id:run.id,binding_id:binding.id,version:r.resultVersion,
    quality_status:v.quality,validation_object_key:base+'/validation.json',candidate_count:v.counts.total_candidates,content_sha256:v.contentHash});
   await insertMany(tx,'records',v.records.map(record=>({id:record.record_id,owner_id:job.owner_id,result_id:r.resultId,stable_key:record.record_id,
    disposition:record.disposition,exclusion_reason:record.exclusion_reason,ordinal:record.ordinal})));
   await insertMany(tx,'evidence',v.evidence.map(e=>({id:e.evidence_id,owner_id:job.owner_id,run_id:run.id,source_unit_id:e.unit_id,locator:e.locator,
    excerpt_object_key:base+'/provenance.jsonl',excerpt_sha256:contentHash(e.excerpt),relation_note:null})));
   const fieldRows:Record<string,unknown>[]=[],fieldEvidence:Record<string,unknown>[]=[];
   for(const record of v.records)for(const field of record.fields){const id=newId();fieldRows.push({id,owner_id:job.owner_id,record_id:record.record_id,
    field_id:field.field_id,raw_object_key:base+'/result.json',raw_text:field.raw_text,typed_value:JSON.stringify(field.typed_value),status:field.status,unit:field.unit,transform_chain:JSON.stringify(field.transform_chain)});
    for(const evidenceId of field.evidence_ids)fieldEvidence.push({id:newId(),owner_id:job.owner_id,field_value_id:id,evidence_id:evidenceId,relation:'SUPPORTS'});}
   await insertMany(tx,'field_values',fieldRows);await insertMany(tx,'field_evidence',fieldEvidence);
   await insertMany(tx,'issues',v.issues.map(issue=>({id:issue.issue_id,owner_id:job.owner_id,result_id:r.resultId,record_id:issue.record_id,
    field_id:issue.field_id,code:issue.code,severity:issue.severity,status:issue.status,allowed_decisions:JSON.stringify(issue.allowed_decisions),
    details:{message:issue.message,evidence_ids:issue.evidence_ids}})));
   await insertMany(tx,'coverage_entries',v.coverageEntries.map(c=>({id:newId(),owner_id:job.owner_id,run_id:run.id,source_unit_id:c.unit_id,
    disposition:c.disposition,reason:c.reason})));
   const manifest=expected.find(e=>e.name==='manifest.json')!;
   await insertRow(tx,'artifact_sets',{id:r.artifactSetId,owner_id:job.owner_id,run_id:run.id,result_id:r.resultId,status:'READY',manifest_sha256:manifest.sha256});
   await insertMany(tx,'artifacts',stored.map(s=>{const name=s.key.split('/').at(-1)! as ResultFileName;return {id:newId(),owner_id:job.owner_id,
    artifact_set_id:r.artifactSetId,name,object_key:s.key,sha256:s.sha256,byte_count:s.bytes,media_type:MEDIA[name]};}));
   await tx.query("UPDATE p07.runs SET execution_status='SUCCEEDED',quality_status=$2,current_stage='COMPLETE',finished_at=now(),version=version+1,result_summary=$3 WHERE id=$1",
    [run.id,v.quality,{counts:v.counts,coverage:v.coverage}]);
   await tx.query('UPDATE p07.tasks SET current_result_id=$2,version=version+1,updated_at=now() WHERE id=$1',[task.id,r.resultId]);
   await tx.query("UPDATE p07.orders SET fulfillment_status='DELIVERABLE',version=version+1,updated_at=now() WHERE contract_id=$1",[contract.id]);
   await tx.query("UPDATE p07.agent_sessions SET result_id=$2,status='RELEASING_RUNTIME' WHERE id=$1",[session.id,r.resultId]);
   await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now(),version=version+1 WHERE id=$1",[job.operation_id,{id:r.resultId,kind:'RESULT'}]);
   await insertRow(tx,'outbox_events',{id:newId(),owner_id:job.owner_id,event_key:'result:'+r.resultId,topic:'RESULT_DURABLE_CLEANUP',aggregate_id:r.resultId,
    payload:{session_id:session.id,result_id:r.resultId,files:9}});
   await cleanup(tx,job.owner_id,{...session,result_id:r.resultId});
  });
 }
}
