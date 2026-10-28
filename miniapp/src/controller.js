import { state,api,refreshTask,restore,remember,clearDraft,readPlan,orderContext,resultSchema,prepareRework,businessTransport,deletionReference,rememberDeletion } from './client.js';
import { environment,navigate,confirm,uuid,chooseImage,chooseOffice,fileBytes,upload,pay,fetchFile,openFile,copyFileLink,provider } from './platform.js';
import { sha256 } from './sha256.js';
import config from '../config.generated.json';
import { titles } from './pages.generated.js';
import { clone,fieldTypes,comparators,editorView,schemaPatch,ruleFromForm } from './schema-editor.js';
import { sourceView,fieldExamples,tableView,issueView } from './presentation.js';

const STATUS={INITIALIZING:'正在准备整理会话',READY_FOR_INPUT:'会话已就绪，可以提交资料',INPUT_RECEIVED:'资料已接收，等待分析',ANALYZING:'正在理解全部已提交资料',WAITING_CONFIRMATION:'规范草案已准备好，请确认',QUOTABLE:'方案已确认，可以预估费用',AWAITING_PAYMENT:'等待原平台确认付款',BATCH_QUEUED:'已核实付款，等待整理',BATCH_RUNNING:'正在批量整理',PERSISTING_RESULTS:'正在保存并核验结果',RELEASING_RUNTIME:'结果与任务环境分别处理，正在清理环境',CLOSED:'任务环境已清理，结果继续保留',FAILED:'整理未完成，请查看订单与售后',CANCELED:'整理已停止',INITIALIZATION_FAILED:'会话准备失败，请重试'};
const labels={CONFIRMED:'服务端已核实付款',PENDING:'等待付款确认',UNKNOWN:'状态待核对',NOT_CREATED:'尚未发起支付',DELIVERABLE:'结果可领取',DELIVERED:'已确认取用',NONE:'无退款申请',SUCCEEDED:'已完成',PROCESSING:'处理中',REQUESTED:'已申请',PARTIAL:'部分退款',FULL:'全额退款',NOT_STARTED:'尚未生产',IN_PROGRESS:'正在履约'};
const writable=()=>state.session&&['READY_FOR_INPUT','INPUT_RECEIVED','WAITING_CONFIRMATION','QUOTABLE'].includes(state.session.status);
function values(record,schema){return record.fields.map(f=>({id:f.field_id,label:schema?.fields.find(x=>x.field_id===f.field_id)?.label??f.field_id,value:f.typed_value===null?'—':String(f.typed_value),status:f.status,evidence:f.evidence_ids}));}
function recordView(record,schema){const fields=values(record,schema);return {...record,values:fields,keyValues:fields.slice(0,5),moreFields:fields.length>5};}
export function createPage(page){return {
 data:{page,title:titles[page],loading:false,error:'',notice:'',phase:'',ready:false,mode:'DISCOVER',goal:'',text:'',instruction:'',name:'',value:'',note:'',category:'资料整理问题',supportAccess:false,
  sources:[],homeSources:[],sourceCount:0,fields:[],fieldCards:[],previewColumns:[],previewRows:[],records:[],issues:[],files:[],tasks:[],templates:[],orders:[],nextCursor:null,selectedAction:'',selectedEvidence:'',filter:'',policy:null,quote:null,order:null,run:null,task:null,session:null,plan:null,proposal:null,evidence:null,decisionPreview:null,deletion:null,capability:null,
  counts:null,bindingId:null,contractId:null,consentId:null,primaryFiles:[],additionalFiles:[],moreFiles:false,expandedRecord:'',environment:environment(),canChooseOffice:!!config[provider].approvedOfficePicker,
  draft:null,ruleViews:[],fieldTypes,comparators,ruleKind:'COMPARE',ruleField:'',ruleTarget:'',ruleComparator:'GE',ruleValue:'',templateEdit:false,reworkReady:false},
 onLoad(query={}){this.route=query;this.pendingKeys={};this.visible=true;this.localFile=null;},
 onShow(){this.visible=true;this.perform(async()=>{if(!state.session&&page!=='MP17'&&page!=='MP18')await restore();await this.refresh();});},
 onHide(){this.visible=false;clearTimeout(this.poller);},
 onUnload(){this.visible=false;clearTimeout(this.poller);this.localFile=null;},
 async perform(fn){if(this.data.loading)return;this.setData({loading:true,error:''});try{await fn();}
  catch(e){this.setData({error:e.message??'操作未完成，请重试。',...(e.requestId?{notice:'请求编号：'+e.requestId}:{})});}
  finally{this.setData({loading:false});}},
 key(action){return this.pendingKeys[action]??(this.pendingKeys[action]=uuid());},
 done(action){delete this.pendingKeys[action];},
 async write(action,path,body){const r=await api(path,'POST',body,this.key(action));this.done(action);return r;},
 onInput(e){const field=e.currentTarget.dataset.field;if(field==='goal'&&writable()&&!state.task)state.draftGoal=e.detail.value;this.setData({[field]:e.detail.value});},
 onChoice(e){if(page==='MP10'&&!this.data.reworkReady)return;this.setData({selectedAction:e.currentTarget.dataset.action,selectedEvidence:e.currentTarget.dataset.id??'',decisionPreview:null});},
 onMode(e){if(state.task)return;this.setData({mode:e.currentTarget.dataset.mode});},
 loadEditor(schema,key){if(this.editorKey===key){this.setData(editorView(clone(this.data.draft)));return;}this.editorKey=key;this.setData({expandedField:schema.fields[0]?.field_id??''});this.originalSchema=clone(schema);this.setData(editorView(clone(schema)));},
 onSchemaInput(e){const {id,property}=e.currentTarget.dataset,draft=clone(this.data.draft),field=draft.fields.find(f=>f.field_id===id),value=e.detail.value;
  if(field){if(property==='enum_values')field.enum_values=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
   else if(property==='scale'){if(value!==''&&(!/^\d+$/.test(value)||Number(value)>18)){this.setData({error:'小数位数请填写 0 至 18。'});return;}field.scale=value===''?null:Number(value);}
   else field[property]=property==='unit'&&value===''?null:value;}else draft[property]=value;this.setData(editorView(draft));},
 async ensureTask(){if(!writable())throw new Error('请先新建会话，并等待准备完成。');
  if(!state.task){const goal=state.draftGoal??this.data.goal;state.task=await this.write('create-task','/tasks',{mode:this.data.mode,client_request_id:this.key('task-request'),agent_session_id:state.session.session_id,...(goal?{optional_goal:goal}:{})});state.draftGoal='';remember();}return refreshTask();},
 async refresh(){
  if(this.route.template&&page==='MP07'){const t=await api('/private-templates/'+this.route.template);state.selectedTemplate=t;
   this.setData({templateEdit:true,name:t.name});this.loadEditor(t.schema,'private:'+t.template_id+':'+t.version);return;}
  if(this.route.task&&state.task?.task_id!==this.route.task){state.task=await api('/tasks/'+this.route.task);state.session=await api('/agent-sessions/'+state.task.agent_session_id);state.run=null;state.quote=null;state.confirmation=null;state.proposal=null;state.order=null;}
  if(this.route.run&&state.run?.run_id!==this.route.run)state.run=await api('/runs/'+this.route.run);
  if(this.route.order){state.order=await api('/orders/'+this.route.order);const c=await orderContext(state.order.order_id);
   if(state.task?.task_id!==c.task_id){state.task=await api('/tasks/'+c.task_id);state.session=await api('/agent-sessions/'+c.session_id);state.run=c.run_id?await api('/runs/'+c.run_id):null;state.quote=null;state.confirmation=null;state.proposal=null;}}
  if(state.session)state.session=await api('/agent-sessions/'+state.session.session_id);
  if(state.task)await refreshTask();
  if(state.correction&&!state.task)this.setData({mode:'PROVIDED',notice:'这是原单纠错的新会话。请重传需要核对的原始资料，分析确认后再提交限时售后审核；审核通过前不收取第二次费用。'});
  const env=environment();if(!state.capability)state.capability=await api('/capabilities?'+Object.entries(env).map(([k,v])=>k+'='+encodeURIComponent(v)).join('&'),'GET',null,null,true);
  const sources=(state.task?.sources??[]).map(sourceView),homeSources=sources.filter(s=>s.role!=='TEMPLATE');
  this.setData({session:state.session,task:state.task,sources,homeSources:homeSources.slice(0,3),sourceCount:homeSources.length,goal:state.task?.goal??state.draftGoal??'',ready:!!writable(),mode:state.task?.mode??state.draftMode??this.data.mode,
   phase:STATUS[state.session?.status]??'先新建会话，准备好后再添加资料。',capability:state.capability});
  if(['MP03','MP06','MP07'].includes(page)&&state.task){
   if(page==='MP03'&&state.selectedTemplate)this.setData({fields:state.selectedTemplate.schema.fields,name:state.selectedTemplate.name});
   else if(state.session?.status==='WAITING_CONFIRMATION'||state.session?.status==='QUOTABLE'){
    state.proposal=await api('/tasks/'+state.task.task_id+'/schema-proposal');this.setData({proposal:state.proposal,fields:state.proposal.schema.fields,fieldCards:fieldExamples(state.proposal.schema.fields),
     ...tableView(state.proposal.preview_records,state.proposal.schema),records:state.proposal.preview_records.map(r=>({...r,values:values(r,state.proposal.schema)}))});}
   if(page==='MP07'&&state.proposal)this.loadEditor(state.proposal.schema,'proposal:'+state.proposal.proposal_id+':'+state.proposal.version);
  }
  if(page==='MP04'&&state.task){const p=await readPlan();this.setData({plan:p.plan,bindingId:p.binding_id,contractId:p.contract_id});
   const correction=await businessTransport('/tasks/'+state.task.task_id+'/correction');state.correction=correction.is_correction;this.setData({correction});
   if(p.contract_id)state.confirmation={contract_id:p.contract_id,contract_hash:p.contract_hash,confirmed_plan:p.plan};
   if(p.order_id)state.order=await api('/orders/'+p.order_id);this.setData({quote:state.quote,order:state.order});}
  if(state.task?.current_run_id&&!state.run)state.run=await api('/runs/'+state.task.current_run_id);
  if(state.run&&['MP05','MP08','MP09','MP10','MP12'].includes(page)){
   state.run=await api('/runs/'+state.run.run_id);this.setData({run:state.run,stageLabel:state.run.stage==='AGENT_BATCH'?'整理与校验':state.run.execution_status==='SUCCEEDED'?'结果已保存':'等待处理'});
   if(state.run.result_version&&(!state.resultSchema||this.schemaRun!==state.run.run_id)){await resultSchema();this.schemaRun=state.run.run_id;}
   if(page==='MP08'&&state.run.result_version){const r=await api(`/runs/${state.run.run_id}/records?result_version=${state.run.result_version}&limit=20`);
    this.setData({records:r.records.map(x=>recordView(x,state.resultSchema)),counts:r.counts,nextCursor:r.next_cursor});}
   if(page==='MP09'&&state.run.result_version){const r=await api(`/runs/${state.run.run_id}/issues?result_version=${state.run.result_version}&limit=20${this.data.filter?'&severity='+this.data.filter:''}`);this.setData({issues:r.issues,nextCursor:r.next_cursor,affected:r.affected_records});}
   if(page==='MP10'){const issue=state.selectedIssue;if(!issue)throw new Error('请从问题列表选择一项。');this.setData({issue,canUserValue:issue.allowed_decisions.includes('USER_VALUE'),canEvidence:issue.allowed_decisions.includes('CHOOSE_EVIDENCE'),canKeep:issue.allowed_decisions.includes('KEEP_UNRESOLVED')});
    if(this.issueKey!==issue.issue_id){this.issueKey=issue.issue_id;this.setData({selectedAction:'',selectedEvidence:'',decisionPreview:null});
     let record=null,cursor=null;for(let batch=0;batch<50;batch++){const r=await api(`/runs/${state.run.run_id}/records?result_version=${state.run.result_version}&limit=20${cursor?'&cursor='+encodeURIComponent(cursor):''}`);record=r.records.find(r=>r.record_id===issue.record_id);if(record||!r.next_cursor)break;cursor=r.next_cursor;}
     this.setData(issueView(issue,record,state.resultSchema));}
    if(!state.reworkSession||state.reworkForRun!==state.run.run_id){const prepared=await prepareRework(state.run.run_id,this.key('rework-session'),this.key('rework-request'),config.skillReleaseId);state.reworkSession={session_id:prepared.session_id};state.reworkForRun=state.run.run_id;this.done('rework-session');}
    state.reworkSession=await api('/agent-sessions/'+state.reworkSession.session_id);this.setData({reworkReady:state.reworkSession.status==='READY_FOR_INPUT',reworkPhase:STATUS[state.reworkSession.status]});
    const excerpts=[];for(const id of issue.evidence_ids.slice(0,8))excerpts.push(await api('/evidence/'+id));this.setData({excerpts});}
   if(page==='MP12'&&state.run.result_version){const r=await api('/runs/'+state.run.run_id+'/artifacts'),names=['result.xlsx','standard.xlsx','issues.xlsx'];this.setData({files:r.artifacts,primaryFiles:names.map(name=>r.artifacts.find(f=>f.name===name)).filter(Boolean),additionalFiles:r.artifacts.filter(f=>!names.includes(f.name)),resultVersion:r.result_version});}
  }
  if(page==='MP11'){const id=this.route.evidence;if(!id)throw new Error('请选择需要查看的来源摘录。');this.setData({evidence:await api('/evidence/'+id)});}
  if(page==='MP13'){const r=await api('/tasks?limit=20');this.setData({tasks:r.items,nextCursor:r.next_cursor});}
  if(page==='MP14'){const r=await api('/private-templates?limit=20'+(this.data.name?'&query='+encodeURIComponent(this.data.name):''));this.setData({templates:r.items,nextCursor:r.next_cursor});}
  if(page==='MP15'){const r=await api('/orders?limit=20');this.setData({orders:r.items,nextCursor:r.next_cursor});}
  if(page==='MP16'&&state.order){state.order=await api('/orders/'+state.order.order_id);this.setData({order:state.order,paymentLabel:labels[state.order.payment_status],refundLabel:labels[state.order.refund_status],fulfillmentLabel:labels[state.order.fulfillment_status]});}
  if(page==='MP17'){this.setData({policy:await api('/privacy/policies?environment='+env.provider+'_'+env.os,'GET',null,null,true)});
   const deletionId=this.data.deletion?.deletion_request_id??deletionReference();if(deletionId)this.setData({deletion:await api('/data-deletion-requests/'+deletionId)});}
  if(page==='MP18'&&state.correction)this.setData({category:'平台纠错',notice:'请说明原资料中的遗漏或错误，并选择是否授权售后限时核对当前任务。审核只覆盖已确认的原资料纠错范围。'});
  remember();
  if(this.visible&&(state.session?.status==='INITIALIZING'||page==='MP10'&&state.reworkSession?.status==='INITIALIZING'||page==='MP05'&&state.session&&!['CLOSED','FAILED','CANCELED','INITIALIZATION_FAILED','WAITING_CONFIRMATION','QUOTABLE','AWAITING_PAYMENT'].includes(state.session.status))){
   clearTimeout(this.poller);this.poller=setTimeout(()=>{if(this.visible)this.perform(()=>this.refresh());},2500);}
 },
 onAction(e){const action=e.detail?.action??e.action??e.currentTarget?.dataset?.action,id=e.detail?.id??e.id??e.currentTarget?.dataset?.id;
  this.perform(()=>this.act(action,id));},
 async act(action,id){
  if(action==='refresh'){await this.refresh();return;}
  if(action==='toggle-files'){this.setData({moreFiles:!this.data.moreFiles});return;}
  if(action==='toggle-record'){this.setData({expandedRecord:this.data.expandedRecord===id?'':id});return;}
  if(action==='edit-field'){this.setData({expandedField:this.data.expandedField===id?'':id});return;}
  if(action==='prepare-correction'){
   const r=await businessTransport('/runs/'+state.run.run_id+'/correction-sessions','POST',{client_request_id:this.key('correction-request'),skill_release_id:config.skillReleaseId},this.key('correction-session'));
   this.done('correction-session');clearDraft();state.correction=true;state.session=await api('/agent-sessions/'+r.session_id);remember();await navigate('MP01');return;
  }
  if(action==='start-correction'){
   const authorization=this.data.correction?.authorization;if(authorization?.status!=='APPROVED'||!state.quote?.quote_id)throw new Error('请先查看估费，并等待原单纠错审核通过。');const p=await readPlan();
   state.run=await businessTransport('/corrections/'+authorization.authorization_id+'/runs','POST',{session_id:state.session.session_id,contract_id:p.contract_id,plan_hash:p.plan.plan_hash,quote_id:state.quote.quote_id},this.key('start-correction'));
   this.done('start-correction');remember();await navigate('MP05');return;
  }
  if(action==='add-field'||action==='remove-field'||action==='field-up'||action==='field-down'||action?.startsWith('field-toggle-')||action?.startsWith('field-type-')||action==='remove-rule'||action==='add-rule'){
   const draft=clone(this.data.draft);if(!draft)throw new Error('请等待规范加载。');const index=draft.fields.findIndex(f=>f.field_id===id),field=draft.fields[index];
   if(action==='add-field'){if(draft.fields.length>=50)throw new Error('本次规范最多包含 50 个字段。');draft.fields.push({field_id:'field_'+uuid(),label:'新字段 '+(draft.fields.length+1),order:draft.fields.length,type:'TEXT',required:false,nullable:true,unit:null,description:''});}
   if(action==='remove-field'){if(draft.identity_keys.includes(id))throw new Error('该字段用于识别记录，请通过文字调整说明同时修改识别规则。');draft.fields=draft.fields.filter(f=>f.field_id!==id);}
   if(action==='field-up'&&index>0)[draft.fields[index-1],draft.fields[index]]=[draft.fields[index],draft.fields[index-1]];
   if(action==='field-down'&&index>=0&&index<draft.fields.length-1)[draft.fields[index+1],draft.fields[index]]=[draft.fields[index],draft.fields[index+1]];
   if(action?.startsWith('field-toggle-')&&field){const property=action.slice(13);field[property]=!field[property];}
   if(action?.startsWith('field-type-')&&field){field.type=action.slice(11);delete field.scale;delete field.enum_values;delete field.closed_enum;if(field.type==='ENUM'){field.enum_values=[];field.closed_enum=true;}}
   if(action==='remove-rule')draft.rules.splice(Number(id),1);if(action==='add-rule')draft.rules.push(ruleFromForm(draft,this.data));
   draft.fields.forEach((f,i)=>{f.order=i;});this.setData(editorView(draft));return;
  }
  if(action?.startsWith('rule-kind-')){this.setData({ruleKind:action.slice(10)});return;}
  if(action?.startsWith('rule-compare-')){this.setData({ruleComparator:action.slice(13)});return;}
  if(action==='rule-field'||action==='rule-target'){this.setData({[action==='rule-field'?'ruleField':'ruleTarget']:id});return;}
  if(action==='edit-template'){await navigate('MP07',{template:id});return;}
  if(action==='save-template-version'){
   if(!this.data.name.trim())throw new Error('请填写规范名称。');if(!await confirm('保存规范的新版本','请确认字段说明和规则中没有具体记录或个人资料。历史任务仍使用各自已确认的版本。','保存新版本'))return;
   const policy=await api('/privacy/policies?environment='+environment().provider+'_'+environment().os,'GET',null,null,true);
   const consent=await this.write('template-version-consent','/privacy/consents',{policy_version:policy.policy_version,scopes:['SAVE_PRIVATE_TEMPLATE'],action:'GRANT'});
   const template=state.selectedTemplate;await this.write('template-version','/private-templates/'+template.template_id+'/versions',{expected_template_version:template.version,name:this.data.name,schema:this.data.draft,policy_consent_id:consent.consent_id});
   await navigate('MP14');return;
  }
  if(action==='filter-blocker'||action==='filter-all'){this.setData({filter:action==='filter-blocker'?'BLOCKER':''});await this.refresh();return;}
  if(action==='mode-discover'||action==='mode-provided'){if(state.task)throw new Error('当前任务已经提交，切换模式请新建会话。');state.draftMode=action==='mode-discover'?'DISCOVER':'PROVIDED';this.setData({mode:state.draftMode});return;}
  if(action?.startsWith('go-')){await navigate(action.slice(3));return;}
  if(action==='new'){
   if(state.session&&!['CLOSED','FAILED','CANCELED','INITIALIZATION_FAILED'].includes(state.session.status)){
    if(!await confirm('已有整理会话','继续新建会话前关闭当前会话。原始资料会清理，已保存结果继续保留。','关闭并新建'))return;
    await this.write('close-old','/agent-sessions/'+state.session.session_id+'/close',{expected_version:state.session.version,reason:'用户新建整理会话'});}
   clearDraft();const r=await this.write('new','/agent-sessions',{client_request_id:this.key('session-request'),skill_release_id:config.skillReleaseId});
   state.session=await api('/agent-sessions/'+r.session_id);this.setData({text:'',goal:'',notice:'正在准备会话，完成后即可提交资料。'});await this.refresh();return;
  }
  if(action==='add-text'){
   const task=await this.ensureTask();if(!this.data.text.trim())throw new Error('请先粘贴需要整理的文字。');
   await this.write('add-text','/tasks/'+task.task_id+'/sources',{role:'SOURCE',text:this.data.text,expected_task_version:task.version});this.setData({text:'',notice:'文字资料已接收。'});await this.refresh();return;
  }
  if(action==='add-image'||action==='add-office'||action==='add-template'){
   if(!state.capability?.flags[action==='add-template'?'template_input':'file_input'])throw new Error('当前平台构建尚未开放文件入口，可先粘贴文字。');
   const task=await this.ensureTask(),selected=action==='add-image'?await chooseImage():await chooseOffice();if(!selected.path)throw new Error('未选择文件。');
   const bytes=await fileBytes(selected.path),role=action==='add-template'?'TEMPLATE':'SOURCE';
   if(bytes.length>(role==='TEMPLATE'?5000000:20000000))throw new Error('文件超过本次大小限制。');
   const png=bytes[0]===137&&bytes[1]===80,jpeg=bytes[0]===255&&bytes[1]===216,pdf=bytes[0]===37&&bytes[1]===80,zip=bytes[0]===80&&bytes[1]===75;
   const ext=selected.name.toLowerCase().split('.').pop(),mime=png?'image/png':jpeg?'image/jpeg':pdf?'application/pdf':zip&&ext==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':zip?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='csv'?'text/csv':'text/plain';
   const grant=await this.write('upload-grant','/tasks/'+task.task_id+'/upload-sessions',{name:selected.name,bytes:bytes.length,sha256:sha256(bytes),mime,role});
   const observed=await upload(selected.path,grant);const completed=await this.write('upload-complete','/uploads/'+grant.upload_id+'/complete',{observed_hash:observed.observed_sha256});
   if(role==='TEMPLATE')await this.write('standard','/tasks/'+task.task_id+'/standard',{expected_task_version:(await refreshTask()).version,template_source_id:completed.source_id});
   else await this.write('link-source','/tasks/'+task.task_id+'/sources',{role:'SOURCE',source_id:completed.source_id,expected_task_version:(await refreshTask()).version});
   await this.refresh();return;
  }
  if(action==='remove-source'){if(!await confirm('移除资料','只从当前任务的确认范围移除此项，后续方案与费用需要重新确认。','移除资料'))return;
   await api('/tasks/'+state.task.task_id+'/sources/'+id+'?expected_task_version='+state.task.version,'DELETE',null,this.key('remove-'+id));this.done('remove-'+id);await this.refresh();return;}
  if(action==='clear-sources'){if(!writable())throw new Error('当前会话不可调整资料。');const sources=state.task?.sources.filter(s=>s.role!=='TEMPLATE')??[];if(!sources.length)return;
   if(!await confirm('清空来源资料','移除本次全部来源资料；规范文件保留。后续方案和未付报价需要重新确认。','清空资料'))return;
   try{for(const source of sources){await refreshTask();await api('/tasks/'+state.task.task_id+'/sources/'+source.source_id+'?expected_task_version='+state.task.version,'DELETE',null,this.key('remove-'+source.source_id));this.done('remove-'+source.source_id);}}finally{await this.refresh();}return;}
  if(action==='analyze'){
   const task=await this.ensureTask();if(!state.consent){await navigate('MP17');this.setData({notice:'请先阅读并确认资料处理用途，再回来开始分析。'});return;}
   await this.write('analyze','/tasks/'+task.task_id+'/preflight',{agent_session_id:state.session.session_id,source_set_version:task.source_set_version,goal_version:task.goal_version});await navigate('MP05');return;
  }
  if(action==='use-template'){
   state.selectedTemplate=await api('/private-templates/'+id);if(!writable()){await navigate('MP01');this.setData({notice:'已选择规范。请先新建会话。'});return;}
   const task=await this.ensureTask();await this.write('use-template','/tasks/'+task.task_id+'/standard',{fields_schema:state.selectedTemplate.schema,expected_task_version:task.version});await navigate('MP03');return;
  }
  if(action==='adopt'){
   const p=state.proposal,t=await refreshTask();if(!p)throw new Error('规范草案尚未准备好。');
   await this.write('adopt','/tasks/'+t.task_id+'/schema-adoptions',{session_id:state.session.session_id,expected_proposal_version:p.version,expected_source_set_version:t.source_set_version,expected_goal_version:t.goal_version});
   await navigate('MP04');return;
  }
  if(action==='revise-schema'){
   if(!this.data.instruction.trim())throw new Error('请说明需要调整的字段、规则或一行代表的对象。');
   await this.write('revise-schema','/tasks/'+state.task.task_id+'/schema-proposal/revisions',{expected_proposal_version:state.proposal.version,instruction:this.data.instruction});this.setData({notice:'调整要求已提交，完成后请重新审阅。'});await navigate('MP05');return;
  }
  if(action==='save-schema-edit'){const patch=schemaPatch(this.originalSchema,this.data.draft);if(!patch.length)throw new Error('还没有修改字段、规则或行对象。');
   await this.write('structured-schema-edit','/tasks/'+state.task.task_id+'/schema-proposal/revisions',{expected_proposal_version:state.proposal.version,patch});state.quote=null;state.confirmation=null;
   await navigate('MP05');return;}
  if(action==='confirm-plan'){
   if(!state.consent)throw new Error('请先在隐私与数据管理中确认资料处理用途。');const t=await refreshTask(),p=await readPlan();
   if(!p.binding_id)throw new Error('请先采用本次推荐规范。');
   if(p.contract_id)state.confirmation={contract_id:p.contract_id,contract_hash:p.contract_hash,confirmed_plan:p.plan};
   else state.confirmation=await this.write('confirm-plan','/tasks/'+t.task_id+'/confirmations',{session_id:state.session.session_id,plan_id:p.plan.plan_id,plan_version:p.plan.version,plan_hash:p.plan.plan_hash,binding_id:p.binding_id,
    policy_consent_id:state.consent,expected_versions:{task_version:t.version,source_set_version:t.source_set_version,goal_version:t.goal_version}});
   state.quote=await this.write('quote','/tasks/'+t.task_id+'/quotes',{session_id:state.session.session_id,contract_id:state.confirmation.contract_id,confirmed_plan_id:p.plan.plan_id,plan_hash:p.plan.plan_hash,origin_environment:environment()});
   this.setData({quote:state.quote,notice:state.quote.access_mode==='PAID'?'请核对费用与交付内容，再到原平台付款。':'当前环境尚未开放收费批量产出。'});await this.refresh();return;
  }
  if(action==='close-session'){
   if(!state.session||!await confirm('结束本次会话','将停止并清理本次临时资料与环境。已保存结果保留；若原平台之后确认付款，将核对原订单退款。','结束会话'))return;
   await this.write('close-session','/agent-sessions/'+state.session.session_id+'/close',{expected_version:state.session.version,reason:'用户结束本次会话'});await this.refresh();return;
  }
  if(action==='checkout'||action==='continue-checkout'){
   if(state.correction)throw new Error('原单纠错请走售后审核与原实付权益核验。');
   if(!state.order){if(!state.quote?.quote_id||!state.confirmation)throw new Error('请先确认当前方案与费用。');
    state.order=await this.write('order','/orders',{quote_id:state.quote.quote_id,contract_hash:state.confirmation.contract_hash});remember();}
   const checkout=await this.write('checkout','/orders/'+state.order.order_id+'/checkout',{expected_channel:provider});
   try{await pay(checkout.provider_checkout_payload);}finally{state.order=await api('/orders/'+state.order.order_id);remember();this.setData({order:state.order,notice:'收银操作已返回。是否实付以原平台查单为准。'});}return;
  }
  if(action==='start-run'){
   if(!state.order)throw new Error('请先查询原订单。');state.order=await api('/orders/'+state.order.order_id);if(state.order.payment_status!=='CONFIRMED')throw new Error('原平台尚未确认付款，请稍后查询。');
   const context=await orderContext(state.order.order_id);state.task=await api('/tasks/'+context.task_id);state.session=await api('/agent-sessions/'+context.session_id);
   const p=await readPlan();state.run=await this.write('start-run','/tasks/'+state.task.task_id+'/runs',{session_id:state.session.session_id,contract_id:p.contract_id,order_id:state.order.order_id,confirmed_plan_hash:p.plan.plan_hash});remember();await navigate('MP05');return;
  }
  if(action==='view-task'){state.task=await api('/tasks/'+id);state.session=await api('/agent-sessions/'+state.task.agent_session_id);state.run=null;state.proposal=null;remember();await navigate(state.task.current_result_version?'MP08':'MP05');return;}
  if(action==='view-order'){state.order=await api('/orders/'+id);const c=await orderContext(id);state.task=await api('/tasks/'+c.task_id);state.session=await api('/agent-sessions/'+c.session_id);state.run=null;state.proposal=null;state.quote=null;state.confirmation=null;state.resultSchema=null;remember();await navigate('MP16',{order:id});return;}
  if(action==='issue'){state.selectedIssue=this.data.issues.find(i=>i.issue_id===id);await navigate('MP10');return;}
  if(action==='evidence'){await navigate('MP11',{evidence:id});return;}
  if(action==='decision-preview'){
   const i=this.data.issue;if(!this.data.selectedAction)throw new Error('请选择补充、来源选项或继续保留待确认。');
   let d={issue_id:i.issue_id,record_id:i.record_id,field_id:i.field_id,action:this.data.selectedAction};
   if(d.action==='USER_VALUE'){if(!this.data.value.trim())throw new Error('请输入明确的补充值。');const field=state.resultSchema?.fields.find(f=>f.field_id===i.field_id);
    let value=this.data.value;if(field?.type==='INTEGER'){value=Number(value);if(!Number.isSafeInteger(value))throw new Error('请提供有效的安全整数。');}if(field?.type==='BOOLEAN'){if(!['true','false'].includes(value))throw new Error('布尔字段填写 true 或 false。');value=value==='true';}d.user_value=value;}
   if(d.action==='CHOOSE_EVIDENCE')d.evidence_id=this.data.selectedEvidence;
   const r=await this.write('decision-preview','/runs/'+state.run.run_id+'/decision-previews',{expected_result_version:state.run.result_version,decisions:[d],scope:{target_record_ids:[i.record_id]}});this.setData({decisionPreview:r});return;
  }
  if(action==='decision-submit'){
   const p=this.data.decisionPreview;if(!p)throw new Error('请先预览本次修改影响。');
   const r=await this.write('decision-submit','/runs/'+state.run.run_id+'/decisions',{preview_id:p.preview_id,preview_hash:p.preview_hash,expected_result_version:state.run.result_version});
   clearDraft();state.session=await api('/agent-sessions/'+r.new_session_id);remember();await navigate('MP01');return;
  }
  if(action==='copy-file-link'){
   if(!state.capability?.flags.export)throw new Error('当前构建尚未通过结果领取能力验证。');
   const file=this.data.files.find(f=>f.artifact_id===id);if(!file)throw new Error('请刷新文件列表。');
   if(!await confirm('复制此文件的短期领取链接','此链接五分钟内有效，持有链接的人可以领取该文件。请只在自己的设备或可信接收方使用。','复制链接'))return;
   const link=await this.write('copy-link-'+id,'/artifacts/'+id+'/download-link',{expected_result_version:state.run.result_version});await copyFileLink(link.signed_url);
   this.setData({notice:'已复制五分钟领取链接，可在自己的浏览器领取文件。到期后可再次生成；本次复制不表示文件已经保存。'});return;
  }
  if(action==='download'){
   if(!state.capability?.flags.export)throw new Error('当前构建尚未通过结果领取能力验证，请保留任务后稍后领取。');
   const file=this.data.files.find(f=>f.artifact_id===id),attempt=uuid();if(!file)throw new Error('文件信息已更新，请刷新。');
   const observe=async(status)=>this.write('export-'+status,'/artifacts/'+id+'/export-attempts',{client_attempt_id:attempt,observed_action:status,receipt_source:'CLIENT',environment:environment(),observed_at:new Date().toISOString()});
   const link=await this.write('download-link','/artifacts/'+id+'/download-link',{expected_result_version:state.run.result_version});this.localFile=await fetchFile(link.signed_url);await observe('FETCHED');
   const bytes=await fileBytes(this.localFile);if(bytes.length!==file.bytes||sha256(bytes)!==file.sha256)throw new Error('文件完整性校验失败，请重新领取。');
   this.setData({notice:'文件已下载并校验。打开文件不等于已经保存到其他位置。'});
   this.lastDownload={file,attempt};if(file.name.endsWith('.xlsx')){await observe('OPEN_REQUESTED');await openFile(this.localFile);await observe('OPENED');}return;
  }
  if(action==='saved-confirmed'){if(!this.localFile||!this.lastDownload)throw new Error('请先领取文件。');
   const {file,attempt}=this.lastDownload;await this.write('export-user-confirmed','/artifacts/'+file.artifact_id+'/export-attempts',{client_attempt_id:attempt,observed_action:'USER_CONFIRMED',receipt_source:'USER',environment:environment(),observed_at:new Date().toISOString()});
   this.setData({notice:'已记录你的保存确认。结果文件仍可从此任务再次领取。'});return;}
  if(action==='save-template'){
   if(!this.data.name.trim())throw new Error('请填写规范名称。');const policy=await api('/privacy/policies?environment='+environment().provider+'_'+environment().os,'GET',null,null,true);
   if(!await confirm('保存为我的规范','仅保存字段和规则。请确认名称、字段说明与规则中没有本次具体事实或个人资料。','保存规范'))return;
   const consent=await this.write('template-consent','/privacy/consents',{policy_version:policy.policy_version,scopes:['SAVE_PRIVATE_TEMPLATE'],action:'GRANT'});
   await this.write('save-template','/private-templates',{binding_id:state.run.binding_id,name:this.data.name,policy_consent_id:consent.consent_id});this.setData({notice:'规范已保存，仅当前账号可见。'});return;
  }
  if(action==='delete-template'){const t=this.data.templates.find(x=>x.template_id===id);if(!await confirm('删除私有规范','停止以后复用此规范。已经绑定的历史任务快照继续保留。','删除规范'))return;
   await api('/private-templates/'+id+'?expected_template_version='+t.version,'DELETE',null,this.key('delete-template-'+id));this.done('delete-template-'+id);await this.refresh();return;}
  if(action==='consent'||action==='withdraw'){
   const r=await this.write('process-consent','/privacy/consents',{policy_version:this.data.policy.policy_version,scopes:['PROCESS_DATA'],action:action==='consent'?'GRANT':'WITHDRAW'});
   state.consent=action==='consent'?r.consent_id:null;this.setData({notice:action==='consent'?'已确认资料处理用途，请返回继续整理。':'已撤回新的资料处理授权，运行中的任务将停止并清理。'});return;
  }
  if(action==='delete-task'||action==='delete-account'){
   if(action==='delete-task'&&!state.task)throw new Error('请先选择需要删除的任务。');
   if(!await confirm(action==='delete-task'?'删除任务资料与结果':'注销账号',action==='delete-task'?'立即撤销访问，并清理本任务的原始资料、结果与相关摘录。此操作无法恢复。':'停止全部任务并删除账号资料、结果和私有规范。必要支付、退款和删除凭据按说明保留。','确认删除'))return;
   const r=await this.write('delete','/data-deletion-requests',{resource_scope:{kind:action==='delete-task'?'TASK_CONTENT':'ACCOUNT',resource_ids:action==='delete-task'?[state.task.task_id]:[]},confirmation:true});rememberDeletion(r);clearDraft();this.setData({deletion:r,task:null,session:null,records:[],sources:[],fields:[],draft:null,text:'',goal:'',note:'',notice:'访问已撤销，正在清理所选资料。'});return;
  }
  if(action==='deletion-status'){if(this.data.deletion)this.setData({deletion:await api('/data-deletion-requests/'+this.data.deletion.deletion_request_id)});return;}
  if(action==='retry-deletion'){const job=this.data.deletion;if(!job||job.status!=='PARTIAL_FAILED')return;
   const result=await businessTransport('/data-deletion-requests/'+job.deletion_request_id+'/retry','POST',{},this.key('retry-deletion'));this.done('retry-deletion');rememberDeletion(result);this.setData({deletion:result});return;}
  if(action==='cancel'){
   if(!state.run)throw new Error('当前没有生产中的任务。');if(!await confirm('停止整理','停止后会清理本次环境，已保存结果保留。未交付部分按原订单核对退款。','停止整理'))return;
   await this.write('cancel','/runs/'+state.run.run_id+'/cancel',{expected_run_version:state.run.version,reason:'用户停止整理'});await this.refresh();return;
  }
  if(action==='refund'){
   if(!state.order)throw new Error('请选择原订单。');if(!await confirm('申请原路退款','可退金额与状态以原支付平台核验为准。处理中不表示已经到账。','申请退款'))return;
   await this.write('refund','/orders/'+state.order.order_id+'/refund-requests',{reason:this.data.note||'用户申请退款',operation_reference:this.key('refund-reference')});await this.refresh();return;
  }
  if(action==='support'){
   if(!this.data.note.trim())throw new Error('请说明遇到的问题，请勿粘贴支付密码或密钥。');
   const r=await this.write('support','/support/tickets',{category:this.data.category,note:this.data.note,content_access_opt_in:this.data.supportAccess,...(state.task?{task_id:state.task.task_id,expected_task_version:state.task.version}:{})});
   this.setData({notice:'问题已记录，编号 '+r.ticket_id,note:''});return;
  }
  if(action==='support-access'){this.setData({supportAccess:!this.data.supportAccess});return;}
  if(action==='load-more'){
   if(!this.data.nextCursor)return;const cursor=encodeURIComponent(this.data.nextCursor);let path,key;
   if(page==='MP13'){path='/tasks?limit=20&cursor='+cursor;key='tasks';}else if(page==='MP14'){path='/private-templates?limit=20&cursor='+cursor+(this.data.name?'&query='+encodeURIComponent(this.data.name):'');key='templates';}
   else if(page==='MP15'){path='/orders?limit=20&cursor='+cursor;key='orders';}
   else{key=page==='MP09'?'issues':'records';path='/runs/'+state.run.run_id+'/'+key+'?result_version='+state.run.result_version+'&limit=20&cursor='+cursor+(this.data.filter?'&severity='+this.data.filter:'');}
   const r=await api(path),items=r.items??r[key];this.setData({[key]:[...this.data[key],...(key==='records'?items.map(x=>recordView(x,state.resultSchema)):items)],nextCursor:r.next_cursor});return;
  }
  throw new Error('此操作当前不可用，请刷新页面后重试。');
 }
};}
