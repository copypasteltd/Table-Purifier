import { z } from 'zod';
import type { Contracts,Schema } from '../shared/contracts.js';
import { invariant } from '../shared/errors.js';
import { validateSchema } from '../validation/schema.js';
import type { SourceUnit } from '../validation/result.js';
import { unitScopeHash } from './skill.js';
import { contentHash } from '../shared/crypto.js';
import { evidenceSchema,validateResult } from '../validation/result.js';

export const analysisSchema=z.object({protocol:z.literal('P07-ANALYSIS-1'),schema:z.unknown(),suggestions:z.array(z.unknown()).max(50),
 preview_records:z.array(z.unknown()).max(5),evidence:z.array(evidenceSchema).max(500),unmapped_important:z.array(z.string().max(1000)).max(100),
 strategy_summary:z.string().min(1).max(2000),estimated_records:z.number().int().min(0).max(1000).nullable(),
 limitations:z.array(z.string().min(1).max(1000)).max(100),coverage:z.array(z.object({unit_id:z.uuid(),
 disposition:z.enum(['READ','UNREADABLE']),reason:z.string().max(1000).nullable()}).strict()).min(1).max(50)}).strict();
export type Analysis=ReturnType<typeof validateAnalysis>;
export function validateAnalysis(contracts:Contracts,input:unknown,units:SourceUnit[],provided:Schema['SchemaDefinition']|null){
 const parsed=analysisSchema.parse(input);const schema=contracts.validate<Schema['SchemaDefinition']>('SchemaDefinition',parsed.schema);validateSchema(schema);
 if(provided)invariant(contentHash(schema)===contentHash(provided),'PROVIDED_SCHEMA_CHANGED','Agent 改变了用户提供的规范，请重新确认。',422);
 const suggestions=parsed.suggestions.map(v=>contracts.validate<Schema['FieldSuggestion']>('FieldSuggestion',v));
 const preview=parsed.preview_records.map(v=>contracts.validate<Schema['Record']>('Record',v));
 const ids=new Set(units.map(u=>u.unit_id));
 invariant(ids.size===units.length&&parsed.coverage.length===units.length&&new Set(parsed.coverage.map(c=>c.unit_id)).size===units.length
  &&parsed.coverage.every(c=>ids.has(c.unit_id)),'ANALYSIS_COVERAGE_INCOMPLETE','分析未覆盖所有已提交资料。',422);
 for(const c of parsed.coverage){const source=units.find(u=>u.unit_id===c.unit_id)!;
  invariant((c.disposition!=='READ'||source.readability!=='UNREADABLE')&&(c.disposition!=='UNREADABLE'||!!c.reason),
   'ANALYSIS_READABILITY_INVALID','分析覆盖与实际读取结果不符。',422);}
 const coverage:Schema['Coverage']={confirmed_units:units.length,read_units:parsed.coverage.filter(c=>c.disposition==='READ').length,
  unreadable_units:parsed.coverage.filter(c=>c.disposition==='UNREADABLE').length,excluded_units:0,scope_sha256:unitScopeHash(units),
  limitations:parsed.coverage.filter(c=>c.disposition==='UNREADABLE').map(c=>c.reason!)};
 const validated=validateResult(contracts,schema,units,{protocol:'P07-CANDIDATE-1',schema_sha256:contentHash(schema),records:preview,
  issues:[],evidence:parsed.evidence,coverage:parsed.coverage,limitations:parsed.limitations});
 const evidenceIds=new Set(validated.evidence.map(e=>e.evidence_id));
 for(const suggestion of suggestions)invariant(suggestion.observed_count<=suggestion.relevant_count&&!suggestion.from_sample
  &&suggestion.evidence_ids.every(id=>evidenceIds.has(id)),'SCHEMA_SUGGESTION_UNVERIFIED','字段建议的统计或证据不符合完整范围分析。',422);
 return {...parsed,schema,suggestions,preview_records:validated.records,evidence:validated.evidence,coverage};
}

/** No markdown scraping/fallback that could turn incomplete text into a valid plan. */
export function parseAgentJson(text:string):unknown{
 invariant(text.length>0&&Buffer.byteLength(text)<=8_000_000,'AGENT_COMPLETION_INVALID','处理结果为空或超过预算。',422);
 try{return JSON.parse(text);}catch{invariant(false,'AGENT_COMPLETION_INVALID','Agent 未返回有效的结构化结果。',422);}
}
