import { sign,verify } from 'node:crypto';
import { z } from 'zod';
import { invariant,AppError } from '../shared/errors.js';
import { sha256 } from '../shared/crypto.js';
import type { OrderRow } from '../domain/models.js';
import type { PlatformAdapter,PaymentFact,RefundFact } from './types.js';
import { merchantReference,signedJsonValue,transport,uniqueForm,type HttpTransport } from './http.js';

export function alipayCanonical(fields:Readonly<Record<string,string>>,notification=false):string{
 return Object.keys(fields).filter(k=>k!=='sign'&&(!notification||k!=='sign_type')&&fields[k]!=='').sort().map(k=>k+'='+fields[k]).join('&');
}
export function cnyMinor(value:unknown):number{
 invariant(typeof value==='string'&&/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value),'PAYMENT_AMOUNT_INVALID','原平台金额格式错误。',502);
 const [whole,decimal='']=value.split('.');const minor=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 invariant(Number.isSafeInteger(minor),'PAYMENT_AMOUNT_INVALID','原平台金额超出精度。',502);return minor;
}
const money=(minor:number)=>`${Math.trunc(minor/100)}.${String(minor%100).padStart(2,'0')}`;
const textField=(data:Record<string,unknown>,key:string):string=>z.string().min(1).parse(data[key]);
export class AlipayAdapter implements PlatformAdapter {
 readonly provider='ALIPAY' as const;readonly configured=true;
 constructor(readonly appAlias:string,readonly appId:string,private readonly privateKey:string,private readonly publicKey:string,
  readonly gateway='https://openapi.alipay.com/gateway.do',private readonly http:HttpTransport=transport){
   const parsed=new URL(gateway);invariant(parsed.protocol==='https:'&&['openapi.alipay.com','openapi-sandbox.dl.alipaydev.com'].includes(parsed.hostname)
    &&parsed.pathname==='/gateway.do','PAYMENT_GATEWAY_INVALID','支付宝网关必须使用获准的官方地址。',503);
 }
 private async call(method:string,params:Record<string,string>):Promise<Record<string,unknown>>{
  const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());
  const fields={app_id:this.appId,method,charset:'utf-8',sign_type:'RSA2',timestamp:stamp,version:'1.0',format:'JSON',...params};
  const signature=sign('RSA-SHA256',Buffer.from(alipayCanonical(fields)),this.privateKey).toString('base64');
  const response=await this.http(this.gateway,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...fields,sign:signature}).toString()});
  const payload=JSON.parse(response.text) as Record<string,unknown>,key=method.replace(/\./g,'_')+'_response';
  // Signed successful responses are mandatory. Unverified error text is never returned to a user or treated as a payment fact.
  invariant(typeof payload.sign==='string'&&verify('RSA-SHA256',Buffer.from(signedJsonValue(response.text,key)),this.publicKey,Buffer.from(payload.sign,'base64')),
    'PLATFORM_SIGNATURE_INVALID','支付宝响应验签失败。',502);
  const data=z.record(z.string(),z.unknown()).parse(payload[key]);
  if(data.code!==undefined&&data.code!=='10000')throw new AppError('PROVIDER_BUSINESS_REJECTED',502,'支付宝未受理此操作，请先查询原订单。',{},true);
  return data;
 }
 async exchangeCode(code:string){const data=await this.call('alipay.system.oauth.token',{grant_type:'authorization_code',code});
  return {subject:(data.user_id?'uid:':'oid:')+textField(data,data.user_id?'user_id':'open_id')};}
 async createPayment(order:OrderRow,buyer:string,notifyUrl:string){
  invariant(order.amount_unit==='CNY_FEN','PAYMENT_UNIT_UNSUPPORTED','支付宝订单必须使用人民币分。',409);
  const data=await this.call('alipay.trade.create',{notify_url:notifyUrl,biz_content:JSON.stringify({out_trade_no:merchantReference(order.id),
   total_amount:money(order.amount_minor),subject:'资料成表服务',...(buyer.startsWith('oid:')?{buyer_open_id:buyer.slice(4)}:
    {buyer_id:buyer.startsWith('uid:')?buyer.slice(4):buyer}),timeout_express:'15m'})});
  const tradeNO=textField(data,'trade_no');return {providerReference:tradeNO,payload:{tradeNO}};
 }
 async queryPayment(id:string):Promise<PaymentFact>{
  const data=await this.call('alipay.trade.query',{biz_content:JSON.stringify({out_trade_no:merchantReference(id)})});
  const state=data.trade_status;const status=state==='TRADE_SUCCESS'||state==='TRADE_FINISHED'?'CONFIRMED':state==='TRADE_CLOSED'?'CLOSED':state==='WAIT_BUYER_PAY'?'PENDING':'UNKNOWN';
  return {provider:'ALIPAY',appAlias:this.appAlias,merchantReference:textField(data,'out_trade_no'),providerReference:textField(data,'trade_no'),status,
   amountMinor:cnyMinor(data.total_amount),amountUnit:'CNY_FEN',factKey:textField(data,'trade_no'),paidAt:null};
 }
 async refund(order:OrderRow,reference:string,amountMinor:number,reason:string):Promise<RefundFact>{
  const data=await this.call('alipay.trade.refund',{biz_content:JSON.stringify({out_trade_no:merchantReference(order.id),out_request_no:merchantReference(reference),
   refund_amount:money(amountMinor),refund_reason:reason.slice(0,128)})});
  return {status:data.fund_change==='Y'?'SUCCEEDED':'PROCESSING',providerReference:String(data.trade_no??''),amountMinor:cnyMinor(data.refund_fee),
   amountUnit:'CNY_FEN',factKey:merchantReference(reference)};
 }
 async queryRefund(order:OrderRow,reference:string):Promise<RefundFact>{
  const data=await this.call('alipay.trade.fastpay.refund.query',{biz_content:JSON.stringify({out_trade_no:merchantReference(order.id),out_request_no:merchantReference(reference)})});
  return {status:data.refund_status==='REFUND_SUCCESS'?'SUCCEEDED':'UNKNOWN',providerReference:String(data.trade_no??''),
   amountMinor:cnyMinor(data.refund_amount),amountUnit:'CNY_FEN',factKey:merchantReference(reference)};
 }
 async verifyEvent(raw:Buffer){
  const data=uniqueForm(raw);invariant(data.app_id===this.appId&&data.sign_type==='RSA2'&&!!data.sign&&
   verify('RSA-SHA256',Buffer.from(alipayCanonical(data,true)),this.publicKey,Buffer.from(data.sign,'base64')),
  'PLATFORM_SIGNATURE_INVALID','支付宝回调验签失败。',401);
  invariant(!!data.out_trade_no&&!!data.notify_id,'INVALID_PLATFORM_EVENT','支付宝回调缺少原订单信息。',400);
  return {eventKey:data.notify_id,merchantReference:data.out_trade_no,kind:(data.refund_fee||data.out_biz_no?'REFUND':'PAYMENT') as 'REFUND'|'PAYMENT',
   ...(data.out_request_no||data.out_biz_no?{refundReference:data.out_request_no||data.out_biz_no}:{} )};
 }
}
