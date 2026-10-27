import { beforeAll,expect,it } from 'vitest';
import { Contracts,type Schema } from '../../src/shared/contracts.js';
import { newId } from '../../src/shared/crypto.js';
import { applySchemaPatch } from '../../src/validation/schema-patch.js';
import { assertConfirmedDecisions,type ConfirmedDecision } from '../../src/validation/decisions.js';
import type { SourceUnit } from '../../src/validation/result.js';
const contracts=new Contracts();beforeAll(()=>contracts.initialize());
const field:Schema['SchemaField']={field_id:'name',label:'姓名',order:0,type:'TEXT',required:true,nullable:false,unit:null,description:'原姓名'};
const schema:Schema['SchemaDefinition']={schema_id:newId(),version:1,origin:'DISCOVERED',purpose:'名册',row_kind:'每人一行',fields:[field],identity_keys:['name'],rules:[],locale:'zh-CN',timezone:'Asia/Shanghai',rounding:'NONE',export_policy:{version:'1',formula_protection:true,csv_encoding:'UTF-8-BOM',csv_separator:','}};
it('applies exact schema edits, preserving unrelated locale, identity and export policies without mutating the confirmed original',()=>{
 const amount:Schema['SchemaField']={...field,field_id:'amount',label:'金额',order:1,type:'DECIMAL',unit:'CNY',scale:2,enum_values:[],description:'精确金额'};
 const result=applySchemaPatch(schema,[{op:'ADD_FIELD',field:amount},{op:'UPDATE_FIELD',field_id:'name',field:{...field,label:'报名姓名'}},
  {op:'SET_RULES',rules:[{op:'COMPARE',comparator:'GE',args:[{op:'FIELD',field_id:'amount'},{op:'CONST',value:'0.00'}]}]},{op:'SET_ROW_KIND',row_kind:'每名报名者一行'}]);
 expect(contracts.validate('SchemaDefinition',result)).toEqual(result);expect(result.fields[1]!.scale).toBe(2);
 expect(result.identity_keys).toEqual(['name']);expect(result.export_policy).toEqual(schema.export_policy);expect(schema.fields).toEqual([field]);
});
it('rejects a missing patch value, duplicate identities and dangling rule/identity references before an Agent turn',()=>{
 expect(()=>applySchemaPatch(schema,[{op:'UPDATE_FIELD',field_id:'name'}])).toThrow();
 expect(()=>applySchemaPatch(schema,[{op:'ADD_FIELD',field}])).toThrow();
 expect(()=>applySchemaPatch(schema,[{op:'REMOVE_FIELD',field_id:'name'}])).toThrow();
});
function fixture(){const record:Schema['Record']={record_id:newId(),ordinal:0,disposition:'ACCEPTED',exclusion_reason:null,issue_ids:[],fields:[{field_id:'name',typed_value:'用户确认姓名',raw_text:null,status:'USER_PROVIDED',unit:null,evidence_ids:[],transform_chain:[]}]};
 const candidate={protocol:'P07-CANDIDATE-1',schema_sha256:'a'.repeat(64),records:[record],issues:[] as Schema['Issue'][],evidence:[] as {evidence_id:string;unit_id:string;excerpt:string;locator:Schema['Locator']}[],coverage:[],limitations:[]};
 const decision:ConfirmedDecision={record_id:record.record_id,field_id:'name',action:'USER_VALUE',user_value:'用户确认姓名'};return {record,candidate,decision};}
it('requires an approved user value to appear exactly and retain USER_PROVIDED attribution',()=>{
 const f=fixture();expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[])).not.toThrow();
 f.record.fields[0]!.status='EXTRACTED';expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[])).toThrow(/明确提供/);
 f.record.fields[0]!.status='USER_PROVIDED';f.record.fields[0]!.typed_value='代理猜测';expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[])).toThrow();
});
it('rejects silently dropping a parent record that has a confirmed decision',()=>{const f=fixture();f.candidate.records=[];expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[])).toThrow(/遗漏/);});
it('keeps an explicitly unresolved field null and its issue open',()=>{
 const f=fixture();f.decision.action='KEEP_UNRESOLVED';f.record.fields[0]!.status='CONFLICT';f.record.fields[0]!.typed_value=null;
 expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[])).toThrow(/保留待确认/);
 f.candidate.issues.push({issue_id:newId(),record_id:f.record.record_id,field_id:'name',code:'CONFLICT',message:'有两个姓名',severity:'BLOCKER',status:'OPEN',allowed_decisions:['USER_VALUE'],evidence_ids:[]});
 expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[])).not.toThrow();
});
it('binds a chosen evidence to the selected immutable parent excerpt in the newly submitted provenance',()=>{
 const f=fixture(),parent=newId(),evidence=newId(),unitId=newId(),locator:Schema['Locator']={version:'1',kind:'TEXT_SPAN',path:null,page_or_ordinal:0,span:[0,100],bbox:null};
 const text=JSON.stringify({evidence_id:parent,excerpt:'张三'}),unit={unit_id:unitId,text} as SourceUnit;
 f.decision={record_id:f.record.record_id,field_id:'name',action:'CHOOSE_EVIDENCE',evidence_id:parent,selected_excerpt:'张三'};
 f.record.fields[0]!.status='EXTRACTED';f.record.fields[0]!.evidence_ids=[evidence];f.candidate.evidence=[{evidence_id:evidence,unit_id:unitId,excerpt:text,locator}];
 expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[unit])).not.toThrow();f.candidate.evidence[0]!.excerpt='李四';
 expect(()=>assertConfirmedDecisions(contracts,f.candidate,[f.decision],[unit])).toThrow(/选定/);
});
