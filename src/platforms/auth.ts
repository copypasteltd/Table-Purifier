import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import type { Database } from '../db/database.js';
import type { Body,Schema } from '../shared/contracts.js';
import type { Config } from '../shared/config.js';
import { canonicalJson,hmac,sha256 } from '../shared/crypto.js';
import { invariant,AppError } from '../shared/errors.js';
import type { Actor } from '../domain/models.js';
import type { Platforms } from './types.js';

export function encryptSubject(secret:string,subject:string,aad:string):string{
 const iv=randomBytes(12),key=Buffer.from(hmac(secret,'P07-IDENTITY-AEAD-1'),'hex');
 const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));
 const encrypted=Buffer.concat([cipher.update(subject,'utf8'),cipher.final()]);return 'enc1:'+Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function decryptSubject(secret:string,value:string,aad:string):string{
 invariant(value.startsWith('enc1:'),'IDENTITY_UNAVAILABLE','支付身份信息不可用。',503);
 const data=Buffer.from(value.slice(5),'base64url'),key=Buffer.from(hmac(secret,'P07-IDENTITY-AEAD-1'),'hex');
 const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));cipher.setAAD(Buffer.from(aad));
 return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');
}
interface AuthRow {owner_id:string;identity_id:string;provider:Schema['Provider'];app_alias:string;session_id:string;}
export class AuthService {
 constructor(readonly config:Config,readonly db:Database,readonly platforms:Platforms){}
 async authenticate(token:string):Promise<Actor>{
  invariant(/^[0-9a-f]{64}$/.test(token),'AUTH_REQUIRED','请先登录。',401);
  const row=(await this.db.pool.query<AuthRow>('SELECT * FROM p07.auth_session($1)',[sha256(token)])).rows[0];
  invariant(row,'AUTH_REQUIRED','登录已过期，请重新登录。',401);
  return {owner:row.owner_id,identity:row.identity_id,provider:row.provider,appAlias:row.app_alias,loginSessionId:row.session_id};
 }
 async login(body:Body<'01'>,idempotencyKey:string):Promise<Schema['Data01']>{
  invariant(idempotencyKey.length>=16&&idempotencyKey.length<=128,'IDEMPOTENCY_KEY_REQUIRED','请提供操作标识。',400);
  const adapter=this.platforms.get(body.provider);
  invariant(adapter?.configured&&adapter.appAlias===body.app_alias,'PLATFORM_NOT_CONFIGURED','该平台登录尚未配置。',503);
  // A retry returns the same opaque token; plaintext token/code never needs to be stored in the DB.
  const token=hmac(this.config.P07_TOKEN_SECRET,'P07-LOGIN-1|'+idempotencyKey+'|'+canonicalJson(body));
  const cached=(await this.db.pool.query<AuthRow>('SELECT * FROM p07.auth_session($1)',[sha256(token)])).rows[0];
  if(cached){const expires=await this.db.withOwner(cached.owner_id,async tx=>(await tx.query<{expires_at:Date}>('SELECT expires_at FROM p07.sessions WHERE id=$1',[cached.session_id])).rows[0]!.expires_at);
   return {session_token:token,expires_at:expires.toISOString(),account_id:cached.owner_id,identity_provider:body.provider};}
  const {subject}=await adapter.exchangeCode(body.one_time_code);
  invariant(subject.length>0&&subject.length<=200,'INVALID_PLATFORM_IDENTITY','原平台未返回有效身份。',401);
  const subjectHash=hmac(this.config.P07_IDENTITY_SECRET,body.provider+'|'+body.app_alias+'|'+subject);
  const aad=body.provider+'|'+body.app_alias+'|'+subjectHash;
  try{
   const result=await this.db.pool.query<{account_id:string;identity_id:string;expires_at:Date}>(
    'SELECT * FROM p07.create_platform_login($1,$2,$3,$4,$5,$6,$7)',[body.provider,body.app_alias,subjectHash,
     encryptSubject(this.config.P07_IDENTITY_SECRET,subject,aad),sha256(body.one_time_code),sha256(token),sha256(idempotencyKey)]);
   const row=result.rows[0]!;return {session_token:token,expires_at:row.expires_at.toISOString(),account_id:row.account_id,identity_provider:body.provider};
  }catch(error){if((error as {code?:string}).code==='23505')throw new AppError('PLATFORM_CODE_REPLAY',401,'授权凭据已使用，请重新授权。');throw error;}
 }
}
