import { afterAll,beforeAll,expect,it } from 'vitest';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { nativePostgres } from '../helpers/native-postgres.js';
import { newId,contentHash } from '../../src/shared/crypto.js';
import { loadConfig,PROJECT_ROOT } from '../../src/shared/config.js';
import { Contracts,type Schema } from '../../src/shared/contracts.js';
import { LocalStore } from '../../src/storage/local-store.js';
import { TaskService } from '../../src/domain/task-service.js';
import { DecisionService } from '../../src/domain/decision-service.js';
import { CorrectionService } from '../../src/domain/correction-service.js';
import { LibraryService } from '../../src/domain/library-service.js';
import { CommerceService } from '../../src/domain/commerce-service.js';
import { insertRow } from '../../src/db/database.js';
import type { Actor,PlanRow,SessionRow } from '../../src/domain/models.js';
import { merchantReference } from '../../src/platforms/http.js';
import { WorkerEngine } from '../../src/worker/engine.js';
import type { AgentRuntime } from '../../src/agent/runner.js';
import type { SourceUnit } from '../../src/validation/result.js';
import { sha256 } from '../../src/shared/crypto.js';
import ExcelJS from 'exceljs';
import { ResultService } from '../../src/domain/result-service.js';
import { PrivacyService } from '../../src/domain/privacy-service.js';

let db:Awaited<ReturnType<typeof nativePostgres>>;let tasks:TaskService;let commerce:CommerceService;
const contracts=new Contracts(),owner=newId(),root=join(PROJECT_ROOT,'runtime/tests','workflow-'+newId());
const actor:Actor={owner,identity:newId(),provider:'ALIPAY',appAlias:'synthetic-test'};
const skillHash='a'.repeat(64);
const schema:Schema['SchemaDefinition']={schema_id:newId(),version:1,origin:'DISCOVERED',purpose:'名称表',row_kind:'一人一行',fields:[{
 field_id:'name',label:'姓名',order:0,type:'TEXT',required:true,nullable:false,unit:null,description:''}],identity_keys:[],rules:[],
 locale:'zh-CN',timezone:'Asia/Shanghai',rounding:'NONE',export_policy:{version:'1',formula_protection:true,csv_encoding:'UTF-8-BOM',csv_separator:','}};
beforeAll(async()=>{db=await nativePostgres();await contracts.initialize();const store=new LocalStore(root,PROJECT_ROOT);await store.initialize();
 const config=loadConfig({P07_ENV:'test',P07_TOKEN_SECRET:'test-only-secret-32-characters-long',P07_COMMERCE_ENABLED:'true',P07_ALIPAY_ENABLED:'true'},false);
 tasks=new TaskService(config,store,{enabled:true,skillReleaseId:'synthetic-test-only',skillHash,profileId:'synthetic-test-only'});
 // Explicit synthetic verifier tests business gates, and is never installed by the application composition root.
 commerce=new CommerceService(config,tasks,new Map([['ALIPAY',{configured:true} as never]]),async()=>true);
 await db.admin.query("INSERT INTO p07.accounts(id,status) VALUES($1,'ACTIVE')",[owner]);
});
afterAll(async()=>{await db?.close();await rm(root,{recursive:true,force:true});});
const tx=<T>(fn:Parameters<typeof db.app.withOwner<T>>[1])=>db.app.withOwner(owner,fn);
it('enforces the entire unpaid analysis → confirmation → quote → verified payment → queued batch sequence in real PostgreSQL',async()=>{
 const init=await tx(t=>tasks.session(t,actor,{client_request_id:newId(),skill_release_id:'synthetic-test-only'}));contracts.validate('Data54',init);
 // Explicit fixture: does not invoke or claim a real model/bootstrap. Only trusted-host persistence behavior is tested here.
 await expect(tx(t=>tasks.create(t,actor,{mode:'DISCOVER',client_request_id:newId(),agent_session_id:init.session_id})))
  .rejects.toMatchObject({code:'SESSION_NOT_READY'});
 await db.admin.query("UPDATE p07.agent_sessions SET status='READY_FOR_INPUT',preload_receipt=$2 WHERE id=$1",[init.session_id,
  {bootstrap_completed:true,host_composition_verified:true,loaded_file_count:9,skill_manifest_sha256:skillHash,context_sha256:'b'.repeat(64)}]);
 await tasks.store.prepareSession(init.session_id);
 const task=await tx(t=>tasks.create(t,actor,{mode:'DISCOVER',client_request_id:newId(),agent_session_id:init.session_id,optional_goal:'整理姓名'}));contracts.validate('Data03',task);
 const source=await tx(t=>tasks.addSource(t,actor,task.task_id,{role:'SOURCE',text:'张三\n李四',expected_task_version:task.version}));contracts.validate('Data06',source);
 await expect(tx(t=>tasks.addSource(t,actor,task.task_id,{role:'SOURCE',text:'王五',expected_task_version:task.version})))
  .rejects.toMatchObject({code:'VERSION_CONFLICT'});
 const consent=newId();await tx(async t=>{await insertRow(t,'consents',{id:consent,owner_id:owner,policy_id:'bfe873aa-192a-43f6-8c64-673d04372700',
  scope:'PROCESS_DATA',action:'GRANT',effective_at:new Date()});});
 const analyzed=await tx(t=>tasks.analyze(t,actor,task.task_id,{agent_session_id:init.session_id,source_set_version:source.source_set_version,goal_version:task.goal_version}));
 contracts.validate('Data09',analyzed);
 const planId=newId(),proposalId=newId();
 const sourceRow=await tx(async t=>(await tasks.sources(t,task.task_id))[0]!);
 const unit:SourceUnit={unit_id:newId(),source_id:sourceRow.id,ordinal:0,kind:'TEXT_SPAN',text:'张三\n李四',sha256:sha256('张三\n李四'),
  readability:'READABLE',confidence:null,limitations:[],locator:{version:'P07-LOCATOR-1',kind:'TEXT_SPAN',page_or_ordinal:0,span:[0,5],bbox:null,path:null}};
 const planRef=`sessions/${init.session_id}/control/synthetic-plan.json`;
 await tasks.store.write(planRef,Buffer.from(JSON.stringify({protocol:'P07-SAVED-PLAN-1',analysis:{},units:[unit]})));
 await tx(async t=>{
  const current=(await t.query('SELECT current_source_set_id FROM p07.tasks WHERE id=$1',[task.task_id])).rows[0];
  const set=(await t.query('SELECT * FROM p07.source_sets WHERE id=$1',[current.current_source_set_id])).rows[0];
  await insertRow(t,'execution_plans',{id:planId,owner_id:owner,task_id:task.task_id,session_id:init.session_id,version:1,status:'DRAFT',
   plan_sha256:contentHash({schema,strategy:'整理姓名'}),source_set_sha256:set.content_sha256,skill_manifest_sha256:skillHash,
   source_set_id:set.id,goal_version:1,content_ref:planRef,estimated_records:2,measured_units:1,summary:{strategy_summary:'逐人整理姓名',preview_record_count:0,limitations:[]}});
  const proposal:Schema['Proposal']={proposal_id:proposalId,version:1,status:'FULL_DRAFT',source_set_version:set.version,goal_version:1,schema,
   suggestions:[],coverage:{confirmed_units:1,read_units:1,unreadable_units:0,excluded_units:0,scope_sha256:set.content_sha256,limitations:[]},
   preview_is_sample:true,preview_records:[],unmapped_important:[],change_preview:null};
  await insertRow(t,'schema_proposals',{id:proposalId,owner_id:owner,task_id:task.task_id,source_set_id:set.id,goal_version:1,version:1,status:'FULL_DRAFT',
   content:proposal,coverage:proposal.coverage,content_sha256:contentHash(proposal),plan_id:planId});
  await t.query('UPDATE p07.tasks SET current_plan_id=$2 WHERE id=$1',[task.task_id,planId]);
  await t.query("UPDATE p07.agent_sessions SET status='WAITING_CONFIRMATION' WHERE id=$1",[init.session_id]);
 });
 const adopted=await tx(t=>tasks.adopt(t,actor,task.task_id,{session_id:init.session_id,expected_proposal_version:1,
  expected_source_set_version:source.source_set_version,expected_goal_version:1}));contracts.validate('Data20',adopted);
 const current=await tx(t=>tasks.view(t,task.task_id));
 const plan=(await db.admin.query<PlanRow>('SELECT * FROM p07.execution_plans WHERE id=$1',[planId])).rows[0]!;
 const confirmed=await tx(t=>tasks.confirm(t,actor,task.task_id,{session_id:init.session_id,plan_id:planId,plan_version:1,plan_hash:plan.plan_sha256,
  binding_id:adopted.binding_id,policy_consent_id:consent,expected_versions:{task_version:current.version,source_set_version:current.source_set_version,goal_version:1}}));
 contracts.validate('Data10',confirmed);
 const environment:Schema['Environment']={provider:'ALIPAY',app_alias:actor.appAlias,os:'ANDROID',host_version:'test',base_sdk:'test',build_id:'test-only'};
 const quoteBody={session_id:init.session_id,contract_id:confirmed.contract_id,confirmed_plan_id:planId,plan_hash:plan.plan_sha256,origin_environment:environment};
 const unavailable=await tx(t=>commerce.quote(t,actor,task.task_id,quoteBody));expect(unavailable.access_mode).toBe('UNAVAILABLE');contracts.validate('Data11',unavailable);
 await db.admin.query(`INSERT INTO p07.capability_releases(id,provider,app_alias,os,sku_id,build_id,capability_version,flags,evidence_index,commercial_enabled,effective_at)
  VALUES($1,'ALIPAY',$2,'ANDROID','synthetic-sku','test-only','synthetic-release',$3,$4,true,now())`,[newId(),actor.appAlias,
   {file_input:true,template_input:true,preview:true,export:true,payment:true},{refs:['SYNTHETIC_TEST_NOT_RELEASE_EVIDENCE']}]);
 const quote=await tx(t=>commerce.quote(t,actor,task.task_id,quoteBody));expect(quote.access_mode).toBe('PAID');contracts.validate('Data11',quote);
 const order=await tx(t=>commerce.createOrder(t,actor,{quote_id:quote.quote_id!,contract_hash:confirmed.contract_hash}));contracts.validate('Data12',order);
 const runBody={session_id:init.session_id,contract_id:confirmed.contract_id,order_id:order.order_id,confirmed_plan_hash:plan.plan_sha256};
 await expect(tx(t=>commerce.createRun(t,actor,task.task_id,runBody))).rejects.toMatchObject({code:'PAYMENT_REQUIRED'});
 // The payment transport itself is not under test; a verified adapter fact is explicitly injected.
 await tx(async t=>{const row=(await t.query('SELECT * FROM p07.orders WHERE id=$1',[order.order_id])).rows[0];
  await commerce.applyPayment(t,actor,row,{provider:'ALIPAY',appAlias:actor.appAlias,merchantReference:merchantReference(order.order_id),providerReference:'fixture-payment',
   status:'CONFIRMED',amountMinor:order.amount.amount_minor,amountUnit:order.amount.amount_unit,factKey:'fixture-payment',paidAt:new Date().toISOString()});});
 const run=await tx(t=>commerce.createRun(t,actor,task.task_id,runBody));contracts.validate('Data16',run);expect(run.execution_status).toBe('QUEUED');
 expect((await tx(t=>commerce.createRun(t,actor,task.task_id,runBody))).run_id).toBe(run.run_id);
 const status=(await db.admin.query<SessionRow>('SELECT * FROM p07.agent_sessions WHERE id=$1',[init.session_id])).rows[0]!;expect(status.status).toBe('BATCH_QUEUED');
 // Explicit synthetic Agent output; this tests real validation, publication and whole-environment cleanup only.
 const evidenceId=newId(),recordId=newId();let stopped=0;
 const runtime:AgentRuntime={enabled:true,profileId:'synthetic-test-only',skill:{manifestHash:skillHash} as never,stop:async()=>{stopped++;},
  run:async()=>({threadId:newId(),units:[unit],receipt:status.preload_receipt!,isolationReceipt:{synthetic:true},
   usage:{input_tokens:1,cached_input_tokens:0,cache_write_input_tokens:0,output_tokens:1,reasoning_output_tokens:0},data:{
    protocol:'P07-CANDIDATE-1',schema_sha256:contentHash(schema),records:[{record_id:recordId,ordinal:0,disposition:'ACCEPTED',
     fields:[{field_id:'name',raw_text:'张三',typed_value:'张三',status:'EXTRACTED',evidence_ids:[evidenceId],unit:null,transform_chain:[]}],issue_ids:[],exclusion_reason:null}],
    issues:[],evidence:[{evidence_id:evidenceId,unit_id:unit.unit_id,excerpt:'张三',locator:unit.locator}],
    coverage:[{unit_id:unit.unit_id,disposition:'READ',reason:null}],limitations:[]}})};
 const engine=new WorkerEngine(db.worker,tasks.config,contracts,tasks.store,runtime,commerce,error=>{throw error;});
 await db.admin.query("UPDATE p07.jobs SET status='DONE' WHERE kind IN('BOOTSTRAP','ANALYZE') AND owner_id=$1",[owner]);
 const batch=await engine.claim('synthetic-worker');expect(batch?.kind).toBe('BATCH');
 await engine.process(batch!,new AbortController().signal);
 const delivered=await tx(async t=>(await t.query('SELECT * FROM p07.result_versions WHERE run_id=$1',[run.run_id])).rows[0]);
 const jobState=(await db.admin.query('SELECT status,last_error_code FROM p07.jobs WHERE id=$1',[batch!.id])).rows[0];
 expect(jobState).toMatchObject({status:'DONE'});expect(delivered).toBeDefined();
 const artifactSet=await tx(async t=>(await t.query('SELECT * FROM p07.artifact_sets WHERE result_id=$1',[delivered.id])).rows[0]);
 expect(artifactSet.status).toBe('READY');
 const files=await tx(async t=>(await t.query('SELECT * FROM p07.artifacts WHERE artifact_set_id=$1',[artifactSet.id])).rows);
 expect(files).toHaveLength(9);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await tasks.store.read(files.find(f=>f.name==='result.xlsx').object_key) as never);
 // The fixture plan predicts two rows but returns one: preserve it for review, never silently certify completeness.
 expect(workbook.getWorksheet('通过验收')!.getRow(2).getCell(1).value).toBeNull();
 expect(workbook.getWorksheet('待确认')!.getRow(2).getCell(1).value).toBe('张三');
 const cleanup=await engine.claim('synthetic-worker');expect(cleanup?.kind).toBe('CLEANUP');
 await engine.process(cleanup!,new AbortController().signal);
 const closed=await tx(t=>tasks.readSession(t,init.session_id));expect(closed).toMatchObject({status:'CLOSED',cleanup_status:'SUCCEEDED',result_files_preserved:true});
 await expect(tasks.store.read(planRef)).rejects.toThrow();
 expect(stopped).toBeGreaterThan(0);
 expect((await tx(t=>tasks.view(t,task.task_id))).goal).toBeNull();
 const sourceAfter=await tx(async t=>(await t.query('SELECT * FROM p07.source_files WHERE id=$1',[sourceRow.id])).rows[0]);
 expect(sourceAfter).toMatchObject({status:'DELETED',display_name:'原始资料已清理'});
 for(const file of files)expect((await tasks.store.inspect(file.object_key)).sha256).toBe(file.sha256);
 expect((await tx(async t=>(await t.query('SELECT count(*)::integer n FROM p07.field_values')).rows[0])).n).toBe(1);
 expect((await tx(async t=>(await t.query("SELECT count(*)::integer n FROM p07.outbox_events WHERE sent_at IS NOT NULL")).rows[0])).n).toBe(1);
 const results=new ResultService(tasks.config,tasks.store);
 const page=await tx(t=>results.records(t,actor,run.run_id,{result_version:1}));contracts.validate('Data21',page);expect(page.records[0]!.fields[0]!.typed_value).toBe('张三');
 const all=await tx(t=>results.artifacts(t,run.run_id));contracts.validate('Data28',all);
 const excel=all.artifacts.find(f=>f.name==='result.xlsx')!;const link=await tx(t=>results.downloadLink(t,actor,excel.artifact_id));contracts.validate('Data29',link);
 const url=new URL(link.signed_url),grant=url.pathname.split('/').at(-1)!,token=url.searchParams.get('token')!;
 expect(results.downloadOwner(grant,token)).toBe(owner);expect((await tx(t=>results.download(t,grant,token))).sha256).toBe(excel.sha256);
 const publishedEvidence=(await tx(async t=>(await t.query('SELECT id FROM p07.evidence WHERE run_id=$1',[run.run_id])).rows[0])).id;
 const preserved=await tx(t=>results.evidence(t,publishedEvidence));contracts.validate('Data23',preserved);expect(preserved).toMatchObject({excerpt:'张三',authorized_page_url:null});
 // Rework has a second real preload gate before new user decisions. Model execution remains an explicit fixture.
 const decisions=new DecisionService(tasks,results,commerce),input:Schema['Request24']={expected_result_version:1,decisions:[{issue_id:newId(),record_id:page.records[0]!.record_id,field_id:'name',action:'USER_VALUE',user_value:'确认姓名'}],scope:{target_record_ids:[page.records[0]!.record_id]}};
 await expect(tx(t=>decisions.preview(t,actor,run.run_id,input))).rejects.toMatchObject({code:'REWORK_SESSION_REQUIRED'});
 const prepared=await tx(t=>decisions.prepare(t,actor,run.run_id,{client_request_id:newId(),skill_release_id:'synthetic-test-only'}));
 expect((await tx(t=>decisions.prepare(t,actor,run.run_id,{client_request_id:newId(),skill_release_id:'synthetic-test-only'}))).session_id).toBe(prepared.session_id);
 await expect(tx(t=>decisions.preview(t,actor,run.run_id,input))).rejects.toMatchObject({code:'REWORK_SESSION_REQUIRED'});
 const fixtureReady=async(sessionId:string)=>{await tasks.store.prepareSession(sessionId);await db.admin.query("UPDATE p07.agent_sessions SET status='READY_FOR_INPUT',preload_receipt=$2 WHERE id=$1",[sessionId,status.preload_receipt]);};
 await fixtureReady(prepared.session_id);
 await expect(tx(t=>tasks.create(t,actor,{mode:'PROVIDED',client_request_id:newId(),agent_session_id:prepared.session_id}))).rejects.toMatchObject({code:'DECISIONS_NOT_CONFIRMED'});
 // Add an explicit synthetic issue for the decision-path fixture, without claiming new model validation.
 await tx(t=>insertRow(t,'issues',{id:input.decisions[0]!.issue_id,owner_id:owner,result_id:delivered.id,record_id:page.records[0]!.record_id,field_id:'name',code:'SYNTHETIC_REVIEW',severity:'WARNING',status:'OPEN',allowed_decisions:JSON.stringify(['USER_VALUE','KEEP_UNRESOLVED']),details:{message:'Synthetic decision fixture',evidence_ids:[]}}));
 const preview=await tx(t=>decisions.preview(t,actor,run.run_id,input)),submitted=await tx(t=>decisions.submit(t,actor,run.run_id,{preview_id:preview.preview_id,preview_hash:preview.preview_hash,expected_result_version:1}));
 expect(submitted.new_session_id).toBe(prepared.session_id);
 expect((await tx(t=>decisions.submit(t,actor,run.run_id,{preview_id:preview.preview_id,preview_hash:preview.preview_hash,expected_result_version:1}))).revision_intent_id).toBe(submitted.revision_intent_id);
 const rework=await tx(t=>tasks.create(t,actor,{mode:'PROVIDED',client_request_id:newId(),agent_session_id:prepared.session_id}));expect(rework.sources).toHaveLength(2);
 const closeFixture=async(sessionId:string)=>{const s=await tx(t=>tasks.readSession(t,sessionId));await tx(t=>tasks.closeSession(t,actor,sessionId,{expected_version:s.version,reason:'Fixture cleanup'}));
  await db.admin.query("UPDATE p07.jobs SET status='DONE' WHERE payload->>'session_id'=$1 AND kind<>'CLEANUP'",[sessionId]);const job=await engine.claim('synthetic-worker');expect(job?.kind).toBe('CLEANUP');await engine.process(job!,new AbortController().signal);};
 await closeFixture(prepared.session_id);
 const purgedPreview=await tx(async t=>(await t.query('SELECT decisions FROM p07.decision_previews WHERE id=$1',[preview.preview_id])).rows[0]);expect(purgedPreview.decisions).toEqual([]);
 // A reviewed platform correction uses the original confirmed payment, a new session and a shared cumulative budget.
 const corrections=new CorrectionService(tasks,results,commerce),correctionSession=await tx(t=>corrections.prepare(t,actor,run.run_id,{client_request_id:newId(),skill_release_id:'synthetic-test-only'}));await fixtureReady(correctionSession.session_id);
 const correctionTask=await tx(t=>tasks.create(t,actor,{mode:'PROVIDED',client_request_id:newId(),agent_session_id:correctionSession.session_id}));
 const originalAgain=await tx(t=>tasks.addSource(t,actor,correctionTask.task_id,{role:'SOURCE',text:'张三\n李四',expected_task_version:correctionTask.version}));
 await tx(t=>tasks.analyze(t,actor,correctionTask.task_id,{agent_session_id:correctionSession.session_id,source_set_version:originalAgain.source_set_version,goal_version:1}));
 const correctionPlan=newId(),correctionProposal=newId();
 await tx(async t=>{const current=(await t.query('SELECT * FROM p07.tasks WHERE id=$1',[correctionTask.task_id])).rows[0],set=(await t.query('SELECT * FROM p07.source_sets WHERE id=$1',[current.current_source_set_id])).rows[0];
  await insertRow(t,'execution_plans',{id:correctionPlan,owner_id:owner,task_id:correctionTask.task_id,session_id:correctionSession.session_id,version:1,status:'DRAFT',
   plan_sha256:contentHash({schema,correction:true}),source_set_sha256:set.content_sha256,skill_manifest_sha256:skillHash,source_set_id:set.id,goal_version:1,estimated_records:1,measured_units:3,summary:{strategy_summary:'Synthetic correction fixture',preview_record_count:0,limitations:[]}});
  const content={proposal_id:correctionProposal,version:1,status:'FULL_DRAFT',source_set_version:set.version,goal_version:1,schema,suggestions:[],coverage:{confirmed_units:3,read_units:3,unreadable_units:0,excluded_units:0,scope_sha256:set.content_sha256,limitations:[]},preview_is_sample:true,preview_records:[],unmapped_important:[],change_preview:null};
  await insertRow(t,'schema_proposals',{id:correctionProposal,owner_id:owner,task_id:correctionTask.task_id,source_set_id:set.id,goal_version:1,version:1,status:'FULL_DRAFT',content,coverage:content.coverage,content_sha256:contentHash(content),plan_id:correctionPlan});
  await t.query('UPDATE p07.tasks SET current_plan_id=$2 WHERE id=$1',[correctionTask.task_id,correctionPlan]);await t.query("UPDATE p07.agent_sessions SET status='WAITING_CONFIRMATION' WHERE id=$1",[correctionSession.session_id]);});
 const correctionAdopt=await tx(t=>tasks.adopt(t,actor,correctionTask.task_id,{session_id:correctionSession.session_id,expected_proposal_version:1,expected_source_set_version:originalAgain.source_set_version,expected_goal_version:1}));
 const correctionCurrent=await tx(t=>tasks.view(t,correctionTask.task_id)),correctionHash=contentHash({schema,correction:true});
 const correctionContract=await tx(t=>tasks.confirm(t,actor,correctionTask.task_id,{session_id:correctionSession.session_id,plan_id:correctionPlan,plan_version:1,plan_hash:correctionHash,binding_id:correctionAdopt.binding_id,policy_consent_id:consent,expected_versions:{task_version:correctionCurrent.version,source_set_version:originalAgain.source_set_version,goal_version:1}}));
 const correctionQuote=await tx(t=>commerce.quote(t,actor,correctionTask.task_id,{session_id:correctionSession.session_id,contract_id:correctionContract.contract_id,confirmed_plan_id:correctionPlan,plan_hash:correctionHash,origin_environment:environment}));
 await expect(tx(t=>commerce.createOrder(t,actor,{quote_id:correctionQuote.quote_id!,contract_hash:correctionContract.contract_hash}))).rejects.toMatchObject({code:'ORIGINAL_PAID_CORRECTION_REQUIRED'});
 const library=new LibraryService(contracts,tasks.store,tasks,commerce,results),ticket=await tx(t=>library.ticket(t,actor,{task_id:correctionTask.task_id,expected_task_version:correctionCurrent.version,category:'平台纠错',note:'Synthetic review fixture',content_access_opt_in:true}));
 const authorization=await tx(t=>corrections.approve(t,{owner_id:owner,ticket_id:ticket.ticket_id,parent_run_id:run.run_id,contract_id:correctionContract.contract_id,plan_hash:correctionHash,reason_code:'EXTRACTION_ERROR',review_receipt_ref:'TEST_ONLY_REVIEW_RECEIPT'},'a'.repeat(64)));
 const correctionBody={session_id:correctionSession.session_id,contract_id:correctionContract.contract_id,plan_hash:correctionHash,quote_id:correctionQuote.quote_id!};
 const child=await tx(t=>corrections.start(t,actor,authorization.authorization_id,correctionBody));expect(child.parent_run_id).toBe(run.run_id);expect(child.execution_status).toBe('QUEUED');
 expect((await tx(t=>corrections.start(t,actor,authorization.authorization_id,correctionBody))).run_id).toBe(child.run_id);
 const correctedGrant=await tx(async t=>(await t.query('SELECT * FROM p07.entitlement_grants WHERE contract_id=$1',[correctionContract.contract_id])).rows[0]);expect(correctedGrant).toMatchObject({kind:'PAID',order_id:order.order_id,revision_consumed:0,revision_reserved:0});
 expect((await tx(async t=>(await t.query('SELECT count(*)::integer n FROM p07.orders')).rows[0])).n).toBe(1);
 expect((await tx(async t=>(await t.query('SELECT budget_contract_id FROM p07.processing_contracts WHERE id=$1',[correctionContract.contract_id])).rows[0])).budget_contract_id).toBe(confirmed.contract_id);
 await closeFixture(correctionSession.session_id);
 // Owner-confirmed deletion is distinct from normal environment cleanup; it revokes links before deleting preserved content.
 const privacy=new PrivacyService(tasks.config),deletion=await tx(t=>privacy.request(t,actor,{resource_scope:{kind:'TASK_CONTENT',resource_ids:[task.task_id]},confirmation:true}));
 contracts.validate('Data37',deletion);expect(deletion.status).toBe('ACCESS_REVOKED');
 await expect(tx(t=>results.download(t,grant,token))).rejects.toThrow();
 const deletionJob=await engine.claim('synthetic-worker');expect(deletionJob?.kind).toBe('DELETION');await engine.process(deletionJob!,new AbortController().signal);
 const deleted=await tx(t=>privacy.read(t,deletion.deletion_request_id));expect(deleted.status).toBe('COMPLETED');
 for(const file of files)await expect(tasks.store.read(file.object_key)).rejects.toThrow();
 expect((await tx(async t=>(await t.query('SELECT count(*)::integer n FROM p07.field_values')).rows[0])).n).toBe(0);
});
