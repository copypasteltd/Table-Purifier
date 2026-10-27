import { sign,verify,randomBytes } from 'node:crypto';
import { z } from 'zod';
import { invariant,AppError } from '../shared/errors.js';
import { sha256 } from '../shared/crypto.js';
import type { OrderRow } from '../domain/models.js';
import type { PlatformAdapter,PaymentFact,RefundFact } from './types.js';
import { merchantReference,transport,type HttpTransport } from './http.js';

export interface DouyinProduct {skuId:string;title:string;image:string;type:number;tagGroupId:string;keyVersion:string;merchantUid?:string;}
const dictionary=z.record(z.string(),z.unknown());
const str=(data:Record<string,unknown>,key:string)=>z.string().min(1).parse(data[key]);
const integer=(value:unknown)=>z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(value);
export function signDouyinOrder(appId:string,privateKey:string,keyVersion:string,data:string,timestamp:string,nonce:string):string{
 const message=`POST\n/requestOrder\n${timestamp}\n${nonce}\n${data}\n`;
 const signature=sign('RSA-SHA256',Buffer.from(message),privateKey).toString('base64');
 return `SHA256-RSA2048 appid=${appId},nonce_str=${nonce},timestamp=${timestamp},key_version=${keyVersion},signature=${signature}`;
}
export function verifyDouyinCallback(raw:Buffer,headers:Record<string,string|undefined>,publicKey:string,now=Date.now()):void{
 const timestamp=headers['byte-timestamp'],nonce=headers['byte-nonce-str'],signature=headers['byte-signature'];
 invariant(!!timestamp&&/^\d{10}$/.test(timestamp)&&Math.abs(now-Number(timestamp)*1000)<=300_000&&!!nonce&&/^[\x21-\x7E]{1,128}$/.test(nonce)&&!!signature,
  'PLATFORM_SIGNATURE_INVALID','抖音回调时间戳或签名参数无效。',401);
 invariant(verify('RSA-SHA256',Buffer.from(`${timestamp}\n${nonce}\n${raw.toString('utf8')}\n`),publicKey,Buffer.from(signature,'base64')),
  'PLATFORM_SIGNATURE_INVALID','抖音回调验签失败。',401);
}
/** General trade system for tools. Does not use legacy life-service ecpay endpoints. */
export class DouyinAdapter implements PlatformAdapter {
 readonly provider='DOUYIN' as const;readonly configured=true;
 private token:{value:string;expires:number}|null=null;private pendingToken:Promise<string>|null=null;
 constructor(readonly appAlias:string,readonly appId:string,private readonly appSecret:string,private readonly privateKey:string,
  private readonly platformPublicKey:string,readonly product:DouyinProduct,private readonly http:HttpTransport=transport){
  invariant(/^tt[a-zA-Z0-9]+$/.test(appId)&&/^[A-Za-z0-9_-]+$/.test(product.keyVersion)&&product.skuId.length>0
   &&product.tagGroupId.length>0&&Number.isSafeInteger(product.type)&&product.type>0&&product.image.startsWith('https://'),
  'PAYMENT_PRODUCT_INVALID','抖音交易商品配置不完整。',503);
 }
 async exchangeCode(code:string){
  const response=await this.http('https://developer.toutiao.com/api/apps/v2/jscode2session',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({appid:this.appId,secret:this.appSecret,code})});
  const data=dictionary.parse(JSON.parse(response.text));invariant(data.err_no===0,'PLATFORM_CODE_INVALID','抖音授权凭据无效或过期。',401);
  return {subject:str(dictionary.parse(data.data),'openid')};
 }
 private async accessToken():Promise<string>{
  if(this.token&&this.token.expires>Date.now()+60_000)return this.token.value;
  if(this.pendingToken)return this.pendingToken;
  this.pendingToken=(async()=>{
   const response=await this.http('https://open.douyin.com/oauth/client_token/',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({client_key:this.appId,client_secret:this.appSecret,grant_type:'client_credential'})});
   const root=dictionary.parse(JSON.parse(response.text)),data=dictionary.parse(root.data);
   invariant(data.error_code===0,'PROVIDER_AUTH_UNAVAILABLE','抖音服务端凭据暂不可用。',502);
   const value=str(data,'access_token');const seconds=integer(data.expires_in);
   this.token={value,expires:Date.now()+seconds*1000};return value;
  })();
  try{return await this.pendingToken;}finally{this.pendingToken=null;}
 }
 private async call(path:'order_query'|'refund_create'|'refund_query',body:Record<string,unknown>):Promise<Record<string,unknown>>{
  const token=await this.accessToken();const response=await this.http(`https://open.douyin.com/api/trade_basic/v1/developer/${path}/`,
   {method:'POST',headers:{'content-type':'application/json','access-token':token},body:JSON.stringify(body)});
  const root=dictionary.parse(JSON.parse(response.text));
  if(root.err_no!==0)throw new AppError('PROVIDER_BUSINESS_REJECTED',502,'抖音未受理此操作，请查询原订单。',{},true);
  return dictionary.parse(root.data);
 }
 async createPayment(order:OrderRow,_buyer:string,notifyUrl:string){
  invariant(['CNY_FEN','DOUYIN_DIAMOND'].includes(order.amount_unit)&&order.sku_id===this.product.skuId,'PAYMENT_PRODUCT_MISMATCH','订单单位或交易商品不匹配。');
  const currency=order.amount_unit==='DOUYIN_DIAMOND'?'DIAMOND':'CNY';
  const data=JSON.stringify({skuList:[{skuId:order.sku_id,price:order.amount_minor,quantity:1,title:this.product.title,imageList:[this.product.image],
    type:this.product.type,tagGroupId:this.product.tagGroupId}],outOrderNo:merchantReference(order.id),totalAmount:order.amount_minor,currency,
   payExpireSeconds:900,payNotifyUrl:notifyUrl,orderEntrySchema:{path:'pages/MP16/index',params:JSON.stringify({order:order.id})},
   ...(this.product.merchantUid?{merchantUid:this.product.merchantUid}:{})});
  const byteAuthorization=signDouyinOrder(this.appId,this.privateKey,this.product.keyVersion,data,String(Math.floor(Date.now()/1000)),randomBytes(16).toString('hex'));
  // The platform order_id is only known after requestOrder. This reference is provisional and is reconciled by server query.
  return {providerReference:merchantReference(order.id),payload:{mode:'DOUYIN_GENERAL_TRADE',data,byteAuthorization}};
 }
 refreshCheckout(order:OrderRow,payload:Record<string,unknown>){
  invariant(payload.mode==='DOUYIN_GENERAL_TRADE'&&typeof payload.data==='string','CHECKOUT_PAYLOAD_INVALID','原订单收银参数不可用。',409);
  const data=JSON.parse(payload.data);invariant(data.outOrderNo===merchantReference(order.id)&&data.totalAmount===order.amount_minor
   &&data.currency===(order.amount_unit==='DOUYIN_DIAMOND'?'DIAMOND':'CNY'),'CHECKOUT_PAYLOAD_INVALID','原订单金额或结算单位已变化。',409);
  return {...payload,byteAuthorization:signDouyinOrder(this.appId,this.privateKey,this.product.keyVersion,payload.data,String(Math.floor(Date.now()/1000)),randomBytes(16).toString('hex'))};
 }
 async queryPayment(id:string):Promise<PaymentFact>{
  const data=await this.call('order_query',{out_order_no:merchantReference(id)});
  invariant(data.app_id===this.appId,'PAYMENT_APP_MISMATCH','抖音订单应用信息不匹配。',409);
  const currency=data.currency??'CNY';invariant(currency==='CNY'||currency==='DIAMOND','PAYMENT_UNIT_UNSUPPORTED','抖音订单使用了未知结算单位。');
  const total=integer(currency==='DIAMOND'?data.total_currency_amount:data.total_amount);
  // No coupon/implicit unit conversion is enabled in the initial source policy.
  invariant((data.discount_amount??0)===0,'PAYMENT_DISCOUNT_UNSUPPORTED','原平台订单存在未确认的优惠，需要核对原订单。',409);
  const status=data.pay_status==='SUCCESS'?'CONFIRMED':data.pay_status==='PROCESS'?'PENDING':data.pay_status==='TIMEOUT'?'CLOSED':data.pay_status==='FAIL'?'FAILED':'UNKNOWN';
  return {provider:'DOUYIN',appAlias:this.appAlias,merchantReference:str(data,'out_order_no'),providerReference:str(data,'order_id'),status,
   amountMinor:total,amountUnit:currency==='DIAMOND'?'DOUYIN_DIAMOND':'CNY_FEN',factKey:str(data,'order_id'),
   paidAt:data.pay_time?new Date(integer(data.pay_time)).toISOString():null};
 }
 async refund(order:OrderRow,reference:string,amountMinor:number,reason:string):Promise<RefundFact>{
  const queried=await this.call('order_query',{out_order_no:merchantReference(order.id)});
  invariant(queried.app_id===this.appId&&queried.out_order_no===merchantReference(order.id),'PAYMENT_FACT_MISMATCH','原订单信息不匹配。');
  const all=amountMinor===order.amount_minor&&order.refunded_minor===0;
  const items=z.array(dictionary).parse(queried.item_order_list);
  invariant(items.length===1,'REFUND_SCOPE_UNSUPPORTED','初始服务仅支持单商品订单退款。');
  const data=await this.call('refund_create',{order_id:str(queried,'order_id'),out_refund_no:merchantReference(reference),refund_total_amount:amountMinor,
   currency:order.amount_unit==='DOUYIN_DIAMOND'?'DIAMOND':'CNY',refund_all:all,...(!all?{item_order_detail:[{item_order_id:str(items[0]!,'item_order_id'),refund_amount:amountMinor}]}:{}),
   refund_reason:[{code:999,text:reason.slice(0,100)}],order_entry_schema:{path:'pages/MP16/index',params:JSON.stringify({order:order.id})}});
  return {status:'PROCESSING',providerReference:str(data,'refund_id'),amountMinor,amountUnit:order.amount_unit,factKey:merchantReference(reference)};
 }
 async queryRefund(order:OrderRow,reference:string):Promise<RefundFact>{
  const data=await this.call('refund_query',{out_refund_no:merchantReference(reference)});
  const list=z.array(dictionary).parse(data.refund_list),row=list.find(r=>r.out_refund_no===merchantReference(reference));
  invariant(row,'REFUND_NOT_FOUND','原平台退款单尚未确认。',502);
  const currency=row.currency??'CNY';const unit=currency==='DIAMOND'?'DOUYIN_DIAMOND':'CNY_FEN';
  invariant(unit===order.amount_unit,'REFUND_UNIT_MISMATCH','退款原单位与订单不符。');
  return {status:row.refund_status==='SUCCESS'?'SUCCEEDED':row.refund_status==='PROCESSING'?'PROCESSING':row.refund_status==='FAIL'?'FAILED':'UNKNOWN',
   providerReference:str(row,'refund_id'),amountMinor:integer(row.refund_total_amount),amountUnit:unit,factKey:merchantReference(reference)};
 }
 async verifyEvent(raw:Buffer,headers:Record<string,string|undefined>){
  verifyDouyinCallback(raw,headers,this.platformPublicKey);
  const root=dictionary.parse(JSON.parse(raw.toString('utf8'))),msg=dictionary.parse(JSON.parse(str(root,'msg')));
  invariant(msg.app_id===this.appId,'PAYMENT_APP_MISMATCH','抖音回调应用不匹配。',401);
  invariant(root.type==='payment'||root.type==='refund','PLATFORM_EVENT_UNSUPPORTED','此回调类型尚未接入。',400);
  return {eventKey:sha256(raw),merchantReference:typeof msg.out_order_no==='string'?msg.out_order_no:str(msg,'order_id'),kind:root.type==='payment'?'PAYMENT' as const:'REFUND' as const,
   ...(typeof msg.out_refund_no==='string'?{refundReference:msg.out_refund_no}:{})};
 }
}
