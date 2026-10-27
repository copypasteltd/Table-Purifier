import type { Body,Schema } from '../shared/contracts.js';
import { invariant } from '../shared/errors.js';
import { validateSchema } from './schema.js';

/** Exact, bounded user edits; the Agent still reanalyses the whole submitted scope. */
export function applySchemaPatch(original:Schema['SchemaDefinition'],patch:NonNullable<Body<'19'>['patch']>):Schema['SchemaDefinition']{
 const schema=structuredClone(original);
 for(const item of patch){switch(item.op){
 case 'ADD_FIELD':invariant(item.field&&!schema.fields.some(f=>f.field_id===item.field!.field_id),'SCHEMA_PATCH_INVALID','新增字段缺失或标识已存在。',422);schema.fields.push(item.field);break;
 case 'UPDATE_FIELD':{const index=schema.fields.findIndex(f=>f.field_id===item.field_id);invariant(item.field&&index>=0&&item.field.field_id===item.field_id,'SCHEMA_PATCH_INVALID','修改字段的标识与当前规范不符。',422);schema.fields[index]=item.field;break;}
 case 'REMOVE_FIELD':invariant(item.field_id&&schema.fields.some(f=>f.field_id===item.field_id),'SCHEMA_PATCH_INVALID','待删除字段不存在。',422);schema.fields=schema.fields.filter(f=>f.field_id!==item.field_id);break;
 case 'SET_ROW_KIND':invariant(item.row_kind&&item.row_kind.trim(),'SCHEMA_PATCH_INVALID','请说明一行代表的对象。',422);schema.row_kind=item.row_kind;break;
 case 'SET_RULES':invariant(item.rules,'SCHEMA_PATCH_INVALID','规则列表缺失。',422);schema.rules=item.rules;break;
 }}
 validateSchema(schema);return schema;
}
