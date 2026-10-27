import { Decimal } from 'decimal.js';
import type { Schema } from '../shared/contracts.js';
import { invariant } from '../shared/errors.js';

export type Scalar=string|number|boolean|null;
type Field=Schema['SchemaField'];type Rule=Schema['RuleNode'];
const ExactDecimal=Decimal.clone({precision:80,rounding:Decimal.ROUND_HALF_UP,toExpNeg:-100,toExpPos:100});
export function decimal(value:Scalar):Decimal {
  invariant(typeof value==='string'&&/^-?(?:0|[1-9]\d{0,29})(?:\.\d{1,18})?$/.test(value),'INVALID_DECIMAL','小数必须使用精确十进制字符串。',422);
  return new ExactDecimal(value);
}
export function validateValue(field:Field,value:Scalar):void {
  if(value===null){invariant(!field.required||field.nullable,'MISSING_REQUIRED','必填字段缺少有效值。',422);return;}
  switch(field.type){
    case 'TEXT':invariant(typeof value==='string'&&value.length<=50_000,'FIELD_TYPE_MISMATCH','文本字段类型错误。',422);break;
    case 'INTEGER':invariant(typeof value==='number'&&Number.isSafeInteger(value),'FIELD_TYPE_MISMATCH','整数超出精度或类型错误。',422);break;
    case 'DECIMAL':{const d=decimal(value);if(field.scale!==undefined&&field.scale!==null)invariant(d.decimalPlaces()<=field.scale,'DECIMAL_SCALE_EXCEEDED','小数位数超过已确认规范。',422);break;}
    case 'BOOLEAN':invariant(typeof value==='boolean','FIELD_TYPE_MISMATCH','布尔值类型错误。',422);break;
    case 'ENUM':invariant(typeof value==='string'&&(!field.closed_enum||field.enum_values?.includes(value)),'ENUM_OUT_OF_RANGE','字段值不在已确认枚举内。',422);break;
    case 'DATE':{
      invariant(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))
        &&new Date(value).toISOString().slice(0,10)===value,'INVALID_DATE','日期必须有效并使用年-月-日格式。',422);break;}
    case 'DATETIME':invariant(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      &&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10),
      'INVALID_DATETIME','时间必须有效并包含明确时区。',422);break;
  }
}
export function validateSchema(schema:Schema['SchemaDefinition']):void {
  invariant(schema.fields.length>=1&&schema.fields.length<=50,'SCHEMA_FIELDS_INVALID','规范字段数量应为一至五十。',422);
  const ids=new Set<string>(),labels=new Set<string>(),orders=new Set<number>();
  for(const field of schema.fields){
    invariant(!ids.has(field.field_id)&&!labels.has(field.label)&&!orders.has(field.order),'DUPLICATE_SCHEMA_FIELD','规范字段标识、名称和顺序必须唯一。',422);
    ids.add(field.field_id);labels.add(field.label);orders.add(field.order);
    invariant(field.type!=='ENUM'||!field.closed_enum||!!field.enum_values?.length,'ENUM_VALUES_REQUIRED','封闭枚举必须声明候选值。',422);
    invariant(field.type==='DECIMAL'||field.scale===undefined||field.scale===null,'INVALID_SCALE','只有十进制字段可设置小数位。',422);
    invariant(!field.enum_values||new Set(field.enum_values).size===field.enum_values.length,'DUPLICATE_ENUM','枚举选项不能重复。',422);
  }
  invariant(schema.identity_keys.every(id=>ids.has(id))&&new Set(schema.identity_keys).size===schema.identity_keys.length,
    'IDENTITY_FIELD_MISSING','主键必须引用现有字段。',422);
  invariant(schema.export_policy.formula_protection,'FORMULA_PROTECTION_REQUIRED','导出必须启用公式注入防护。',422);
  try{new Intl.DateTimeFormat(schema.locale,{timeZone:schema.timezone});}catch{invariant(false,'INVALID_LOCALE','规范的语言或时区无效。',422);}
  for(const rule of schema.rules)compileRule(rule,schema.fields);
}
type Kind='scalar'|'decimal'|'boolean';
export function compileRule(rule:Rule,fields:Field[]):(values:ReadonlyMap<string,Scalar>)=>boolean {
  const map=new Map(fields.map(f=>[f.field_id,f]));let nodes=0;
  type Node={kind:Kind;unit:string|null;get:(values:ReadonlyMap<string,Scalar>)=>Scalar|Decimal};
  const compile=(node:Rule,depth:number):Node=>{
    invariant(++nodes<=500&&depth<=12,'RULE_COMPLEXITY_EXCEEDED','规则超出可验证的复杂度。',422);
    const children=()=>node.args?.map(child=>compile(child,depth+1))??[];
    switch(node.op){
      case 'FIELD':{
        const field=node.field_id?map.get(node.field_id):null;invariant(field&&!node.args?.length,'RULE_FIELD_INVALID','规则引用了不存在的字段。',422);
        return {kind:field.type==='DECIMAL'?'decimal':field.type==='BOOLEAN'?'boolean':'scalar',unit:field.unit,
          get:values=>{const v=values.get(field.field_id)??null;return field.type==='DECIMAL'&&v!==null?decimal(v):v;}};}
      case 'CONST':invariant('value' in node&&!node.args?.length,'RULE_CONST_INVALID','常量规则缺少值。',422);
        return {kind:typeof node.value==='boolean'?'boolean':'scalar',unit:null,get:()=>node.value??null};
      case 'AND':case 'OR':{const args=children();invariant(args.length>=1&&args.every(a=>a.kind==='boolean'),'RULE_BOOLEAN_REQUIRED','逻辑规则只能组合布尔条件。',422);
        return {kind:'boolean',unit:null,get:values=>node.op==='AND'?args.every(a=>a.get(values)===true):args.some(a=>a.get(values)===true)};}
      case 'REQUIRED_IF':{const args=children();invariant(args.length===1&&args[0]!.kind==='boolean'&&!!node.field_id&&map.has(node.field_id),
        'RULE_REQUIRED_IF_INVALID','条件必填规则需指定字段及一个条件。',422);
        return {kind:'boolean',unit:null,get:values=>args[0]!.get(values)!==true||((values.get(node.field_id!)??null)!==null&&values.get(node.field_id!)!=='')};}
      case 'COMPARE':{
        const args=children();invariant(args.length===2&&!!node.comparator,'RULE_COMPARE_INVALID','比较规则必须包含两个操作数。',422);
        const [left,right]=args as [Node,Node];invariant(!left.unit||!right.unit||left.unit===right.unit,'RULE_UNIT_MISMATCH','比较字段单位不一致。',422);
        return {kind:'boolean',unit:null,get:values=>{
          const a=left.get(values),b=right.get(values);if(a===null||b===null)return false;
          let comparison:number;
          if(Decimal.isDecimal(a)||Decimal.isDecimal(b))comparison=(Decimal.isDecimal(a)?a:decimal(a as Scalar)).comparedTo(Decimal.isDecimal(b)?b:decimal(b as Scalar));
          else {if(typeof a!==typeof b)return false;comparison=a===b?0:a>b?1:-1;}
          return ({EQ:comparison===0,NE:comparison!==0,GT:comparison>0,GE:comparison>=0,LT:comparison<0,LE:comparison<=0})[node.comparator!];}};}
      case 'DECIMAL_ADD':case 'DECIMAL_SUBTRACT':case 'DECIMAL_MULTIPLY':case 'DECIMAL_DIVIDE':{
        const args=children();invariant(args.length===2,'RULE_ARITY_INVALID','十进制运算需两个操作数。',422);
        const [left,right]=args as [Node,Node];
        if(node.op==='DECIMAL_ADD'||node.op==='DECIMAL_SUBTRACT')invariant(!left.unit||!right.unit||left.unit===right.unit,'RULE_UNIT_MISMATCH','加减字段单位不一致。',422);
        return {kind:'decimal',unit:node.op==='DECIMAL_MULTIPLY'||node.op==='DECIMAL_DIVIDE'?null:left.unit??right.unit,get:values=>{
          const a=left.get(values),b=right.get(values);if(a===null||b===null)return null;
          const x=Decimal.isDecimal(a)?a:decimal(a as Scalar),y=Decimal.isDecimal(b)?b:decimal(b as Scalar);
          invariant(node.op!=='DECIMAL_DIVIDE'||!y.isZero(),'DIVISION_BY_ZERO','规则发生除零，需人工确认。',422);
          const result=node.op==='DECIMAL_ADD'?x.plus(y):node.op==='DECIMAL_SUBTRACT'?x.minus(y):node.op==='DECIMAL_MULTIPLY'?x.mul(y):x.div(y);
          invariant(result.isFinite()&&result.abs().lt('1e60'),'RULE_NUMBER_OVERFLOW','规则计算结果超过数值范围。',422);return result;}};}
    }
  };
  const root=compile(rule,0);invariant(root.kind==='boolean','RULE_BOOLEAN_REQUIRED','验收规则的结果必须是布尔条件。',422);
  return values=>root.get(values)===true;
}
export function safeSpreadsheetText(value:Scalar):string {
  const text=value===null?'':String(value);
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text)?"'"+text:text;
}
export function csvCell(value:Scalar):string{return '"'+safeSpreadsheetText(value).replace(/"/g,'""')+'"';}
