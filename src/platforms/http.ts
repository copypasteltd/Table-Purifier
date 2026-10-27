import { AppError,invariant } from '../shared/errors.js';

export type HttpTransport=(url:string,options:{method:string;headers:Record<string,string>;body:string})=>Promise<{text:string;headers:Headers;status:number}>;
export const transport:HttpTransport=async(url,options)=>{
 const response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)});
 const length=Number(response.headers.get('content-length')??0);invariant(length<=2_000_000,'PROVIDER_RESPONSE_TOO_LARGE','原平台响应超出限制。',502);
 if(!response.ok)throw new AppError('PROVIDER_UNAVAILABLE',502,'原平台接口暂不可用。',{},true);
 const reader=response.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
 if(reader)try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;
  invariant(size<=2_000_000,'PROVIDER_RESPONSE_TOO_LARGE','原平台响应超出限制。',502);chunks.push(item.value);}}
 finally{await reader.cancel().catch(()=>undefined);}
 return {text:Buffer.concat(chunks).toString('utf8'),headers:response.headers,status:response.status};
};
export function merchantReference(id:string):string{return 'p07_'+id.replace(/-/g,'');}
export function orderIdFromReference(reference:string):string{
 invariant(/^p07_[0-9a-f]{32}$/.test(reference),'PROVIDER_ORDER_INVALID','原平台订单标识无效。',400);
 const id=reference.slice(4);return `${id.slice(0,8)}-${id.slice(8,12)}-${id.slice(12,16)}-${id.slice(16,20)}-${id.slice(20)}`;
}
export function uniqueForm(raw:Buffer):Record<string,string>{
 const form=new URLSearchParams(raw.toString('utf8')),result:Record<string,string>=Object.create(null);
 for(const [key,value] of form){invariant(!Object.hasOwn(result,key),'INVALID_PLATFORM_EVENT','回调包含重复字段。',400);result[key]=value;}
 return result;
}
/** Extract exactly the raw signed JSON value; never reserialize before RSA verification. */
export function signedJsonValue(text:string,key:string):string {
 let i=0;const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
 const string=()=>{const start=i++;for(;i<text.length;i++){if(text[i]==='\\'){i++;continue;}if(text[i]==='"'){i++;return text.slice(start,i);}}throw new Error('Invalid JSON string');};
 const value=()=>{const start=i;if(text[i]==='"')string();else if(text[i]==='{'||text[i]==='['){const stack=[text[i++]];
   while(i<text.length&&stack.length){const c=text[i];if(c==='"'){string();continue;}if(c==='{'||c==='[')stack.push(c);
    if(c==='}'||c===']'){invariant(stack.pop()===(c==='}'?'{':'['),'PROVIDER_RESPONSE_INVALID','原平台响应结构异常。',502);}i++;}
   invariant(!stack.length,'PROVIDER_RESPONSE_INVALID','原平台响应结构异常。',502);
  }else while(i<text.length&&!/[\s,}\]]/.test(text[i]!))i++;return text.slice(start,i);};
 ws();invariant(text[i++]==='{','PROVIDER_RESPONSE_INVALID','原平台响应结构异常。',502);let found:string|undefined;const keys=new Set<string>();
 while(i<text.length){ws();if(text[i]==='}'){i++;break;}invariant(text[i]==='"','PROVIDER_RESPONSE_INVALID','原平台响应结构异常。',502);
  const name=JSON.parse(string()) as string;invariant(!keys.has(name),'PROVIDER_RESPONSE_INVALID','原平台响应字段重复。',502);keys.add(name);
  ws();invariant(text[i++]===':','PROVIDER_RESPONSE_INVALID','原平台响应结构异常。',502);ws();const raw=value();if(name===key)found=raw;
  ws();if(text[i]===','){i++;continue;}invariant(text[i]==='}','PROVIDER_RESPONSE_INVALID','原平台响应结构异常。',502);i++;break;
 }
 ws();invariant(i===text.length&&found!==undefined,'PROVIDER_RESPONSE_INVALID','原平台响应缺少有效业务信息。',502);return found;
}
