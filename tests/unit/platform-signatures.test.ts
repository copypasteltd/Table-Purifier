import { expect,it } from 'vitest';
import { generateKeyPairSync,sign,verify } from 'node:crypto';
import { AlipayAdapter,alipayCanonical,cnyMinor } from '../../src/platforms/alipay.js';
import { signDouyinOrder,verifyDouyinCallback } from '../../src/platforms/douyin.js';
import { signedJsonValue,uniqueForm } from '../../src/platforms/http.js';

const pair=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
it('verifies original RSA2 callback bytes and rejects altered facts, wrong application and duplicate form keys',async()=>{
 const adapter=new AlipayAdapter('test','fixture-app',pair.privateKey,pair.publicKey);
 const fields={app_id:'fixture-app',sign_type:'RSA2',notify_id:'notification-test-only',out_trade_no:'p07_fixture',total_amount:'12.34',trade_status:'TRADE_SUCCESS'};
 const signature=sign('RSA-SHA256',Buffer.from(alipayCanonical(fields,true)),pair.privateKey).toString('base64');
 const original=Buffer.from(new URLSearchParams({...fields,sign:signature}).toString());
 expect(await adapter.verifyEvent(original)).toMatchObject({kind:'PAYMENT',merchantReference:'p07_fixture'});
 await expect(adapter.verifyEvent(Buffer.from(original.toString().replace('12.34','12.35')))).rejects.toMatchObject({code:'PLATFORM_SIGNATURE_INVALID'});
 await expect(adapter.verifyEvent(Buffer.concat([original,Buffer.from('&app_id=other')]))).rejects.toThrow();
 const wrong={...fields,app_id:'other'},wrongSignature=sign('RSA-SHA256',Buffer.from(alipayCanonical(wrong,true)),pair.privateKey).toString('base64');
 await expect(adapter.verifyEvent(Buffer.from(new URLSearchParams({...wrong,sign:wrongSignature}).toString()))).rejects.toThrow();
});
it('binds Douyin signatures to exact method, route, timestamp, nonce and body bytes; expires callbacks',()=>{
 const timestamp=String(Math.floor(Date.now()/1000)),nonce='fixture-nonce',data='{"a":1, "b":"中文"}';
 const auth=signDouyinOrder('ttfixture',pair.privateKey,'1',data,timestamp,nonce),signature=auth.split('signature=')[1]!;
 expect(verify('RSA-SHA256',Buffer.from(`POST\n/requestOrder\n${timestamp}\n${nonce}\n${data}\n`),pair.publicKey,Buffer.from(signature,'base64'))).toBe(true);
 const callback=sign('RSA-SHA256',Buffer.from(`${timestamp}\n${nonce}\n${data}\n`),pair.privateKey).toString('base64');
 const headers={'byte-timestamp':timestamp,'byte-nonce-str':nonce,'byte-signature':callback};
 expect(()=>verifyDouyinCallback(Buffer.from(data),headers,pair.publicKey)).not.toThrow();
 expect(()=>verifyDouyinCallback(Buffer.from('{"a":1,"b":"中文"}'),headers,pair.publicKey)).toThrow();
 expect(()=>verifyDouyinCallback(Buffer.from(data),headers,pair.publicKey,(Number(timestamp)+301)*1000)).toThrow();
});
it('keeps signed JSON lexemes intact and accepts only exact minor-unit money',()=>{
 const text='{"alipay_trade_query_response": {"nested":{"escaped":"a}\\\"b"}, "amount":"0.10"},"sign":"signature"}';
 expect(signedJsonValue(text,'alipay_trade_query_response')).toBe('{"nested":{"escaped":"a}\\\"b"}, "amount":"0.10"}');
 expect(()=>uniqueForm(Buffer.from('a=1&a=2'))).toThrow();expect(cnyMinor('0.10')).toBe(10);expect(cnyMinor('9007199.99')).toBe(900719999);
 for(const value of ['1.001','1e3','-1',' 1.00',1.2])expect(()=>cnyMinor(value)).toThrow();
});
