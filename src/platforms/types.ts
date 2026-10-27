import type { Schema } from '../shared/contracts.js';
import type { OrderRow } from '../domain/models.js';

export interface PaymentFact {provider:Schema['Provider'];appAlias:string;merchantReference:string;providerReference:string;
  status:'CONFIRMED'|'PENDING'|'FAILED'|'CLOSED'|'UNKNOWN';amountMinor:number;amountUnit:string;factKey:string;paidAt:string|null;}
export interface RefundFact {status:'PROCESSING'|'SUCCEEDED'|'FAILED'|'UNKNOWN';providerReference:string|null;amountMinor:number;amountUnit:string;factKey:string;}
export interface PlatformAdapter {
  provider:Schema['Provider'];appAlias:string;configured:boolean;
  exchangeCode(code:string):Promise<{subject:string}>;
  createPayment(order:OrderRow,buyer:string,notifyUrl:string):Promise<{providerReference:string;payload:Record<string,unknown>}>;
  refreshCheckout?(order:OrderRow,payload:Record<string,unknown>):Record<string,unknown>;
  queryPayment(merchantReference:string):Promise<PaymentFact>;
  refund(order:OrderRow,reference:string,amountMinor:number,reason:string):Promise<RefundFact>;
  queryRefund(order:OrderRow,reference:string):Promise<RefundFact>;
  verifyEvent(raw:Buffer,headers:Record<string,string|undefined>):Promise<{eventKey:string;merchantReference:string;kind:'PAYMENT'|'REFUND';refundReference?:string}>;
}
export type Platforms=ReadonlyMap<Schema['Provider'],PlatformAdapter>;
