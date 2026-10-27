/* Compiled once per native host. No browser DOM, webview or global desktop credentials. */
import config from '../config.generated.json';
export const provider=__P07_PROVIDER__;
export const host=provider==='ALIPAY'?my:tt;
export const options=config[provider];
export const apiBase=config.apiBaseUrl;
export const invoke=(name,params={})=>new Promise((resolve,reject)=>{
 if(typeof host[name]!=='function')return reject(new Error('当前版本暂不支持此操作，请升级宿主后重试。'));
 host[name]({...params,success:resolve,fail:()=>reject(new Error('操作未完成。取消、权限或网络问题可在本页重新尝试。'))});
});
export function uuid(){
 // Identifiers are client action keys, never authentication or payment proofs. The server generates all authoritative IDs.
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:r&3|8).toString(16);});
}
export function getStored(key){try{return provider==='ALIPAY'?host.getStorageSync({key}).data:host.getStorageSync(key);}catch{return null;}}
export function store(key,data){if(provider==='ALIPAY')host.setStorageSync({key,data});else host.setStorageSync(key,data);}
export function forget(key){if(provider==='ALIPAY')host.removeStorageSync({key});else host.removeStorageSync(key);}
export function environment(){const s=host.getSystemInfoSync();return {provider,app_alias:options.appAlias,os:/ios/i.test(s.platform??s.system)?'IOS':'ANDROID',
 host_version:String(s.version??s.appVersion??'unknown'),base_sdk:String(s.SDKVersion??'unknown'),build_id:config.buildId};}
export async function loginCode(){if(provider==='ALIPAY'){const r=await invoke('getAuthCode',{scopes:['auth_base']});return r.authCode;}
 const r=await invoke('login',{force:true});return r.code;}
export async function request(path,method,body,token,key){
 if(!apiBase||!/^https:\/\//.test(apiBase))throw new Error('服务地址尚未配置，请联系服务提供方。');
 const header={'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(key?{'Idempotency-Key':key}:{})};
 const response=await invoke('request',{url:apiBase+path,method,data:body??{},[provider==='ALIPAY'?'headers':'header']:header,timeout:20000,dataType:'json'});
 const status=response.status??response.statusCode;let payload=response.data;if(typeof payload==='string')try{payload=JSON.parse(payload);}catch{throw new Error('服务响应不可用。');}
 if(status<200||status>=300){const error=new Error(payload?.error?.message??'操作尚未完成，请刷新当前状态。');error.code=payload?.error?.code;error.requestId=payload?.request_id;throw error;}
 return payload.data;
}
export async function confirm(title,content,confirmText='继续'){
 const r=provider==='ALIPAY'?await invoke('confirm',{title,content,confirmButtonText:confirmText,cancelButtonText:'返回'}):await invoke('showModal',{title,content,confirmText,cancelText:'返回'});return r.confirm===true;
}
export function navigate(page,query={}){const q=Object.entries(query).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(String(v))).join('&');
 return invoke(['MP01','MP13','MP14','MP15'].includes(page)?'reLaunch':'navigateTo',{url:'/pages/'+page+'/index'+(q?'?'+q:'')});}
export async function chooseImage(){const r=await invoke('chooseImage',{count:1,sizeType:['original'],sourceType:['album','camera']});
 return provider==='ALIPAY'?{path:r.apFilePaths?.[0],name:'资料图片.jpg'}:{path:r.tempFilePaths?.[0],name:'资料图片.jpg'};}
export async function chooseOffice(){
 if(!options.approvedOfficePicker||!options.officePickerEvidence)throw new Error('当前环境未开放办公文件选择，可先粘贴文字或添加资料图片。');
 // Only a host API recorded by this exact build's device evidence can be selected here. No fake cross-host chooser.
 if(provider==='ALIPAY'&&options.approvedOfficePicker==='chooseFileFromDisk'){
  const r=await invoke('chooseFileFromDisk',{});return {path:r.apFilePath,name:r.fileName??'规范文件'};}
 throw new Error('此构建未提供已核验的办公文件入口。');
}
export async function fileBytes(path){const fs=host.getFileSystemManager?.();if(!fs)throw new Error('当前版本暂不能读取文件摘要，请使用粘贴文字入口。');
 return new Promise((resolve,reject)=>fs.readFile({filePath:path,success:r=>resolve(new Uint8Array(r.data)),fail:()=>reject(new Error('文件读取失败，请重新选择。'))}));}
export async function upload(path,grant){
 const r=await invoke('uploadFile',{url:grant.limited_upload_target,filePath:path,[provider==='ALIPAY'?'fileName':'name']:'file',
  ...(provider==='ALIPAY'?{fileType:'image'}:{}),[provider==='ALIPAY'?'headers':'header']:{Authorization:'Bearer '+grant.upload_token}});
 const status=r.status??r.statusCode;if(status!==200)throw new Error('文件尚未接收完成，请重新选择上传。');return typeof r.data==='string'?JSON.parse(r.data):r.data;
}
export async function pay(payload){
 if(payload.query_required)return;
 if(provider==='ALIPAY'){await invoke('tradePay',{tradeNO:payload.tradeNO});return;}
 if(payload.mode!=='DOUYIN_GENERAL_TRADE')throw new Error('当前平台收银参数不可用。');
 const r=await invoke('requestOrder',{data:payload.data,byteAuthorization:payload.byteAuthorization});
 if(!r.orderId)throw new Error('平台未返回原订单号，请查询付款状态。');
 await invoke('getOrderPayment',{orderId:r.orderId});
}
export async function fetchFile(url){const r=await invoke('downloadFile',{url});const status=r.status??r.statusCode;
 if(status!==200)throw new Error('领取链接已失效，请重新领取。');return r.apFilePath??r.tempFilePath;}
export async function openFile(path){return invoke('openDocument',provider==='ALIPAY'?{filePath:path,fileType:'xlsx'}:{filePath:path,showMenu:true});}
export function copyFileLink(url){return provider==='ALIPAY'?invoke('setClipboard',{text:url}):invoke('setClipboardData',{data:url});}
