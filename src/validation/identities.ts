import { candidateSchema } from './result.js';
import type { Contracts,Schema } from '../shared/contracts.js';
import { newId } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import type { Scalar } from './schema.js';

/** Candidate-local IDs never become global DB identities supplied by a model or copied parent result. */
export function freshCandidate(contracts:Contracts,input:unknown,approved:ReadonlyMap<string,Scalar>){
 const candidate=candidateSchema.parse(input),records=candidate.records.map(r=>structuredClone(contracts.validate<Schema['Record']>('Record',r))),issues=candidate.issues.map(i=>structuredClone(contracts.validate<Schema['Issue']>('Issue',i)));
 const mapping=(ids:string[])=>{invariant(new Set(ids).size===ids.length,'DUPLICATE_CANDIDATE_ID','候选标识重复。',422);return new Map(ids.map(id=>[id,newId()]));};
 const r=mapping(records.map(x=>x.record_id)),i=mapping(issues.map(x=>x.issue_id)),e=mapping(candidate.evidence.map(x=>x.evidence_id));
 const ref=(map:Map<string,string>,id:string)=>{const value=map.get(id);invariant(value,'CANDIDATE_REFERENCE_INVALID','候选结果引用不存在的标识。',422);return value;};
 const userValues=new Map<string,Scalar>();
 for(const record of records){const old=record.record_id;record.record_id=ref(r,old);record.issue_ids=record.issue_ids.map(id=>ref(i,id));
  for(const field of record.fields){field.evidence_ids=field.evidence_ids.map(id=>ref(e,id));if(approved.has(old+':'+field.field_id))userValues.set(record.record_id+':'+field.field_id,approved.get(old+':'+field.field_id)!);}}
 for(const issue of issues){issue.issue_id=ref(i,issue.issue_id);if(issue.record_id)issue.record_id=ref(r,issue.record_id);issue.evidence_ids=issue.evidence_ids.map(id=>ref(e,id));}
 for(const evidence of candidate.evidence)evidence.evidence_id=ref(e,evidence.evidence_id);
 return {candidate:{...candidate,records,issues},userValues};
}
