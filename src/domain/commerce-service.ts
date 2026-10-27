import { insertRow,one,type Transaction } from '../db/database.js';
import { enqueue,operation } from '../db/queue.js';
import type { Config } from '../shared/config.js';
import type { Body,Schema } from '../shared/contracts.js';
import { contentHash,newId } from '../shared/crypto.js';
import { invariant,notFound } from '../shared/errors.js';
import { calculateQuote } from '../shared/pricing.js';
import type { PaymentFact,Platforms } from '../platforms/types.js';
import { merchantReference } from '../platforms/http.js';
import { action,get,operationView,type Actor,type ContractRow,type OperationRow,type OrderRow,type PlanRow,type QuoteRow,type RunRow,
  type SessionRow,type TaskRow } from './models.js';
import { TaskService } from './task-service.js';
import { releaseEvidence,type EvidenceVerifier } from './release-evidence.js';

interface ReleaseRow {capability_version:string;flags:Schema['Capability']['flags'];commercial_enabled:boolean;sku_id:string|null;evidence_index:{refs?:string[];gates?:unknown[]};
 settlement_unit:'CNY_FEN'|'DOUYIN_DIAMOND';price_policy:{id:string;baseMinor:number;unitMinor:number;maxMinor:number}|null;}
export class CommerceService {
  constructor(readonly config:Config,readonly tasks:TaskService,readonly platforms:Platforms,readonly verifyEvidence:EvidenceVerifier=releaseEvidence(config.projectRoot)){}
  async capability(tx:Transaction,actor:Actor,environment:Schema['Environment']):Promise<Schema['Capability']>{
    invariant(actor.provider===environment.provider&&actor.appAlias===environment.app_alias,'ORIGIN_MISMATCH','当前登录与调用平台不匹配。',403);
    const release=await one<ReleaseRow>(tx,`SELECT * FROM p07.capability_releases WHERE provider=$1 AND app_alias=$2 AND os=$3 AND build_id=$4
      AND effective_at<=now() ORDER BY effective_at DESC LIMIT 1`,[environment.provider,environment.app_alias,environment.os,environment.build_id]);
    const configured=!!this.platforms.get(actor.provider)?.configured;
    const agent=this.tasks.runtime.enabled;
    const proven=!!release&&await this.verifyEvidence(release,environment);
    const unitAllowed=actor.provider==='ALIPAY'?release?.settlement_unit==='CNY_FEN':environment.os!=='IOS'||release?.settlement_unit==='DOUYIN_DIAMOND'&&!!release.price_policy;
    const payment=!!(proven&&release?.commercial_enabled&&release.sku_id&&release.flags.payment&&configured&&this.config.P07_COMMERCE_ENABLED&&agent&&unitAllowed);
    const flags={file_input:!!(proven&&release?.flags.file_input&&agent),template_input:!!(proven&&release?.flags.template_input&&agent),
      preview:!!(proven&&release?.flags.preview),export:!!(proven&&release?.flags.export),payment};
    const reasons:Schema['Capability']['reasons']=[];
    if(!proven)reasons.push({action:'ALL',code:'RELEASE_NOT_VERIFIED',message:'当前平台、系统和构建尚未通过能力验证。'});
    if(!agent)reasons.push({action:'CREATE_SESSION',code:'AGENT_NOT_CONFIGURED',message:'专用模型与原生隔离运行环境尚未配置。'});
    if(!payment)reasons.push({action:'PAYMENT',code:'COMMERCE_UNAVAILABLE',message:'当前环境尚未开通核验后的收银能力。'});
    return {capability_version:release?.capability_version??'unreleased',environment,flags,commercial_enabled:payment,reasons};
  }
  async quote(tx:Transaction,actor:Actor,id:string,body:Body<'11'>){
    const task=await get<TaskRow>(tx,'tasks',id,true),session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);
    invariant(session.id===body.session_id&&session.status==='QUOTABLE'&&!task.deleted_at,'INVALID_SESSION_PHASE','请先确认本次执行方案。');
    const contract=await get<ContractRow>(tx,'processing_contracts',body.contract_id),plan=await get<PlanRow>(tx,'execution_plans',body.confirmed_plan_id);
    invariant(contract.task_id===id&&contract.confirmed_plan_id===plan.id&&plan.id===task.current_plan_id&&plan.status==='CONFIRMED'
      &&plan.plan_sha256===body.plan_hash&&contract.source_set_id===task.current_source_set_id,'PLAN_STALE','当前方案已变化，请重新分析确认。');
    const cap=await this.capability(tx,actor,body.origin_environment),policy=this.tasks.policy();
    if(!cap.commercial_enabled)return {access_mode:'UNAVAILABLE' as const,quote_id:null,plan_hash:plan.plan_sha256,amount:null,expires_at:null,
      policy,commercial_enabled:false,reason_codes:cap.reasons.map(r=>r.code)};
    const release=await one<ReleaseRow>(tx,'SELECT * FROM p07.capability_releases WHERE capability_version=$1 AND provider=$2 AND app_alias=$3 AND os=$4 AND build_id=$5',
      [cap.capability_version,actor.provider,actor.appAlias,body.origin_environment.os,body.origin_environment.build_id]);
    invariant(release?.sku_id,'COMMERCE_UNAVAILABLE','收银商品尚未配置。',403);
    invariant(release.settlement_unit!=='DOUYIN_DIAMOND'||release.price_policy,'PRICE_POLICY_UNAVAILABLE','钻石原单位价格表尚未配置。',503);
    const price=calculateQuote(release.price_policy??{id:this.config.P07_PRICE_POLICY,baseMinor:this.config.P07_PRICE_BASE_MINOR,unitMinor:this.config.P07_PRICE_UNIT_MINOR,
      maxMinor:this.config.P07_PRICE_MAX_MINOR},plan.measured_units);
    const idQuote=newId(),expires=new Date(Date.now()+900_000);
    const amount={amount_minor:price.amount_minor,amount_unit:release.settlement_unit,provider:actor.provider,sku_id:release.sku_id};
    const quotedPolicy={...policy,approved_sku_id:release.sku_id};
    await insertRow(tx,'quotes',{id:idQuote,owner_id:actor.owner,contract_id:contract.id,provider:actor.provider,app_alias:actor.appAlias,
      os:body.origin_environment.os,sku_id:release.sku_id,amount_minor:amount.amount_minor,amount_unit:amount.amount_unit,expires_at:expires,
      capability_version:cap.capability_version,policy_snapshot:quotedPolicy,quote_sha256:contentHash({contract:contract.contract_sha256,plan:plan.plan_sha256,amount,expires:expires.toISOString()})});
    return {access_mode:'PAID' as const,quote_id:idQuote,plan_hash:plan.plan_sha256,amount,expires_at:expires.toISOString(),policy:quotedPolicy,
      commercial_enabled:true,reason_codes:[]};
  }
  async createOrder(tx:Transaction,actor:Actor,body:Body<'12'>){
    invariant(this.config.P07_COMMERCE_ENABLED,'COMMERCE_UNAVAILABLE','当前尚未开放付款。',403);
    const quote=await get<QuoteRow>(tx,'quotes',body.quote_id),contract=await get<ContractRow>(tx,'processing_contracts',quote.contract_id);
    const task=await get<TaskRow>(tx,'tasks',contract.task_id,true),session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);
    invariant(!await one(tx,"SELECT id FROM p07.revision_intents WHERE task_id=$1 AND billing_class='PLATFORM_CORRECTION'",[task.id]),
      'ORIGINAL_PAID_CORRECTION_REQUIRED','平台纠错应核验原实付权益，不创建第二笔收款。',409);
    invariant(quote.provider===actor.provider&&quote.app_alias===actor.appAlias,'ORIGIN_MISMATCH','订单只能在原平台支付。',403);
    const existing=await one<OrderRow>(tx,'SELECT * FROM p07.orders WHERE contract_id=$1',[contract.id]);if(existing)return this.orderView(existing);
    invariant(quote.expires_at.getTime()>Date.now()&&session.status==='QUOTABLE'&&task.current_plan_id===contract.confirmed_plan_id
      &&contract.contract_sha256===body.contract_hash,'QUOTE_STALE','报价已失效，请重新确认费用。');
    const plan=await get<PlanRow>(tx,'execution_plans',contract.confirmed_plan_id);invariant(plan.status==='CONFIRMED','PLAN_STALE','执行方案已经变化。');
    const id=newId();await insertRow(tx,'orders',{id,owner_id:actor.owner,contract_id:contract.id,quote_id:quote.id,provider:actor.provider,
      app_alias:actor.appAlias,sku_id:quote.sku_id,amount_minor:quote.amount_minor,amount_unit:quote.amount_unit,
      payment_status:'NOT_CREATED',refund_status:'NONE',fulfillment_status:'NOT_STARTED'});
    await tx.query("UPDATE p07.agent_sessions SET status='AWAITING_PAYMENT' WHERE id=$1",[session.id]);
    return this.orderView(await get<OrderRow>(tx,'orders',id));
  }
  orderView(row:OrderRow):Schema['Order']{return {order_id:row.id,contract_id:row.contract_id,version:row.version,
    amount:{amount_minor:row.amount_minor,amount_unit:row.amount_unit,provider:row.provider,sku_id:row.sku_id},payment_status:row.payment_status,
    refund_status:row.refund_status,fulfillment_status:row.fulfillment_status,refunded_minor:row.refunded_minor,updated_at:row.updated_at.toISOString(),
    allowed_actions:[action('CHECKOUT','去付款',['NOT_CREATED','PENDING'].includes(row.payment_status),'PAYMENT_UNAVAILABLE'),
      action('QUERY_PAYMENT','查询付款',true),action('RUN','开始整理',!row.reconciliation_required&&row.payment_status==='CONFIRMED'&&row.refund_status==='NONE','PAYMENT_REQUIRED'),
      action('REFUND','申请退款',!row.reconciliation_required&&row.payment_status==='CONFIRMED'&&row.refunded_minor+row.refund_reserved_minor<row.amount_minor,'REFUND_UNAVAILABLE')]};}
  async applyPayment(tx:Transaction,actor:Actor,order:OrderRow,fact:PaymentFact):Promise<void>{
    invariant(fact.provider===order.provider&&fact.appAlias===order.app_alias&&fact.merchantReference===merchantReference(order.id)
      &&fact.amountMinor===order.amount_minor&&fact.amountUnit===order.amount_unit,'PAYMENT_FACT_MISMATCH','原支付平台的订单信息不匹配。',409);
    if(fact.status==='CONFIRMED'){
      const ledger=await tx.query(`INSERT INTO p07.payment_ledger(id,owner_id,order_id,provider,provider_fact_key,kind,amount_minor,amount_unit,fact_at)
        VALUES($1,$2,$3,$4,$5,'PAYMENT',$6,$7,$8) ON CONFLICT(provider,provider_fact_key,kind) DO NOTHING RETURNING id`,
      [newId(),actor.owner,order.id,order.provider,fact.factKey,order.amount_minor,order.amount_unit,fact.paidAt??new Date().toISOString()]);
      if(!ledger.rowCount)invariant(await one(tx,"SELECT id FROM p07.payment_ledger WHERE provider=$1 AND provider_fact_key=$2 AND kind='PAYMENT' AND order_id=$3 AND amount_minor=$4 AND amount_unit=$5",
        [order.provider,fact.factKey,order.id,order.amount_minor,order.amount_unit]),'PAYMENT_FACT_REUSED','原平台支付凭据已关联其他订单。',409);
      await tx.query("UPDATE p07.orders SET payment_status='CONFIRMED',version=version+1,updated_at=now() WHERE id=$1 AND payment_status<>'CONFIRMED'",[order.id]);
      const grant=await one(tx,'SELECT id FROM p07.entitlement_grants WHERE order_id=$1',[order.id]);
      if(!grant)await insertRow(tx,'entitlement_grants',{id:newId(),owner_id:actor.owner,contract_id:order.contract_id,order_id:order.id,
        kind:'PAID',policy_snapshot:this.tasks.policy(),revision_limit:3});
      const contract=await get<ContractRow>(tx,'processing_contracts',order.contract_id),task=await get<TaskRow>(tx,'tasks',contract.task_id);
      const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id);
      if(!['AWAITING_PAYMENT','BATCH_QUEUED','BATCH_RUNNING','PERSISTING_RESULTS','RELEASING_RUNTIME','CLOSED'].includes(session.status)
        ||['RELEASING_RUNTIME','CLOSED'].includes(session.status)&&!session.result_id){
        // A late payment cannot resurrect a canceled/expired runtime. Reserve refund through the ordinary verified path.
        await this.requestRefund(tx,actor,order.id,{reason:'会话已关闭，原订单晚到付款退回',operation_reference:newId()});
      }
    }else if(order.payment_status!=='CONFIRMED')await tx.query('UPDATE p07.orders SET payment_status=$2,version=version+1,updated_at=now() WHERE id=$1',[order.id,fact.status]);
  }
  async requestRefund(tx:Transaction,actor:Actor,id:string,body:Body<'15'>){
    const order=await get<OrderRow>(tx,'orders',id,true);invariant(order.provider===actor.provider&&order.app_alias===actor.appAlias,'ORIGIN_MISMATCH','请在原支付平台申请退款。',403);
    invariant(!order.reconciliation_required,'REFUND_RECONCILIATION_REQUIRED','原平台存在额外退款事实，请先核对原退款单，避免重复退款。',409);
    invariant(order.payment_status==='CONFIRMED','PAYMENT_NOT_CONFIRMED','原平台尚未确认付款，暂不能退款。');
    const active=await one<RunRow>(tx,"SELECT * FROM p07.runs WHERE contract_id=$1 AND execution_status IN ('QUEUED','RUNNING')",[order.contract_id]);
    invariant(!active,'RUN_ACTIVE','请先停止正在生产的任务，再申请退款。');
    const amount=body.amount_minor??order.amount_minor-order.refunded_minor-order.refund_reserved_minor;
    invariant(amount>0&&amount<=order.amount_minor-order.refunded_minor-order.refund_reserved_minor,'REFUND_AMOUNT_INVALID','退款金额超过可退余额。',400);
    const op=await operation(tx,actor.owner,'REFUND'),refundId=newId();
    await insertRow(tx,'refunds',{id:refundId,owner_id:actor.owner,order_id:id,provider:order.provider,merchant_refund_ref:body.operation_reference,
      amount_minor:amount,amount_unit:order.amount_unit,status:'REQUESTED',reason:body.reason,operation_id:op});
    await tx.query("UPDATE p07.orders SET refund_reserved_minor=refund_reserved_minor+$2,refund_status='REQUESTED',version=version+1,updated_at=now() WHERE id=$1",[id,amount]);
    await tx.query('UPDATE p07.entitlement_grants SET revoked_at=now() WHERE order_id=$1',[id]);
    await enqueue(tx,actor.owner,'REFUND','refund:'+refundId,{refund_id:refundId},op);
    return {operation:operationView(await get<OperationRow>(tx,'operations',op)),refund:{refund_id:refundId,order_id:id,status:'REQUESTED' as const,
      amount:{amount_minor:amount,amount_unit:order.amount_unit,provider:order.provider,sku_id:order.sku_id},operation_id:op,retry_of:null}};
  }
  async createRun(tx:Transaction,actor:Actor,id:string,body:Body<'16'>):Promise<Schema['Run']>{
    const task=await get<TaskRow>(tx,'tasks',id,true),session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);
    invariant(session.id===body.session_id&&!task.deleted_at,'SESSION_SCOPE_MISMATCH','会话与本次任务不匹配。',403);
    const contract=await get<ContractRow>(tx,'processing_contracts',body.contract_id),plan=await get<PlanRow>(tx,'execution_plans',contract.confirmed_plan_id);
    const order=await get<OrderRow>(tx,'orders',body.order_id,true);
    invariant(order.provider===actor.provider&&order.app_alias===actor.appAlias,'ORIGIN_MISMATCH','请在原支付平台继续生产。',403);
    invariant(contract.task_id===id&&plan.plan_sha256===body.confirmed_plan_hash,'PLAN_STALE','任务与所选合同或方案不匹配。',409);
    const existing=await one<RunRow>(tx,'SELECT * FROM p07.runs WHERE contract_id=$1 ORDER BY created_at LIMIT 1',[contract.id]);
    if(existing){invariant(await one(tx,'SELECT id FROM p07.entitlement_grants WHERE id=$1 AND order_id=$2',[existing.grant_id,order.id]),'ORDER_SCOPE_MISMATCH','该任务的原订单不匹配。',409);return this.runView(tx,existing.id);}
    invariant(contract.task_id===id&&task.current_plan_id===plan.id&&plan.status==='CONFIRMED'&&plan.plan_sha256===body.confirmed_plan_hash
      &&session.status==='AWAITING_PAYMENT','PLAN_STALE','方案或会话阶段已变化。');
    const correction=order.contract_id!==contract.id?await one(tx,"SELECT id FROM p07.correction_authorizations WHERE contract_id=$1 AND original_order_id=$2 AND status='APPROVED' AND expires_at>now() AND plan_sha256=$3",[contract.id,order.id,plan.plan_sha256]):null;
    invariant(!order.reconciliation_required&&(order.contract_id===contract.id||!!correction)&&order.payment_status==='CONFIRMED'&&order.amount_minor>0&&order.refunded_minor+order.refund_reserved_minor===0,
      'PAYMENT_REQUIRED','只有原平台服务端确认实付后才可批量产出。',403);
    const grant=await one<{id:string}>(tx,"SELECT id FROM p07.entitlement_grants WHERE contract_id=$1 AND order_id=$2 AND kind='PAID' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())",[contract.id,order.id]);
    invariant(grant,'PAYMENT_REQUIRED','实付生产权益尚未确认。',403);
    const run=newId(),op=await operation(tx,actor.owner,'BATCH',id);
    const parent=await one<{parent_run_id:string;parent_result_id:string}>(tx,'SELECT parent_run_id,parent_result_id FROM p07.revision_intents WHERE task_id=$1',[id]);
    await insertRow(tx,'runs',{id:run,owner_id:actor.owner,task_id:id,contract_id:contract.id,grant_id:grant.id,parent_run_id:parent?.parent_run_id??null,parent_result_id:parent?.parent_result_id??null,execution_status:'QUEUED',
      schema_status:'ADOPTED',quality_status:'NOT_EVALUATED',epoch:task.epoch,schema_binding_id:contract.schema_binding_id});
    await tx.query('UPDATE p07.tasks SET current_run_id=$2,version=version+1,updated_at=now() WHERE id=$1',[id,run]);
    await tx.query("UPDATE p07.agent_sessions SET run_id=$2,status='BATCH_QUEUED' WHERE id=$1",[session.id,run]);
    await tx.query("UPDATE p07.orders SET fulfillment_status='IN_PROGRESS',version=version+1,updated_at=now() WHERE id=$1",[order.id]);
    await enqueue(tx,actor.owner,'BATCH','batch:'+run,{session_id:session.id},op,run);return this.runView(tx,run);
  }
  async runView(tx:Transaction,id:string):Promise<Schema['Run']>{
    const run=await get<RunRow>(tx,'runs',id),task=await get<TaskRow>(tx,'tasks',run.task_id);if(task.deleted_at)notFound();
    const result=await one<{version:number}>(tx,'SELECT version FROM p07.result_versions WHERE run_id=$1 ORDER BY version DESC LIMIT 1',[id]);
    const summary=await one<{result_summary:{coverage?:Schema['Coverage']}|null}>(tx,'SELECT result_summary FROM p07.runs WHERE id=$1',[id]);
    const artifact=await one<{status:Schema['ArtifactStatus']}>(tx,'SELECT status FROM p07.artifact_sets WHERE run_id=$1 AND revoked_at IS NULL',[id]);
    const parent=run.parent_result_id?await one<{version:number}>(tx,'SELECT version FROM p07.result_versions WHERE id=$1',[run.parent_result_id]):null;
    const grant=await one<{remaining:number}>(tx,'SELECT revision_limit-revision_consumed-revision_reserved remaining FROM p07.entitlement_grants WHERE id=$1',[run.grant_id]);
    const used=await one<{ms:number}>(tx,"SELECT coalesce(sum(compute_ms),0)::bigint ms FROM p07.run_budget_events WHERE run_id=$1 AND kind='CONSUME'",[id]);
    return {run_id:id,task_id:run.task_id,parent_run_id:run.parent_run_id,parent_result_version:parent?.version??null,version:run.version,
      execution_status:run.execution_status,schema_status:run.schema_status,quality_status:run.quality_status,artifact_status:artifact?.status??'NOT_READY',
      stage:run.current_stage,binding_id:run.schema_binding_id,result_version:result?.version??null,
      coverage:summary?.result_summary?.coverage??{confirmed_units:0,read_units:0,unreadable_units:0,excluded_units:0,scope_sha256:'0'.repeat(64),limitations:[]},compute_used_ms:used?.ms??0,
      compute_limit_ms:this.config.P07_AGENT_BATCH_MS,revision_rounds_remaining:Math.max(grant?.remaining??0,0),review_expires_at:null,
      allowed_actions:[action('CANCEL','停止整理',['QUEUED','RUNNING'].includes(run.execution_status)),action('VIEW_RESULT','查看结果',!!result),
        action('DOWNLOAD','领取文件',artifact?.status==='READY','ARTIFACT_NOT_READY'),action('REVISE','调整结果',!!result,'RESULT_NOT_READY')]};
  }
}
