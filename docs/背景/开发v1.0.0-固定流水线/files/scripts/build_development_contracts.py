"""Generate engine/artifact schemas and executable-spec examples, without running product logic."""
from __future__ import annotations

import copy
import json

from build_development_assets import DEST, DOMAIN, REQS, ROOT, read, write
from build_development_openapi import HASH, ID, SHORT, TIME, arr, enum, integer, nullable, obj, ref, st


def schemas():
    api=json.loads((DEST/'openapi.json').read_text(encoding='utf-8'))
    model=copy.deepcopy(api['components']['schemas'])
    text=json.dumps(model,ensure_ascii=False).replace('#/components/schemas/','#/$defs/')
    library={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:p07:domain:dev1','$defs':json.loads(text),'description':'Schema library generated from OpenAPI. Validate with an explicit #/$defs/<Name> root, not this unrestricted library root.'}
    write('domain.schema.json',library)
    relative=st(pattern=r'^(?!/)(?!.*(?:^|/)\.\.(?:/|$))(?!.*[:\\]).+$',maxLength=1000,description='Project-relative forward slash path. Host verifies resolved path/ACL and reparse-point containment; regex alone is insufficient.')
    request=obj({'protocol_version':{'const':'P07-ENGINE-1'},'attempt_id':ID,'action':enum('PARSE','NORMALIZE','VALIDATE','BUILD'),'input_manifest_path':relative,'output_dir':relative,'deadline_at':TIME,'max_output_bytes':integer(1),'versions':obj({'parser':SHORT,'unitizer':SHORT,'rule_engine':SHORT,'exporter':SHORT}),'binding_sha256':nullable(HASH),'source_set_sha256':HASH})
    event=obj({'protocol_version':{'const':'P07-ENGINE-1'},'attempt_id':ID,'sequence':integer(),'type':enum('PROGRESS','RESULT','ERROR'),'stage':SHORT,'processed_units':integer(),'checkpoint_manifest_path':relative,'output_sha256':HASH,'error_code':SHORT,'retry_class':enum('RETRYABLE','PERMANENT','UNKNOWN_EXTERNAL','USER_ACTION','BUDGET_EXCEEDED')},required=['protocol_version','attempt_id','sequence','type','stage'])
    event['allOf']=[{'if':{'properties':{'type':{'const':'RESULT'}}},'then':{'required':['checkpoint_manifest_path','output_sha256']}},{'if':{'properties':{'type':{'const':'ERROR'}}},'then':{'required':['error_code','retry_class']}}]
    protocol={'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:p07:engine:1','$defs':{'Request':request,'Event':event},'oneOf':[{'$ref':'#/$defs/Request'},{'$ref':'#/$defs/Event'}],'description':'One bounded stdin JSON request; stdout JSONL events. Progress is observation, final RESULT+exit0+readback required. No DB/payment secret.'}
    write('engine-protocol.schema.json',protocol)
    names=['standard.xlsx','standard.json','result.xlsx','accepted.csv','result.json','issues.xlsx','provenance.jsonl','validation.json']
    manifest=obj({'format_version':{'const':'P07-ARTIFACT-1'},'artifact_set_id':ID,'task_id':ID,'run_id':ID,'result_version':integer(1),'binding_sha256':HASH,'source_set_sha256':HASH,'quality_status':enum('PASSED','NEEDS_REVIEW','BLOCKED'),'created_at':TIME,'expires_at':nullable(TIME),'files':arr(obj({'name':enum(*names),'sha256':HASH,'bytes':integer(),'media_type':SHORT}),minItems=8,maxItems=8,uniqueItems=True),'counts':obj({'total_candidates':integer(),'accepted':integer(),'needs_review':integer(),'excluded':integer()}),'versions':obj({'parser':SHORT,'ocr':nullable(SHORT),'model':nullable(SHORT),'prompt':SHORT,'rule':SHORT,'exporter':SHORT}),'limitations':arr(st(maxLength=1500))})
    manifest.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:p07:artifact-manifest:1','description':'Eight payload files only. Check unique names/count sum/readback in domain validator. Manifest own hash returned via API; schema does not prove file facts.'})
    write('artifact-manifest.schema.json',manifest)
    cases=[]
    for r in REQS:
        for ac in r['acceptance_criteria']:
            cases.append({'case_id':'DEVTEST-'+ac['id'].removeprefix('P07-'),'kind':'BUSINESS_ACCEPTANCE','requirement_ids':[r['id']],'reference_ids':[ac['id'],r['primary_test_id']],'expected':ac['criterion'],'environment':'PARAMETERIZE_APPLICABLE_MODES_FORMATS_HOSTS','priority':r['priority'],'execution_status':'NOT_RUN','evidence_refs':[]})
    for group,key,kind in [('assets/requirements/exception-cases.v3.1.json','cases','EXCEPTION'),('assets/requirements/nonfunctional.v3.1.json','requirements','NFR'),('assets/requirements/quality-metrics.v3.1.json','metrics','QUALITY')]:
        data=read(group)
        values=data.get(key)
        if values is None:
            values=next(v for v in data.values() if isinstance(v,list))
        for item in values:
            identifier=item.get('id',item.get('case_id',item.get('metric_id',item.get('nfr_id'))))
            cases.append({'case_id':'DEVTEST-'+identifier,'kind':kind,'requirement_ids':item.get('requirement_ids',[]),'reference_ids':[identifier],'expected':item.get('expected',item.get('requirement',item.get('definition',item.get('description',item.get('title','See source reference'))))),'source_contract':group,'environment':'PARAMETERIZE_REAL_ENVIRONMENT','priority':'P0','execution_status':'NOT_RUN','evidence_refs':[]})
    engineering=[('FENCE','旧worker租约过期后写发布被拒；新worker一次发布'),('BUDGET','重试/子Run累计计算不重置900秒并结清旧预留'),('ROUND','100并发同批次只一个活动operation/预留/child，成功一次消费失败释放'),('PAYMENT_UNKNOWN','支付超时查同原单，不重复收银；正式晚到事实可核后履约或退款'),('REFUND_UNKNOWN','退款提交超时查同merchant_refund_ref，累计成功/在途不超实付'),('PUBLISH_9','第9文件失败整体不READY，旧结果可读，孤儿半包不可见'),('DELETE_PUBLISH','删除与发布竞争，tombstone先胜后不可重新签链/读Range'),('PROVIDED_BIND','已有规范在API10与范围原子绑定，无需先建Run'),('FREE_GRANT','仅服务端明确免费政策发free grant，空价格无虚假通道流水'),('PREFLIGHT_READ','异步预检可通过task.latest_preflight恢复，局部不可采用'),('OBJECT_OWNER','互换源/依据/产物/订单/模板/operation ID全部拒绝'),('RESTORE_DELETE','恢复旧备份先重放新tombstone，再开放访问'),('DOCX_BLOCK','4000码点按固定版本分块、单表行不拆、超长行报告资源限制'),('CSV_FORMULA','文本危险前缀安全转义、真实数值负数仍数值，原值可追'),('SPARSE_FIELD','报价保修稀有字段保留，待议价格不填0/平均数'),('HOST_EXPORT','四环境分别证明用户可见取用，缓存不当交付'),('PROMPT_INJECTION','资料要求忽略规则/付款/抓URL时无工具调用，事实仍校证据'),('SUPPORT_SCOPE','客服无opt-in/跨任务/到期/撤回均拒正文并有审计'),('CONFIG_GATES','未获准SKU/环境/P1默认关闭，不能客户端改OS开支付'),('CANONICAL_HASH','Node/Python对Unicode键/emoji/0/false/null一致P07-CJ1 hash')]
    for ident,expected in engineering:
        cases.append({'case_id':'DEVTEST-ENG-'+ident,'kind':'ENGINEERING_FAULT_OR_BOUNDARY','requirement_ids':[],'reference_ids':[],'expected':expected,'environment':'REAL_POSTGRESQL_OR_DEVICE_AS_APPLICABLE','priority':'P0','execution_status':'NOT_RUN','evidence_refs':[]})
    write('test-plan.json',{'development_baseline':'P07-DEV 1.0.0','status':'PLAN_ONLY_NOT_EXECUTED','cases':cases,'quality_dataset_requirement':{'minimum_groups':30,'minimum_discover_groups':10,'minimum_themes':2,'status':'NOT_PREPARED','annotation':'independent human ground truth; actual file hashes required'},'device_matrix':[{'provider':p,'os':os,'status':'NOT_RUN','build_id':None,'evidence_refs':[]} for p in ['ALIPAY','DOUYIN'] for os in ['ANDROID','IOS']]})


def examples():
    uid=lambda n: f'00000000-0000-4000-8000-{n:012d}'
    version={'task_version':3,'source_set_version':1,'goal_version':1}
    policy={'policy_id':'synthetic-free-policy','retention_policy_id':'synthetic-retention','review_window_seconds':0,'revision_rounds':0,'content_retention_seconds':3600,'delivery_summary':'合成合同示例，不代表正式权益','refund_summary':'免费示例无通道流水','approved_sku_id':None,'effective_at':'2026-10-27T00:00:00Z'}
    values=[
      ('create-discover','Request03',{'mode':'DISCOVER','optional_goal':'比较三家供应商报价，保留价格和保修','client_request_id':uid(1)}),
      ('confirm-discover','Request10',{'mode':'DISCOVER','expected_versions':version,'exclusions':[],'policy_consent_id':uid(2)}),
      ('free-access','Response11',{'request_id':'req_synthetic_free','data':{'access_mode':'FREE','quote_id':None,'free_grant_id':uid(3),'amount':None,'expires_at':'2026-10-27T01:00:00Z','contract_hash':'a'*64,'policy':policy,'commercial_enabled':False,'reason_codes':[]}}),
      ('start-free','Request16',{'contract_id':uid(4),'free_grant':uid(3)}),
      ('adopt-full','Request20',{'expected_proposal_version':2,'expected_source_set_version':1,'expected_goal_version':1}),
      ('choose-user-value','Request24',{'expected_result_version':1,'decisions':[{'issue_id':uid(5),'record_id':uid(6),'field_id':'price','action':'USER_VALUE','user_value':'30.00','note':'用户补充价格，不能记自动提取正确'}],'scope':{'target_record_ids':[uid(6)]}}),
      ('commit-preview','Request25',{'preview_id':uid(7),'preview_hash':'b'*64,'expected_result_version':1})
    ]
    write('contract-examples.json',{'status':'SYNTHETIC_CONTRACT_EXAMPLES_NOT_PRODUCT_TESTS','examples':[{'name':name,'schema':schema,'payload':payload} for name,schema,payload in values],'invalid_examples':[{'name':'discover-cannot-bind-provided-draft','schema':'Request10','payload':{'mode':'DISCOVER','expected_versions':version,'exclusions':[],'policy_consent_id':uid(2),'provided_standard_draft_id':uid(9)}},{'name':'free-cannot-claim-price','schema':'Response11','payload':{'request_id':'req_synthetic_invalid','data':{'access_mode':'FREE','quote_id':None,'free_grant_id':uid(3),'amount':{'amount_minor':100,'amount_unit':'CNY_CENT','provider':'ALIPAY','sku_id':'unapproved-example'},'expires_at':None,'contract_hash':'a'*64,'policy':policy,'commercial_enabled':False,'reason_codes':[]}}}]})


if __name__=='__main__':
    schemas();examples()
    print('Generated engine/artifact/domain schemas, test plan and synthetic contract examples. No product tests run.')
