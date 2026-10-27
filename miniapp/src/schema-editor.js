export const fieldTypes=[{value:'TEXT',label:'文本'},{value:'DECIMAL',label:'精确小数'},{value:'INTEGER',label:'整数'},
 {value:'BOOLEAN',label:'是或否'},{value:'DATE',label:'日期'},{value:'DATETIME',label:'含时区时间'},{value:'ENUM',label:'枚举选项'}];
export const comparators=[{value:'EQ',label:'等于'},{value:'NE',label:'不等于'},{value:'GT',label:'大于'},
 {value:'GE',label:'大于等于'},{value:'LT',label:'小于'},{value:'LE',label:'小于等于'}];
export const clone=value=>JSON.parse(JSON.stringify(value));
export function describeRule(rule,fields){const label=id=>fields.find(f=>f.field_id===id)?.label??id;
 if(rule.op==='FIELD')return label(rule.field_id);if(rule.op==='CONST')return String(rule.value);
 if(rule.op==='COMPARE')return (rule.args??[]).map(x=>describeRule(x,fields)).join(' '+(comparators.find(c=>c.value===rule.comparator)?.label??'比较')+' ');
 if(rule.op==='REQUIRED_IF')return '当 '+describeRule(rule.args[0],fields)+' 时，'+label(rule.field_id)+' 必填';
 const names={AND:' 并且 ',OR:' 或者 ',DECIMAL_ADD:' + ',DECIMAL_SUBTRACT:' − ',DECIMAL_MULTIPLY:' × ',DECIMAL_DIVIDE:' ÷ '};
 return '('+(rule.args??[]).map(x=>describeRule(x,fields)).join(names[rule.op]??'、')+')';
}
export function editorView(schema){return {draft:schema,fields:schema.fields.map(f=>({...f,typeLabel:fieldTypes.find(t=>t.value===f.type)?.label,
 enumText:(f.enum_values??[]).join('\n')})),ruleViews:schema.rules.map((r,index)=>({index,label:describeRule(r,schema.fields)}))};}
export function schemaPatch(original,draft){const patches=[];
 for(const field of original.fields)if(!draft.fields.some(f=>f.field_id===field.field_id))patches.push({op:'REMOVE_FIELD',field_id:field.field_id});
 for(const field of draft.fields){const old=original.fields.find(f=>f.field_id===field.field_id);
  if(!old)patches.push({op:'ADD_FIELD',field});else if(JSON.stringify(old)!==JSON.stringify(field))patches.push({op:'UPDATE_FIELD',field_id:field.field_id,field});}
 if(original.row_kind!==draft.row_kind)patches.push({op:'SET_ROW_KIND',row_kind:draft.row_kind});
 if(JSON.stringify(original.rules)!==JSON.stringify(draft.rules))patches.push({op:'SET_RULES',rules:draft.rules});return patches;
}
export function ruleFromForm(schema,form){const field=schema.fields.find(f=>f.field_id===form.ruleField);if(!field)throw new Error('请选择条件字段。');
 let value=form.ruleValue;if(value==='')throw new Error('请填写用于比较的值。');
 if(field.type==='INTEGER'){if(!/^-?\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('比较值必须是安全整数。');value=Number(value);}
 if(field.type==='BOOLEAN'){if(!['true','false'].includes(value))throw new Error('是或否的比较值填写 true 或 false。');value=value==='true';}
 const condition={op:'COMPARE',comparator:form.ruleComparator,args:[{op:'FIELD',field_id:field.field_id},{op:'CONST',value}]};
 if(form.ruleKind==='REQUIRED_IF'){if(!schema.fields.some(f=>f.field_id===form.ruleTarget))throw new Error('请选择需要必填的字段。');return {op:'REQUIRED_IF',field_id:form.ruleTarget,args:[condition]};}
 return condition;
}
