// Read-only view models: never send these display properties back as schema facts.
const types={TEXT:'文本',INTEGER:'整数',DECIMAL:'金额 / 数值',DATE:'日期',DATETIME:'日期时间',BOOLEAN:'是 / 否',ENUM:'选项'};
export function fileSize(bytes){if(!Number.isFinite(bytes)||bytes<0)return '大小待核对';return bytes<1000?bytes+' B':bytes<1000000?(bytes/1000).toFixed(bytes<10000?1:0)+' KB':(bytes/1000000).toFixed(1)+' MB';}
export function sourceView(source){const name=source.name||'文字资料',icon=/\.pdf$/i.test(name)?'pdf':/\.(png|jpe?g|webp)$/i.test(name)?'image':/\.(xlsx?|csv)$/i.test(name)?'sheet':'document';
 return {...source,icon,meta:fileSize(source.bytes)+' · '+(source.status==='PURGED'?'原件已清理':'已接收')};}
export function fieldView(field){return {...field,icon:['DATE','DATETIME'].includes(field.type)?'calendar':['INTEGER','DECIMAL'].includes(field.type)?'currency':'text',
 meta:(types[field.type]||field.type)+' · '+(field.required?'必填':'选填'),reason:field.description||'按当前规范整理'};}
export function fieldExamples(fields){const selected=[],seen=new Set();for(const field of fields){if(!seen.has(field.type)){selected.push(field);seen.add(field.type);}if(selected.length===3)break;}for(const field of fields){if(selected.length===3)break;if(!selected.includes(field))selected.push(field);}return selected.map(fieldView);}
export function tableView(records,schema){const fields=(schema?.fields||[]).slice(0,4);return {previewColumns:fields.map(f=>({id:f.field_id,label:f.label})),
 previewRows:records.slice(0,5).map(r=>({id:r.record_id,cells:fields.map(f=>{const cell=r.fields.find(v=>v.field_id===f.field_id);return {id:f.field_id,value:cell?.typed_value==null?'待补':String(cell.typed_value),unresolved:cell?.typed_value==null};})}))};}
export function issueView(issue,record,schema){const field=schema?.fields.find(f=>f.field_id===issue.field_id),cells=record?.fields||[];
 const label=f=>schema?.fields.find(x=>x.field_id===f.field_id)?.label||f.field_id;
 const identified=cells.filter(f=>f.typed_value!=null&&schema?.identity_keys?.includes(f.field_id));
 const other=cells.filter(f=>f.typed_value!=null&&!schema?.identity_keys?.includes(f.field_id)&&f.field_id!==issue.field_id).sort((a,b)=>Number(schema?.fields.find(f=>f.field_id===b.field_id)?.type==='INTEGER')-Number(schema?.fields.find(f=>f.field_id===a.field_id)?.type==='INTEGER'));
 const issueCell=cells.find(f=>f.field_id===issue.field_id);
 const facts=[issueCell||{field_id:issue.field_id,typed_value:null},...other].slice(0,3).map(f=>({id:f.field_id,label:label(f),value:f.typed_value==null?'待补':String(f.typed_value)+(schema?.fields.find(x=>x.field_id===f.field_id)?.unit?' '+schema.fields.find(x=>x.field_id===f.field_id).unit:''),unresolved:f.field_id===issue.field_id}));
 return {issueLabel:field?.label||issue.field_id,issueRecordTitle:identified[0]?String(identified[0].typed_value):'记录 '+(record?record.ordinal+1:issue.record_id),
 issueRecordSubtitle:identified.slice(1).map(f=>String(f.typed_value)).join(' · ')||schema?.row_kind||'待确认的原记录',issueFacts:facts,issueRecordAvailable:!!record};}
