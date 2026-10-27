import { afterEach,describe,expect,it } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { cp,mkdir,rm,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../../src/shared/config.js';
import { newId } from '../../src/shared/crypto.js';
import { loadFullSkill,requestContainsFullSkill } from '../../src/agent/skill.js';
import { SessionBroker } from '../../src/agent/broker.js';

const roots:string[]=[];afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
describe('actual Skill composition and scoped model broker',()=>{
 it('loads every sealed body; refuses over-budget contexts and changed/missing tool code',async()=>{
  const skill=await loadFullSkill(join(PROJECT_ROOT,'agent'),64000);
  expect(skill.fileCount).toBe(7);expect(skill.context).toContain('def read_document(');expect(skill.context).toContain('subprocess.run(command');
  expect(requestContainsFullSkill({input:[{role:'user',content:skill.context}]},skill)).toBe(false);
  expect(requestContainsFullSkill({input:[{role:'developer',content:[{type:'input_text',text:skill.context}]}]},skill)).toBe(true);
  await expect(loadFullSkill(join(PROJECT_ROOT,'agent'),8192)).rejects.toMatchObject({code:'SKILL_CONTEXT_EXCEEDED'});
  const root=join(PROJECT_ROOT,'runtime/tests/skill-'+newId());roots.push(root);await mkdir(root,{recursive:true});
  await cp(join(PROJECT_ROOT,'agent'),root,{recursive:true});
  await writeFile(join(root,'tools/read_document.py'),'pass');
  await expect(loadFullSkill(root,64000)).rejects.toMatchObject({code:'SKILL_HASH_MISMATCH'});
  await rm(join(root,'tools/read_document.py'));
  await expect(loadFullSkill(root,64000)).rejects.toThrow();
 });
 it('forwards only an authorized complete context; never forwards the transient credential or provider errors',async()=>{
  const skill=await loadFullSkill(join(PROJECT_ROOT,'agent'),64000);const calls:{headers:unknown;body:any}[]=[];
  const upstream=createServer(async(req,res)=>{const chunks=[];for await(const part of req)chunks.push(part);
   calls.push({headers:req.headers,body:JSON.parse(Buffer.concat(chunks).toString())});
   res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: {"ok":true}\n\n');});
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');const address=upstream.address();if(!address||typeof address==='string')throw new Error();
  const controller=new AbortController();const broker=await SessionBroker.open({skill,model:'test-model',apiKey:'dedicated-test-service-key',
   baseUrl:`http://127.0.0.1:${address.port}/v1`,contextTokens:64000,signal:controller.signal,allowTestHttp:true,
   tools:{definitions:[{name:'list_sources',description:'test',inputSchema:{type:'object'}}],call:async()=>({sources:[]})}});
  const send=(data:unknown,token=broker.token,path='/v1/responses')=>fetch(broker.url+path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(data)});
  try{
   const payload={model:'test-model',input:[{role:'developer',content:skill.context}],store:true};
   expect((await send(payload,'wrong')).status).toBe(422);
   expect((await send({...payload,input:[{role:'user',content:skill.context}]})).status).toBe(422);
   expect((await send({...payload,previous_response_id:'remote-history'})).status).toBe(422);
   expect((await send({...payload,model:'other'})).status).toBe(422);
   expect((await send({...payload,tools:[{type:'web_search'}]})).status).toBe(422);
   expect(calls).toHaveLength(0);
   expect(await (await send(payload)).text()).toContain('"ok":true');
   expect(calls).toHaveLength(1);expect(calls[0]!.body.store).toBe(false);
   expect((calls[0]!.headers as Record<string,string>).authorization).toBe('Bearer dedicated-test-service-key');
   expect(JSON.stringify(calls)).not.toContain(broker.token);
   const discovery=await send({jsonrpc:'2.0',id:1,method:'tools/list'},broker.token,'/mcp');
   expect((await discovery.json()).result.tools[0].name).toBe('list_sources');
   expect(broker.receipt).toMatchObject({verified_requests:1,tools_discovered:true,context_sha256:skill.contextHash});
  }finally{await broker.close();await new Promise<void>(r=>upstream.close(()=>r()));}
 });
});
