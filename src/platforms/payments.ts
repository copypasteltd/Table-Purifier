import type { Database,Transaction } from '../db/database.js';
import { one,insertRow } from '../db/database.js';
import { assertFence,cleanup,enqueue,type Job } from '../db/queue.js';
import { get,type Actor,type ContractRow,type OrderRow,type SessionRow,type TaskRow } from '../domain/models.js';
import type { CommerceService } from '../domain/commerce-service.js';
import type { Config } from '../shared/config.js';
import type { Body,Schema } from '../shared/contracts.js';
import { invariant } from '../shared/errors.js';
import { newId,sha256 } from '../shared/crypto.js';
import type { PlatformAdapter,Platforms,RefundFact } from './types.js';
import { decryptSubject } from './auth.js';
import { merchantReference } from './http.js';

interface Attempt {id:string;state:string;provider_order_ref:string|null;checkout_payload:Record<string,unknown>|null;}
interface RefundRow {id:string;order_id:string;merchant_refund_ref:string;amount_minor:number;amount_unit:string;status:string;reason:string;operation_id:string;}
export class PaymentService {
 constructor(readonly config:Config,readonly db:Database,readonly commerce:CommerceService,readonly platforms:Platforms){}
 adapter(order:Pick<OrderRow,'provider'|'app_alias'>):PlatformAdapter{const adapter=this.platforms.get(order.provider);
  invariant(adapter?.configured&&adapter.appAlias===order.app_alias,'PAYMENT_NOT_CONFIGURED','原支付平台通道尚未配置。',503);return adapter;}
 private async lockOrder(tx:Transaction,id:string){const initial=await get<OrderRow>(tx,'orders',id);
  const contract=await get<ContractRow>(tx,'processing_contracts',initial.contract_id);const task=await get<TaskRow>(tx,'tasks',contract.task_id,true);
  const session=await get<SessionRow>(tx,'agent_sessions',task.agent_session_id,true);const order=await get<OrderRow>(tx,'orders',id,true);return {order,session,task,contract};}
 async checkout(actor:Actor,id:string,body:Body<'13'>):Promise<Schema['Data13']>{
  const prepared=await this.db.withOwner(actor.owner,async tx=>{
   const {order,session}=await this.lockOrder(tx,id);
   invariant(body.expected_channel===actor.provider&&order.provider===actor.provider&&order.app_alias===actor.appAlias,'ORIGIN_MISMATCH','请在原平台打开收银。',403);
   this.adapter(order);invariant(this.config.P07_COMMERCE_ENABLED&&session.status==='AWAITING_PAYMENT','CHECKOUT_UNAVAILABLE','本次会话当前不能支付。',409);
   invariant(!['CONFIRMED','CLOSED','FAILED'].includes(order.payment_status)&&order.refunded_minor+order.refund_reserved_minor===0,'CHECKOUT_UNAVAILABLE','请先查询原订单状态。',409);
   const old=await one<Attempt>(tx,'SELECT * FROM p07.payment_attempts WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1',[id]);
   if(old?.checkout_payload)return {order,attempt:old,buyer:null};
   if(old)return {order,attempt:old,buyer:null};
   const quote=await one<{expires_at:Date}>(tx,'SELECT expires_at FROM p07.quotes WHERE id=$1',[order.quote_id]);
   invariant(quote&&quote.expires_at.getTime()>Date.now(),'QUOTE_EXPIRED','费用确认已过期，请重新分析并确认。',409);
   const identity=await one<{subject_cipher_ref:string;subject_hash:string}>(tx,'SELECT subject_cipher_ref,subject_hash FROM p07.platform_identities WHERE id=$1 AND provider=$2 AND app_alias=$3',[actor.identity,order.provider,order.app_alias]);
   invariant(identity,'IDENTITY_UNAVAILABLE','支付登录身份已失效。',401);
   const buyer=decryptSubject(this.config.P07_IDENTITY_SECRET,identity.subject_cipher_ref,order.provider+'|'+order.app_alias+'|'+identity.subject_hash);
   const attempt:Attempt={id:newId(),state:'CREATING',provider_order_ref:null,checkout_payload:null};
   await insertRow(tx,'payment_attempts',{id:attempt.id,owner_id:actor.owner,order_id:id,provider:order.provider,merchant_reference:merchantReference(id),state:'CREATING'});
   await tx.query("UPDATE p07.orders SET payment_status='UNKNOWN',version=version+1,updated_at=now() WHERE id=$1",[id]);
   return {order,attempt,buyer};
  });
  if(prepared.attempt.checkout_payload){const adapter=this.adapter(prepared.order);
   return {order_id:id,provider:prepared.order.provider,provider_checkout_payload:adapter.refreshCheckout?.(prepared.order,prepared.attempt.checkout_payload)??prepared.attempt.checkout_payload,
    expires_at:prepared.order.provider==='DOUYIN'?new Date(Date.now()+240_000).toISOString():null};}
  if(!prepared.buyer){await this.reconcile(actor.owner,id);
   // An uncertain create is never blindly repeated. A verified original-order query controls the next action.
   return {order_id:id,provider:prepared.order.provider,provider_checkout_payload:{query_required:true},expires_at:null};}
  try{
   const result=await this.adapter(prepared.order).createPayment(prepared.order,prepared.buyer,
    this.config.P07_PUBLIC_URL+'/v1/p07/platform-events/'+prepared.order.provider);
   await this.db.withOwner(actor.owner,async tx=>{const {order}=await this.lockOrder(tx,id);
    await tx.query("UPDATE p07.payment_attempts SET state='PENDING',provider_order_ref=$2,checkout_payload=$3,last_checked_at=now() WHERE id=$1",[prepared.attempt.id,result.providerReference,result.payload]);
    if(order.payment_status!=='CONFIRMED')await tx.query("UPDATE p07.orders SET payment_status='PENDING',version=version+1,updated_at=now() WHERE id=$1",[id]);
    await enqueue(tx,actor.owner,'PAYMENT_QUERY','payment-query:'+prepared.attempt.id,{order_id:id});});
   return {order_id:id,provider:prepared.order.provider,provider_checkout_payload:result.payload,expires_at:null};
  }catch{
   await this.db.withOwner(actor.owner,async tx=>{await tx.query("UPDATE p07.payment_attempts SET state='UNKNOWN',last_checked_at=now() WHERE id=$1",[prepared.attempt.id]);
    await enqueue(tx,actor.owner,'PAYMENT_QUERY','payment-query:'+prepared.attempt.id,{order_id:id});});
   return {order_id:id,provider:prepared.order.provider,provider_checkout_payload:{query_required:true},expires_at:null};
  }
 }
 async reconcile(owner:string,id:string,job?:Job):Promise<Schema['Order']>{
  const order=await this.db.withOwner(owner,tx=>get<OrderRow>(tx,'orders',id));
  const fact=await this.adapter(order).queryPayment(id);
  return this.db.withOwner(owner,async tx=>{const {order:current}=await this.lockOrder(tx,id);if(job)await assertFence(tx,job);
   await this.commerce.applyPayment(tx,{owner,identity:'',provider:current.provider,appAlias:current.app_alias},current,fact);
   await tx.query('UPDATE p07.payment_attempts SET state=$2,provider_order_ref=$3,last_checked_at=now() WHERE order_id=$1',[id,fact.status,fact.providerReference]);
   return this.commerce.orderView(await get<OrderRow>(tx,'orders',id));});
 }
 async notify(provider:Schema['Provider'],raw:Buffer,headers:Record<string,string|undefined>):Promise<void>{
  const adapter=this.platforms.get(provider);invariant(adapter,'PAYMENT_NOT_CONFIGURED','回调通道未配置。',503);
  const event=await adapter.verifyEvent(raw,headers);
  const match=(await this.db.pool.query<{owner_id:string;order_id:string}>('SELECT * FROM p07.find_payment_order($1,$2)',[provider,event.merchantReference])).rows[0];
  invariant(match,'UNKNOWN_PLATFORM_ORDER','原订单引用无效。',404);
  await this.db.withOwner(match.owner_id,async tx=>{
   const locked=await this.lockOrder(tx,match.order_id);
   const inserted=await tx.query(`INSERT INTO p07.platform_events(id,owner_id,provider,provider_event_key,order_id,event_kind,verified_at,event_summary)
    VALUES($1,$2,$3,$4,$5,$6,now(),$7) ON CONFLICT(provider,provider_event_key) DO NOTHING RETURNING id`,
    [newId(),match.owner_id,provider,event.eventKey,match.order_id,event.kind,{raw_sha256:sha256(raw),kind:event.kind}]);
   if(!inserted.rowCount)return;
   if(event.kind==='PAYMENT')await enqueue(tx,match.owner_id,'PAYMENT_QUERY','platform-event:'+provider+':'+event.eventKey,{order_id:match.order_id});
   else{
    const own=event.refundReference?await one(tx,'SELECT id FROM p07.refunds WHERE order_id=$1 AND($2=merchant_refund_ref OR $2=\'p07_\'||replace(merchant_refund_ref,\'-\',\'\') OR $2=provider_refund_ref)',[match.order_id,event.refundReference]):null;
    if(!own){
     await tx.query("UPDATE p07.orders SET reconciliation_required=true,refund_status='UNKNOWN',version=version+1,updated_at=now() WHERE id=$1",[match.order_id]);
     await tx.query('UPDATE p07.entitlement_grants SET revoked_at=coalesce(revoked_at,now()) WHERE order_id=$1',[match.order_id]);
     await tx.query("UPDATE p07.runs SET execution_status='CANCELED',cancel_requested_at=now(),finished_at=now(),version=version+1 WHERE contract_id=$1 AND execution_status IN('QUEUED','RUNNING')",[locked.order.contract_id]);
     if(!['CLOSED','RELEASING_RUNTIME','FAILED','CANCELED','INITIALIZATION_FAILED'].includes(locked.session.status)){
      await tx.query("UPDATE p07.agent_sessions SET status='CANCELED' WHERE id=$1",[locked.session.id]);await cleanup(tx,match.owner_id,locked.session);
     }
    }
    const refunds=(await tx.query<{id:string}>(txTextRefunds,[match.order_id])).rows;
    for(const refund of refunds)await enqueue(tx,match.owner_id,'REFUND_QUERY','platform-event:'+event.eventKey+':'+refund.id,{refund_id:refund.id});
   }
  });
 }
 async refund(job:Job,queryOnly=false):Promise<void>{
  const id=job.payload.refund_id;invariant(id,'REFUND_SCOPE_MISSING','退款任务引用缺失。',503);
  const state=await this.db.withOwner(job.owner_id,async tx=>{
   await assertFence(tx,job);const initial=await one<RefundRow>(tx,'SELECT * FROM p07.refunds WHERE id=$1',[id]);invariant(initial,'REFUND_NOT_FOUND','退款记录不存在。',404);
   const {order}=await this.lockOrder(tx,initial.order_id);const refund=(await one<RefundRow>(tx,'SELECT * FROM p07.refunds WHERE id=$1 FOR UPDATE',[id]))!;
   if(refund.status==='SUCCEEDED'||refund.status==='FAILED')return null;
   const create=refund.status==='REQUESTED'&&!queryOnly;
   if(create)await tx.query("UPDATE p07.refunds SET status='PROCESSING',last_checked_at=now() WHERE id=$1",[id]);
   return {order,refund,create};
  });if(!state)return;
  let fact:RefundFact;
  try{const adapter=this.adapter(state.order);fact=state.create?await adapter.refund(state.order,state.refund.merchant_refund_ref,state.refund.amount_minor,state.refund.reason):
   await adapter.queryRefund(state.order,state.refund.merchant_refund_ref);}
  catch{await this.db.withOwner(job.owner_id,async tx=>{await assertFence(tx,job);await tx.query("UPDATE p07.refunds SET status='UNKNOWN',last_checked_at=now() WHERE id=$1",[id]);
   await tx.query("UPDATE p07.orders SET refund_status='UNKNOWN',version=version+1,updated_at=now() WHERE id=$1",[state.order.id]);});return;}
  await this.db.withOwner(job.owner_id,async tx=>{
   const {order}=await this.lockOrder(tx,state.order.id);await assertFence(tx,job);
   const refund=(await one<RefundRow>(tx,'SELECT * FROM p07.refunds WHERE id=$1 FOR UPDATE',[id]))!;
   invariant(fact.amountMinor===refund.amount_minor&&fact.amountUnit===refund.amount_unit&&fact.factKey===merchantReference(refund.merchant_refund_ref),
    'REFUND_FACT_MISMATCH','原平台退款金额、单位或原请求引用不符。',409);
   if(refund.status==='SUCCEEDED')return;
   if(fact.status==='SUCCEEDED'){
    const inserted=await tx.query(`INSERT INTO p07.payment_ledger(id,owner_id,order_id,provider,provider_fact_key,kind,amount_minor,amount_unit,fact_at)
     VALUES($1,$2,$3,$4,$5,'REFUND',$6,$7,now()) ON CONFLICT(provider,provider_fact_key,kind) DO NOTHING RETURNING id`,
    [newId(),job.owner_id,order.id,order.provider,fact.factKey,fact.amountMinor,fact.amountUnit]);
    invariant(inserted.rowCount,'REFUND_FACT_REUSED','退款事实已关联其他处理，请核对原订单。',409);
    await tx.query("UPDATE p07.orders SET refunded_minor=refunded_minor+$2,refund_reserved_minor=refund_reserved_minor-$2,refund_status='SUCCEEDED',version=version+1,updated_at=now() WHERE id=$1",[order.id,refund.amount_minor]);
    await tx.query("UPDATE p07.operations SET status='SUCCEEDED',resource_ref=$2,finished_at=now() WHERE id=$1",[refund.operation_id,{id:refund.id,kind:'REFUND'}]);
   }else if(fact.status==='FAILED'){
    await tx.query("UPDATE p07.orders SET refund_reserved_minor=refund_reserved_minor-$2,refund_status='FAILED',version=version+1,updated_at=now() WHERE id=$1",[order.id,refund.amount_minor]);
    await tx.query("UPDATE p07.operations SET status='FAILED',error_code='PROVIDER_REFUND_FAILED',finished_at=now() WHERE id=$1",[refund.operation_id]);
   }else await tx.query('UPDATE p07.orders SET refund_status=$2,version=version+1,updated_at=now() WHERE id=$1',[order.id,fact.status]);
   await tx.query('UPDATE p07.refunds SET status=$2,provider_refund_ref=$3,last_checked_at=now() WHERE id=$1',[refund.id,fact.status,fact.providerReference]);
  });
 }
 async process(job:Job):Promise<void>{
  if(job.kind==='PAYMENT_QUERY')await this.reconcile(job.owner_id,job.payload.order_id!,job);
  else if(job.kind==='REFUND'||job.kind==='REFUND_QUERY')await this.refund(job,job.kind==='REFUND_QUERY');
  else invariant(false,'PAYMENT_JOB_INVALID','资金任务类型无效。',503);
  await this.db.withOwner(job.owner_id,async tx=>{await assertFence(tx,job);await tx.query("UPDATE p07.jobs SET status='DONE',lease_until=NULL,lease_owner=NULL WHERE id=$1",[job.id]);});
 }
}
const txTextRefunds="SELECT id FROM p07.refunds WHERE order_id=$1 AND status IN('REQUESTED','PROCESSING','UNKNOWN')";
