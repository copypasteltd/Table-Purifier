import { afterAll,beforeAll,expect,it } from 'vitest';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { nativePostgres } from '../helpers/native-postgres.js';
import { createApplication,type Application } from '../../src/application.js';
import { WorkerEngine } from '../../src/worker/engine.js';
import { buildServer } from '../../src/api/server.js';
import { loadConfig,PROJECT_ROOT } from '../../src/shared/config.js';
import { newId,sha256 } from '../../src/shared/crypto.js';
import { loadFullSkill } from '../../src/agent/skill.js';
import type { AgentRuntime } from '../../src/agent/runner.js';

let db:Awaited<ReturnType<typeof nativePostgres>>,app:Awaited<ReturnType<typeof buildServer>>;
const owner=newId(),identity=newId(),other=newId(),token='a'.repeat(64),otherToken='b'.repeat(64),root=join(PROJECT_ROOT,'runtime/tests/api-'+newId());
let skill:Awaited<ReturnType<typeof loadFullSkill>>;
let services:Application;
beforeAll(async()=>{
 db=await nativePostgres();skill=await loadFullSkill(join(PROJECT_ROOT,'agent'),64000);
 const config=loadConfig({P07_ENV:'test',P07_TOKEN_SECRET:'api-test-only-secret-longer-than-32',P07_STORAGE_ROOT:root},false);
 const fixture:AgentRuntime={enabled:true,profileId:'SYNTHETIC_NOT_NATIVE',skill,run:async()=>{throw new Error('No model invoked by API contract tests');},stop:async()=>{}};
 services=await createApplication(config,db.app,{runtime:fixture,platforms:new Map()});app=await buildServer(services);
 for(const[o,i,t]of [[owner,identity,token],[other,newId(),otherToken]]){
  await db.admin.query("INSERT INTO p07.accounts(id,status) VALUES($1,'ACTIVE')",[o]);
  await db.admin.query("INSERT INTO p07.platform_identities(id,owner_id,provider,app_alias,subject_cipher_ref,subject_hash,verified_at) VALUES($1,$2,'ALIPAY','test','fixture',$3,now())",[i,o,sha256(o!)]);
  await db.admin.query("INSERT INTO p07.sessions(id,owner_id,identity_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[newId(),o,i,sha256(t!)]);
 }
});
afterAll(async()=>{await app?.close();await db?.close();await rm(root,{recursive:true,force:true});});
const headers=(key=newId())=>({authorization:'Bearer '+token,'idempotency-key':key});
it('registers the 56 contracts, keeps uploads behind actual READY, validates envelopes/idempotency and isolates owners',async()=>{
 const live=await app.inject('/health/live');expect(live.statusCode).toBe(200);expect(live.json()).toEqual({status:'alive'});
 expect((await app.inject('/health/ready')).statusCode).toBe(200);
 expect((await app.inject('/v1/p07/tasks')).statusCode).toBe(401);
 const request={client_request_id:newId(),skill_release_id:skill.releaseId},key=newId();
 const created=await app.inject({method:'POST',url:'/v1/p07/agent-sessions',headers:headers(key),payload:request});
 expect(created.statusCode,created.body).toBe(200);const sessionId=created.json().data.session_id;
 expect(created.json().data.status).toBe('INITIALIZING');
 const repeat=await app.inject({method:'POST',url:'/v1/p07/agent-sessions',headers:headers(key),payload:request});expect(repeat.json().data).toEqual(created.json().data);
 const different=await app.inject({method:'POST',url:'/v1/p07/agent-sessions',headers:headers(key),payload:{...request,client_request_id:newId()}});expect(different.statusCode).toBe(409);
 const taskBody={client_request_id:newId(),agent_session_id:sessionId,mode:'DISCOVER',optional_goal:'把资料整理为名册'};
 const early=await app.inject({method:'POST',url:'/v1/p07/tasks',headers:headers(),payload:taskBody});expect(early.statusCode).toBe(409);
 expect((await app.inject({url:'/v1/p07/agent-sessions/'+sessionId,headers:{authorization:'Bearer '+otherToken}})).statusCode).toBe(404);
 expect((await app.inject({method:'POST',url:'/v1/p07/agent-sessions',headers:headers(),payload:{...request,customer_text:'不得在初始化提交'}})).statusCode).toBe(400);
 // Explicit bootstrap fixture; not a real model or native isolation claim.
 await db.admin.query("UPDATE p07.agent_sessions SET status='READY_FOR_INPUT',preload_receipt=$2 WHERE id=$1",[sessionId,
  {bootstrap_completed:true,host_composition_verified:true,loaded_file_count:skill.fileCount,skill_manifest_sha256:skill.manifestHash,context_sha256:skill.contextHash}]);
 const task=await app.inject({method:'POST',url:'/v1/p07/tasks',headers:headers(),payload:taskBody});expect(task.statusCode,task.body).toBe(201);
 const t=task.json().data;
 const text=await app.inject({method:'POST',url:`/v1/p07/tasks/${t.task_id}/sources`,headers:headers(),payload:{role:'SOURCE',text:'张三\n李四',expected_task_version:t.version}});expect(text.statusCode,text.body).toBe(200);
 const file=Buffer.from('读取数据'),permit=await app.inject({method:'POST',url:`/v1/p07/tasks/${t.task_id}/upload-sessions`,headers:headers(),payload:{role:'SOURCE',name:'data.txt',bytes:file.length,mime:'text/plain',sha256:sha256(file)}});
 expect(permit.statusCode,permit.body).toBe(201);const grant=permit.json().data,boundary='p07-upload-boundary';
 const multipart=(extra:boolean)=>Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="data.txt"\r\nContent-Type: text/plain\r\n\r\n`),file,
  Buffer.from(extra?`\r\n--${boundary}\r\nContent-Disposition: form-data; name="extra"\r\n\r\nrejected\r\n--${boundary}--\r\n`:`\r\n--${boundary}--\r\n`)]);
 const stage=(extra:boolean)=>app.inject({method:'POST',url:'/transport/v1/uploads/'+grant.upload_id,headers:{authorization:'Bearer '+grant.upload_token,'content-type':'multipart/form-data; boundary='+boundary},payload:multipart(extra)});
 expect((await stage(true)).statusCode).toBe(413);
 expect((await db.admin.query('SELECT status FROM p07.upload_sessions WHERE id=$1',[grant.upload_id])).rows[0].status).toBe('ISSUED');
 expect((await stage(false)).statusCode).toBe(200);
 const beforeConsent=await app.inject({method:'POST',url:`/v1/p07/tasks/${t.task_id}/preflight`,headers:headers(),payload:{agent_session_id:sessionId,source_set_version:text.json().data.source_set_version,goal_version:t.goal_version}});
 expect(beforeConsent.statusCode).toBe(403);expect(beforeConsent.json().error.code).toBe('CONSENT_REQUIRED');
 const policy=await app.inject('/v1/p07/privacy/policies?environment=ALIPAY_ANDROID');expect(policy.statusCode,policy.body).toBe(200);
 const consent=await app.inject({method:'POST',url:'/v1/p07/privacy/consents',headers:headers(),payload:{policy_version:policy.json().data.policy_version,scopes:['PROCESS_DATA'],action:'GRANT'}});expect(consent.statusCode,consent.body).toBe(200);
 const analyze=await app.inject({method:'POST',url:`/v1/p07/tasks/${t.task_id}/preflight`,headers:headers(),payload:{agent_session_id:sessionId,source_set_version:text.json().data.source_set_version,goal_version:t.goal_version}});expect(analyze.statusCode,analyze.body).toBe(202);
 const list=await app.inject({url:'/v1/p07/tasks?limit=1',headers:headers()});expect(list.statusCode,list.body).toBe(200);expect(list.json().data.items).toHaveLength(1);
 expect((await app.inject({url:'/v1/p07/tasks?limit=0',headers:headers()})).statusCode).toBe(400);
 expect((await app.inject({url:'/v1/p07/tasks?unknown=1',headers:headers()})).statusCode).toBe(400);
 const foreign=await app.inject({url:'/v1/p07/tasks/'+t.task_id,headers:{authorization:'Bearer '+otherToken}});expect(foreign.statusCode).toBe(404);
 const capability=await app.inject('/v1/p07/capabilities?provider=DOUYIN&app_alias=test&os=IOS&host_version=1&base_sdk=1&build_id=unreleased');
 expect(capability.statusCode,capability.body).toBe(200);expect(capability.json().data.commercial_enabled).toBe(false);
});
it('reports a migration hash mismatch as unready without disclosing database details',async()=>{
 const saved=(await db.admin.query('SELECT name,sha256 FROM p07_meta.migrations ORDER BY name LIMIT 1')).rows[0];
 try{await db.admin.query('UPDATE p07_meta.migrations SET sha256=$2 WHERE name=$1',[saved.name,'0'.repeat(64)]);
  const response=await app.inject('/health/ready');expect(response.statusCode).toBe(503);expect(response.json()).toEqual({status:'unavailable'});
 }finally{await db.admin.query('UPDATE p07_meta.migrations SET sha256=$2 WHERE name=$1',[saved.name,saved.sha256]);}
 expect((await app.inject('/health/ready')).statusCode).toBe(200);
});
it('retries an owner-scoped deletion and keeps only the current receipt login after actual file and SQL purging',async()=>{
 const secondToken='c'.repeat(64),secondId=newId();
 await db.admin.query("INSERT INTO p07.sessions(id,owner_id,identity_id,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')",[secondId,owner,identity,sha256(secondToken)]);
 const response=await app.inject({method:'POST',url:'/v1/p07/data-deletion-requests',headers:headers(),payload:{resource_scope:{kind:'ACCOUNT',resource_ids:[]},confirmation:true}});
 expect(response.statusCode,response.body).toBe(202);const deletion=response.json().data,id=deletion.deletion_request_id;
 expect((await app.inject({url:'/v1/p07/data-deletion-requests/'+id,headers:{authorization:'Bearer '+secondToken}})).statusCode).toBe(401);
 // An exhausted native-cleanup state is an explicit fixture, not a real Linux failure claim.
 await db.admin.query("UPDATE p07.agent_sessions SET cleanup_status='FAILED' WHERE owner_id=$1",[owner]);
 await db.admin.query("UPDATE p07.runtime_cleanup_jobs SET status='FAILED' WHERE owner_id=$1",[owner]);
 await db.admin.query("UPDATE p07.jobs SET status='DEAD',attempts=100 WHERE owner_id=$1 AND kind='CLEANUP'",[owner]);
 await db.admin.query("UPDATE p07.jobs SET status='DONE' WHERE owner_id=$1 AND kind IN('BOOTSTRAP','ANALYZE','ADJUST')",[owner]);
 const failures:unknown[]=[],engine=new WorkerEngine(db.worker,services.config,services.contracts,services.store,services.runtime,services.commerce,e=>failures.push(e));
 const failedJob=await engine.claim('api-deletion-test');expect(failedJob?.kind).toBe('DELETION');await engine.process(failedJob!,new AbortController().signal);
 expect((await services.db.withOwner(owner,tx=>services.privacy.read(tx,id))).status).toBe('PARTIAL_FAILED');
 const path='/transport/v1/data-deletion-requests/'+id+'/retry';
 expect((await app.inject({method:'POST',url:path,headers:{...headers(),authorization:'Bearer '+otherToken},payload:{}})).statusCode).toBe(404);
 const retry=await app.inject({method:'POST',url:path,headers:headers(),payload:{}});expect(retry.statusCode,retry.body).toBe(200);expect(retry.json().data.status).toBe('ACCESS_REVOKED');
 for(let i=0;i<10;i++){const current=await services.db.withOwner(owner,tx=>services.privacy.read(tx,id));if(current.status==='COMPLETED')break;
  const job=await engine.claim('api-deletion-test');if(!job)break;await engine.process(job,new AbortController().signal);}
 expect(failures).toEqual([]);
 const receipt=await app.inject({url:'/v1/p07/data-deletion-requests/'+id,headers:headers()});expect(receipt.statusCode,receipt.body).toBe(200);expect(receipt.json().data.status).toBe('COMPLETED');
 expect((await db.admin.query('SELECT status FROM p07.accounts WHERE id=$1',[owner])).rows[0].status).toBe('CLOSED');
 expect((await app.inject({url:'/v1/p07/tasks',headers:headers()})).statusCode).toBe(403);
 expect((await app.inject({method:'POST',url:'/v1/p07/agent-sessions',headers:headers(),payload:{client_request_id:newId(),skill_release_id:skill.releaseId}})).statusCode).toBe(403);
 expect((await db.admin.query('SELECT subject_cipher_ref FROM p07.platform_identities WHERE id=$1',[identity])).rows[0].subject_cipher_ref).toBe('PURGED');
});
