import ExcelJS from 'exceljs';
import { contentHash,sha256 } from '../shared/crypto.js';
import { LocalStore,RESULT_FILES,type ResultFileName } from './local-store.js';
import { csvCell,safeSpreadsheetText } from '../validation/schema.js';
import type { ValidatedResult } from '../validation/result.js';
import { PRODUCT_NAME } from '../shared/brand.js';

export const MEDIA:Record<ResultFileName,string>={'standard.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'result.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','issues.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'standard.json':'application/json','result.json':'application/json','validation.json':'application/json','manifest.json':'application/json',
 'accepted.csv':'text/csv; charset=utf-8','provenance.jsonl':'application/x-ndjson'};
const json=(value:unknown)=>Buffer.from(JSON.stringify(value,null,2)+'\n');
async function xlsx(sheets:{name:string;headers:string[];rows:(string|number|boolean|null)[][]}[]):Promise<Buffer>{
  const workbook=new ExcelJS.Workbook();workbook.creator=PRODUCT_NAME;
  for(const sheet of sheets){const page=workbook.addWorksheet(sheet.name,{views:[{state:'frozen',ySplit:1}]});
    page.addRow(sheet.headers.map(safeSpreadsheetText));
    // Every source string is an explicit text cell. Formula-looking text is prefixed for downstream CSV/Excel safety.
    for(const row of sheet.rows)page.addRow(row.map(v=>typeof v==='string'?safeSpreadsheetText(v):v));
    page.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};page.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF16745B'}};
    for(const column of page.columns)column.width=24;
    if(sheet.rows.length)page.autoFilter={from:{row:1,column:1},to:{row:sheet.rows.length+1,column:sheet.headers.length}};
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
export interface ArtifactContext {artifactSetId:string;taskId:string;runId:string;resultVersion:number;sourceSetHash:string;createdAt:string;model:string|null;}
export async function buildArtifacts(store:LocalStore,sessionId:string,resultId:string,validated:ValidatedResult,
  bindingHash:string,planHash:string,context:ArtifactContext):Promise<{name:ResultFileName;bytes:number;sha256:string}[]>{
  const fields=[...validated.schema.fields].sort((a,b)=>a.order-b.order);
  const rows=(disposition?:string)=>validated.records.filter(r=>!disposition||r.disposition===disposition).map(r=>{
    const values=new Map(r.fields.map(f=>[f.field_id,f.typed_value]));return fields.map(f=>values.get(f.field_id)??null);});
  const accepted=rows('ACCEPTED');const separator=validated.schema.export_policy.csv_separator;
  const files=new Map<ResultFileName,Buffer>();
  files.set('standard.json',json(validated.schema));
  const schemaBytes=Buffer.from(JSON.stringify(validated.schema)),encoded=schemaBytes.toString('base64'),schemaRows:(string|number|boolean|null)[][]=[];
  for(let offset=0;offset<encoded.length;offset+=30000)schemaRows.push(['P07-SCHEMA-XLSX-1',sha256(schemaBytes),offset/30000,encoded.slice(offset,offset+30000)]);
  files.set('standard.xlsx',await xlsx([{name:'规范',headers:['字段标识','名称','类型','必填','可空','单位','说明'],
    rows:fields.map(f=>[f.field_id,f.label,f.type,f.required,f.nullable,f.unit,f.description])},
    {name:'__P07_SCHEMA__',headers:['协议','SHA256','分块序号','规范JSON（Base64）'],rows:schemaRows}]));
  files.set('result.xlsx',await xlsx([{name:'通过验收',headers:fields.map(f=>f.label),rows:accepted},
    {name:'待确认',headers:fields.map(f=>f.label),rows:rows('NEEDS_REVIEW')},{name:'已排除',headers:fields.map(f=>f.label),rows:rows('EXCLUDED')}]));
  files.set('accepted.csv',Buffer.from('\uFEFF'+[fields.map(f=>csvCell(f.label)).join(separator),...accepted.map(row=>row.map(csvCell).join(separator))].join('\r\n')+'\r\n'));
  files.set('result.json',json({protocol:'P07-RESULT-1',result_id:resultId,schema:validated.schema,records:validated.records,issues:validated.issues,
    counts:validated.counts,quality:validated.quality,coverage:validated.coverage,limitations:validated.limitations}));
  files.set('issues.xlsx',await xlsx([{name:'问题清单',headers:['问题ID','记录ID','字段','严重程度','问题代码','说明','状态'],
    rows:validated.issues.map(i=>[i.issue_id,i.record_id,i.field_id,i.severity,i.code,i.message,i.status])}]));
  const units=new Map(validated.units.map(u=>[u.unit_id,u]));
  files.set('provenance.jsonl',Buffer.from(validated.evidence.map(e=>JSON.stringify({...e,source_id:units.get(e.unit_id)!.source_id,
    source_unit_sha256:units.get(e.unit_id)!.sha256,original_available:false})).join('\n')+'\n'));
  files.set('validation.json',json({validator_version:'P07-HOST-VALIDATOR-1',result_id:resultId,quality:validated.quality,
    counts:validated.counts,coverage:validated.coverage,binding_sha256:bindingHash,plan_sha256:planHash,result_sha256:validated.contentHash,
    checks:['SCHEMA','EXACT_TYPES','SOURCE_ANCHORS','COVERAGE','RULES','IDENTITY','DISPOSITION','FORMULA_PROTECTION'],
    limitations:['结构、规则和引用校验不能保证所有语义理解正确，存在歧义时保留问题。',...validated.limitations]}));
  const entries=[...files.entries()].map(([name,data])=>({name,bytes:data.length,sha256:sha256(data),media_type:MEDIA[name]}));
  // A manifest cannot hash itself. The eight entries are sealed; its own hash is stored by the artifact set.
  files.set('manifest.json',json({format_version:'P07-ARTIFACT-1',artifact_set_id:context.artifactSetId,task_id:context.taskId,run_id:context.runId,
    result_version:context.resultVersion,binding_sha256:bindingHash,source_set_sha256:context.sourceSetHash,quality_status:validated.quality,
    created_at:context.createdAt,expires_at:null,files:entries,counts:{total_candidates:validated.counts.total_candidates,accepted:validated.counts.accepted,
      needs_review:validated.counts.needs_review,excluded:validated.counts.excluded},
    versions:{parser:'p07-agent-tools-1',ocr:null,model:context.model,prompt:'P07-SKILL-IMPLEMENTATION-1',rule:'P07-HOST-VALIDATOR-1',exporter:'P07-EXPORT-1'},
    limitations:validated.limitations}));
  const expected=[];
  for(const name of RESULT_FILES){const content=files.get(name)!;const saved=await store.write(`sessions/${sessionId}/candidate/${name}`,content);
    expected.push({name,bytes:saved.bytes,sha256:saved.sha256});}
  return expected;
}
