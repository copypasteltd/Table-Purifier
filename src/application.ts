import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Config } from './shared/config.js';
import { projectPath } from './shared/config.js';
import { Contracts } from './shared/contracts.js';
import { invariant } from './shared/errors.js';
import { contentHash } from './shared/crypto.js';
import type { Database } from './db/database.js';
import { one } from './db/database.js';
import { LocalStore } from './storage/local-store.js';
import { loadFullSkill } from './agent/skill.js';
import { CodexAgentRuntime,type AgentRuntime } from './agent/runner.js';
import { NativeIsolation } from './agent/isolation.js';
import { createPlatforms } from './platforms/factory.js';
import type { Platforms } from './platforms/types.js';
import { AuthService } from './platforms/auth.js';
import { PaymentService } from './platforms/payments.js';
import { TaskService } from './domain/task-service.js';
import { UploadService } from './domain/upload-service.js';
import { CommerceService } from './domain/commerce-service.js';
import { ResultService } from './domain/result-service.js';
import { LibraryService } from './domain/library-service.js';
import { PrivacyService } from './domain/privacy-service.js';
import { DecisionService } from './domain/decision-service.js';
import { CorrectionService } from './domain/correction-service.js';

export async function createApplication(config:Config,db:Database,options:{runtime?:AgentRuntime;platforms?:Platforms}={}){
 await db.assertApplicationRole();const contracts=new Contracts();await contracts.initialize();
 const store=new LocalStore(config.storageRoot,config.projectRoot);await store.initialize();
 let runtime=options.runtime;
 if(!runtime){if(config.P07_AGENT_ENABLED)runtime=await CodexAgentRuntime.create(config,store);
  else{const skill=await loadFullSkill(join(config.projectRoot,'agent'),config.P07_AGENT_CONTEXT_TOKENS);
   const isolation=config.P07_ISOLATION_PROFILE?await NativeIsolation.load(config,store):null;
   runtime={enabled:false,skill,profileId:isolation?.profile.id??'DISABLED',
    run:async()=>{throw new Error('Agent is disabled.');},stop:async(id,remove)=>{
     invariant(isolation,'NATIVE_CLEANUP_UNAVAILABLE','真实任务环境清理器尚未配置。',503);await isolation.stop(id,remove);}};
  }
 }
 // Missing supplier declarations fail closed before customer material can leave the Host.
 if(config.P07_AGENT_ENABLED){
  invariant(config.P07_PROCESSOR_POLICY_FILE,'PROCESSOR_POLICY_REQUIRED','启用模型前须配置已告知的实际数据处理方。',503);
  const declared=JSON.parse(await readFile(projectPath(config.projectRoot,config.P07_PROCESSOR_POLICY_FILE),'utf8'));
  const policy=await db.withOwner('00000000-0000-4000-8000-000000000007',tx=>one<{content:{processors:unknown[]}}>(tx,
   "SELECT content FROM p07.privacy_policies WHERE policy_version=$1 AND environment IN($2,'ALL') ORDER BY(environment=$2) DESC LIMIT 1",[config.P07_POLICY_VERSION,config.P07_ENV]));
  invariant(declared.policy_version===config.P07_POLICY_VERSION&&declared.model_base_url===(config.P07_CODEX_BASE_URL||'https://api.openai.com/v1')
   &&Array.isArray(declared.processors)&&declared.processors.length>0&&declared.processors.every((p:Record<string,string>)=>['name','purpose','region','retention','deletion_limitations'].every(k=>typeof p[k]==='string'&&p[k]!.length>0&&!p[k]!.includes('NOT_CONFIGURED')))
   &&contentHash(policy?.content.processors??[])===contentHash(declared.processors),
   'PROCESSOR_POLICY_MISMATCH','实际数据处理方与当前告知版本不一致。',503);
 }
 const platforms=options.platforms??await createPlatforms(config);
 const tasks=new TaskService(config,store,{enabled:runtime.enabled,skillReleaseId:runtime.skill.releaseId,skillHash:runtime.skill.manifestHash,profileId:runtime.profileId});
 const commerce=new CommerceService(config,tasks,platforms),results=new ResultService(config,store);
 const auth=new AuthService(config,db,platforms),payments=new PaymentService(config,db,commerce,platforms);
 const library=new LibraryService(contracts,store,tasks,commerce,results),privacy=new PrivacyService(config);
 const decisions=new DecisionService(tasks,results,commerce);
 return {config,db,contracts,store,runtime,platforms,tasks,commerce,results,auth,payments,library,privacy,decisions,
  corrections:new CorrectionService(tasks,results,commerce),uploads:new UploadService(config,db,tasks)};
}
export type Application=Awaited<ReturnType<typeof createApplication>>;
