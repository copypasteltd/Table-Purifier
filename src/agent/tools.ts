import { join } from 'node:path';
import { z } from 'zod';
import type { Config } from '../shared/config.js';
import { newId,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import type { SourceRow } from '../domain/models.js';
import type { SourceUnit } from '../validation/result.js';
import type { LocalStore } from '../storage/local-store.js';
import type { BrokerTools } from './broker.js';
import { confinedProcess,type NativeIsolation } from './isolation.js';

const sourceArgs=z.object({source_id:z.uuid()}).strict();
const ocrArgs=sourceArgs.extend({language:z.enum(['chi_sim+eng','chi_tra+eng','eng','chi_sim','chi_tra'])});
const unitData=z.object({ordinal:z.number().int().nonnegative(),kind:z.enum(['TEXT_SPAN','PDF_PAGE','IMAGE_BBOX','DOCX_PATH','SHEET_CELL','CSV_CELL']),
 locator:z.object({version:z.string(),kind:z.string(),page_or_ordinal:z.number().int().nullable(),span:z.tuple([z.number().int(),z.number().int()]).nullable(),
 bbox:z.tuple([z.number(),z.number(),z.number(),z.number()]).nullable(),path:z.string().nullable()}),sha256:z.string(),text:z.string().max(1_500_000),
 readability:z.enum(['READABLE','PARTIAL','UNREADABLE']),confidence:z.number().min(0).max(1).nullable(),limitations:z.array(z.string())});
const readData=z.object({protocol:z.literal('P07-READ-1'),source_sha256:z.string(),bytes:z.number().int(),units:z.array(unitData).min(1).max(50)});

/** Per-turn trusted tool host. It records actual full reads; the Agent cannot write the receipts. */
export class DocumentTools implements BrokerTools {
 readonly definitions=[
  {name:'list_sources',description:'列出本次授权的全部资料与规范模板，不暴露路径。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'read_source',description:'完整读取 source_id 的全部物理单元并记录可信计量。不能抽样代替。',inputSchema:{type:'object',properties:{source_id:{type:'string',format:'uuid'}},required:['source_id'],additionalProperties:false}},
  {name:'ocr_source',description:'明确调用本机离线 OCR 识别单张图片。保留置信度；未配置不伪造识别。',inputSchema:{type:'object',properties:{source_id:{type:'string',format:'uuid'},language:{type:'string',enum:['chi_sim+eng','chi_tra+eng','eng','chi_sim','chi_tra']}},required:['source_id','language'],additionalProperties:false}},
 ];
 private readonly readings=new Map<string,SourceUnit[]>();private tail:Promise<unknown>=Promise.resolve();
 constructor(private readonly config:Config,private readonly store:LocalStore,private readonly isolation:NativeIsolation,
  readonly sessionId:string,readonly sources:SourceRow[],private readonly signal:AbortSignal,
  existing:SourceUnit[]=[],private readonly tesseract:string|null=null){
  for(const source of sources){const units=existing.filter(u=>u.source_id===source.id);if(units.length)this.readings.set(source.id,units);}
 }
 call(name:string,args:unknown):Promise<unknown>{const next=this.tail.then(()=>this.execute(name,args));this.tail=next.catch(()=>undefined);return next;}
 private async execute(name:string,args:unknown):Promise<unknown>{
  if(name==='list_sources'){z.object({}).strict().parse(args);return {sources:this.sources.map(s=>({source_id:s.id,role:s.role,sha256:s.content_sha256,
   media_type:s.media_type,bytes:s.byte_count,name:s.display_name}))};}
  const {source_id}=sourceArgs.parse(name==='ocr_source'?{source_id:ocrArgs.parse(args).source_id}:args);
  const source=this.sources.find(s=>s.id===source_id);invariant(source&&source.session_id===this.sessionId,'SOURCE_SCOPE_INVALID','此资料不属于本次授权范围。',403);
  if(name==='read_source'){
   if(this.readings.has(source_id))return {source_id,units:this.readings.get(source_id)};
   const object=await this.store.inspect(source.object_key);
   invariant(object.sha256===source.content_sha256&&object.bytes===source.byte_count,'SOURCE_HASH_MISMATCH','原始资料摘要不符。',422);
   const scope=await this.isolation.scope(this.sessionId,this.isolation.profile.python,false,[join(this.config.projectRoot,'agent/tools')]);
   const output=await confinedProcess(this.isolation.profile.launcher,['-I',join(this.config.projectRoot,'agent/tools/read_document.py')],scope.env,
    JSON.stringify({path:await this.store.path(source.object_key),media_type:source.media_type}),AbortSignal.any([this.signal,AbortSignal.timeout(60_000)]),8_000_000,[0,2]);
   await this.isolation.verify(scope);const parsed=JSON.parse(output);
   invariant(!parsed.error,'SOURCE_READ_FAILED',parsed.error==='PROCESSING_UNIT_LIMIT'?'资料超过完整范围处理预算，请减少资料。':'资料无法完整读取，请检查格式、密码或扫描内容。',422);
   const read=readData.parse(parsed);
   invariant(read.source_sha256===source.content_sha256&&read.bytes===source.byte_count,'SOURCE_HASH_MISMATCH','读取内容与授权原件不符。',422);
   const units:SourceUnit[]=read.units.map(unit=>({...unit,unit_id:newId(),source_id:source.id,locator:{...unit.locator,kind:unit.kind}}));
   for(const unit of units)invariant(unit.sha256===sha256(unit.text),'TOOL_READ_INVALID','读取摘要校验失败。',422);
   this.readings.set(source.id,units);
   const factUnits=this.units();invariant(factUnits.length<=50,'PROCESSING_UNIT_LIMIT','完整资料范围超过五十个处理单元。',422);
   await this.store.write(`sessions/${this.sessionId}/control/read-${source.id}.json`,Buffer.from(JSON.stringify({source_id,units})));
   return {source_id,units};
  }
  invariant(name==='ocr_source'&&this.tesseract&&source.media_type.startsWith('image/'),'OCR_UNAVAILABLE','本次资料没有可用的离线图片识别工具。',422);
  const {language}=ocrArgs.parse(args);if(!this.readings.has(source.id))await this.execute('read_source',{source_id});
  const scope=await this.isolation.scope(this.sessionId,this.isolation.profile.python,false,[join(this.config.projectRoot,'agent/tools')]);
  const output=await confinedProcess(this.isolation.profile.launcher,['-I',join(this.config.projectRoot,'agent/tools/ocr_image.py')],scope.env,
   JSON.stringify({path:await this.store.path(source.object_key),language,tesseract:this.tesseract}),AbortSignal.any([this.signal,AbortSignal.timeout(100_000)]),8_000_000,[0,2]);
  await this.isolation.verify(scope);
  const parsed=z.object({protocol:z.literal('P07-OCR-1'),text:z.string().max(1_500_000),words:z.array(z.object({text:z.string(),confidence:z.number().min(0).max(1),
   bbox:z.array(z.number().min(0).max(1)).length(4)})).max(100_000),sha256:z.string(),confidence:z.number().min(0).max(1)}).parse(JSON.parse(output));
  invariant(parsed.sha256===sha256(parsed.text),'OCR_READ_INVALID','识别摘要校验失败。',422);
  const unit=this.readings.get(source.id)![0]!;
  const upgraded:SourceUnit={...unit,text:parsed.text,sha256:parsed.sha256,confidence:parsed.confidence,
   readability:parsed.text.trim()?'PARTIAL':'UNREADABLE',limitations:['OCR_MAY_CONTAIN_RECOGNITION_ERRORS'],locator:{...unit.locator,bbox:[0,0,1,1]}};
  this.readings.set(source.id,[upgraded]);
  await this.store.write(`sessions/${this.sessionId}/control/ocr-${source.id}.json`,Buffer.from(JSON.stringify({source_id,unit:upgraded,words:parsed.words})));
  return {source_id,units:[upgraded],words:parsed.words};
 }
 units():SourceUnit[]{return this.sources.filter(s=>s.role==='SOURCE').flatMap(s=>this.readings.get(s.id)??[]);}
 allUnits():SourceUnit[]{return this.sources.flatMap(s=>this.readings.get(s.id)??[]);}
 assertAllRead():void{invariant(this.sources.every(s=>this.readings.has(s.id))&&this.units().length>0,'FULL_ANALYSIS_REQUIRED','尚未完成所有资料和模板的完整读取。',422);}
}
