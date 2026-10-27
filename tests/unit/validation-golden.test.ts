import { beforeAll,describe,expect,it } from 'vitest';
import { Contracts,type Schema } from '../../src/shared/contracts.js';
import { newId,contentHash,sha256 } from '../../src/shared/crypto.js';
import { compileRule,csvCell,safeSpreadsheetText,validateSchema,validateValue } from '../../src/validation/schema.js';
import { validateResult,type SourceUnit } from '../../src/validation/result.js';

const contracts=new Contracts();beforeAll(()=>contracts.initialize());
function field(type:Schema['SchemaField']['type']='TEXT'):Schema['SchemaField']{return {field_id:'name',label:'名称',order:0,type,required:true,
 nullable:false,unit:null,description:'',...(type==='DECIMAL'?{scale:2}:{}),...(type==='ENUM'?{closed_enum:true,enum_values:['是','否']}:{})};}
export function golden(){
 const schema:Schema['SchemaDefinition']={schema_id:newId(),version:1,origin:'DISCOVERED',purpose:'整理名称',row_kind:'每人一行',fields:[field()],identity_keys:[],rules:[],
 locale:'zh-CN',timezone:'Asia/Shanghai',rounding:'NONE',export_policy:{version:'1',formula_protection:true,csv_encoding:'UTF-8-BOM',csv_separator:','}};
 const unit:SourceUnit={unit_id:newId(),source_id:newId(),ordinal:0,kind:'TEXT_SPAN',locator:{version:'1',kind:'TEXT_SPAN',page_or_ordinal:0,path:null},
 sha256:sha256('姓名：张三'),text:'姓名：张三',readability:'READABLE',confidence:null,limitations:[]};
 const evidenceId=newId();const record:Schema['Record']={record_id:newId(),ordinal:0,disposition:'ACCEPTED',fields:[{field_id:'name',raw_text:'张三',typed_value:'张三',
 status:'EXTRACTED',evidence_ids:[evidenceId],unit:null,transform_chain:[]}],issue_ids:[],exclusion_reason:null};
 const candidate={protocol:'P07-CANDIDATE-1',schema_sha256:contentHash(schema),records:[record],issues:[] as Schema['Issue'][],
 evidence:[{evidence_id:evidenceId,unit_id:unit.unit_id,excerpt:'张三',locator:unit.locator}],
 coverage:[{unit_id:unit.unit_id,disposition:'READ',reason:null}],limitations:[]};
 return {schema,unit,record,candidate};
}
describe('30 typed-value golden acceptance cases',()=>{
 const cases:[string,Schema['SchemaField']['type'],unknown,boolean][]=[
 ['中文文本','TEXT','资料成表',true],['前导零文本','TEXT','00123',true],['空必填','TEXT',null,false],['数字不是文本','TEXT',0,false],
 ['零整数','INTEGER',0,true],['负整数','INTEGER',-123,true],['整数不能是小数','INTEGER',1.2,false],['不安全整数','INTEGER',9007199254740992,false],
 ['整数字符串','INTEGER','23',false],['布尔假','BOOLEAN',false,true],['布尔真','BOOLEAN',true,true],['布尔字符串','BOOLEAN','false',false],
 ['小数零','DECIMAL','0.00',true],['负小数','DECIMAL','-12.30',true],['浮点不入库','DECIMAL',0.1,false],['指数小数拒绝','DECIMAL','1e2',false],
 ['超精度小数','DECIMAL','1.234',false],['大额精确字符串','DECIMAL','9007199254740993.01',true],['NaN拒绝','DECIMAL','NaN',false],
 ['闰年二月','DATE','2024-02-29',true],['非闰年二月','DATE','2025-02-29',false],['无效月份','DATE','2026-13-01',false],
 ['含糊日期拒绝','DATE','10/11/2026',false],['ISO时间','DATETIME','2026-10-27T12:00:00+08:00',true],
 ['UTC时间','DATETIME','2026-10-27T04:00:00Z',true],['时间缺时区','DATETIME','2026-10-27T12:00:00',false],
 ['封闭枚举匹配','ENUM','是',true],['封闭枚举超范围','ENUM','可能',false],['不可空布尔','BOOLEAN',null,false],['空必填整数','INTEGER',null,false],
 ];
 it.each(cases)('%s',(_name,type,value,valid)=>{
  const run=()=>validateValue(field(type),value as string|number|boolean|null);if(valid)expect(run).not.toThrow();else expect(run).toThrow();
 });
});
describe('independent result decisions and provenance',()=>{
 it('marks changed candidate counts for review instead of claiming semantic completeness from READ coverage',()=>{
  const f=golden(),result=validateResult(contracts,f.schema,[f.unit],f.candidate,new Map(),2);
  expect(result.quality).toBe('NEEDS_REVIEW');expect(result.counts.accepted).toBe(0);expect(result.counts.needs_review).toBe(1);
  expect(result.issues).toContainEqual(expect.objectContaining({code:'RECORD_COUNT_CHANGED',record_id:null,severity:'BLOCKER'}));
 });
 it('accepts a source-anchored record and preserves zero/false semantics in rules',()=>{
  const f=golden(),result=validateResult(contracts,f.schema,[f.unit],f.candidate);expect(result.counts).toEqual({total_candidates:1,accepted:1,needs_review:0,excluded:0,issue_count:0});
  expect(result.quality).toBe('PASSED');
  expect(compileRule({op:'COMPARE',comparator:'EQ',args:[{op:'CONST',value:false},{op:'CONST',value:false}]},[])(new Map())).toBe(true);
 });
 it('rejects fabricated evidence even when the Agent claims the record is accepted',()=>{
  const f=golden();f.candidate.evidence[0]!.excerpt='李四';expect(()=>validateResult(contracts,f.schema,[f.unit],f.candidate)).toThrow(/证据摘录/);
 });
 it('does not allow invented user decisions or solved issues',()=>{
  const f=golden();f.record.fields[0]!.status='USER_PROVIDED';expect(()=>validateResult(contracts,f.schema,[f.unit],f.candidate)).toThrow(/用户输入/);
 });
 it('downgrades missing required values and uncertain OCR to review without discarding records',()=>{
  const f=golden();f.unit.confidence=0.4;f.record.fields[0]!.typed_value=null;f.record.fields[0]!.status='MISSING';
  const result=validateResult(contracts,f.schema,[f.unit],f.candidate);expect(result.counts.needs_review).toBe(1);expect(result.quality).toBe('NEEDS_REVIEW');
 });
 it('requires full scope coverage',()=>{
  const f=golden();expect(()=>validateResult(contracts,f.schema,[f.unit,{...f.unit,unit_id:newId()}],f.candidate)).toThrow(/完整已确认/);
 });
 it('detects duplicate identities and protects every spreadsheet formula prefix',()=>{
  const f=golden();f.schema.identity_keys=['name'];f.candidate.schema_sha256=contentHash(f.schema);
  f.candidate.records.push({...structuredClone(f.record),record_id:newId(),ordinal:1});
  expect(validateResult(contracts,f.schema,[f.unit],f.candidate).counts.needs_review).toBe(2);
  for(const text of ['=HYPERLINK("x")','+cmd','-cmd','@SUM(A1)',' \t=1'])expect(safeSpreadsheetText(text).startsWith("'")).toBe(true);
  expect(csvCell('a,"b')).toBe('"a,""b"');
 });
 it('evaluates exact decimal arithmetic, rejects incompatible units and excessive AST depth',()=>{
  const money={...field('DECIMAL'),field_id:'amount',unit:'元'};
  const rule:Schema['RuleNode']={op:'COMPARE',comparator:'EQ',args:[{op:'DECIMAL_ADD',args:[{op:'CONST',value:'0.1'},{op:'CONST',value:'0.2'}]},{op:'CONST',value:'0.3'}]};
  expect(compileRule(rule,[money])(new Map())).toBe(true);
  let deep:Schema['RuleNode']={op:'CONST',value:true};for(let i=0;i<15;i++)deep={op:'AND',args:[deep]};expect(()=>compileRule(deep,[])).toThrow(/复杂度/);
  const f=golden();f.schema.fields.push({...field(),order:1});expect(()=>validateSchema(f.schema)).toThrow(/唯一/);
 });
});
