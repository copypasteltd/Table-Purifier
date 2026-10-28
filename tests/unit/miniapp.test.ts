import { beforeAll,expect,it } from 'vitest';
import { build } from 'esbuild';
import { createContext,runInContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT } from '../../src/shared/config.js';
import { Contracts } from '../../src/shared/contracts.js';

const contracts=new Contracts();beforeAll(()=>contracts.initialize());
async function client(provider:'ALIPAY'|'DOUYIN'){
 const id='3815ac3f-44a8-4332-9c69-24cc4e14a086',requests:{url:string;data:unknown;method:string}[]=[];
 let phase='INITIALIZING',task:any=null;const stored:unknown[]=[];const config={apiBaseUrl:'https://unit-test.invalid',buildId:'fixture',skillReleaseId:'fixture',ALIPAY:{appAlias:'test'},DOUYIN:{appAlias:'test'}};
 const bundled=await build({entryPoints:[join(PROJECT_ROOT,'miniapp/src/controller.js')],bundle:true,write:false,format:'cjs',platform:'neutral',target:'es2017',define:{__P07_PROVIDER__:JSON.stringify(provider)},plugins:[{
  name:'test-configuration',setup(b){b.onLoad({filter:/config\.generated\.json$/},()=>({contents:JSON.stringify(config),loader:'json'}));}}]});
 const host={getSystemInfoSync:()=>({platform:'android',version:'fixture',SDKVersion:'fixture'}),getStorageSync:()=>provider==='ALIPAY'?{data:{token:'fixture'}}:{token:'fixture'},setStorageSync:(value:unknown)=>{stored.push(value);},
  request(p:{url:string;method:string;data:unknown;success:(r:unknown)=>void}){requests.push(p);let data:unknown;
   if(p.url.includes('capabilities'))data={flags:{file_input:false,template_input:false,export:false},commercial_enabled:false};
   else if(p.url.endsWith('/agent-sessions')){contracts.validate('Request54',p.data);data={session_id:id,status:'INITIALIZING',operation_id:id};}
   else if(p.url.includes('/agent-sessions/'))data={session_id:id,status:phase,task_id:null};
   else if(p.url.endsWith('/tasks')&&p.method==='POST'){const body=p.data as {mode:string;optional_goal?:string};task={task_id:id,agent_session_id:id,version:1,goal:body.optional_goal??'',mode:body.mode,sources:[]};data=task;}
   else if(p.url.endsWith('/tasks/'+id))data=task;
   else throw new Error('Unexpected test request');
   p.success(provider==='ALIPAY'?{status:200,data:{data}}:{statusCode:200,data:{data}});
  }};
 const module={exports:{} as Record<string,unknown>},context=createContext({module,exports:module.exports,my:host,tt:host,Promise,Uint8Array,DataView,Date,Math,Set,Map,encodeURIComponent,setTimeout,clearTimeout});
 runInContext(bundled.outputFiles[0]!.text,context);const createPage=module.exports.createPage as (id:string)=>any;
 const page=createPage('MP01');page.setData=(patch:object)=>Object.assign(page.data,patch);page.onLoad({});
 return {page,requests,stored,createPage,setPhase:(s:string)=>{phase=s;}};
}
for(const provider of ['ALIPAY','DOUYIN'] as const)it(provider+' initializes without customer data, keeps inputs closed until READY and stops polling on hide',async()=>{
 const c=await client(provider);await c.page.act('new');expect(c.page.data.ready).toBe(false);expect(c.page.data.session.status).toBe('INITIALIZING');
 expect(c.requests.filter(r=>r.url.endsWith('/agent-sessions'))[0]!.data).toMatchObject({skill_release_id:'fixture'});
 expect(Object.keys(c.requests.filter(r=>r.url.endsWith('/agent-sessions'))[0]!.data as object)).toEqual(['client_request_id','skill_release_id']);
 await expect(c.page.act('add-text')).rejects.toThrow('准备完成');c.setPhase('READY_FOR_INPUT');await c.page.refresh();expect(c.page.data.ready).toBe(true);
 c.page.onHide();expect(c.page.visible).toBe(false);
});
for(const provider of ['ALIPAY','DOUYIN'] as const)it(provider+' carries an in-memory goal and input mode to task creation after navigating',async()=>{
 const c=await client(provider);await c.page.act('new');c.setPhase('READY_FOR_INPUT');await c.page.refresh();
 c.page.onInput({currentTarget:{dataset:{field:'goal'}},detail:{value:'只在内存保留的用途'}});await c.page.act('mode-provided');
 const next=c.createPage('MP02');next.setData=(patch:object)=>Object.assign(next.data,patch);next.onLoad({});await next.refresh();await next.ensureTask();
 const request=c.requests.find(r=>r.url.endsWith('/tasks')&&r.method==='POST');expect(request?.data).toMatchObject({optional_goal:'只在内存保留的用途',mode:'PROVIDED'});
 expect(JSON.stringify(c.stored)).not.toContain('只在内存保留的用途');c.page.onUnload();next.onUnload();
});
it('uses standard SHA-256 for complete selected bytes, including block boundaries',async()=>{
 const bundled=await build({entryPoints:[join(PROJECT_ROOT,'miniapp/src/sha256.js')],bundle:true,write:false,platform:'neutral',format:'cjs'});
 const module={exports:{} as Record<string,unknown>};runInContext(bundled.outputFiles[0]!.text,createContext({module,exports:module.exports,Uint8Array,DataView}));
 for(const size of [0,1,55,56,63,64,65,100000]){const b=Buffer.alloc(size,0xa7);expect((module.exports.sha256 as Function)(new Uint8Array(b))).toBe(createHash('sha256').update(b).digest('hex'));}
});
it('ships both native targets with 18 page controllers and 32 distinct registered components, with no webview',async()=>{
 for(const target of ['mini-alipay','mini-douyin']){const root=join(PROJECT_ROOT,'src',target),manifest=JSON.parse(await readFile(join(root,'source-manifest.json'),'utf8'));
  expect(manifest.pages).toBe(18);expect(manifest.components).toBe(32);expect(manifest.native_device_status).toBe('NOT_RUN');
  const app=JSON.parse(await readFile(join(root,'app.json'),'utf8'));expect(app.pages).toHaveLength(18);
  for(const p of app.pages){const xml=await readFile(join(root,p+(target==='mini-alipay'?'.axml':'.ttml')),'utf8');expect(xml).not.toMatch(/web-view|<iframe|<html/i);
   const config=JSON.parse(await readFile(join(root,p+'.json'),'utf8'));expect(Object.keys(config.usingComponents)).toHaveLength(32);}
 }
});
