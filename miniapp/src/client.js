import { provider,options,request,loginCode,getStored,store,forget,uuid,apiBase,invoke } from './platform.js';
export const state={session:null,task:null,draftGoal:'',draftMode:'DISCOVER',proposal:null,confirmation:null,quote:null,order:null,run:null,resultSchema:null,resultVersion:null,selectedIssue:null,selectedTemplate:null,capability:null,consent:null,reworkSession:null,reworkForRun:null};
let token=getStored('p07-login')?.token??null,loginPromise=null;
export async function authenticate(){if(token)return;
 if(!loginPromise)loginPromise=(async()=>{const code=await loginCode(),key=uuid(),r=await request('/v1/p07/auth/platform-sessions','POST',{provider,app_alias:options.appAlias,one_time_code:code},null,key);
  token=r.session_token;store('p07-login',{token,expires:r.expires_at});})().finally(()=>{loginPromise=null;});
 await loginPromise;
}
export async function api(path,method='GET',body,key,publicCall=false){
 if(!publicCall)await authenticate();try{return await request('/v1/p07'+path,method,body,publicCall?null:token,method==='GET'?null:key??uuid());}
 catch(error){if(error.code==='AUTH_REQUIRED'){token=null;forget('p07-login');}throw error;}
}
export function remember(){store('p07-current',{session:state.session?.session_id,task:state.task?.task_id,run:state.run?.run_id,order:state.order?.order_id,purpose:state.correction?'PLATFORM_CORRECTION':null});}
export async function restore(){const ids=getStored('p07-current');if(!ids)return;
 state.correction=ids.purpose==='PLATFORM_CORRECTION';
 if(ids.session)state.session=await api('/agent-sessions/'+ids.session);
 if(ids.task)state.task=await api('/tasks/'+ids.task);
 if(ids.run)state.run=await api('/runs/'+ids.run);
 if(ids.order)state.order=await api('/orders/'+ids.order);
}
export async function refreshTask(){if(state.task)state.task=await api('/tasks/'+state.task.task_id);return state.task;}
export async function readPlan(){await authenticate();return request('/transport/v1/tasks/'+state.task.task_id+'/plan','GET',null,token);}
export async function orderContext(id){await authenticate();return request('/transport/v1/orders/'+id+'/context','GET',null,token);}
export async function resultSchema(){await authenticate();const r=await request('/transport/v1/runs/'+state.run.run_id+'/schema?result_version='+state.run.result_version,'GET',null,token);state.resultSchema=r.schema;return r.schema;}
export async function prepareRework(id,key,clientRequestId,skillReleaseId){await authenticate();return request('/transport/v1/runs/'+id+'/rework-sessions','POST',{client_request_id:clientRequestId,skill_release_id:skillReleaseId},token,key);}
export async function businessTransport(path,method='GET',body,key){await authenticate();return request('/transport/v1'+path,method,body,token,key);}
export function deletionReference(){return getStored('p07-deletion')?.id??null;}
export function rememberDeletion(job){store('p07-deletion',{id:job.deletion_request_id});}
export function clearDraft(){state.session=null;state.task=null;state.draftGoal='';state.draftMode='DISCOVER';state.proposal=null;state.confirmation=null;state.quote=null;state.order=null;state.run=null;state.resultSchema=null;state.selectedIssue=null;state.selectedTemplate=null;state.reworkSession=null;state.reworkForRun=null;state.correction=false;state.consent=null;remember();}
