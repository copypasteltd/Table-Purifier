import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { contentHash,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { csvCell,safeSpreadsheetText } from './schema.js';
import type { ValidatedResult } from './result.js';
import { RESULT_FILES,type LocalStore } from '../storage/local-store.js';

/** Independent content checks after writing; never accept mere file existence or a model-authored validation.json. */
export async function validatePackage(store:LocalStore,sessionId:string,result:ValidatedResult):Promise<void>{
 const files=new Map<string,Buffer>();for(const name of RESULT_FILES)files.set(name,await store.read(`sessions/${sessionId}/candidate/${name}`));
 const manifest=JSON.parse(files.get('manifest.json')!.toString('utf8'));
 invariant(manifest.files.length===8&&new Set(manifest.files.map((f:{name:string})=>f.name)).size===8,'ARTIFACT_SET_INCOMPLETE','结果清单有重复或缺少文件。',422);
 for(const entry of manifest.files){const data=files.get(entry.name);invariant(data&&entry.name!=='manifest.json'&&data.length===entry.bytes&&sha256(data)===entry.sha256,
  'ARTIFACT_HASH_MISMATCH','实际结果文件与清单摘要不一致。',422);}
 invariant(contentHash(JSON.parse(files.get('standard.json')!.toString('utf8')))===contentHash(result.schema),'ARTIFACT_CONTENT_MISMATCH','规范导出与绑定内容不同。',422);
 const standard=new ExcelJS.Workbook();await standard.xlsx.load(files.get('standard.xlsx')! as never);
 const protocol=standard.getWorksheet('__P07_SCHEMA__');invariant(protocol&&protocol.rowCount>=2,'SCHEMA_ROUNDTRIP_FAILED','Excel 规范缺少完整协议。',422);
 const chunks:string[]=[];let schemaHash='';for(let row=2;row<=protocol.rowCount;row++){
  const r=protocol.getRow(row);invariant(r.getCell(1).value==='P07-SCHEMA-XLSX-1'&&r.getCell(3).value===row-2,'SCHEMA_ROUNDTRIP_FAILED','Excel 规范协议分块顺序错误。',422);
  const digest=String(r.getCell(2).value);if(schemaHash)invariant(schemaHash===digest,'SCHEMA_ROUNDTRIP_FAILED','Excel 规范分块摘要不同。',422);schemaHash=digest;chunks.push(String(r.getCell(4).value));
 }
 const decoded=Buffer.from(chunks.join(''),'base64');invariant(sha256(decoded)===schemaHash&&contentHash(JSON.parse(decoded.toString('utf8')))===contentHash(result.schema),'SCHEMA_ROUNDTRIP_FAILED','Excel 规范没有完整保留字段和规则。',422);
 const json=JSON.parse(files.get('result.json')!.toString('utf8'));
 invariant(contentHash(json.records)===contentHash(result.records)&&contentHash(json.issues)===contentHash(result.issues)
  &&contentHash(json.counts)===contentHash(result.counts),'ARTIFACT_CONTENT_MISMATCH','结构化导出内容不符。',422);
 const fields=[...result.schema.fields].sort((a,b)=>a.order-b.order);
 const expectedRows=(disposition:string)=>result.records.filter(r=>r.disposition===disposition).map(r=>fields.map(f=>r.fields.find(v=>v.field_id===f.field_id)!.typed_value));
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(files.get('result.xlsx')! as never);
 for(const [name,disposition] of [['通过验收','ACCEPTED'],['待确认','NEEDS_REVIEW'],['已排除','EXCLUDED']]){
  const page=workbook.getWorksheet(name!);const rows=expectedRows(disposition!);
  invariant(page&&page.rowCount===rows.length+1,'ARTIFACT_ROW_COUNT_MISMATCH','Excel 记录数量与验收结果不同。',422);
  for(const [index,field] of fields.entries())invariant(page.getRow(1).getCell(index+1).value===safeSpreadsheetText(field.label),'ARTIFACT_COLUMN_MISMATCH','Excel 列序与规范不同。',422);
  for(const [index,row] of rows.entries())for(const [column,value] of row.entries()){
   const expected=typeof value==='string'?safeSpreadsheetText(value):value;
   invariant(page.getRow(index+2).getCell(column+1).value===expected,'ARTIFACT_VALUE_MISMATCH','Excel 单元格类型或值发生变化。',422);
  }
 }
 const csv=files.get('accepted.csv')!.toString('utf8');invariant(csv.startsWith('\uFEFF'),'ARTIFACT_ENCODING_MISMATCH','CSV 缺少约定编码标记。',422);
 // ExcelJS uses its CSV reader, separate from our quoting writer. Force text values to preserve identifiers.
 const csvBook=new ExcelJS.Workbook();const csvPage=await csvBook.csv.read(Readable.from([Buffer.from(csv.slice(1))]),
  {parserOptions:{delimiter:result.schema.export_policy.csv_separator},map:(value:string)=>value} as never);
 const accepted=expectedRows('ACCEPTED');
 invariant(csvPage.rowCount===accepted.length+1,'ARTIFACT_ROW_COUNT_MISMATCH','CSV 记录数量与验收结果不同。',422);
 for(const [index,row] of accepted.entries())for(const [column,value] of row.entries()){
  const expected=value===null?'':typeof value==='string'?safeSpreadsheetText(value):String(value);
  invariant((csvPage.getRow(index+2).getCell(column+1).value??'')===expected,'ARTIFACT_VALUE_MISMATCH','CSV 单元格与验收结果不同。',422);
 }
 const issues=new ExcelJS.Workbook();await issues.xlsx.load(files.get('issues.xlsx')! as never);
 invariant(issues.getWorksheet('问题清单')?.rowCount===result.issues.length+1,'ARTIFACT_ROW_COUNT_MISMATCH','问题表行数不符。',422);
 const provenance=files.get('provenance.jsonl')!.toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
 invariant(provenance.length===result.evidence.length&&provenance.every(p=>p.original_available===false&&result.evidence.some(e=>e.evidence_id===p.evidence_id&&e.excerpt===p.excerpt)),
  'ARTIFACT_PROVENANCE_MISMATCH','来源摘录导出内容不符。',422);
 const validation=JSON.parse(files.get('validation.json')!.toString('utf8'));
 invariant(validation.result_sha256===result.contentHash&&validation.quality===result.quality&&contentHash(validation.counts)===contentHash(result.counts),
  'ARTIFACT_VALIDATION_MISMATCH','验收摘要与本次 Host 校验不符。',422);
}
