import { createServer,type IncomingMessage,type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { randomToken,constantTimeEqual } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import { requestContainsFullSkill,type FullSkill } from './skill.js';

export interface BrokerTools {definitions:{name:string;description:string;inputSchema:object}[];call(name:string,args:unknown):Promise<unknown>;}
export interface BrokerOptions {skill:FullSkill;model:string;apiKey:string;baseUrl:string;contextTokens:number;
 signal:AbortSignal;tools:BrokerTools;maxRequests?:number;allowTestHttp?:boolean;}

async function body(request:IncomingMessage,max:number):Promise<Buffer>{
 const chunks:Buffer[]=[];let bytes=0;
 for await(const chunk of request){bytes+=chunk.length;invariant(bytes<=max,'BROKER_REQUEST_LIMIT','请求超出上下文限制。',413);chunks.push(chunk);}
 return Buffer.concat(chunks);
}
function json(response:ServerResponse,status:number,value:unknown){response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(value));}

/** The dedicated service API key never enters the SDK/tool process environment. */
export class SessionBroker {
 readonly token=randomToken();private readonly server=createServer((req,res)=>{void this.handle(req,res);});
 private requests=0;private verified=0;private discovered=false;private closed=false;
 private readonly connections=new Set<import('node:net').Socket>();
 private constructor(private readonly options:BrokerOptions){
  const url=new URL(options.baseUrl||'https://api.openai.com/v1');
  invariant(url.protocol==='https:'||(options.allowTestHttp&&url.hostname==='127.0.0.1'&&url.protocol==='http:'),
   'MODEL_GATEWAY_INVALID','模型网关必须使用专用 HTTPS 地址。',503);
  invariant(!url.username&&!url.password&&!url.search&&!url.hash,'MODEL_GATEWAY_INVALID','模型网关地址不允许包含凭据或查询参数。',503);
  this.server.on('connection',socket=>{this.connections.add(socket);socket.once('close',()=>this.connections.delete(socket));});
  this.server.headersTimeout=10_000;this.server.requestTimeout=30_000;
 }
 static async open(options:BrokerOptions):Promise<SessionBroker>{
  const broker=new SessionBroker(options);broker.server.listen(0,'127.0.0.1');await once(broker.server,'listening');
  options.signal.addEventListener('abort',()=>{void broker.close();},{once:true});return broker;
 }
 get url():string{const address=this.server.address();if(!address||typeof address==='string')throw new Error('Broker closed');return `http://127.0.0.1:${address.port}`;}
 get receipt(){return {verified_requests:this.verified,context_sha256:this.options.skill.contextHash,tools_discovered:this.discovered};}
 async close():Promise<void>{if(this.closed)return;this.closed=true;for(const socket of this.connections)socket.destroy();
  await new Promise<void>(resolve=>this.server.close(()=>resolve()));}
 private async handle(request:IncomingMessage,response:ServerResponse):Promise<void>{
  try{
   invariant(!this.closed&&!this.options.signal.aborted,'BROKER_CLOSED','本次授权已撤销。',403);
   invariant(request.method==='POST'&&constantTimeEqual(request.headers.authorization??'',`Bearer ${this.token}`),
    'BROKER_UNAUTHORIZED','无效的临时处理授权。',401);
   if(request.url==='/mcp'){await this.mcp(request,response);return;}
   invariant(request.url==='/v1/responses','BROKER_ROUTE_BLOCKED','不允许调用此接口。',403);
   invariant(++this.requests<=(this.options.maxRequests??64),'AGENT_REQUEST_BUDGET','已达到处理调用预算。',429);
   const raw=await body(request,Math.min(this.options.contextTokens*6,6_000_000));const payload=JSON.parse(raw.toString('utf8')) as Record<string,unknown>;
   invariant(requestContainsFullSkill(payload,this.options.skill),'FULL_SKILL_MISSING','实际模型请求未包含完整业务技能，已停止。',422);
   invariant(payload.model===this.options.model&&!payload.previous_response_id,'MODEL_SCOPE_INVALID','模型或上下文请求不符合本次授权。',403);
   // Require self-contained input on every call; neither remote history nor compaction can replace the full skill.
   invariant(Buffer.byteLength(JSON.stringify(payload.input??[]))+Buffer.byteLength(String(payload.instructions??''))+4096<this.options.contextTokens,
    'AGENT_CONTEXT_BUDGET','完整上下文超出当前预算，请缩减提交范围。',422);
   const tools=Array.isArray(payload.tools)?payload.tools as {type?:string}[]:[];
   invariant(tools.every(t=>t.type==='function'||t.type==='custom'),'HOSTED_TOOL_BLOCKED','不允许使用未授权托管工具。',403);
   payload.store=false;payload.model=this.options.model;
   payload.max_output_tokens=Math.min(typeof payload.max_output_tokens==='number'?payload.max_output_tokens:24000,24000);
   this.verified++;
   const upstream=await fetch(this.options.baseUrl.replace(/\/$/,'')+'/responses',{method:'POST',redirect:'error',
    headers:{authorization:`Bearer ${this.options.apiKey}`,'content-type':'application/json'},body:JSON.stringify(payload),
    signal:AbortSignal.any([this.options.signal,AbortSignal.timeout(180_000)])});
   if(!upstream.ok||!upstream.body){await upstream.body?.cancel();json(response,502,{error:{code:'MODEL_GATEWAY_FAILED',message:'模型网关暂不可用。'}});return;}
   response.writeHead(200,{'content-type':upstream.headers.get('content-type')?.includes('text/event-stream')?'text/event-stream':'application/json',
    'cache-control':'no-store'});
   let received=0;const reader=upstream.body.getReader();
   try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;
    invariant(received<=32_000_000,'MODEL_OUTPUT_LIMIT','模型输出超过处理预算。',502);
    if(!response.write(value))await once(response,'drain',{signal:this.options.signal});}response.end();}
   finally{await reader.cancel().catch(()=>undefined);}
  }catch{if(!response.headersSent)json(response,422,{error:{code:'P07_BROKER_REJECTED',message:'本次请求不符合处理授权。'}});else response.destroy();}
 }
 private async mcp(request:IncomingMessage,response:ServerResponse):Promise<void>{
  const message=JSON.parse((await body(request,16000)).toString('utf8')) as {jsonrpc?:string;id?:number|string;method?:string;params?:Record<string,unknown>};
  invariant(message.jsonrpc==='2.0'&&typeof message.method==='string','MCP_INVALID','工具请求格式无效。',400);
  if(message.id===undefined){response.writeHead(202);response.end();return;}
  let result:unknown;
  if(message.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'p07',version:'1.0.0'}};
  else if(message.method==='ping')result={};
  else if(message.method==='tools/list'){this.discovered=true;result={tools:this.options.tools.definitions};}
  else if(message.method==='tools/call'){
   const name=message.params?.name;
   invariant(typeof name==='string'&&this.options.tools.definitions.some(t=>t.name===name),'MCP_TOOL_UNAVAILABLE','工具不可用。',400);
   try{const output=await this.options.tools.call(name,message.params?.arguments??{});
    result={content:[{type:'text',text:JSON.stringify(output)}],isError:false};}
   catch{result={content:[{type:'text',text:JSON.stringify({error:'P07_TOOL_FAILED',message:'读取失败或超过预算，请保留不可读原因。'})}],isError:true};}
  }else{json(response,200,{jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found'}});return;}
  json(response,200,{jsonrpc:'2.0',id:message.id,result});
 }
}
