// Synthetic quotation scenario for comparing the three retained B reference screens.
// This module is imported exclusively by the documentation adapter, never by product code.
export function quotationFixture(){
 const definitions=[['supplier','供应商','TEXT',null],['product','商品名称','TEXT',null],['price','单价','DECIMAL','CNY'],['warranty','保修期','TEXT',null],['delivery','交期','DATE',null],['moq','起订量','INTEGER','件'],['model','型号','TEXT',null],['contact','联系人','TEXT',null],['note','备注','TEXT',null]];
 const schema={schema_id:'demo-quotation-schema',version:1,row_kind:'每条商品报价一行',identity_keys:['supplier','product'],locale:'zh-CN',timezone:'Asia/Shanghai',rules:[],rounding_policy:'HALF_UP',export_policy:{formula_policy:'ESCAPE'},
  fields:definitions.map(([field_id,label,type,unit],order)=>({field_id,label,type,unit,order,required:order<3,nullable:order>=2,description:order===0?'识别报价来源':order===1?'便于汇总比价':order===2?'保留原报价金额':'整理原资料中的'+label,...type==='DECIMAL'?{scale:2}:{}}))};
 const rows=[['青禾供应','桌面支架 A2','12.80','12个月','2026-11-05',100,'A2','示例联系人甲','合成演示'],['白石供应','折叠支架 M1',null,'12个月','2026-11-08',50,'M1','示例联系人乙','单价待议'],['山岚供应','铝合金支架 S3','18.50','18个月','2026-11-10',80,'S3','示例联系人丙','合成演示']];
 const records=rows.map((row,ordinal)=>({record_id:'demo-record-'+(ordinal+1),ordinal,disposition:ordinal===1?'NEEDS_REVIEW':'ACCEPTED',fields:row.map((typed_value,i)=>({field_id:schema.fields[i].field_id,typed_value,status:typed_value===null?'MISSING':'EXTRACTED',evidence_ids:['demo-evidence']}))}));
 return {schema,records,issue:{issue_id:'demo-issue',record_id:'demo-record-2',field_id:'price',severity:'BLOCKER',message:'单价缺失，原资料为“价格待议”。',evidence_ids:['demo-evidence'],allowed_decisions:['USER_VALUE','KEEP_UNRESOLVED']},
  evidence:{evidence_id:'demo-evidence',source_unit_id:'demo-unit-2',excerpt:'白石供应：折叠支架 M1，50 件起订，保修 12 个月。价格待议。',locator:{page_or_ordinal:2,path:'供应商聊天记录.txt / 第 2 条'},limitations:['合成报价示例，不对应真实供应商或交易。']},
  sources:[['供应商聊天记录.txt',3500],['报价单_10月.pdf',248000],['产品清单.png',1200000]].map(([name,bytes],i)=>({source_id:'demo-source-'+i,name,bytes,role:'SOURCE',status:'RECEIVED'}))};
}
