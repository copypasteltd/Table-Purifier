import Fastify,{type FastifyRequest} from 'fastify';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import type { Application } from '../application.js';
import { registerCorrectionRoutes } from './correction-routes.js';
import { join } from 'node:path';
import { migrationReadiness } from '../db/readiness.js';
import type { EvidenceRelease } from '../domain/release-evidence.js';
import type { Body,Schema } from '../shared/contracts.js';
import { AppError,invariant,safeErrorCode } from '../shared/errors.js';
import { constantTimeEqual,newId,sha256 } from '../shared/crypto.js';
import { idempotent } from '../db/idempotency.js';
import { one,type Transaction } from '../db/database.js';
import { BUDGET,get,operationView,planView,type Actor,type OperationRow,type OrderRow,type TaskRow,type PlanRow,type BindingRow } from '../domain/models.js';

const PUBLIC_OWNER='00000000-0000-4000-8000-000000000007';
type Query=Record<string,unknown>;
const bearer=(request:FastifyRequest)=>{const h=request.headers.authorization;invariant(typeof h==='string'&&h.startsWith('Bearer '),'AUTH_REQUIRED','请先登录。',401);return h.slice(7);};
export async function buildServer(a:Application){
 const app=Fastify({logger:false,bodyLimit:512_000,requestTimeout:45_000,connectionTimeout:10_000,keepAliveTimeout:5000,
  genReqId:()=>newId(),trustProxy:false});
 const httpsPublicUrl=new URL(a.config.P07_PUBLIC_URL).protocol==='https:';
 await app.register(helmet,{strictTransportSecurity:httpsPublicUrl,
  contentSecurityPolicy:{directives:{defaultSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:httpsPublicUrl?[]:null}}});
 await app.register(multipart,{limits:{fileSize:20_000_000,files:1,fields:0,parts:1,fieldNameSize:100,headerPairs:30},throwFileSizeLimit:true});
 const buckets=new Map<string,{at:number;count:number}>();
 app.addHook('onRequest',async req=>{
  const now=Date.now(),key=req.ip,old=buckets.get(key);if(!old||old.at+60_000<=now){if(buckets.size>=2000){for(const[k,v]of buckets)if(v.at+60_000<=now)buckets.delete(k);if(buckets.size>=2000)buckets.delete(buckets.keys().next().value!);}buckets.set(key,{at:now,count:1});}
  else invariant(++old.count<=180,'RATE_LIMITED','请求过于频繁，请稍后再试。',429);
 });
 app.addHook('onSend',async(_req,reply)=>{reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','no-referrer');});
 app.setErrorHandler((error,req,reply)=>{
  const bad=error instanceof z.ZodError||['FST_ERR_CTP_INVALID_JSON_BODY','FST_ERR_VALIDATION'].includes((error as {code?:string}).code??'');
  const e=error instanceof AppError?error:new AppError(bad?'INVALID_REQUEST':(error as {statusCode?:number}).statusCode===413?'LIMIT_EXCEEDED':'INTERNAL_ERROR',bad?400:(error as {statusCode?:number}).statusCode===413?413:500,bad?'提交内容无效。':'本次请求暂未完成，请稍后查询状态。',{},!bad);
  // Never serialize raw exceptions, SQL, request bodies, signed URLs or platform credentials.
  reply.code(e.statusCode).send({request_id:req.id,error:{code:e.code,message:e.message,retryable:e.retryable,
   ...(typeof e.details.operation_id==='string'?{operation_id:e.details.operation_id}:{})}});
 });
 app.setNotFoundHandler((req,reply)=>reply.code(404).send({request_id:req.id,error:{code:'RESOURCE_NOT_FOUND',message:'接口不存在。',retryable:false}}));
 app.get('/health/live',async()=>({status:'alive'}));
 const databaseReady=await migrationReadiness(a.db,join(a.config.projectRoot,'migrations'));
 app.get('/health/ready',async(_req,reply)=>{try{if(!await databaseReady())return reply.code(503).send({status:'unavailable'});return {status:'ready'};}
  catch{return reply.code(503).send({status:'unavailable'});}});
 for(const op of a.contracts.operations){
  const n=op.operationId.slice(-2);if(n==='53')continue;
  app.route({method:op.method as 'GET'|'POST'|'DELETE',url:op.path,handler:async(req,reply)=>{
   const params={...req.params as Query},query={...req.query as Query};
   a.contracts.parameters(op,{path:params,query,header:req.headers as Query});
   if(op.bodySchema)a.contracts.validate(op.bodySchema,req.body);else invariant(req.body===undefined,'INVALID_REQUEST','该接口不接收正文。',400);
   const body=req.body,id=String(params.id??''),key=String(req.headers['idempotency-key']??'');
   let actor:Actor;
   if(op.public){actor={owner:PUBLIC_OWNER,identity:PUBLIC_OWNER,provider:query.provider as Schema['Provider']??'ALIPAY',appAlias:String(query.app_alias??a.config.P07_ALIPAY_APP_ALIAS)};}
   else if(n==='39'){
    invariant(a.config.P07_OPERATOR_TOKEN_HASH&&constantTimeEqual(sha256(bearer(req)),a.config.P07_OPERATOR_TOKEN_HASH),'OPERATOR_AUTH_REQUIRED','需要运营身份。',403);
    actor={owner:PUBLIC_OWNER,identity:PUBLIC_OWNER,provider:'ALIPAY',appAlias:a.config.P07_ALIPAY_APP_ALIAS};
   }else actor=await a.auth.authenticate(bearer(req));
   if(!op.public&&n!=='39')await a.db.withOwner(actor.owner,async tx=>{
    const account=await one<{status:string}>(tx,'SELECT status FROM p07.accounts WHERE id=$1',[actor.owner]);
    invariant(account?.status==='ACTIVE'||account?.status==='DELETION_PENDING'&&['26','50','51','14','15','31','52'].includes(n)
     ||account?.status==='CLOSED'&&['26','50'].includes(n),'ACCOUNT_UNAVAILABLE','账号正在删除或已关闭。',403);
   });
   if(n==='01'){const data=await a.auth.login(body as Body<'01'>,key);return reply.code(op.status).send(a.contracts.validate('Response01',{request_id:req.id,data},true));}
   if(n==='13'){invariant(key.length>=16&&key.length<=128,'IDEMPOTENCY_KEY_REQUIRED','请提供稳定操作标识。',400);
    const data=await a.payments.checkout(actor,id,body as Body<'13'>);return reply.code(op.status).send(a.contracts.validate('Response13',{request_id:req.id,data},true));}
   if(n==='14'){
    const current=await a.db.withOwner(actor.owner,tx=>get<OrderRow>(tx,'orders',id));
    const data=['PENDING','UNKNOWN'].includes(current.payment_status)?await a.payments.reconcile(actor.owner,id):a.commerce.orderView(current);
    return reply.code(op.status).send(a.contracts.validate('Response14',{request_id:req.id,data},true));
   }
   const data=await a.db.withOwner(actor.owner,async tx=>{
    if(!op.public&&n!=='39'){
     const account=await one<{status:string}>(tx,'SELECT status FROM p07.accounts WHERE id=$1',[actor.owner]);
     invariant(account?.status==='ACTIVE'||account?.status==='DELETION_PENDING'&&['26','50','51','15','31','52'].includes(n)||account?.status==='CLOSED'&&['26','50'].includes(n),'ACCOUNT_UNAVAILABLE','账号正在删除或已关闭。',403);
    }
    const action=async()=>{
     const value=await dispatch(a,tx,actor,n,id,params,query,body);
     a.contracts.validate('Data'+n,value,true);return value;
    };
    if(op.method==='GET')return action();
    const session=await linkedSession(tx,n,id,body);
    return idempotent(tx,actor.owner,op.operationId+':'+op.path,key,{params,query,body:body??null},action,session);
   });
   return reply.code(op.status).send(a.contracts.validate('Response'+n,{request_id:req.id,data},true));
  }});
 }
 await app.register(async scope=>{
  scope.removeAllContentTypeParsers();scope.addContentTypeParser(['application/json','application/x-www-form-urlencoded'],{parseAs:'buffer',bodyLimit:128_000},(_r,b,done)=>done(null,b));
  scope.post('/v1/p07/platform-events/:provider',async(req,reply)=>{
   const provider=z.enum(['ALIPAY','DOUYIN']).parse((req.params as {provider:string}).provider);
   invariant(Buffer.isBuffer(req.body),'INVALID_CALLBACK','支付回调格式无效。',400);
   const headers:Record<string,string|undefined>={};for(const[k,v]of Object.entries(req.headers))headers[k]=Array.isArray(v)?undefined:v;
   await a.payments.notify(provider,req.body,headers);
   return provider==='ALIPAY'?reply.type('text/plain').send('success'):reply.send({err_no:0,err_tips:'success'});
  });
 });
 app.post('/transport/v1/uploads/:upload_id',async(req,reply)=>{
  const id=z.uuid().parse((req.params as {upload_id:string}).upload_id),token=bearer(req);
  const parts=req.parts(),part=(await parts.next()).value;invariant(part?.type==='file'&&part.fieldname==='file','UPLOAD_FILE_REQUIRED','请选择一个文件。',400);
  const result=await a.uploads.stage(id,token,part.file,async()=>{
   invariant((await parts.next()).done,'UPLOAD_SINGLE_FILE_REQUIRED','本次上传只允许一个文件。',400);
   invariant(!part.file.truncated,'LIMIT_EXCEEDED','文件超过限制。',413);
  });return reply.send(result);
 });
 // Additive implementation transport: frozen API10 requires plan_id/hash/version, but its frozen read models omit them.
 app.post('/transport/v1/runs/:run_id/rework-sessions',async(req,reply)=>{
  const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {run_id:string}).run_id);
  a.contracts.validate('Request54',req.body);const key=String(req.headers['idempotency-key']??'');
  const data=await a.db.withOwner(actor.owner,async tx=>{const account=await get<{status:string}>(tx,'accounts',actor.owner);invariant(account.status==='ACTIVE','ACCOUNT_UNAVAILABLE','账号当前不可新建会话。',403);
   return idempotent(tx,actor.owner,'transport:prepare-rework:'+id,key,req.body,()=>a.decisions.prepare(tx,actor,id,req.body as Body<'54'>));
  });return reply.send({request_id:req.id,data});
 });
 app.get('/transport/v1/tasks/:task_id/plan',async req=>{
  const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {task_id:string}).task_id);
  return a.db.withOwner(actor.owner,async tx=>{const task=await get<TaskRow>(tx,'tasks',id);invariant(!task.deleted_at&&task.current_plan_id,'PLAN_NOT_READY','本次分析方案尚未完成。',409);
   const plan=await get<PlanRow>(tx,'execution_plans',task.current_plan_id);const binding=plan.binding_id?await get<BindingRow>(tx,'schema_bindings',plan.binding_id):null;
   const contract=await one<{id:string;contract_sha256:string}>(tx,'SELECT id,contract_sha256 FROM p07.processing_contracts WHERE confirmed_plan_id=$1 ORDER BY version DESC LIMIT 1',[plan.id]);
   const order=contract?await one<{id:string}>(tx,'SELECT id FROM p07.orders WHERE contract_id=$1',[contract.id]):null;
   const view=a.contracts.validate('ExecutionPlan',planView(plan,binding?.content_sha256??null),true);
   return {request_id:req.id,data:{plan:view,binding_id:binding?.id??null,contract_id:contract?.id??null,contract_hash:contract?.contract_sha256??null,order_id:order?.id??null}};
  });
 });
 app.get('/transport/v1/orders/:order_id/context',async req=>{
  const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {order_id:string}).order_id);
  return a.db.withOwner(actor.owner,async tx=>{const order=await get<OrderRow>(tx,'orders',id);
   const contract=await get<{task_id:string}>(tx,'processing_contracts',order.contract_id),task=await get<TaskRow>(tx,'tasks',contract.task_id);
   invariant(!task.deleted_at,'RESOURCE_NOT_FOUND','该任务已删除。',404);
   return {request_id:req.id,data:{task_id:task.id,session_id:task.agent_session_id,run_id:task.current_run_id}};
  });
 });
 app.get('/transport/v1/runs/:run_id/schema',async req=>{
  const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {run_id:string}).run_id);
  const query=z.object({result_version:z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER)}).strict().parse(req.query);
  return a.db.withOwner(actor.owner,async tx=>{const result=await a.results.result(tx,id,query.result_version),binding=await get<BindingRow>(tx,'schema_bindings',result.binding_id);
   return {request_id:req.id,data:{result_version:result.version,schema:a.contracts.validate('SchemaDefinition',binding.content,true)}};
  });
 });
 registerCorrectionRoutes(app,a,bearer);
 app.post('/transport/v1/data-deletion-requests/:request_id/retry',async req=>{
  const actor=await a.auth.authenticate(bearer(req)),id=z.uuid().parse((req.params as {request_id:string}).request_id);
  z.object({}).strict().parse(req.body);const key=String(req.headers['idempotency-key']??'');
  const data=await a.db.withOwner(actor.owner,tx=>idempotent(tx,actor.owner,'transport:retry-deletion:'+id,key,{},()=>a.privacy.retry(tx,actor,id)));
  return {request_id:req.id,data:a.contracts.validate('DeletionJob',data,true)};
 });
 let downloads=0;
 app.get('/transport/v1/downloads/:grant_id',async(req,reply)=>{
  invariant(downloads<4,'DOWNLOAD_BUSY','领取请求较多，请稍后重试。',429);downloads++;
  try{const id=z.uuid().parse((req.params as {grant_id:string}).grant_id),query=z.object({token:z.string().min(1).max(8192)}).strict().parse(req.query);
   const owner=a.results.downloadOwner(id,query.token),file=await a.db.withOwner(owner,tx=>a.results.download(tx,id,query.token));
   const bytes=await a.store.read(file.object_key);invariant(bytes.length===file.byte_count&&sha256(bytes)===file.sha256,'ARTIFACT_HASH_MISMATCH','结果文件完整性校验失败。',503);
   reply.header('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(file.name)).header('Accept-Ranges','bytes').header('ETag','"'+file.sha256+'"').type(file.media_type);
   const range=req.headers.range;if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);invariant(match,'RANGE_INVALID','文件范围无效。',416);
    const start=Number(match[1]),end=match[2]?Number(match[2]):bytes.length-1;invariant(Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end&&start<bytes.length&&end<bytes.length,'RANGE_INVALID','文件范围无效。',416);
    return reply.code(206).header('Content-Range',`bytes ${start}-${end}/${bytes.length}`).send(bytes.subarray(start,end+1));}
   return reply.send(bytes);
  }finally{downloads--;}
 });
 return app;
}

async function linkedSession(tx:Transaction,n:string,id:string,body:unknown):Promise<string|undefined>{
 const b=body as Record<string,unknown>|undefined;for(const key of ['session_id','agent_session_id'])if(typeof b?.[key]==='string')return b[key] as string;
 if(['04','06','07','09','10','11','18','19','20','46'].includes(n))return (await one<{agent_session_id:string}>(tx,'SELECT agent_session_id FROM p07.tasks WHERE id=$1',[id]))?.agent_session_id;
 if(n==='25'&&typeof b?.preview_id==='string')return (await one<{session_id:string}>(tx,'SELECT session_id FROM p07.decision_previews WHERE id=$1',[b.preview_id]))?.session_id;
 if(n==='24')return (await one<{session_id:string}>(tx,`SELECT r.session_id FROM p07.revision_intents r JOIN p07.agent_sessions s ON s.id=r.session_id WHERE r.parent_run_id=$1 AND r.billing_class='USER_REVISION' AND r.batch_id IS NULL AND s.status='READY_FOR_INPUT' ORDER BY r.created_at DESC LIMIT 1`,[id]))?.session_id;
 if(['27','30'].includes(n))return (await one<{agent_session_id:string}>(tx,'SELECT t.agent_session_id FROM p07.runs r JOIN p07.tasks t ON t.id=r.task_id WHERE r.id=$1',[id]))?.agent_session_id;
 if(n==='56')return id;return undefined;
}
async function dispatch(a:Application,tx:Transaction,actor:Actor,n:string,id:string,params:Query,q:Query,body:unknown):Promise<unknown>{
 const page=q as {cursor?:string;limit?:number;result_version?:number};
 switch(n){
 case '02':return a.commerce.capability(tx,actor,q as unknown as Schema['Environment']);
 case '03':return a.tasks.create(tx,actor,body as Body<'03'>);
 case '04':return a.uploads.issue(tx,actor,id,body as Body<'04'>);
 case '05':return a.uploads.complete(tx,actor,id,body as Body<'05'>);
 case '06':return a.tasks.addSource(tx,actor,id,body as Body<'06'>);
 case '07':return a.tasks.standard(tx,actor,id,body as Body<'07'>);
 case '08':return a.tasks.readStandard(tx,id);
 case '09':return a.tasks.analyze(tx,actor,id,body as Body<'09'>);
 case '10':return a.tasks.confirm(tx,actor,id,body as Body<'10'>);
 case '11':return a.commerce.quote(tx,actor,id,body as Body<'11'>);
 case '12':return a.commerce.createOrder(tx,actor,body as Body<'12'>);
 case '15':return a.commerce.requestRefund(tx,actor,id,body as Body<'15'>);
 case '16':return a.commerce.createRun(tx,actor,id,body as Body<'16'>);
 case '17':return a.commerce.runView(tx,id);
 case '18':return a.tasks.proposal(tx,id);
 case '19':return a.tasks.revise(tx,actor,id,body as Body<'19'>);
 case '20':return a.tasks.adopt(tx,actor,id,body as Body<'20'>);
 case '21':return a.results.records(tx,actor,id,page);
 case '22':return a.results.issues(tx,actor,id,q);
 case '23':return a.results.evidence(tx,id);
 case '24':return a.decisions.preview(tx,actor,id,body as Body<'24'>);
 case '25':return a.decisions.submit(tx,actor,id,body as Body<'25'>);
 case '26':return operationView(await get<OperationRow>(tx,'operations',id));
 case '27':return a.decisions.revision(tx,actor,id,body as Body<'27'>);
 case '28':return a.results.artifacts(tx,id);
 case '29':return a.results.downloadLink(tx,actor,id,(body as Body<'29'>).expected_result_version);
 case '30':return a.results.cancel(tx,actor,id,body as Body<'30'>);
 case '31':return a.library.ticket(tx,actor,body as Body<'31'>,id);
 case '32':return a.library.save(tx,actor,body as Body<'32'>);
 case '33':return a.results.observe(tx,actor,id,body as Body<'33'>);
 case '34':return a.library.list(tx,actor,page,q.query as string|undefined);
 case '35':return a.privacy.policy(tx,q.policy_version as string|undefined,q.environment as string|undefined);
 case '36':return a.privacy.recordConsent(tx,actor,body as Body<'36'>);
 case '37':return a.privacy.request(tx,actor,body as Body<'37'>);
 case '39':{
  const[provider,os]=String(q.environment).split('_') as [Schema['Provider'],Schema['Environment']['os']];
  const release=await one<EvidenceRelease&{app_alias:string;build_id:string;evidence_index:{refs?:string[];environment?:Schema['Environment']}}>(tx,
   'SELECT * FROM p07.capability_releases WHERE provider=$1 AND os=$2 ORDER BY effective_at DESC LIMIT 1',[provider,os]);
  const alias=release?.app_alias??(provider==='ALIPAY'?a.config.P07_ALIPAY_APP_ALIAS:a.config.P07_DOUYIN_APP_ALIAS);
  const environment=release?.evidence_index.environment?a.contracts.validate<Schema['Environment']>('Environment',release.evidence_index.environment):
   {provider,app_alias:alias,os,host_version:'OPERATOR_UNSPECIFIED',base_sdk:'OPERATOR_UNSPECIFIED',build_id:release?.build_id??'unreleased'};
  invariant(environment.provider===provider&&environment.os===os&&environment.app_alias===alias&&environment.build_id===(release?.build_id??'unreleased'),'RELEASE_ENVIRONMENT_MISMATCH','能力证据所属环境不匹配。',503);
  const capability=await a.commerce.capability(tx,{...actor,provider,appAlias:alias},environment);
  const verified=!!release&&await a.commerce.verifyEvidence(release,environment),refs=release?.evidence_index.refs??[];
  return {capability,gates:[{gate_id:'EXACT_RELEASE_EVIDENCE',status:verified?'PASS':'NOT_RUN',evidence_refs:refs}],evidence_index:refs};
 }
 case '41':return {format:q.format,supported:['txt','csv','xlsx','docx','pdf','png','jpeg','jpg','json'].includes(String(q.format).toLowerCase()),limits:BUDGET,price_contract_required:true,
  limitations:['跨平台扩展格式仍需独立读取和收银能力验证。','PDF 扫描页、加密文件和低清图片可能需要重传或人工确认。']};
 case '44':return a.library.listTasks(tx,actor,page,q.mode as string|undefined);
 case '45':return a.tasks.view(tx,id);
 case '46':return a.tasks.removeSource(tx,actor,id,String(params.source_id),Number(q.expected_task_version));
 case '47':return a.library.read(tx,id);
 case '48':return a.library.update(tx,actor,id,body as Body<'48'>);
 case '49':return a.library.remove(tx,id,Number(q.expected_template_version));
 case '50':return a.privacy.read(tx,id);
 case '51':return a.library.listOrders(tx,actor,page,q.payment_status as string|undefined);
 case '52':return a.library.ticket(tx,actor,body as Body<'52'>);
 case '54':return a.tasks.session(tx,actor,body as Body<'54'>);
 case '55':return a.tasks.readSession(tx,id);
 case '56':return a.tasks.closeSession(tx,actor,id,body as Body<'56'>);
 case '38':case '40':case '42':case '43':throw new AppError('P1_FEATURE_DISABLED',501,'此进阶功能尚未开放。');
 default:throw new AppError('RESOURCE_NOT_FOUND',404,'接口不存在。');
 }
}
