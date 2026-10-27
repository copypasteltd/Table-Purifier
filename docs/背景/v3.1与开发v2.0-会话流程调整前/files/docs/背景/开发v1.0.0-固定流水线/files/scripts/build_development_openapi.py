"""Generate explicit internal HTTP contracts; does not implement or invoke endpoints."""
from __future__ import annotations

from build_development_assets import APIS, DEST, DOMAIN, write


def obj(props, required=None, **kwargs):
    return {'type':'object','additionalProperties':False,'properties':props,'required':list(props) if required is None else required,**kwargs}


def st(**kwargs): return {'type':'string',**kwargs}
def integer(minimum=0, **kwargs): return {'type':'integer','minimum':minimum,'maximum':9007199254740991,**kwargs}
def enum(*values): return {'type':'string','enum':list(values)}
def arr(item, **kwargs): return {'type':'array','items':item,**kwargs}
def ref(name): return {'$ref':'#/components/schemas/'+name}
def nullable(schema): return {'anyOf':[schema,{'type':'null'}]}


ID=st(format='uuid')
V=integer(1)
TIME=st(format='date-time')
HASH=st(pattern='^[0-9a-f]{64}$')
TEXT=st(maxLength=50000)
SHORT=st(minLength=1,maxLength=200)
BOOL={'type':'boolean'}
JSON_VALUE={'type':['string','integer','boolean','null'],'description':'Decimal serialized as exact string; field binding determines semantic type. No floating JSON monetary value.'}
S={}


def schemas():
    for k,v in DOMAIN['axes'].items(): S[k.title().replace('_','')+'Status']=enum(*v)
    S['Mode']=enum('PROVIDED','DISCOVER')
    S['Provider']=enum('ALIPAY','DOUYIN')
    S['Environment']=obj({'provider':ref('Provider'),'app_alias':SHORT,'os':enum('ANDROID','IOS'),'host_version':SHORT,'base_sdk':SHORT,'build_id':SHORT})
    S['VersionSet']=obj({'task_version':V,'source_set_version':V,'goal_version':V,'proposal_version':nullable(V),'result_version':nullable(V)},required=['task_version','source_set_version','goal_version'])
    S['AllowedActions']=arr(obj({'action':SHORT,'enabled':BOOL,'reason_code':nullable(SHORT),'label':SHORT}),maxItems=30)
    S['Operation']=obj({'operation_id':ID,'status':ref('OperationStatus'),'kind':SHORT,'resource_id':nullable(ID),'resource_kind':nullable(SHORT),'retry_of':nullable(ID),'error_code':nullable(SHORT),'current_versions':ref('VersionSet')},required=['operation_id','status','kind','resource_id','resource_kind','error_code'])
    S['Error']=obj({'request_id':SHORT,'error':obj({'code':SHORT,'message':st(maxLength=500),'retryable':BOOL,'operation_id':nullable(ID),'current_versions':nullable(ref('VersionSet')),'details':arr(obj({'field':SHORT,'code':SHORT,'message':st(maxLength=300)}),maxItems=100)},required=['code','message','retryable'])})
    S['Budget']=obj({k:integer(0 if k=='stage_auto_retries_max' else 1,maximum=v) for k,v in DOMAIN['budget'].items()})
    S['PolicySnapshot']=obj({'policy_id':SHORT,'retention_policy_id':SHORT,'review_window_seconds':integer(),'revision_rounds':integer(),'content_retention_seconds':integer(),'delivery_summary':st(maxLength=1000),'refund_summary':st(maxLength=1000),'approved_sku_id':nullable(SHORT),'effective_at':TIME})
    S['ScopeUnit']=obj({'source_id':ID,'unit_id':ID,'kind':enum('PDF_PAGE','IMAGE','DOCX_BLOCK','TEXT_REGION','SHEET_REGION','CSV_REGION'),'ordinal':integer(),'disposition':enum('READ','UNREADABLE','USER_EXCLUDED'),'reason':nullable(st(maxLength=500))})
    S['Coverage']=obj({'confirmed_units':integer(),'read_units':integer(),'unreadable_units':integer(),'excluded_units':integer(),'scope_sha256':HASH,'limitations':arr(st(maxLength=1000))})
    S['Locator']=obj({'version':SHORT,'kind':enum('TEXT_SPAN','PDF_PAGE','IMAGE_BBOX','DOCX_PATH','SHEET_CELL','CSV_CELL'),'page_or_ordinal':nullable(integer()),'span':nullable(arr(integer(),minItems=2,maxItems=2)),'bbox':nullable(arr({'type':'number','minimum':0,'maximum':1},minItems=4,maxItems=4)),'path':nullable(st(maxLength=500))},required=['version','kind'])
    S['RuleNode']=obj({'op':enum('FIELD','CONST','COMPARE','AND','OR','REQUIRED_IF','DECIMAL_ADD','DECIMAL_SUBTRACT','DECIMAL_MULTIPLY','DECIMAL_DIVIDE'),'field_id':SHORT,'value':JSON_VALUE,'comparator':enum('EQ','NE','GT','GE','LT','LE'),'args':arr(ref('RuleNode'),maxItems=100)},required=['op'],description='Restricted AST. Domain compiler checks op-specific operands, type, max depth/nodes. Never eval strings.')
    S['SchemaField']=obj({'field_id':SHORT,'label':SHORT,'order':integer(),'type':enum('TEXT','DECIMAL','INTEGER','BOOLEAN','DATE','DATETIME','ENUM'),'required':BOOL,'nullable':BOOL,'unit':nullable(SHORT),'scale':nullable(integer(maximum=18)),'description':st(maxLength=1000),'enum_values':arr(st(maxLength=200),maxItems=100),'closed_enum':BOOL},required=['field_id','label','order','type','required','nullable','unit','description'])
    S['SchemaDefinition']=obj({'schema_id':ID,'version':V,'origin':enum('PROVIDED','DISCOVERED','PRIVATE_TEMPLATE','MANUAL'),'purpose':st(maxLength=1000),'row_kind':SHORT,'fields':arr(ref('SchemaField'),minItems=1,maxItems=50),'identity_keys':arr(SHORT,maxItems=50),'rules':arr(ref('RuleNode'),maxItems=100),'locale':SHORT,'timezone':SHORT,'rounding':enum('HALF_UP','HALF_EVEN','NONE'),'export_policy':obj({'version':SHORT,'formula_protection':BOOL,'csv_encoding':enum('UTF-8-BOM'),'csv_separator':enum(',',';','\t')})})
    S['FieldSuggestion']=obj({'field':ref('SchemaField'),'reason':st(maxLength=1500),'evidence_ids':arr(ID),'observed_count':integer(),'relevant_count':integer(),'from_sample':BOOL,'ambiguity':nullable(st(maxLength=1000))})
    S['ChangePreview']=obj({'changed_field_ids':arr(SHORT),'affected_record_ids':arr(ID),'unmapped_important':arr(st(maxLength=1000)),'new_issues':arr(st(maxLength=1000)),'requires_recompute':BOOL})
    S['Proposal']=obj({'proposal_id':ID,'version':V,'status':ref('SchemaStatus'),'source_set_version':V,'goal_version':V,'schema':ref('SchemaDefinition'),'suggestions':arr(ref('FieldSuggestion'),maxItems=50),'coverage':ref('Coverage'),'preview_is_sample':BOOL,'preview_records':arr(ref('Record'),maxItems=5),'unmapped_important':arr(st(maxLength=1000)),'change_preview':nullable(ref('ChangePreview'))})
    S['Source']=obj({'source_id':ID,'role':enum('SOURCE','TEMPLATE'),'name':SHORT,'bytes':integer(),'sha256':HASH,'mime':SHORT,'status':enum(*DOMAIN['source_status']),'expires_at':nullable(TIME),'readability_reason':nullable(st(maxLength=500))})
    S['PreflightReport']=obj({'preflight_id':ID,'status':enum('PENDING','RUNNING','SUCCEEDED','FAILED'),'source_set_version':V,'goal_version':V,'processing_units':integer(),'readability':arr(obj({'source_id':ID,'status':enum('READABLE','PARTIAL','UNREADABLE'),'limitations':arr(st(maxLength=1000))})),'coverage':ref('Coverage'),'partial_proposal_id':nullable(ID),'limits':ref('Budget'),'blocking_reasons':arr(st(maxLength=1000))})
    S['Task']=obj({'task_id':ID,'version':V,'mode':ref('Mode'),'goal':nullable(st(maxLength=1000)),'goal_version':V,'source_set_version':V,'current_run_id':nullable(ID),'current_result_version':nullable(V),'latest_preflight':nullable(ref('PreflightReport')),'sources':arr(ref('Source'),maxItems=11),'allowed_actions':ref('AllowedActions'),'updated_at':TIME})
    S['FieldValue']=obj({'field_id':SHORT,'raw_text':nullable(TEXT),'typed_value':JSON_VALUE,'status':enum(*DOMAIN['field_status']),'evidence_ids':arr(ID),'unit':nullable(SHORT),'transform_chain':arr(obj({'rule_id':SHORT,'version':SHORT,'input_field_ids':arr(SHORT),'description':st(maxLength=500)}))})
    S['Record']=obj({'record_id':ID,'ordinal':integer(),'disposition':enum(*DOMAIN['candidate_disposition']),'fields':arr(ref('FieldValue'),maxItems=50),'issue_ids':arr(ID),'exclusion_reason':nullable(st(maxLength=1000))})
    S['Counts']=obj({'total_candidates':integer(),'accepted':integer(),'needs_review':integer(),'excluded':integer(),'issue_count':integer()},description='First three dispositions sum to total; issue_count may overlap and is not a fourth disposition.')
    S['Issue']=obj({'issue_id':ID,'record_id':nullable(ID),'field_id':nullable(SHORT),'code':SHORT,'severity':enum('INFO','WARNING','BLOCKER'),'message':st(maxLength=1000),'allowed_decisions':arr(enum(*DOMAIN['decision_actions'])),'evidence_ids':arr(ID),'status':enum('OPEN','RESOLVED','KEPT_UNRESOLVED')})
    S['Decision']=obj({'issue_id':ID,'record_id':ID,'field_id':SHORT,'action':enum(*DOMAIN['decision_actions']),'evidence_id':ID,'user_value':JSON_VALUE,'note':st(maxLength=1000)},required=['issue_id','record_id','field_id','action'],description='CHOOSE_EVIDENCE requires evidence_id; USER_VALUE requires non-null value validated to binding; KEEP_UNRESOLVED preserves issue.')
    S['Decision']['allOf']=[
        {'if':{'properties':{'action':{'const':'CHOOSE_EVIDENCE'}}},'then':{'required':['evidence_id'],'not':{'required':['user_value']}}},
        {'if':{'properties':{'action':{'const':'USER_VALUE'}}},'then':{'required':['user_value'],'properties':{'user_value':{'type':['string','integer','boolean']}},'not':{'required':['evidence_id']}}},
        {'if':{'properties':{'action':{'const':'KEEP_UNRESOLVED'}}},'then':{'not':{'anyOf':[{'required':['evidence_id']},{'required':['user_value']}]}}}
    ]
    S['Run']=obj({'run_id':ID,'task_id':ID,'parent_run_id':nullable(ID),'parent_result_version':nullable(V),'version':V,'execution_status':ref('ExecutionStatus'),'schema_status':ref('SchemaStatus'),'quality_status':ref('QualityStatus'),'artifact_status':ref('ArtifactStatus'),'stage':nullable(SHORT),'binding_id':nullable(ID),'result_version':nullable(V),'coverage':ref('Coverage'),'compute_used_ms':integer(),'compute_limit_ms':integer(maximum=900000),'revision_rounds_remaining':integer(),'review_expires_at':nullable(TIME),'allowed_actions':ref('AllowedActions')})
    S['Amount']=obj({'amount_minor':integer(),'amount_unit':SHORT,'provider':ref('Provider'),'sku_id':SHORT},description='Original channel unit; no implicit CNY conversion.')
    S['Order']=obj({'order_id':ID,'contract_id':ID,'version':V,'amount':ref('Amount'),'payment_status':ref('PaymentStatus'),'refund_status':ref('RefundStatus'),'fulfillment_status':ref('FulfillmentStatus'),'refunded_minor':integer(),'allowed_actions':ref('AllowedActions'),'updated_at':TIME})
    S['Refund']=obj({'refund_id':ID,'order_id':ID,'status':ref('RefundStatus'),'amount':ref('Amount'),'operation_id':ID,'retry_of':nullable(ID)})
    S['Artifact']=obj({'artifact_id':ID,'name':enum('standard.xlsx','standard.json','result.xlsx','accepted.csv','result.json','issues.xlsx','provenance.jsonl','validation.json','manifest.json'),'bytes':integer(),'sha256':HASH,'media_type':SHORT,'expires_at':nullable(TIME)})
    S['PrivateTemplate']=obj({'template_id':ID,'version':V,'name':SHORT,'schema':ref('SchemaDefinition'),'sanitizer_version':SHORT,'updated_at':TIME})
    S['DeletionJob']=obj({'deletion_request_id':ID,'operation_id':ID,'status':enum('REQUESTED','ACCESS_REVOKED','PURGING','COMPLETED','PARTIAL_FAILED'),'access_revoked_at':nullable(TIME),'remaining_categories':arr(SHORT),'limitations':arr(st(maxLength=1000))})
    S['Capability']=obj({'capability_version':SHORT,'environment':ref('Environment'),'flags':obj({k:BOOL for k in ['file_input','template_input','preview','export','payment']}),'commercial_enabled':BOOL,'reasons':arr(obj({'action':SHORT,'code':SHORT,'message':st(maxLength=500)}))})
    S['StandardDraft']=obj({'draft_id':ID,'version':V,'schema':nullable(ref('SchemaDefinition')),'clarifications':arr(st(maxLength=1000)),'status':ref('SchemaStatus')})
    S['Ticket']=obj({'ticket_id':ID,'status':enum('OPEN','IN_PROGRESS','RESOLVED','CLOSED'),'content_access_expires_at':nullable(TIME)})


def contracts():
    requests={}
    responses={}
    queries={}
    async_codes={9,15,19,25,27,30,37,40,42}
    def req(n,properties,required=None,**kwargs): requests[n]=obj(properties,required,**kwargs)
    def resp(n,value): responses[n]=value
    def query(n,name,schema,required=False): queries.setdefault(n,[]).append({'name':name,'in':'query','required':required,'schema':schema})
    def page_query(n):
        query(n,'cursor',st(maxLength=4096));query(n,'limit',integer(1,maximum=100,default=20))
    def page_response(item): return obj({'items':arr(item,maxItems=100),'next_cursor':nullable(st(maxLength=4096))})

    req(1,{'provider':ref('Provider'),'app_alias':SHORT,'one_time_code':st(minLength=1,maxLength=4096)})
    resp(1,obj({'session_token':st(minLength=1),'expires_at':TIME,'account_id':ID,'identity_provider':ref('Provider')}))
    for k in ['provider','app_alias','os','host_version','base_sdk','build_id']: query(2,k,S['Environment']['properties'][k],True)
    resp(2,ref('Capability'))
    req(3,{'mode':ref('Mode'),'optional_goal':st(maxLength=1000),'client_request_id':ID},['mode','client_request_id']);resp(3,ref('Task'))
    req(4,{'role':enum('SOURCE','TEMPLATE'),'name':SHORT,'bytes':integer(1,maximum=20000000),'mime':SHORT,'sha256':HASH});resp(4,obj({'upload_id':ID,'method':{'const':'POST'},'limited_upload_target':st(format='uri'),'upload_token':st(minLength=1),'expires_at':TIME,'limits':obj({'bytes':integer(1),'mime':SHORT,'sha256':HASH})}))
    req(5,{'observed_hash':HASH});resp(5,ref('Source'))
    req(6,{'text':st(minLength=1,maxLength=50000),'source_id':ID,'role':{'const':'SOURCE'},'expected_task_version':V},['role','expected_task_version'],oneOf=[{'required':['text'],'not':{'required':['source_id']}},{'required':['source_id'],'not':{'required':['text']}}]);resp(6,obj({'source_set_version':V,'task_version':V,'received_source':ref('Source')}))
    req(7,{'expected_task_version':V,'template_source_id':ID,'private_template_version_id':ID,'fields_schema':ref('SchemaDefinition')},['expected_task_version'],oneOf=[{'required':[k],'not':{'anyOf':[{'required':[o]} for o in ['template_source_id','private_template_version_id','fields_schema'] if o!=k]}} for k in ['template_source_id','private_template_version_id','fields_schema']]);resp(7,ref('StandardDraft'))
    resp(8,ref('StandardDraft'))
    req(9,{'source_set_version':V,'goal_version':V});resp(9,obj({'operation':ref('Operation'),'preflight_id':ID}))
    req(10,{'mode':ref('Mode'),'expected_versions':ref('VersionSet'),'exclusions':arr(obj({'source_id':ID,'unit_ids':arr(ID),'reason':st(minLength=1,maxLength=1000)})),'policy_consent_id':ID,'provided_standard_draft_id':ID,'expected_standard_draft_version':V},['mode','expected_versions','exclusions','policy_consent_id'],allOf=[{'if':{'properties':{'mode':{'const':'PROVIDED'}}},'then':{'required':['provided_standard_draft_id','expected_standard_draft_version']},'else':{'not':{'anyOf':[{'required':['provided_standard_draft_id']},{'required':['expected_standard_draft_version']}]}}}]);resp(10,obj({'contract_id':ID,'contract_version':V,'contract_hash':HASH,'binding_id':nullable(ID),'budget':ref('Budget'),'policy':ref('PolicySnapshot')}))
    req(11,{'contract_id':ID,'origin_environment':ref('Environment')})
    quote_data=obj({'access_mode':enum('PAID','FREE','UNAVAILABLE'),'quote_id':nullable(ID),'free_grant_id':nullable(ID),'amount':nullable(ref('Amount')),'expires_at':nullable(TIME),'contract_hash':HASH,'policy':ref('PolicySnapshot'),'commercial_enabled':BOOL,'reason_codes':arr(SHORT)})
    quote_data['allOf']=[
        {'if':{'properties':{'access_mode':{'const':'PAID'}}},'then':{'properties':{'quote_id':ID,'amount':ref('Amount'),'free_grant_id':{'type':'null'},'commercial_enabled':{'const':True},'expires_at':TIME}}},
        {'if':{'properties':{'access_mode':{'const':'FREE'}}},'then':{'properties':{'quote_id':{'type':'null'},'amount':{'type':'null'},'free_grant_id':ID,'commercial_enabled':{'const':False}}}},
        {'if':{'properties':{'access_mode':{'const':'UNAVAILABLE'}}},'then':{'properties':{'quote_id':{'type':'null'},'amount':{'type':'null'},'free_grant_id':{'type':'null'},'commercial_enabled':{'const':False}}}}
    ]
    resp(11,quote_data)
    req(12,{'quote_id':ID,'contract_hash':HASH});resp(12,ref('Order'))
    req(13,{'expected_channel':ref('Provider')});resp(13,obj({'order_id':ID,'provider':ref('Provider'),'provider_checkout_payload':{'type':'object','additionalProperties':True,'description':'Opaque approved adapter payload. Actual SDK fields and signature must be verified; never produced by a model.'},'expires_at':nullable(TIME)}))
    resp(14,ref('Order'))
    req(15,{'reason':st(minLength=1,maxLength=1000),'operation_reference':ID,'amount_minor':integer(1)},['reason','operation_reference']);resp(15,obj({'operation':ref('Operation'),'refund':ref('Refund')}))
    req(16,{'contract_id':ID,'order_id':ID,'free_grant':ID},['contract_id'],oneOf=[{'required':['order_id'],'not':{'required':['free_grant']}},{'required':['free_grant'],'not':{'required':['order_id']}}]);resp(16,ref('Run'))
    resp(17,ref('Run'));resp(18,ref('Proposal'))
    req(19,{'expected_proposal_version':V,'instruction':st(minLength=1,maxLength=2000),'patch':arr(obj({'op':enum('ADD_FIELD','UPDATE_FIELD','REMOVE_FIELD','SET_ROW_KIND','SET_RULES'),'field_id':SHORT,'field':ref('SchemaField'),'row_kind':SHORT,'rules':arr(ref('RuleNode'))},['op']),minItems=1,maxItems=100)},['expected_proposal_version'],oneOf=[{'required':['instruction'],'not':{'required':['patch']}},{'required':['patch'],'not':{'required':['instruction']}}]);resp(19,obj({'operation':ref('Operation'),'proposal_id':ID}))
    req(20,{'expected_proposal_version':V,'expected_source_set_version':V,'expected_goal_version':V});resp(20,obj({'binding_id':ID,'schema_version':V,'binding_hash':HASH,'run':ref('Run')}))
    for n in [21,22]:
        query(n,'result_version',V,True);page_query(n)
    query(21,'disposition',enum(*DOMAIN['candidate_disposition']));query(21,'fields',st(maxLength=3000,description='Comma-separated stable field IDs; field whitelist checked against binding.'))
    resp(21,obj({'result_version':V,'records':arr(ref('Record'),maxItems=100),'counts':ref('Counts'),'next_cursor':nullable(st(maxLength=4096))}))
    query(22,'severity',enum('INFO','WARNING','BLOCKER'));query(22,'type',SHORT);resp(22,obj({'result_version':V,'issues':arr(ref('Issue'),maxItems=100),'affected_records':integer(),'next_cursor':nullable(st(maxLength=4096))}))
    resp(23,obj({'evidence_id':ID,'source_id':ID,'source_unit_id':ID,'excerpt':nullable(TEXT),'locator':ref('Locator'),'authorized_page_url':nullable(st(format='uri')),'expires_at':nullable(TIME),'limitations':arr(st(maxLength=1000))}))
    req(24,{'expected_result_version':V,'decisions':arr(ref('Decision'),minItems=1,maxItems=1000),'scope':obj({'target_record_ids':arr(ID,maxItems=1000),'predicate_hash':HASH},['target_record_ids'])});resp(24,obj({'preview_id':ID,'preview_hash':HASH,'expires_at':TIME,'affected_records':integer(),'exceptions':arr(obj({'record_id':ID,'reason':st(maxLength=1000)})),'impact':ref('ChangePreview'),'will_reserve_rounds':integer(maximum=1),'billing_class':enum('USER_REVISION','PLATFORM_CORRECTION')}))
    req(25,{'preview_id':ID,'preview_hash':HASH,'expected_result_version':V});resp(25,obj({'operation':ref('Operation'),'decision_batch_id':ID,'child_run_id':ID}))
    resp(26,ref('Operation'))
    req(27,{'decision_batch_id':ID,'expected_result_version':V});resp(27,obj({'operation':ref('Operation'),'child_run_id':ID,'authorized_retry':BOOL}))
    query(28,'result_version',V,True);resp(28,obj({'artifact_set_id':ID,'result_version':V,'status':ref('ArtifactStatus'),'quality':ref('QualityStatus'),'manifest_hash':HASH,'artifacts':arr(ref('Artifact'),minItems=9,maxItems=9),'expires_at':nullable(TIME)}))
    req(29,{'expected_result_version':V});resp(29,obj({'signed_url':st(format='uri'),'ttl_seconds':integer(1,maximum=300),'sha256':HASH,'bytes':integer()}))
    req(30,{'expected_run_version':V,'reason':st(maxLength=1000)});resp(30,obj({'operation':ref('Operation'),'resolved_status':ref('ExecutionStatus')}))
    req(31,{'category':SHORT,'note':st(maxLength=2000),'content_access_opt_in':BOOL,'task_id':ID},['category','note','content_access_opt_in']);resp(31,ref('Ticket'))
    req(32,{'binding_id':ID,'name':SHORT,'policy_consent_id':ID});resp(32,ref('PrivateTemplate'))
    req(33,{'client_attempt_id':ID,'observed_action':ref('ExportObservationStatus'),'receipt_source':enum('CLIENT','USER'),'environment':ref('Environment'),'observed_at':TIME,'receipt_ref':st(maxLength=1000)},['client_attempt_id','observed_action','receipt_source','environment','observed_at']);resp(33,obj({'export_attempt_id':ID,'accepted_observation':ref('ExportObservationStatus')},description='Client cannot claim VERIFIED_PLATFORM. This endpoint never directly sets DELIVERED.'))
    page_query(34);query(34,'query',st(maxLength=200));resp(34,page_response(ref('PrivateTemplate')))
    query(35,'environment',enum('ALIPAY_ANDROID','ALIPAY_IOS','DOUYIN_ANDROID','DOUYIN_IOS'),True);query(35,'policy_version',SHORT)
    resp(35,obj({'policy_version':SHORT,'policy_id':ID,'purposes':arr(st(maxLength=1000)),'processors':arr(obj({'name':SHORT,'purpose':SHORT,'region':SHORT,'retention':st(maxLength=1000),'deletion_limitations':st(maxLength=1000)})),'retention_categories':arr(obj({'category':SHORT,'policy_id':SHORT,'duration_seconds':nullable(integer()),'limitations':st(maxLength=1000)}))}))
    req(36,{'policy_version':SHORT,'scopes':arr(SHORT,minItems=1),'action':enum('GRANT','WITHDRAW')});resp(36,obj({'consent_id':ID,'effect':enum('RECORDED','NEW_PROCESSING_STOPPED','WITHDRAWAL_PENDING_REVIEW'),'effective_at':TIME}))
    req(37,{'resource_scope':obj({'kind':enum('TASK_CONTENT','PRIVATE_TEMPLATE','ACCOUNT'),'resource_ids':arr(ID,maxItems=1000)},['kind','resource_ids']),'confirmation':{'const':True}});resp(37,ref('DeletionJob'))
    req(38,{'current_verified_identity_id':ID,'target_provider':ref('Provider')});resp(38,obj({'challenge_id':ID,'expires_at':TIME},description='Optional P1. No implicit merge or cross-platform paid entitlement transfer.'))
    query(39,'environment',enum('ALIPAY_ANDROID','ALIPAY_IOS','DOUYIN_ANDROID','DOUYIN_IOS'),True);resp(39,obj({'capability':ref('Capability'),'gates':arr(obj({'gate_id':SHORT,'status':enum('PASS','FAIL','NOT_RUN'),'evidence_refs':arr(SHORT)})),'evidence_index':arr(SHORT)}))
    req(40,{'expected_project_version':V,'new_sources':arr(ID,minItems=1,maxItems=10)});resp(40,obj({'operation':ref('Operation'),'new_contract_id':nullable(ID),'impact':ref('ChangePreview')}))
    query(41,'format',SHORT,True);query(41,'mode',ref('Mode'),True);resp(41,obj({'format':SHORT,'supported':BOOL,'limits':ref('Budget'),'price_contract_required':BOOL,'limitations':arr(st(maxLength=1000))}))
    req(42,{'contract_id':ID,'payment_permission_ref':SHORT,'callback_endpoint_id':SHORT},['contract_id','payment_permission_ref']);resp(42,obj({'operation':ref('Operation'),'async_run_id':ID,'settlement_reference':nullable(SHORT)}))
    query(43,'task_id',ID,True);resp(43,obj({'task':ref('Task'),'run':nullable(ref('Run')),'allowed_actions':ref('AllowedActions')}))
    page_query(44);query(44,'mode',ref('Mode'));resp(44,page_response(ref('Task')))
    resp(45,ref('Task'))
    query(46,'expected_task_version',V,True);resp(46,obj({'task_version':V,'source_set_version':V,'removed_source_id':ID}))
    resp(47,ref('PrivateTemplate'))
    req(48,{'expected_template_version':V,'name':SHORT,'schema':ref('SchemaDefinition'),'policy_consent_id':ID});resp(48,ref('PrivateTemplate'))
    query(49,'expected_template_version',V,True);resp(49,obj({'template_id':ID,'future_reuse_revoked':BOOL,'historical_bindings_retained':BOOL}))
    resp(50,ref('DeletionJob'))
    page_query(51);query(51,'payment_status',ref('PaymentStatus'));resp(51,page_response(ref('Order')))
    req(52,{'category':SHORT,'note':st(maxLength=2000),'task_id':ID,'expected_task_version':V,'content_access_opt_in':BOOL},['category','note','content_access_opt_in'],dependentRequired={'task_id':['expected_task_version']});resp(52,ref('Ticket'))

    paths={}
    common_errors={str(n):{'description':d,'content':{'application/json':{'schema':ref('Error')}}} for n,d in [(400,'Invalid request'),(401,'Authentication required or expired'),(403,'Capability/permission/license guard'),(404,'Unavailable resource, including wrong owner'),(409,'Version/idempotency/business conflict'),(410,'Content/grant expired or revoked'),(413,'Size/resource limit exceeded'),(415,'Unsupported media'),(422,'Semantic/rule error'),(429,'Rate limited'),(503,'Dependency unavailable or P1 disabled')]}
    for a in APIS:
        n=int(a['id'][-2:]);method=a['method'].lower();path=a['path']
        op={'operationId':a['id'],'summary':a['name'],'description':a['guards']+'。开发合同；未实现/未验收。','tags':[module_for(n)],'security':[{'ConsumerSession':[]}],'parameters':[],'responses':dict(common_errors),'x-requirement-ids':a['requirement_ids'],'x-priority':a['priority'],'x-implementation-status':'NOT_IMPLEMENTED'}
        for name in __import__('re').findall(r'{([^}]+)}',path):
            op['parameters'].append({'name':name,'in':'path','required':True,'schema':enum('alipay','douyin') if name=='provider' else ID})
        op['parameters']+=queries.get(n,[])
        if n==53:
            op['security']=[]
            op['x-auth-mode']='PROVIDER_RAW_SIGNATURE_REQUIRED'
            op['x-version-guard']='server transaction locks original order/refund; no invented provider expected_version'
            op['x-idempotency']='provider event/fact key; do not require custom Idempotency-Key from provider'
            op['requestBody']={'required':True,'description':'Exact original provider bytes. Signature headers/media/ACK determined by verified channel adapter.','content':{'*/*':{'schema':st(format='binary')}}}
            op['responses']={'200':{'description':'Only verified/recognized event accepted. Exact channel ACK/media is unresolved until approved provider integration; no generic JSON ACK is prescribed.'},'400':common_errors['400'],'403':common_errors['403'],'503':common_errors['503']}
        else:
            if a['idempotency_required']:
                op['parameters'].append({'name':'Idempotency-Key','in':'header','required':True,'schema':st(minLength=16,maxLength=128),'description':'Stable action key; same owner/route/key with different canonical payload returns 409.'})
            if n in requests:
                S['Request'+str(n).zfill(2)]=requests[n]
                op['requestBody']={'required':True,'content':{'application/json':{'schema':ref('Request'+str(n).zfill(2))}}}
            S['Data'+str(n).zfill(2)]=responses[n]
            S['Response'+str(n).zfill(2)]=obj({'request_id':SHORT,'data':ref('Data'+str(n).zfill(2))})
            success='202' if n in async_codes else '201' if n in {3,4,10,12,16,20,32,38,48} else '200'
            op['responses'][success]={'description':'Persisted acceptance; inspect operation for final outcome.' if success=='202' else 'Versioned authorized resource','content':{'application/json':{'schema':ref('Response'+str(n).zfill(2))}},'headers':{'Cache-Control':{'schema':{'const':'no-store'}}}}
            if n in {1,2,35}: op['security']=[]
            if n==39: op['security']=[{'OperatorSession':[]}]
            if n==42: op['security']=[{'ScopedDeveloperKey':[]}]
            if n in {38,40,41,42,43}: op['x-default-enabled']=False
        paths.setdefault(path,{})[method]=op
    document={'openapi':'3.1.1','jsonSchemaDialect':'https://json-schema.org/draft/2020-12/schema','info':{'title':'表格修复站 / internal business API','version':'1.0.0-dev-contract','description':'Business v3.1 / Design B1.0.0 / P07-DEV1.0.0. All operations NOT_IMPLEMENTED. Platform SDK/signature payloads remain provider integration contracts.'},'servers':[{'url':'http://127.0.0.1:7307','description':'Local development proposal; no server running'}],'paths':paths,'components':{'schemas':S,'securitySchemes':{'ConsumerSession':{'type':'http','scheme':'bearer','description':'Our revocable opaque consumer session, not a platform token.'},'OperatorSession':{'type':'http','scheme':'bearer','description':'Internal role-limited session; ordinary consumer token rejected.'},'ScopedDeveloperKey':{'type':'apiKey','in':'header','name':'X-P07-Developer-Key','description':'P1 internal API key, not platform payment signature.'}}}}
    write('openapi.json',document)


def module_for(n):
    if n in {1,2,35,36,37,38,39,50}:return 'identity-capability-privacy'
    if n in {12,13,14,15,31,51,52,53}:return 'commerce-support'
    if n in {32,33,34,47,48,49}:return 'templates-export'
    if n in {40,41,42,43}:return 'P1-extension'
    if n<=11 or n in {44,45,46}:return 'intake-contract'
    return 'run-schema-decision-artifact'


def transport():
    def parameter(name,where,schema):return {'name':name,'in':where,'required':True,'schema':schema}
    doc={'openapi':'3.1.1','info':{'title':'P07 controlled transport and health contract','version':'1.0.0-dev-contract','description':'Infrastructure endpoints supporting existing business APIs; NOT_IMPLEMENTED.'},'paths':{
      '/transport/v1/uploads/{upload_id}':{'post':{'operationId':'P07-TRANSPORT-UPLOAD','parameters':[parameter('upload_id','path',ID)],'security':[{'UploadGrant':[]}],'requestBody':{'required':True,'content':{'multipart/form-data':{'schema':obj({'file':st(format='binary')})}}},'responses':{'200':{'description':'Staged bytes received; business API05 still required.','content':{'application/json':{'schema':obj({'upload_id':ID,'observed_bytes':integer(),'observed_sha256':HASH})}}},'403':{'description':'Expired/revoked/wrong-purpose upload grant'},'413':{'description':'Stream limit exceeded'}}}},
      '/transport/v1/downloads/{grant_id}':{'get':{'operationId':'P07-TRANSPORT-DOWNLOAD','parameters':[parameter('grant_id','path',ID),parameter('token','query',st(minLength=1)),{'name':'Range','in':'header','required':False,'schema':st(pattern='^bytes=[0-9]+-[0-9]*$')}],'security':[],'x-auth-mode':'DOWNLOAD_GRANT_TOKEN_REQUIRED','description':'Every GET/Range checks token hash, owner binding, expiry, result version and tombstone/revocation. Never log query. In-flight/already downloaded bytes cannot be recalled.','responses':{'200':{'description':'Authorized immutable file','content':{'application/octet-stream':{'schema':st(format='binary')}}},'206':{'description':'Authorized single byte range','content':{'application/octet-stream':{'schema':st(format='binary')}}},'403':{'description':'Invalid or revoked grant'},'410':{'description':'Content expired'},'416':{'description':'Invalid range'}}}},
      '/health/live':{'get':{'operationId':'P07-HEALTH-LIVE','security':[],'responses':{'200':{'description':'Process alive; no internal details','content':{'application/json':{'schema':obj({'status':{'const':'alive'}})}}}}}},
      '/health/ready':{'get':{'operationId':'P07-HEALTH-READY','security':[],'responses':{'200':{'description':'DB migration, object store and required config ready','content':{'application/json':{'schema':obj({'status':{'const':'ready'}})}}},'503':{'description':'Not ready; safe summary only'}}}}
    },'components':{'securitySchemes':{'UploadGrant':{'type':'http','scheme':'bearer','description':'Single-purpose upload token from API04; not consumer session.'}}}}
    write('transport.openapi.json',doc)


if __name__=='__main__':
    schemas();contracts();transport()
    print('Generated 53 explicit business API contracts and 4 infrastructure transport/health operations. No HTTP services invoked.')
