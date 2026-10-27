import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Codex,type Usage } from '@openai/codex-sdk';
import type { Config } from '../shared/config.js';
import type { AgentPhase,PreloadReceipt } from '../shared/lifecycle.js';
import { invariant } from '../shared/errors.js';
import { sha256 } from '../shared/crypto.js';
import { z } from 'zod';
import type { SourceRow } from '../domain/models.js';
import type { SourceUnit } from '../validation/result.js';
import type { LocalStore } from '../storage/local-store.js';
import { SessionBroker } from './broker.js';
import { NativeIsolation } from './isolation.js';
import { loadFullSkill,type FullSkill } from './skill.js';
import { DocumentTools } from './tools.js';
import { parseAgentJson } from './protocol.js';

export interface AgentInput {sessionId:string;phase:AgentPhase;threadId:string|null;sources:SourceRow[];control:Record<string,unknown>;
 units?:SourceUnit[];budgetMs?:number;signal:AbortSignal;onThread?:(id:string)=>Promise<void>;onProgress?:(kind:'READING'|'PROCESSING')=>Promise<void>;}
export interface AgentOutput {threadId:string;data:unknown;units:SourceUnit[];usage:Usage;receipt:PreloadReceipt;isolationReceipt:object;}
export interface AgentRuntime {readonly enabled:boolean;readonly skill:FullSkill;readonly profileId:string;
 run(input:AgentInput):Promise<AgentOutput>;stop(sessionId:string,remove?:boolean):Promise<void>;}

/** The only production implementation. No desktop login, synthetic client or direct chat-completions fallback. */
export class CodexAgentRuntime implements AgentRuntime {
 readonly enabled=true;readonly profileId:string;
 private constructor(private readonly config:Config,private readonly store:LocalStore,readonly skill:FullSkill,
  private readonly isolation:NativeIsolation){this.profileId=isolation.profile.id;}
 static async create(config:Config,store:LocalStore):Promise<CodexAgentRuntime>{
  invariant(config.P07_AGENT_ENABLED&&!!config.P07_CODEX_API_KEY,'AGENT_NOT_CONFIGURED','专用 Codex Agent 尚未配置。',503);
  const skill=await loadFullSkill(join(config.projectRoot,'agent'),config.P07_AGENT_CONTEXT_TOKENS);
  const isolation=await NativeIsolation.load(config,store);return new CodexAgentRuntime(config,store,skill,isolation);
 }
 stop(id:string,remove=false){return this.isolation.stop(id,remove);}
 async run(input:AgentInput):Promise<AgentOutput>{
  const root=await this.store.prepareSession(input.sessionId);
  await this.isolation.stop(input.sessionId);await this.isolation.prepare(input.sessionId);
  let physical:object={};let broker:SessionBroker|undefined;
  const phaseLimit=input.phase==='BOOTSTRAP'?this.config.P07_AGENT_BOOTSTRAP_MS:
   input.phase==='BATCH'||input.phase==='REPAIR'?this.config.P07_AGENT_BATCH_MS:this.config.P07_AGENT_ANALYSIS_MS;
  const limit=Math.min(phaseLimit,input.budgetMs??phaseLimit);invariant(Number.isSafeInteger(limit)&&limit>0,'COMPUTE_BUDGET_EXCEEDED','本次处理没有可用的累计预算。',429);
  const signal=AbortSignal.any([input.signal,AbortSignal.timeout(limit)]);
  try{
   if(input.phase==='BOOTSTRAP')physical=await this.isolation.probe(input.sessionId,signal);
   const tools=new DocumentTools(this.config,this.store,this.isolation,input.sessionId,input.sources,signal,input.units??[],
    this.config.P07_TESSERACT_PATH||null);
   broker=await SessionBroker.open({skill:this.skill,model:this.config.P07_CODEX_MODEL,apiKey:this.config.P07_CODEX_API_KEY,
    baseUrl:this.config.P07_CODEX_BASE_URL||'https://api.openai.com/v1',contextTokens:this.config.P07_AGENT_CONTEXT_TOKENS,signal,tools});
   const scope=await this.isolation.scope(input.sessionId,this.isolation.profile.codex,['BATCH','REPAIR'].includes(input.phase));
   await mkdir(join(root,'session/codex'),{recursive:true,mode:0o700});
   const shellEnv={PATH:'/usr/local/bin:/usr/bin:/bin',HOME:join(root,'session'),TMPDIR:join(root,'tmp'),LANG:'C.UTF-8',
    PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'};
   const codex=new Codex({codexPathOverride:this.isolation.profile.launcher,
    env:{...scope.env,P07_SCOPE_TOKEN:broker.token},config:{
     developer_instructions:this.skill.context,model_provider:'p07_broker',model_context_window:this.config.P07_AGENT_CONTEXT_TOKENS,
     model_auto_compact_token_limit:this.config.P07_AGENT_CONTEXT_TOKENS-4096,disable_response_storage:true,
     model_providers:{p07_broker:{name:'P07 scoped model broker',base_url:broker.url+'/v1',env_key:'P07_SCOPE_TOKEN',
      wire_api:'responses',requires_openai_auth:false,supports_websockets:false,request_max_retries:0,stream_max_retries:0}},
     mcp_servers:{p07:{url:broker.url+'/mcp',bearer_token_env_var:'P07_SCOPE_TOKEN',required:true,
      enabled_tools:tools.definitions.map(t=>t.name),tool_timeout_sec:110}},
     features:{multi_agent:false,multi_agent_mode:false,multi_agent_v2:false,apps:false,plugins:false,
      memory_tool:false,memories:false,web_search:false,prefer_mxc:false,remote_control:false,request_permissions_tool:false},
     shell_environment_policy:{inherit:'none',set:shellEnv},history:{persistence:'none'},project_doc_max_bytes:0,
     sandbox_workspace_write:{exclude_slash_tmp:true,exclude_tmpdir_env_var:true,writable_roots:[join(root,'work'),join(root,'proposal'),join(root,'tmp')]},
    }});
   const options={model:this.config.P07_CODEX_MODEL,workingDirectory:join(root,'work'),skipGitRepoCheck:true,
    sandboxMode:'workspace-write' as const,networkAccessEnabled:false,webSearchMode:'disabled' as const,approvalPolicy:'never' as const};
   const thread=input.threadId?codex.resumeThread(input.threadId,options):codex.startThread(options);
   const control={protocol:'P07-HOST-CONTROL-1',phase:input.phase,session_id:input.sessionId,...input.control};
   const stream=await thread.runStreamed(JSON.stringify(control),{signal});
   let final='';let usage:Usage|null=null;let commands=0;let sawError=false;
   for await(const event of stream.events){
    if(event.type==='thread.started')await input.onThread?.(event.thread_id);
    else if(event.type==='turn.completed')usage=event.usage;
    else if(event.type==='turn.failed'||event.type==='error')sawError=true;
    else if(event.type==='item.completed'){
     if(event.item.type==='agent_message')final=event.item.text;
     else if(event.item.type==='web_search')invariant(false,'AGENT_TOOL_FORBIDDEN','本次处理不允许网页搜索。',422);
     else if(event.item.type==='command_execution'){invariant(++commands<=100,'AGENT_COMMAND_BUDGET','超过本次处理命令预算。',422);await input.onProgress?.('PROCESSING');}
     else if(event.item.type==='mcp_tool_call')await input.onProgress?.('READING');
    }
   }
   invariant(!sawError&&usage&&thread.id&&broker.receipt.verified_requests>0&&broker.receipt.tools_discovered,
    'AGENT_TURN_FAILED','本次处理未完成真实模型或完整工具上下文校验。',503);
   const isolationReceipt={physical_probe:physical,process:await this.isolation.verify(scope),model_context:broker.receipt};
   let data=parseAgentJson(final);
   if(['BATCH','REPAIR'].includes(input.phase)&&(data as {protocol?:unknown})?.protocol==='P07-CANDIDATE-FILE-1'){
    const ref=z.object({protocol:z.literal('P07-CANDIDATE-FILE-1'),file_name:z.literal('candidate.json'),bytes:z.number().int().positive().max(40_000_000),
     sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(data);
    const content=await this.store.read(`sessions/${input.sessionId}/work/candidate.json`,40_000_000);
    invariant(content.length===ref.bytes&&sha256(content)===ref.sha256,'AGENT_CANDIDATE_HASH_MISMATCH','批量候选文件摘要不符。',422);
    data=JSON.parse(content.toString('utf8'));
   }
   if(input.phase==='BOOTSTRAP')invariant((data as {protocol?:unknown;ready?:unknown})?.protocol==='P07-BOOTSTRAP-1'&&
    (data as {ready?:unknown}).ready===true,'SKILL_BOOTSTRAP_FAILED','完整业务技能初始化未完成。',503);
   else tools.assertAllRead();
   return {threadId:thread.id,data,units:tools.allUnits(),usage,receipt:{skill_manifest_sha256:this.skill.manifestHash,
    loaded_file_count:this.skill.fileCount,context_sha256:this.skill.contextHash,host_composition_verified:true,bootstrap_completed:true},isolationReceipt};
  }finally{await broker?.close();await this.isolation.stop(input.sessionId);}
 }
}
