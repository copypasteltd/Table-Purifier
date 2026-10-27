import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Ajv2020,type ValidateFunction } from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import { PROJECT_ROOT } from './config.js';
import { AppError } from './errors.js';
import type { components } from './generated/contracts.js';

export type Schema=components['schemas'];
export type RequestCode=Extract<keyof Schema,`Request${string}`>;
export type DataCode=Extract<keyof Schema,`Data${string}`>;
export type Body<N extends string>=Schema[Extract<`Request${N}`,keyof Schema>];
export type Data<N extends string>=Schema[Extract<`Data${N}`,keyof Schema>];
export interface ApiOperation {
  operationId:string;method:string;path:string;status:number;public:boolean;bodySchema?:string;
  parameters:{name:string;in:string;required?:boolean;schema:Record<string,unknown>}[];
}
type OpenApi={components:{schemas:Record<string,object>};paths:Record<string,Record<string,{
  operationId:string;security?:unknown[];parameters?:ApiOperation['parameters'];
  requestBody?:{content:{'application/json'?:{schema:{$ref:string}}}};responses:Record<string,unknown>;
}>>};

export class Contracts {
  readonly operations:ApiOperation[]=[];
  private readonly validators=new Map<string,ValidateFunction>();
  private parameterValidators=new Map<string,ValidateFunction>();
  async initialize():Promise<void>{
    const document=JSON.parse(await readFile(join(PROJECT_ROOT,'assets/development/v3.0.0/openapi.json'),'utf8')) as OpenApi;
    const ajv=new Ajv2020({allErrors:true,strict:false,validateFormats:true,coerceTypes:false});
    (formats as unknown as (ajv:Ajv2020)=>void)(ajv);
    ajv.addSchema({$id:'urn:p07:api',components:document.components});
    for(const name of Object.keys(document.components.schemas))
      this.validators.set(name,ajv.compile({$ref:`urn:p07:api#/components/schemas/${name}`}));
    for(const [path,methods] of Object.entries(document.paths))for(const [method,o] of Object.entries(methods)){
      const ref=o.requestBody?.content['application/json']?.schema.$ref;
      this.operations.push({operationId:o.operationId,method:method.toUpperCase(),path:path.replace(/\{(\w+)\}/g,':$1'),
        status:Number(Object.keys(o.responses).find(code=>code.startsWith('2'))),public:o.security?.length===0,
        ...(ref?{bodySchema:ref.split('/').at(-1)!}:{}),parameters:o.parameters??[]});
      for(const p of o.parameters??[]){const schema=JSON.parse(JSON.stringify(p.schema).replaceAll('#/components/','urn:p07:api#/components/'));
        this.parameterValidators.set(o.operationId+'|'+p.in+'|'+p.name,ajv.compile(schema));}
    }
  }
  parameters(operation:ApiOperation,values:{path:Record<string,unknown>;query:Record<string,unknown>;header:Record<string,unknown>}):void{
    for(const p of operation.parameters){const record=values[p.in as keyof typeof values];if(!record)continue;
      const name=p.in==='header'?p.name.toLowerCase():p.name;let value=record[name];
      if(value===undefined){if(p.required)throw new AppError('INVALID_REQUEST',400,'缺少必要参数。');continue;}
      if(p.schema.type==='integer'&&typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value))value=record[name]=Number(value);
      if(!this.parameterValidators.get(operation.operationId+'|'+p.in+'|'+p.name)!(value))throw new AppError('INVALID_REQUEST',400,'请求参数无效。');
    }
    const names=new Set(operation.parameters.filter(p=>p.in==='query').map(p=>p.name));
    if(Object.keys(values.query).some(key=>!names.has(key)))throw new AppError('INVALID_REQUEST',400,'包含未声明的查询参数。');
  }
  validate<T=unknown>(name:string,value:unknown,server=false):T {
    const validate=this.validators.get(name);if(!validate)throw new Error('Unknown contract '+name);
    if(!validate(value))throw new AppError(server?'RESPONSE_CONTRACT_FAILED':'INVALID_REQUEST',server?500:400,
      server?'服务响应暂不可用。':'提交内容不符合要求。',server?{}:{violations:validate.errors?.slice(0,12).map(e=>({path:e.instancePath,rule:e.keyword}))});
    return value as T;
  }
}
