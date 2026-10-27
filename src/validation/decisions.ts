import type { Contracts,Schema } from '../shared/contracts.js';
import { invariant } from '../shared/errors.js';
import { candidateSchema,type SourceUnit } from './result.js';
import type { Scalar } from './schema.js';

export interface ConfirmedDecision {record_id:string;field_id:string;action:string;user_value?:Scalar;evidence_id?:string;selected_excerpt?:string;}
/** A completed model turn cannot silently omit, reinterpret, or resolve an approved decision. */
export function assertConfirmedDecisions(contracts:Contracts,input:unknown,decisions:ConfirmedDecision[],units:SourceUnit[]):void{
 if(!decisions.length)return;const candidate=candidateSchema.parse(input),records=candidate.records.map(r=>contracts.validate<Schema['Record']>('Record',r));
 const issues=candidate.issues.map(i=>contracts.validate<Schema['Issue']>('Issue',i));
 for(const d of decisions){const record=records.find(r=>r.record_id===d.record_id),field=record?.fields.find(f=>f.field_id===d.field_id);
  invariant(record&&record.disposition!=='EXCLUDED'&&field,'CONFIRMED_DECISION_OMITTED','结果遗漏了已确认的目标记录或字段。',422);
  if(d.action==='USER_VALUE')invariant(field.status==='USER_PROVIDED'&&field.typed_value===d.user_value,'CONFIRMED_VALUE_CHANGED','结果未保留用户明确提供的值及其来源类型。',422);
  if(d.action==='KEEP_UNRESOLVED')invariant(['MISSING','CONFLICT','UNREADABLE'].includes(field.status)&&field.typed_value===null
   &&issues.some(i=>i.record_id===d.record_id&&i.field_id===d.field_id&&i.status==='OPEN'),'CONFIRMED_ISSUE_RESOLVED','用户要求保留待确认的问题不能被自动解决。',422);
  if(d.action==='CHOOSE_EVIDENCE'){
   const excerpt=d.selected_excerpt,encoded=excerpt?JSON.stringify(excerpt).slice(1,-1):'';
   invariant(excerpt&&field.evidence_ids.some(id=>{const evidence=candidate.evidence.find(e=>e.evidence_id===id),unit=units.find(u=>u.unit_id===evidence?.unit_id);
    return evidence&&unit&&unit.text.includes(d.evidence_id!)&&(evidence.excerpt.includes(excerpt)||evidence.excerpt.includes(encoded));}),
   'CONFIRMED_EVIDENCE_CHANGED','结果未引用用户选定的父结果证据，请重新核对。',422);
  }
 }
}
