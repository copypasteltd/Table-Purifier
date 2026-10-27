import { readFile,lstat } from 'node:fs/promises';
import { createPrivateKey,createPublicKey } from 'node:crypto';
import { projectPath,type Config } from '../shared/config.js';
import { invariant } from '../shared/errors.js';
import type { PlatformAdapter,Platforms } from './types.js';
import { AlipayAdapter } from './alipay.js';
import { DouyinAdapter } from './douyin.js';

async function keyFile(config:Config,file:string,privateKey:boolean):Promise<string>{
 const path=projectPath(config.projectRoot,file);
 const info=await lstat(path);invariant(info.isFile()&&!info.isSymbolicLink()&&info.size<32_000,
  'PLATFORM_KEY_UNAVAILABLE','平台密钥文件无效。',503);
 const text=await readFile(path,'utf8');const key=privateKey?createPrivateKey(text):createPublicKey(text);
 invariant(key.asymmetricKeyType==='rsa'&&(key.asymmetricKeyDetails?.modulusLength??0)>=2048,
  'PLATFORM_KEY_INVALID','平台签名必须使用至少 2048 位 RSA 密钥。',503);return text;
}
export async function createPlatforms(config:Config):Promise<Platforms>{
 const adapters=new Map<'ALIPAY'|'DOUYIN',PlatformAdapter>();
 if(config.P07_ALIPAY_ENABLED){
  invariant(!!config.P07_ALIPAY_APP_ID,'PLATFORM_NOT_CONFIGURED','支付宝 App ID 尚未配置。',503);
  adapters.set('ALIPAY',new AlipayAdapter(config.P07_ALIPAY_APP_ALIAS,config.P07_ALIPAY_APP_ID,
   await keyFile(config,config.P07_ALIPAY_PRIVATE_KEY_FILE,true),await keyFile(config,config.P07_ALIPAY_PUBLIC_KEY_FILE,false),config.P07_ALIPAY_GATEWAY));
 }
 if(config.P07_DOUYIN_ENABLED){
  const product=JSON.parse(await readFile(projectPath(config.projectRoot,config.P07_DOUYIN_PRODUCT_FILE),'utf8'));
  adapters.set('DOUYIN',new DouyinAdapter(config.P07_DOUYIN_APP_ALIAS,config.P07_DOUYIN_APP_ID,config.P07_DOUYIN_APP_SECRET,
   await keyFile(config,config.P07_DOUYIN_PRIVATE_KEY_FILE,true),await keyFile(config,config.P07_DOUYIN_PUBLIC_KEY_FILE,false),product));
 }
 return adapters;
}
