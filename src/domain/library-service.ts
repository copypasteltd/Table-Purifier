import type { Transaction } from '../db/database.js';
import { insertRow,one } from '../db/database.js';
import type { Body,Contracts,Schema } from '../shared/contracts.js';
import { contentHash,newId } from '../shared/crypto.js';
import { assertVersion,invariant,notFound } from '../shared/errors.js';
import { validateSchema } from '../validation/schema.js';
import type { LocalStore } from '../storage/local-store.js';
import { get,type Actor,type BindingRow,type OrderRow,type TaskRow } from './models.js';
import type { TaskService } from './task-service.js';
import type { CommerceService } from './commerce-service.js';
import type { Page,ResultService } from './result-service.js';

interface Template {id:string;name:string;version:number;current_template_version_id:string;deleted_at:Date|null;updated_at:Date;}
const SENSITIVE=/(?:\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)|(?:身份证|银行卡|收件地址|联系电话)[：:]\s*\S+)/u;

/** Saves schema definitions only. No records, examples, evidence or source bodies enter the template store. */
export class LibraryService {
 constructor(readonly contracts:Contracts,readonly store:LocalStore,readonly tasks:TaskService,readonly commerce:CommerceService,readonly results:ResultService){}
 async consent(tx:Transaction,id:string,scope:string):Promise<void>{
  const row=await one(tx,`SELECT c.id FROM p07.consents c JOIN p07.privacy_policies p ON p.id=c.policy_id
   WHERE c.id=$1 AND c.scope=$2 AND c.action='GRANT' AND p.policy_version=$3 AND NOT EXISTS(
    SELECT 1 FROM p07.consents n WHERE n.owner_id=c.owner_id AND n.scope=c.scope AND n.effective_at>c.effective_at AND n.action='WITHDRAW')`,
   [id,scope,this.tasks.config.P07_POLICY_VERSION]);invariant(row,'CONSENT_REQUIRED','请先确认对应用途的保存说明。',403);
 }
 async pureSchema(tx:Transaction,schema:Schema['SchemaDefinition'],name:string,binding?:BindingRow):Promise<Schema['SchemaDefinition']>{
  this.contracts.validate('SchemaDefinition',schema);validateSchema(schema);
  const text=JSON.stringify({name,schema});invariant(!SENSITIVE.test(text),'TEMPLATE_REVIEW_REQUIRED','规范描述可能包含个人资料，请移除具体事实后再保存。',422);
  if(binding){const values=(await tx.query<{raw_text:string}>(`SELECT DISTINCT v.raw_text FROM p07.field_values v JOIN p07.records r ON r.id=v.record_id
    JOIN p07.result_versions x ON x.id=r.result_id WHERE x.binding_id=$1 AND length(v.raw_text)>=4 LIMIT 5000`,[binding.id])).rows;
   const labels=[name,schema.purpose,schema.row_kind,...schema.fields.flatMap(f=>[f.label,f.description,...f.enum_values??[]])];
   invariant(!values.some(v=>labels.some(label=>label.includes(v.raw_text))),'TEMPLATE_REVIEW_REQUIRED','规范中包含本次记录的具体取值，请修改字段说明后保存。',422);
  }
  // Explicit allowlist; validation rejects unrecognized properties before projection.
  return {schema_id:schema.schema_id,version:schema.version,origin:'PRIVATE_TEMPLATE',purpose:schema.purpose,row_kind:schema.row_kind,
   fields:schema.fields.map(f=>({field_id:f.field_id,label:f.label,order:f.order,type:f.type,required:f.required,nullable:f.nullable,
    unit:f.unit,description:f.description,...(f.scale!==undefined?{scale:f.scale}:{}),...(f.enum_values?{enum_values:[...f.enum_values]}:{}),
    ...(f.closed_enum!==undefined?{closed_enum:f.closed_enum}:{})})),identity_keys:[...schema.identity_keys],rules:structuredClone(schema.rules),
   locale:schema.locale,timezone:schema.timezone,rounding:schema.rounding,export_policy:{...schema.export_policy}};
 }
 async save(tx:Transaction,actor:Actor,body:Body<'32'>):Promise<Schema['PrivateTemplate']>{
  const binding=await get<BindingRow>(tx,'schema_bindings',body.binding_id);const task=await get<TaskRow>(tx,'tasks',binding.task_id);if(task.deleted_at)notFound();
  await this.consent(tx,body.policy_consent_id,'SAVE_PRIVATE_TEMPLATE');
  const schema=await this.pureSchema(tx,binding.content,body.name,binding),id=newId(),versionId=newId();
  await insertRow(tx,'private_templates',{id,owner_id:actor.owner,name:body.name,current_template_version_id:versionId});
  await this.version(tx,actor,id,versionId,1,schema,body.policy_consent_id);return this.read(tx,id);
 }
 private async version(tx:Transaction,actor:Actor,templateId:string,id:string,version:number,schema:Schema['SchemaDefinition'],consentId:string){
  await insertRow(tx,'private_template_versions',{id,owner_id:actor.owner,template_id:templateId,version,content:schema,content_sha256:contentHash(schema),
   sanitizer_version:'P07-PURE-SCHEMA-1',consent_id:consentId});
 }
 async read(tx:Transaction,id:string):Promise<Schema['PrivateTemplate']>{
  const template=await get<Template>(tx,'private_templates',id);if(template.deleted_at)notFound();
  const v=await get<{content:Schema['SchemaDefinition'];sanitizer_version:string}>(tx,'private_template_versions',template.current_template_version_id);
  return {template_id:id,version:template.version,name:template.name,schema:v.content,sanitizer_version:v.sanitizer_version,updated_at:template.updated_at.toISOString()};
 }
 async update(tx:Transaction,actor:Actor,id:string,body:Body<'48'>):Promise<Schema['PrivateTemplate']>{
  const t=await get<Template>(tx,'private_templates',id,true);if(t.deleted_at)notFound();assertVersion(t.version,body.expected_template_version);
  await this.consent(tx,body.policy_consent_id,'SAVE_PRIVATE_TEMPLATE');const schema=await this.pureSchema(tx,body.schema,body.name);
  const versionId=newId();await this.version(tx,actor,id,versionId,t.version+1,schema,body.policy_consent_id);
  await tx.query('UPDATE p07.private_templates SET name=$2,version=version+1,current_template_version_id=$3,updated_at=now() WHERE id=$1',[id,body.name,versionId]);return this.read(tx,id);
 }
 async remove(tx:Transaction,id:string,expected:number):Promise<Schema['Data49']>{
  const t=await get<Template>(tx,'private_templates',id,true);assertVersion(t.version,expected);
  await tx.query('UPDATE p07.private_templates SET deleted_at=coalesce(deleted_at,now()),updated_at=now() WHERE id=$1',[id]);
  return {template_id:id,future_reuse_revoked:true,historical_bindings_retained:true};
 }
 async list(tx:Transaction,actor:Actor,page:Page,filter?:string):Promise<Schema['Data34']>{
  const scope={kind:'templates',query:filter??null},after=this.results.after(actor.owner,scope,page.cursor);const limit=page.limit??20;
  invariant(after===null||typeof after==='string','CURSOR_SCOPE_MISMATCH','翻页位置无效。',400);
  const rows=(await tx.query<{id:string}>(`SELECT id FROM p07.private_templates WHERE deleted_at IS NULL AND($1::uuid IS NULL OR id>$1)
   AND($2::text IS NULL OR position(lower($2) IN lower(name))>0) ORDER BY id LIMIT $3`,[after,filter??null,limit+1])).rows;
  const items=[];for(const row of rows.slice(0,limit))items.push(await this.read(tx,row.id));
  return {items,next_cursor:rows.length>limit?this.results.cursor(actor.owner,scope,rows[limit-1]!.id):null};
 }
 async listTasks(tx:Transaction,actor:Actor,page:Page,mode?:string):Promise<Schema['Data44']>{
  const scope={kind:'tasks',mode:mode??null},after=this.results.after(actor.owner,scope,page.cursor),limit=page.limit??20;
  const rows=(await tx.query<{id:string}>(`SELECT id FROM p07.tasks WHERE deleted_at IS NULL AND($1::uuid IS NULL OR id>$1)
   AND($2::text IS NULL OR mode=$2) ORDER BY id LIMIT $3`,[after,mode??null,limit+1])).rows;
  const items=[];for(const row of rows.slice(0,limit))items.push(await this.tasks.view(tx,row.id));
  return {items,next_cursor:rows.length>limit?this.results.cursor(actor.owner,scope,rows[limit-1]!.id):null};
 }
 async listOrders(tx:Transaction,actor:Actor,page:Page,status?:string):Promise<Schema['Data51']>{
  const scope={kind:'orders',status:status??null},after=this.results.after(actor.owner,scope,page.cursor),limit=page.limit??20;
  const rows=(await tx.query<OrderRow>(`SELECT * FROM p07.orders WHERE ($1::uuid IS NULL OR id>$1) AND($2::text IS NULL OR payment_status=$2) ORDER BY id LIMIT $3`,[after,status??null,limit+1])).rows;
  return {items:rows.slice(0,limit).map(r=>this.commerce.orderView(r)),next_cursor:rows.length>limit?this.results.cursor(actor.owner,scope,rows[limit-1]!.id):null};
 }
 async ticket(tx:Transaction,actor:Actor,body:Body<'52'>|Body<'31'>,orderId?:string):Promise<Schema['Ticket']>{
  if(orderId)await get(tx,'orders',orderId);
  if(body.task_id){const task=await get<TaskRow>(tx,'tasks',body.task_id);if(task.deleted_at)notFound();if('expected_task_version' in body)assertVersion(task.version,body.expected_task_version!);
   if(orderId)invariant(await one(tx,'SELECT o.id FROM p07.orders o JOIN p07.processing_contracts c ON c.id=o.contract_id WHERE o.id=$1 AND c.task_id=$2',[orderId,task.id]),'TICKET_SCOPE_MISMATCH','订单与任务不匹配。',403);}
  invariant(!body.content_access_opt_in||body.task_id,'TASK_REQUIRED','资料访问授权需要明确指定任务。',400);
  const id=newId(),key=`support/${actor.owner}/${id}.txt`;await this.store.write(key,Buffer.from(body.note));
  await insertRow(tx,'support_tickets',{id,owner_id:actor.owner,order_id:orderId??null,task_id:body.task_id??null,category:body.category,note_object_key:key,status:'OPEN'});
  const expires=body.content_access_opt_in?new Date(Date.now()+86400_000):null;
  if(expires)await insertRow(tx,'support_access_grants',{id:newId(),owner_id:actor.owner,ticket_id:id,task_id:body.task_id!,operator_subject:'P07_SUPPORT',purpose:body.category,expires_at:expires});
  return {ticket_id:id,status:'OPEN',content_access_expires_at:expires?.toISOString()??null};
 }
}
