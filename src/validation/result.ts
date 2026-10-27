import { z } from 'zod';
import { newId,contentHash } from '../shared/crypto.js';
import type { Contracts,Schema } from '../shared/contracts.js';
import { invariant } from '../shared/errors.js';
import { compileRule,validateSchema,validateValue,type Scalar } from './schema.js';

export interface SourceUnit {unit_id:string;source_id:string;ordinal:number;kind:Schema['Locator']['kind'];locator:Schema['Locator'];
  sha256:string;text:string;readability:'READABLE'|'PARTIAL'|'UNREADABLE';confidence:number|null;limitations:string[];}
export const evidenceSchema=z.object({evidence_id:z.uuid(),unit_id:z.uuid(),excerpt:z.string().min(1).max(2000),locator:z.record(z.string(),z.unknown())}).strict();
export const candidateSchema=z.object({protocol:z.literal('P07-CANDIDATE-1'),schema_sha256:z.string().regex(/^[0-9a-f]{64}$/),
 records:z.array(z.unknown()).max(1000),issues:z.array(z.unknown()).max(10_000),evidence:z.array(evidenceSchema).max(50_000),
 coverage:z.array(z.object({unit_id:z.uuid(),disposition:z.enum(['READ','UNREADABLE','USER_EXCLUDED']),reason:z.string().max(1000).nullable()}).strict()).max(50),
 limitations:z.array(z.string().max(1000)).max(100)}).strict();
export interface Evidence {evidence_id:string;unit_id:string;excerpt:string;locator:Schema['Locator'];}
export interface ValidatedResult {schema:Schema['SchemaDefinition'];records:Schema['Record'][];issues:Schema['Issue'][];evidence:Evidence[];
  units:SourceUnit[];counts:Schema['Counts'];coverage:Schema['Coverage'];coverageEntries:{unit_id:string;disposition:'READ'|'UNREADABLE'|'USER_EXCLUDED';reason:string|null}[];
  quality:'PASSED'|'NEEDS_REVIEW';limitations:string[];contentHash:string;}

/** Runs in the trusted Host. Never trust agent-supplied validation.json, dispositions, counts or hashes. */
export function validateResult(contracts:Contracts,schema:Schema['SchemaDefinition'],units:SourceUnit[],input:unknown,
  userValues:ReadonlyMap<string,Scalar>=new Map(),estimatedRecords:number|null=null):ValidatedResult {
  contracts.validate('SchemaDefinition',schema);validateSchema(schema);
  const candidate=candidateSchema.parse(input);
  invariant(candidate.schema_sha256===contentHash(schema),'BINDING_HASH_MISMATCH','候选结果使用了未确认的规范。',422);
  const unitMap=new Map(units.map(unit=>[unit.unit_id,unit]));
  invariant(units.length>0&&units.length<=50&&unitMap.size===units.length,'SOURCE_MEASUREMENT_INVALID','可信资料范围计量无效。',422);
  invariant(candidate.coverage.length===units.length&&new Set(candidate.coverage.map(c=>c.unit_id)).size===units.length
    &&candidate.coverage.every(c=>unitMap.has(c.unit_id)),'COVERAGE_INCOMPLETE','候选结果没有覆盖完整已确认资料范围。',422);
  for(const entry of candidate.coverage){const unit=unitMap.get(entry.unit_id)!;
    invariant(entry.disposition!=='USER_EXCLUDED','UNCONFIRMED_EXCLUSION','Agent 不得自行排除已确认资料范围。',422);
    invariant(entry.disposition!=='READ'||unit.readability!=='UNREADABLE','UNREADABLE_COVERAGE','不可读资料不得标记为已读取。',422);
    invariant(entry.disposition==='READ'||!!entry.reason,'UNREADABLE_REASON_REQUIRED','不可读范围必须给出原因。',422);}
  const evidence:Evidence[]=candidate.evidence.map(raw=>{
    const unit=unitMap.get(raw.unit_id);invariant(unit,'EVIDENCE_SOURCE_MISSING','证据未关联本次资料。',422);
    const locator=contracts.validate<Schema['Locator']>('Locator',raw.locator);
    invariant(locator.kind===unit.locator.kind&&locator.page_or_ordinal===unit.locator.page_or_ordinal
      &&locator.path===unit.locator.path,'EVIDENCE_LOCATOR_MISMATCH','证据位置与可信读取结果不符。',422);
    invariant(unit.text.includes(raw.excerpt),'EVIDENCE_NOT_FOUND','证据摘录未出现在对应资料单元中。',422);
    return {...raw,locator};
  });
  const evidenceMap=new Map(evidence.map(e=>[e.evidence_id,e]));
  invariant(evidenceMap.size===evidence.length,'DUPLICATE_EVIDENCE','证据标识重复。',422);
  const records=candidate.records.map(r=>structuredClone(contracts.validate<Schema['Record']>('Record',r)));
  const issues=candidate.issues.map(i=>structuredClone(contracts.validate<Schema['Issue']>('Issue',i)));
  const recordMap=new Map(records.map(r=>[r.record_id,r]));
  invariant(recordMap.size===records.length&&new Set(records.map(r=>r.ordinal)).size===records.length,'DUPLICATE_RECORD','记录标识或顺序重复。',422);
  const issueIds=new Set<string>();
  for(const issue of issues){
    invariant(!issueIds.has(issue.issue_id)&&(!issue.record_id||recordMap.has(issue.record_id)),'ISSUE_REFERENCE_INVALID','问题引用无效或重复。',422);issueIds.add(issue.issue_id);
    invariant(issue.status==='OPEN','UNAUTHORIZED_ISSUE_RESOLUTION','只有用户确认的决定才能解决问题。',422);
    invariant(issue.evidence_ids.every(id=>evidenceMap.has(id)),'EVIDENCE_SOURCE_MISSING','问题引用了不存在的证据。',422);
  }
  const addIssue=(record:Schema['Record'],fieldId:string|null,code:string,message:string)=>{
    if(issues.some(i=>i.record_id===record.record_id&&i.field_id===fieldId&&i.code===code))return;
    const issue:Schema['Issue']={issue_id:newId(),record_id:record.record_id,field_id:fieldId,code,severity:'BLOCKER',message,
      allowed_decisions:['USER_VALUE','KEEP_UNRESOLVED'],evidence_ids:[],status:'OPEN'};
    issues.push(issue);issueIds.add(issue.issue_id);
  };
  const fieldMap=new Map(schema.fields.map(f=>[f.field_id,f]));const rules=schema.rules.map(r=>compileRule(r,schema.fields));
  for(const record of records){
    invariant(record.fields.length===schema.fields.length&&new Set(record.fields.map(f=>f.field_id)).size===record.fields.length
      &&record.fields.every(f=>fieldMap.has(f.field_id)),'RECORD_SCHEMA_MISMATCH','记录字段与已确认规范不一致。',422);
    if(record.disposition==='EXCLUDED')invariant(!!record.exclusion_reason,'EXCLUSION_REASON_REQUIRED','排除记录必须注明理由。',422);
    for(const value of record.fields){
      const field=fieldMap.get(value.field_id)!;
      invariant(value.unit===field.unit,'VALUE_UNIT_MISMATCH','字段值单位与已确认规范不同。',422);
      invariant(value.evidence_ids.every(id=>evidenceMap.has(id)),'EVIDENCE_SOURCE_MISSING','字段引用了不存在的证据。',422);
      try{validateValue(field,value.typed_value);}catch{addIssue(record,field.field_id,'INVALID_FIELD_VALUE','值缺失、类型、格式或精度不符合规范。');}
      if(['MISSING','CONFLICT','UNREADABLE'].includes(value.status))addIssue(record,field.field_id,value.status,'该字段需要确认后才能通过验收。');
      if(value.typed_value!==null){
        if(value.status==='USER_PROVIDED'){
          invariant(userValues.has(record.record_id+':'+field.field_id)&&userValues.get(record.record_id+':'+field.field_id)===value.typed_value,
            'USER_VALUE_UNVERIFIED','字段未关联服务端确认的用户输入。',422);
        }else if(value.status==='DERIVED'||value.status==='DEFAULTED'){
          addIssue(record,field.field_id,'UNVERIFIED_DERIVATION','推导或默认值尚未关联可独立复算的已确认规则。');
        }else if(!value.evidence_ids.length)addIssue(record,field.field_id,'EVIDENCE_REQUIRED','此值缺少可追溯的来源证据。');
        else{
          if(value.raw_text!==null&&!value.evidence_ids.some(id=>evidenceMap.get(id)!.excerpt.includes(value.raw_text!)))
            addIssue(record,field.field_id,'RAW_VALUE_NOT_IN_EVIDENCE','原始值没有出现在引用证据中。');
          if(value.status==='EXTRACTED'&&value.typed_value!==value.raw_text&&typeof value.typed_value==='string')
            addIssue(record,field.field_id,'TRANSFORM_NOT_DECLARED','字段值与原始摘录不同，但未声明转换。');
          if(value.status==='NORMALIZED'&&!value.transform_chain.length)addIssue(record,field.field_id,'TRANSFORM_NOT_DECLARED','规范化值缺少转换说明。');
          if(value.evidence_ids.some(id=>(unitMap.get(evidenceMap.get(id)!.unit_id)!.confidence??1)<0.8))
            addIssue(record,field.field_id,'LOW_CONFIDENCE_SOURCE','该值来自识别置信度不足的资料，需要人工核对。');
        }
      }
    }
    const values=new Map(record.fields.map(f=>[f.field_id,f.typed_value]));
    for(const [index,rule] of rules.entries()){try{if(!rule(values))addIssue(record,null,'RULE_FAILED_'+index,'记录不符合已确认的跨字段规则。');}
      catch{addIssue(record,null,'RULE_EVALUATION_'+index,'规则无法确定计算，需要人工确认。');}}
  }
  if(schema.identity_keys.length){
    const seen=new Map<string,Schema['Record']>();
    for(const record of records.filter(r=>r.disposition!=='EXCLUDED')){
      const values=new Map(record.fields.map(f=>[f.field_id,f.typed_value]));if(schema.identity_keys.some(k=>values.get(k)===null))continue;
      const key=contentHash(schema.identity_keys.map(k=>values.get(k)));const prior=seen.get(key);
      if(prior){addIssue(prior,null,'DUPLICATE_IDENTITY','存在相同主键的候选记录。');addIssue(record,null,'DUPLICATE_IDENTITY','存在相同主键的候选记录。');}else seen.set(key,record);
    }
  }
  if(estimatedRecords!==null&&records.length!==estimatedRecords)issues.push({issue_id:newId(),record_id:null,field_id:null,code:'RECORD_COUNT_CHANGED',severity:'BLOCKER',
   message:`当前候选记录 ${records.length} 条，与确认方案预计的 ${estimatedRecords} 条不一致，请核对是否存在遗漏、拆分或合并。`,allowed_decisions:[],evidence_ids:[],status:'OPEN'});
  for(const record of records){record.issue_ids=issues.filter(i=>i.record_id===record.record_id).map(i=>i.issue_id);
    if(record.disposition!=='EXCLUDED')record.disposition=issues.some(i=>(i.record_id===record.record_id||i.record_id===null)&&i.severity==='BLOCKER')?'NEEDS_REVIEW':'ACCEPTED';}
  const counts:Schema['Counts']={total_candidates:records.length,accepted:records.filter(r=>r.disposition==='ACCEPTED').length,
    needs_review:records.filter(r=>r.disposition==='NEEDS_REVIEW').length,excluded:records.filter(r=>r.disposition==='EXCLUDED').length,issue_count:issues.length};
  const coverage:Schema['Coverage']={confirmed_units:units.length,read_units:candidate.coverage.filter(c=>c.disposition==='READ').length,
    unreadable_units:candidate.coverage.filter(c=>c.disposition==='UNREADABLE').length,excluded_units:0,
    scope_sha256:contentHash(units.map(u=>({id:u.unit_id,sha256:u.sha256}))),limitations:candidate.coverage.filter(c=>c.disposition!=='READ').map(c=>c.reason!)};
  const quality=counts.needs_review>0||coverage.unreadable_units>0||issues.some(i=>i.severity==='BLOCKER')?'NEEDS_REVIEW':'PASSED';
  return {schema,records,issues,evidence,units,counts,coverage,coverageEntries:candidate.coverage,quality,limitations:candidate.limitations,
    // P07-CJ1 numbers are exact integers. Coordinates are a geometric decimal
    // projection for hashing only; the public locator keeps its numeric format.
    contentHash:contentHash({schema,records,issues,evidence:evidence.map(e=>({...e,locator:{...e.locator,
      ...(e.locator.bbox?{bbox:e.locator.bbox.map(n=>String(n))}:{})}})),coverage})};
}
