import {expect,it} from 'vitest';
const views=await import('../../miniapp/src/presentation.js' as string);
it('keeps zero distinct from missing values and does not mutate result or schema facts',()=>{
 const schema={fields:[{field_id:'amount',label:'单价',type:'DECIMAL',required:true}],identity_keys:[]};
 const records=[{record_id:'r1',fields:[{field_id:'amount',typed_value:'0.00'}]},{record_id:'r2',fields:[{field_id:'amount',typed_value:null}]}];
 const original=JSON.stringify({schema,records}),view=views.tableView(records,schema);
 expect(view.previewRows[0].cells[0]).toMatchObject({value:'0.00',unresolved:false});
 expect(view.previewRows[1].cells[0]).toMatchObject({value:'待补',unresolved:true});
 expect(JSON.stringify({schema,records})).toBe(original);
});
it('shows authoritative record identity and never fabricates context for an unavailable record',()=>{
 const schema={row_kind:'每条报价一行',identity_keys:['supplier','product'],fields:[{field_id:'supplier',label:'供应商'},{field_id:'product',label:'商品名称'},{field_id:'price',label:'单价'}]};
 const issue={record_id:'r1',field_id:'price'},record={ordinal:1,fields:[{field_id:'supplier',typed_value:'合成甲'},{field_id:'product',typed_value:'支架'},{field_id:'price',typed_value:null}]};
 expect(views.issueView(issue,record,schema)).toMatchObject({issueRecordTitle:'合成甲',issueRecordSubtitle:'支架',issueFacts:[{label:'单价',value:'待补'}],issueRecordAvailable:true});
 const unavailable=views.issueView(issue,null,schema);expect(unavailable.issueRecordAvailable).toBe(false);expect(unavailable.issueRecordTitle).not.toContain('合成甲');expect(unavailable.issueFacts).toHaveLength(1);
});
