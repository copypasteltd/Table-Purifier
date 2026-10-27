"""Build reviewable development reference assets. Never connects to DB or providers."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/development/v1.0.0'


def read(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8-sig'))


def write(name, value):
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


DOMAIN = read('assets/contracts/domain-contract.v3.1.json')
APIS = read('assets/contracts/api-catalog.v3.1.json')['operations']
REQS = read('assets/requirements/requirements.v3.1.json')['requirements']
TRACE = read('assets/requirements/traceability.v3.1.json')['rows']
PAGES = read('assets/requirements/pages.v3.1.json')['pages']
COMPONENTS = read('assets/design/b-jade-folders/v1.0.0/specs/components.json')['components']


def sql_enum(values):
    return ', '.join("'" + v + "'" for v in values)


def database():
    tables = []

    def add(name, purpose, columns, refs=(), checks=(), unique=(), indexes=(), owner=True, retention='CONTENT'):
        c = {'id': 'uuid PRIMARY KEY'}
        if owner:
            c['owner_id'] = 'uuid NOT NULL'
        c.update(columns)
        c.setdefault('created_at', 'timestamptz NOT NULL DEFAULT now()')
        relations = []
        if owner:
            relations.append({'columns': ['owner_id'], 'table': 'accounts', 'target_columns': ['id']})
        for col, target in refs:
            if owner:
                relations.append({'columns': ['owner_id', col], 'table': target, 'target_columns': ['owner_id', 'id']})
            else:
                relations.append({'columns': [col], 'table': target, 'target_columns': ['id']})
        u = ([['owner_id', 'id']] if owner else []) + [list(x) for x in unique]
        tables.append({'name': name, 'purpose': purpose, 'owner_scoped': owner, 'retention_category': retention,
                       'columns': [{'name': k, 'sql': v} for k, v in c.items()], 'foreign_keys': relations,
                       'checks': list(checks), 'unique': u, 'indexes': list(indexes), 'status': 'REFERENCE_NOT_EXECUTED'})

    axis = lambda key, col: f"{col} IN ({sql_enum(DOMAIN['axes'][key])})"
    j = "jsonb NOT NULL DEFAULT '{}'::jsonb"
    ver = 'bigint NOT NULL DEFAULT 1 CHECK (version >= 1)'
    add('accounts', '隔离账户，不按昵称/手机号跨端合并', {'status': "text NOT NULL CHECK (status IN ('ACTIVE','DELETION_PENDING','CLOSED'))", 'version': ver}, owner=False, retention='ACCOUNT')
    add('platform_identities', '真实平台身份映射', {'provider': "text NOT NULL CHECK (provider IN ('ALIPAY','DOUYIN'))", 'app_alias': 'text NOT NULL', 'subject_cipher_ref': 'text NOT NULL', 'subject_hash': 'text NOT NULL', 'verified_at': 'timestamptz NOT NULL'}, unique=[('provider','app_alias','subject_hash')], retention='ACCOUNT')
    add('sessions', '可撤销会话，只存token摘要', {'identity_id': 'uuid NOT NULL','token_hash': 'text NOT NULL','expires_at':'timestamptz NOT NULL','revoked_at':'timestamptz'}, refs=[('identity_id','platform_identities')], unique=[('token_hash',)], retention='AUTH')
    add('tasks', '草稿与当前工作区指针', {'mode': "text NOT NULL CHECK (mode IN ('PROVIDED','DISCOVER'))",'goal':'text','goal_version':'bigint NOT NULL DEFAULT 1','version':ver,'epoch':'bigint NOT NULL DEFAULT 1','current_source_set_id':'uuid','current_run_id':'uuid','current_result_id':'uuid','updated_at':'timestamptz NOT NULL DEFAULT now()','deleted_at':'timestamptz'}, refs=[('current_source_set_id','source_sets'),('current_run_id','runs'),('current_result_id','result_versions')], indexes=['CREATE INDEX tasks_owner_recent ON p07.tasks(owner_id, updated_at DESC, id DESC)'])
    add('source_files', '原件与直接文本受控对象', {'role':"text NOT NULL CHECK (role IN ('SOURCE','TEMPLATE'))",'kind':"text NOT NULL CHECK (kind IN ('FILE','TEXT'))",'display_name':'text NOT NULL','media_type':'text NOT NULL','byte_count':'bigint NOT NULL CHECK (byte_count >= 0)','content_sha256':'text NOT NULL','object_key':'text NOT NULL','status':'text NOT NULL','duplicate_of':'uuid','expires_at':'timestamptz','deleted_at':'timestamptz'}, refs=[('duplicate_of','source_files')], checks=[f"status IN ({sql_enum(DOMAIN['source_status'])})", "content_sha256 ~ '^[0-9a-f]{64}$'"], unique=[('object_key',)])
    add('upload_sessions', '逐文件一次用途许可及接收状态', {'task_id':'uuid NOT NULL','role':"text NOT NULL CHECK (role IN ('SOURCE','TEMPLATE'))",'expected_bytes':'bigint NOT NULL CHECK(expected_bytes > 0)','expected_sha256':'text NOT NULL','expected_mime':'text NOT NULL','display_name':'text NOT NULL','token_hash':'text NOT NULL','expires_at':'timestamptz NOT NULL','status':"text NOT NULL CHECK(status IN ('ISSUED','RECEIVING','RECEIVED','COMPLETED','FAILED','EXPIRED'))",'source_id':'uuid','received_object_key':'text'},refs=[('task_id','tasks'),('source_id','source_files')],unique=[('token_hash',)])
    add('task_source_links','草稿资料队列，规范角色分开',{'task_id':'uuid NOT NULL','source_id':'uuid NOT NULL','role':"text NOT NULL CHECK(role IN ('SOURCE','TEMPLATE'))",'ordinal':'integer NOT NULL CHECK(ordinal >= 0)','removed_at':'timestamptz'},refs=[('task_id','tasks'),('source_id','source_files')],unique=[('task_id','source_id','role')])
    add('source_sets','不可变来源集版本',{'task_id':'uuid NOT NULL','version':ver,'content_sha256':'text NOT NULL','unitizer_version':'text NOT NULL','scope_summary':j},refs=[('task_id','tasks')],unique=[('task_id','version')])
    add('source_set_items','冻结来源/排除及实测摘要',{'source_set_id':'uuid NOT NULL','source_id':'uuid NOT NULL','role':"text NOT NULL CHECK(role IN ('SOURCE','TEMPLATE'))",'ordinal':'integer NOT NULL','included':'boolean NOT NULL','exclusion_reason':'text','source_sha256':'text NOT NULL','scope':j},refs=[('source_set_id','source_sets'),('source_id','source_files')],unique=[('source_set_id','source_id','role')],checks=['included OR exclusion_reason IS NOT NULL'])
    add('preflights','有限语义/全范围可读性预检',{'task_id':'uuid NOT NULL','source_set_id':'uuid NOT NULL','goal_version':'bigint NOT NULL','status':"text NOT NULL CHECK(status IN ('PENDING','RUNNING','SUCCEEDED','FAILED'))",'semantic_units_used':'integer NOT NULL DEFAULT 0 CHECK(semantic_units_used BETWEEN 0 AND 3)','report':j,'operation_id':'uuid'},refs=[('task_id','tasks'),('source_set_id','source_sets'),('operation_id','operations')])
    add('processing_contracts','不可变确认范围/预算/政策',{'task_id':'uuid NOT NULL','version':ver,'source_set_id':'uuid NOT NULL','goal_version':'bigint NOT NULL','mode':"text NOT NULL CHECK(mode IN ('PROVIDED','DISCOVER'))",'schema_binding_id':'uuid','contract_sha256':'text NOT NULL','policy_snapshot':j,'budget_snapshot':j,'confirmed_at':'timestamptz NOT NULL','expires_at':'timestamptz'},refs=[('task_id','tasks'),('source_set_id','source_sets'),('schema_binding_id','schema_bindings')],unique=[('owner_id','contract_sha256'),('task_id','version')],retention='CONTRACT_MINIMAL')
    add('quotes','原单位不可变报价',{'contract_id':'uuid NOT NULL','provider':'text NOT NULL','app_alias':'text NOT NULL','os':'text NOT NULL','sku_id':'text NOT NULL','amount_minor':'bigint NOT NULL CHECK(amount_minor >= 0)','amount_unit':'text NOT NULL','expires_at':'timestamptz NOT NULL','capability_version':'text NOT NULL','policy_snapshot':j,'quote_sha256':'text NOT NULL'},refs=[('contract_id','processing_contracts')],retention='FINANCIAL')
    add('orders','原渠道订单，三轴分开',{'contract_id':'uuid NOT NULL','quote_id':'uuid NOT NULL','provider':'text NOT NULL','app_alias':'text NOT NULL','sku_id':'text NOT NULL','amount_minor':'bigint NOT NULL CHECK(amount_minor >= 0)','amount_unit':'text NOT NULL','payment_status':'text NOT NULL','refund_status':'text NOT NULL','fulfillment_status':'text NOT NULL','refunded_minor':'bigint NOT NULL DEFAULT 0','refund_reserved_minor':'bigint NOT NULL DEFAULT 0','version':ver,'updated_at':'timestamptz NOT NULL DEFAULT now()'},refs=[('contract_id','processing_contracts'),('quote_id','quotes')],checks=[axis('payment','payment_status'),axis('refund','refund_status'),axis('fulfillment','fulfillment_status'),'refunded_minor >= 0 AND refund_reserved_minor >= 0 AND refunded_minor + refund_reserved_minor <= amount_minor'],unique=[('owner_id','contract_id')],indexes=['CREATE INDEX orders_owner_recent ON p07.orders(owner_id, updated_at DESC, id DESC)'],retention='FINANCIAL')
    add('payment_attempts','同商户引用查回原单',{'order_id':'uuid NOT NULL','provider':'text NOT NULL','merchant_reference':'text NOT NULL','provider_order_ref':'text','state':'text NOT NULL','request_object_ref':'text','last_checked_at':'timestamptz'},refs=[('order_id','orders')],unique=[('provider','merchant_reference'),('provider','provider_order_ref')],retention='FINANCIAL')
    add('platform_events','原始验签交易事件去重',{'provider':'text NOT NULL','provider_event_key':'text NOT NULL','order_id':'uuid NOT NULL','event_kind':'text NOT NULL','raw_object_ref':'text','verified_at':'timestamptz NOT NULL','event_summary':j,'processed_at':'timestamptz'},refs=[('order_id','orders')],unique=[('provider','provider_event_key')],retention='FINANCIAL')
    add('payment_ledger','不可变支付/退款事实，原单位',{'order_id':'uuid NOT NULL','provider':'text NOT NULL','provider_fact_key':'text NOT NULL','kind':"text NOT NULL CHECK(kind IN ('PAYMENT','REFUND','FEE','ADJUSTMENT'))",'amount_minor':'bigint NOT NULL CHECK(amount_minor >= 0)','amount_unit':'text NOT NULL','fact_at':'timestamptz NOT NULL','event_id':'uuid'},refs=[('order_id','orders'),('event_id','platform_events')],unique=[('provider','provider_fact_key','kind')],retention='FINANCIAL')
    add('refunds','退款预留与原单重查',{'order_id':'uuid NOT NULL','provider':'text NOT NULL','merchant_refund_ref':'text NOT NULL','provider_refund_ref':'text','amount_minor':'bigint NOT NULL CHECK(amount_minor > 0)','amount_unit':'text NOT NULL','status':'text NOT NULL','reason':'text NOT NULL','retry_of':'uuid','operation_id':'uuid','last_checked_at':'timestamptz'},refs=[('order_id','orders'),('retry_of','refunds'),('operation_id','operations')],checks=[axis('refund','status')],unique=[('provider','merchant_refund_ref')],retention='FINANCIAL')
    add('entitlement_grants','明确免费/原单已付许可',{'contract_id':'uuid NOT NULL','order_id':'uuid','kind':"text NOT NULL CHECK(kind IN ('FREE','PAID'))",'policy_snapshot':j,'revision_limit':'integer NOT NULL CHECK(revision_limit >= 0)','revision_consumed':'integer NOT NULL DEFAULT 0','revision_reserved':'integer NOT NULL DEFAULT 0','expires_at':'timestamptz','revoked_at':'timestamptz','version':ver},refs=[('contract_id','processing_contracts'),('order_id','orders')],checks=["(kind = 'FREE' AND order_id IS NULL) OR (kind = 'PAID' AND order_id IS NOT NULL)",'revision_consumed >= 0 AND revision_reserved >= 0 AND revision_consumed + revision_reserved <= revision_limit'],unique=[('owner_id','contract_id')],retention='CONTRACT_MINIMAL')
    add('runs','执行实例，终态保持，修订新建子Run',{'task_id':'uuid NOT NULL','contract_id':'uuid NOT NULL','grant_id':'uuid NOT NULL','parent_run_id':'uuid','parent_result_id':'uuid','decision_batch_id':'uuid','execution_status':'text NOT NULL','schema_status':'text NOT NULL','quality_status':'text NOT NULL','version':ver,'epoch':'bigint NOT NULL','schema_binding_id':'uuid','current_stage':'text','cancel_requested_at':'timestamptz','finished_at':'timestamptz'},refs=[('task_id','tasks'),('contract_id','processing_contracts'),('grant_id','entitlement_grants'),('parent_run_id','runs'),('parent_result_id','result_versions'),('decision_batch_id','decision_batches'),('schema_binding_id','schema_bindings')],checks=[axis('execution','execution_status'),axis('schema','schema_status'),axis('quality','quality_status')],indexes=["CREATE UNIQUE INDEX runs_one_root_per_contract ON p07.runs(owner_id, contract_id) WHERE parent_run_id IS NULL", "CREATE UNIQUE INDEX runs_one_active_per_task ON p07.runs(owner_id, task_id) WHERE execution_status IN ('QUEUED','RUNNING','WAITING_SCHEMA')"])
    add('run_budget_events','同合同累计预算幂等计量',{'contract_id':'uuid NOT NULL','run_id':'uuid NOT NULL','attempt_id':'uuid','event_key':'text NOT NULL','kind':"text NOT NULL CHECK(kind IN ('RESERVE','CONSUME','RELEASE','ADJUST'))",'compute_ms':'bigint NOT NULL CHECK(compute_ms >= 0)','usage':j,'estimated':'boolean NOT NULL DEFAULT false'},refs=[('contract_id','processing_contracts'),('run_id','runs'),('attempt_id','stage_attempts')],unique=[('contract_id','event_key')],retention='USAGE')
    add('stage_attempts','一次阶段租约与检查点',{'run_id':'uuid NOT NULL','job_id':'uuid NOT NULL','stage':'text NOT NULL','attempt_no':'integer NOT NULL CHECK(attempt_no > 0)','fence':'bigint NOT NULL CHECK(fence > 0)','input_sha256':'text NOT NULL','status':"text NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED','LOST'))",'provider_request_ref':'text','checkpoint_key':'text','versions':j,'started_at':'timestamptz NOT NULL','finished_at':'timestamptz','error_code':'text'},refs=[('run_id','runs'),('job_id','jobs')],unique=[('run_id','stage','attempt_no')])
    add('parse_manifests','不可变解析版本与资源计量',{'source_id':'uuid NOT NULL','source_set_id':'uuid NOT NULL','attempt_id':'uuid NOT NULL','parser_version':'text NOT NULL','unitizer_version':'text NOT NULL','object_key':'text NOT NULL','unit_count':'integer NOT NULL CHECK(unit_count >= 0)','manifest_sha256':'text NOT NULL'},refs=[('source_id','source_files'),('source_set_id','source_sets'),('attempt_id','stage_attempts')])
    add('source_units','稳定页/块/区域定位',{'manifest_id':'uuid NOT NULL','source_id':'uuid NOT NULL','ordinal':'integer NOT NULL CHECK(ordinal >= 0)','unit_kind':'text NOT NULL','locator':j,'content_sha256':'text NOT NULL','text_object_key':'text','readability':'text NOT NULL'},refs=[('manifest_id','parse_manifests'),('source_id','source_files')],unique=[('manifest_id','ordinal')])
    add('schema_proposals','局部/全量版本化规范建议',{'run_id':'uuid','task_id':'uuid NOT NULL','source_set_id':'uuid NOT NULL','goal_version':'bigint NOT NULL','version':ver,'status':'text NOT NULL','content':j,'coverage':j,'unmapped':"jsonb NOT NULL DEFAULT '[]'::jsonb",'preview_object_key':'text','content_sha256':'text NOT NULL'},refs=[('run_id','runs'),('task_id','tasks'),('source_set_id','source_sets')],checks=[axis('schema','status')],unique=[('task_id','version')])
    add('schema_bindings','不可变采用合同',{'task_id':'uuid NOT NULL','source_set_id':'uuid NOT NULL','proposal_id':'uuid','proposal_version':'bigint','goal_version':'bigint NOT NULL','content':j,'content_sha256':'text NOT NULL','adopted_at':'timestamptz NOT NULL'},refs=[('task_id','tasks'),('source_set_id','source_sets'),('proposal_id','schema_proposals')],unique=[('owner_id','task_id','content_sha256','source_set_id','goal_version')])
    add('result_versions','不可变结果版本',{'task_id':'uuid NOT NULL','run_id':'uuid NOT NULL','binding_id':'uuid NOT NULL','version':ver,'quality_status':'text NOT NULL','validation_object_key':'text NOT NULL','candidate_count':'integer NOT NULL CHECK(candidate_count >= 0)','content_sha256':'text NOT NULL'},refs=[('task_id','tasks'),('run_id','runs'),('binding_id','schema_bindings')],checks=[axis('quality','quality_status')],unique=[('task_id','version'),('run_id',)])
    add('records','结果候选及唯一去向',{'result_id':'uuid NOT NULL','stable_key':'text NOT NULL','disposition':'text NOT NULL','exclusion_reason':'text','ordinal':'integer NOT NULL'},refs=[('result_id','result_versions')],checks=[f"disposition IN ({sql_enum(DOMAIN['candidate_disposition'])})","disposition <> 'EXCLUDED' OR exclusion_reason IS NOT NULL"],unique=[('result_id','stable_key'),('result_id','ordinal')])
    add('field_values','原值/精确typed值/事实类别',{'record_id':'uuid NOT NULL','field_id':'text NOT NULL','raw_object_key':'text','typed_value':'jsonb','status':'text NOT NULL','unit':'text','transform_chain':"jsonb NOT NULL DEFAULT '[]'::jsonb",'rule_version':'text','actor_id':'uuid'},refs=[('record_id','records')],checks=[f"status IN ({sql_enum(DOMAIN['field_status'])})"],unique=[('record_id','field_id')])
    add('evidence','依据定位与对象语义',{'run_id':'uuid NOT NULL','source_unit_id':'uuid NOT NULL','locator':j,'excerpt_object_key':'text','excerpt_sha256':'text','relation_note':'text'},refs=[('run_id','runs'),('source_unit_id','source_units')])
    add('field_evidence','字段与多个依据的关联',{'field_value_id':'uuid NOT NULL','evidence_id':'uuid NOT NULL','relation':'text NOT NULL'},refs=[('field_value_id','field_values'),('evidence_id','evidence')],unique=[('field_value_id','evidence_id')])
    add('record_lineage','多源补行/一源多行/合并拆分关系',{'record_id':'uuid NOT NULL','source_unit_id':'uuid','parent_record_id':'uuid','relation_kind':"text NOT NULL CHECK(relation_kind IN ('SOURCE_TO_RECORD','MERGED_FROM','SPLIT_FROM'))",'reason':'text NOT NULL'},refs=[('record_id','records'),('source_unit_id','source_units'),('parent_record_id','records')],checks=['source_unit_id IS NOT NULL OR parent_record_id IS NOT NULL'])
    add('coverage_entries','每次执行每个确认单元唯一主去向',{'run_id':'uuid NOT NULL','source_unit_id':'uuid NOT NULL','disposition':"text NOT NULL CHECK(disposition IN ('READ','UNREADABLE','USER_EXCLUDED'))",'reason':'text','details':j},refs=[('run_id','runs'),('source_unit_id','source_units')],unique=[('run_id','source_unit_id')])
    add('issues','当前结果问题与合法决定',{'result_id':'uuid NOT NULL','record_id':'uuid','field_id':'text','code':'text NOT NULL','severity':"text NOT NULL CHECK(severity IN ('INFO','WARNING','BLOCKER'))",'status':"text NOT NULL CHECK(status IN ('OPEN','RESOLVED','KEPT_UNRESOLVED'))",'allowed_decisions':"jsonb NOT NULL DEFAULT '[]'::jsonb",'details':j},refs=[('result_id','result_versions'),('record_id','records')])
    add('decision_previews','提交前精确范围/影响预览',{'run_id':'uuid NOT NULL','result_id':'uuid NOT NULL','expected_result_version':'bigint NOT NULL','preview_sha256':'text NOT NULL','decisions':"jsonb NOT NULL",'scope':j,'impact':j,'expires_at':'timestamptz NOT NULL'},refs=[('run_id','runs'),('result_id','result_versions')])
    add('decision_batches','已批准决定批次，可重试不可重复消费',{'preview_id':'uuid NOT NULL','parent_run_id':'uuid NOT NULL','parent_result_id':'uuid NOT NULL','preview_sha256':'text NOT NULL','billing_class':"text NOT NULL CHECK(billing_class IN ('USER_REVISION','PLATFORM_CORRECTION'))"},refs=[('preview_id','decision_previews'),('parent_run_id','runs'),('parent_result_id','result_versions')],unique=[('preview_id',)])
    add('decisions','明确人工动作与原问题关联',{'batch_id':'uuid NOT NULL','issue_id':'uuid NOT NULL','action':'text NOT NULL','evidence_id':'uuid','user_value':'jsonb','note':'text'},refs=[('batch_id','decision_batches'),('issue_id','issues'),('evidence_id','evidence')],checks=[f"action IN ({sql_enum(DOMAIN['decision_actions'])})","action <> 'CHOOSE_EVIDENCE' OR evidence_id IS NOT NULL","action <> 'USER_VALUE' OR user_value IS NOT NULL"],unique=[('batch_id','issue_id')])
    add('operations','未知写动作持久查询与重试链',{'kind':'text NOT NULL','task_id':'uuid','run_id':'uuid','decision_batch_id':'uuid','status':'text NOT NULL','retry_of':'uuid','resource_ref':j,'error_code':'text','version':ver,'finished_at':'timestamptz'},refs=[('task_id','tasks'),('run_id','runs'),('decision_batch_id','decision_batches'),('retry_of','operations')],checks=[axis('operation','status')],indexes=["CREATE UNIQUE INDEX operations_one_pending_batch ON p07.operations(owner_id, decision_batch_id) WHERE status='PENDING' AND decision_batch_id IS NOT NULL"])
    add('revision_reservations','一次批次一轮预留/消费/释放',{'grant_id':'uuid NOT NULL','batch_id':'uuid NOT NULL','operation_id':'uuid NOT NULL','status':"text NOT NULL CHECK(status IN ('RESERVED','CONSUMED','RELEASED','WAIVED'))",'rounds':'integer NOT NULL CHECK(rounds IN (0,1))'},refs=[('grant_id','entitlement_grants'),('batch_id','decision_batches'),('operation_id','operations')],unique=[('operation_id',)],indexes=["CREATE UNIQUE INDEX revision_one_live_per_batch ON p07.revision_reservations(owner_id, batch_id) WHERE status IN ('RESERVED','CONSUMED','WAIVED')"])
    add('artifact_sets','九文件整体状态与manifest',{'run_id':'uuid NOT NULL','result_id':'uuid NOT NULL','status':'text NOT NULL','manifest_sha256':'text','expires_at':'timestamptz','revoked_at':'timestamptz'},refs=[('run_id','runs'),('result_id','result_versions')],checks=[axis('artifact','status')],unique=[('result_id',)])
    filenames=['standard.xlsx','standard.json','result.xlsx','accepted.csv','result.json','issues.xlsx','provenance.jsonl','validation.json','manifest.json']
    add('artifacts','已发布不可变单文件',{'artifact_set_id':'uuid NOT NULL','name':'text NOT NULL','object_key':'text NOT NULL','sha256':'text NOT NULL','byte_count':'bigint NOT NULL CHECK(byte_count >= 0)','media_type':'text NOT NULL'},refs=[('artifact_set_id','artifact_sets')],checks=[f"name IN ({sql_enum(filenames)})","sha256 ~ '^[0-9a-f]{64}$'"],unique=[('artifact_set_id','name'),('object_key',)])
    add('download_grants','每请求可撤短授权，产物或依据页只读用途',{'purpose':"text NOT NULL CHECK(purpose IN ('ARTIFACT','EVIDENCE_PAGE'))",'artifact_id':'uuid','evidence_id':'uuid','source_unit_id':'uuid','token_hash':'text NOT NULL','expires_at':'timestamptz NOT NULL','revoked_at':'timestamptz','result_version':'bigint NOT NULL'},refs=[('artifact_id','artifacts'),('evidence_id','evidence'),('source_unit_id','source_units')],checks=["(purpose='ARTIFACT' AND artifact_id IS NOT NULL AND evidence_id IS NULL AND source_unit_id IS NULL) OR (purpose='EVIDENCE_PAGE' AND artifact_id IS NULL AND evidence_id IS NOT NULL AND source_unit_id IS NOT NULL)"],unique=[('token_hash',)],retention='AUTH')
    add('export_attempts','取用的观察事件，不冒充履约',{'artifact_id':'uuid NOT NULL','client_attempt_id':'uuid NOT NULL','observed_action':'text NOT NULL','receipt_source':"text NOT NULL CHECK(receipt_source IN ('CLIENT','USER','SERVER','VERIFIED_PLATFORM'))",'environment':j,'observed_at':'timestamptz NOT NULL','receipt_ref':'text'},refs=[('artifact_id','artifacts')],checks=[axis('export_observation','observed_action')],unique=[('owner_id','client_attempt_id','observed_action')],retention='USAGE')
    add('private_templates','本人主动另存规范头',{'name':'text NOT NULL','version':ver,'current_template_version_id':'uuid','deleted_at':'timestamptz','updated_at':'timestamptz NOT NULL DEFAULT now()'},refs=[('current_template_version_id','private_template_versions')])
    add('private_template_versions','不可变去事实规范白名单',{'template_id':'uuid NOT NULL','version':ver,'content':j,'content_sha256':'text NOT NULL','sanitizer_version':'text NOT NULL','consent_id':'uuid NOT NULL'},refs=[('template_id','private_templates'),('consent_id','consents')],unique=[('template_id','version')])
    add('privacy_policies','公开告知及供应商/期限版本',{'policy_version':'text NOT NULL','environment':'text NOT NULL','content':j,'content_sha256':'text NOT NULL','effective_at':'timestamptz NOT NULL'},owner=False,unique=[('policy_version','environment')],retention='PUBLIC_POLICY')
    add('consents','必要/可选用途分开及撤回事实',{'policy_id':'uuid NOT NULL','scope':'text NOT NULL','action':"text NOT NULL CHECK(action IN ('GRANT','WITHDRAW'))",'effective_at':'timestamptz NOT NULL'},retention='CONSENT')
    tables[-1]['foreign_keys'].append({'columns':['policy_id'],'table':'privacy_policies','target_columns':['id']})
    add('deletion_requests','删除范围/进度/必要保留类别',{'scope':j,'status':"text NOT NULL CHECK(status IN ('REQUESTED','ACCESS_REVOKED','PURGING','COMPLETED','PARTIAL_FAILED'))",'operation_id':'uuid','remaining_categories':"jsonb NOT NULL DEFAULT '[]'::jsonb",'progress':j,'finished_at':'timestamptz'},refs=[('operation_id','operations')],retention='DELETION_LEDGER')
    add('tombstones','先撤权并在恢复后重放的删除事实',{'deletion_request_id':'uuid NOT NULL','resource_kind':'text NOT NULL','resource_id':'uuid NOT NULL','epoch':'bigint NOT NULL','effective_at':'timestamptz NOT NULL','purged_at':'timestamptz'},refs=[('deletion_request_id','deletion_requests')],unique=[('owner_id','resource_kind','resource_id')],retention='DELETION_LEDGER')
    add('support_tickets','订单售后/无订单帮助的脱敏元数据',{'order_id':'uuid','task_id':'uuid','category':'text NOT NULL','note_object_key':'text','status':"text NOT NULL CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'))",'operation_id':'uuid'},refs=[('order_id','orders'),('task_id','tasks'),('operation_id','operations')],retention='SUPPORT')
    add('support_access_grants','客服按任务/目的限时内容授权',{'ticket_id':'uuid NOT NULL','task_id':'uuid NOT NULL','operator_subject':'text NOT NULL','purpose':'text NOT NULL','expires_at':'timestamptz NOT NULL','revoked_at':'timestamptz'},refs=[('ticket_id','support_tickets'),('task_id','tasks')],retention='AUTH')
    add('capability_releases','四环境/商品/构建证据与有效开关',{'provider':'text NOT NULL','app_alias':'text NOT NULL','os':'text NOT NULL','sku_id':'text','build_id':'text NOT NULL','capability_version':'text NOT NULL','flags':j,'evidence_index':j,'commercial_enabled':'boolean NOT NULL DEFAULT false','effective_at':'timestamptz NOT NULL'},owner=False,retention='RELEASE')
    add('idempotency_records','同owner/路由/键与请求摘要找回',{'route_id':'text NOT NULL','key_hash':'text NOT NULL','request_sha256':'text NOT NULL','operation_id':'uuid','response_status':'integer','response_object_ref':'text','expires_at':'timestamptz NOT NULL'},refs=[('operation_id','operations')],unique=[('owner_id','route_id','key_hash')],retention='IDEMPOTENCY')
    add('jobs','持久队列，全局领取但带owner上下文',{'run_id':'uuid','operation_id':'uuid','kind':'text NOT NULL','status':"text NOT NULL CHECK(status IN ('READY','LEASED','DONE','DEAD'))",'dedupe_key':'text NOT NULL','payload':j,'priority':'integer NOT NULL DEFAULT 0','available_at':'timestamptz NOT NULL DEFAULT now()','lease_owner':'text','lease_until':'timestamptz','fence':'bigint NOT NULL DEFAULT 0','attempts':'integer NOT NULL DEFAULT 0','last_error_code':'text'},refs=[('run_id','runs'),('operation_id','operations')],unique=[('owner_id','dedupe_key')],indexes=["CREATE INDEX jobs_ready ON p07.jobs(priority DESC, available_at, id) WHERE status='READY'","CREATE INDEX jobs_expired_lease ON p07.jobs(lease_until) WHERE status='LEASED'"],retention='OPERATIONAL')
    add('outbox_events','业务事实和投递原子提交',{'event_key':'text NOT NULL','topic':'text NOT NULL','aggregate_id':'uuid NOT NULL','payload':j,'available_at':'timestamptz NOT NULL DEFAULT now()','sent_at':'timestamptz','attempts':'integer NOT NULL DEFAULT 0','lease_until':'timestamptz','fence':'bigint NOT NULL DEFAULT 0'},unique=[('event_key',)],indexes=['CREATE INDEX outbox_unsent ON p07.outbox_events(available_at, id) WHERE sent_at IS NULL'],retention='OPERATIONAL')
    add('audit_events','脱敏审计，不保存正文/密钥',{'actor_kind':'text NOT NULL','actor_ref':'text NOT NULL','action':'text NOT NULL','resource_kind':'text NOT NULL','resource_id':'uuid','request_id':'text NOT NULL','reason':'text','details':j},retention='AUDIT')
    add('reconciliation_runs','按原渠道原单位对账批次',{'provider':'text NOT NULL','business_date':'date NOT NULL','status':"text NOT NULL CHECK(status IN ('PENDING','RUNNING','SUCCEEDED','FAILED'))",'summary':j,'report_object_key':'text'},owner=False,unique=[('provider','business_date')],retention='FINANCIAL')

    lines = ['-- P07-DEV 1.0.0 / business v3.1 / PostgreSQL 18',
             '-- REFERENCE ONLY. NOT EXECUTED. Not an idempotent production migration.',
             '-- Application guards, RLS/GRANT, immutable/state triggers require reviewed migrations and DB tests.',
             'BEGIN;', 'CREATE SCHEMA p07;']
    for t in tables:
        lines.append('\n-- ' + t['purpose'])
        body = ['  '+ c['name']+' '+c['sql'] for c in t['columns']]
        body += ['  UNIQUE ('+', '.join(u)+')' for u in t['unique']]
        body += ['  CHECK ('+c+')' for c in t['checks']]
        lines.append('CREATE TABLE p07.'+t['name']+' (\n'+',\n'.join(body)+'\n);')
    for t in tables:
        for n,fk in enumerate(t['foreign_keys'],1):
            lines.append('ALTER TABLE p07.'+t['name']+' ADD CONSTRAINT '+t['name']+'_fk_'+str(n)+' FOREIGN KEY ('+', '.join(fk['columns'])+') REFERENCES p07.'+fk['table']+' ('+', '.join(fk['target_columns'])+') ON DELETE RESTRICT;')
        lines.extend(s+';' for s in t['indexes'])
    lines.append('COMMIT;\n')
    (DEST/'schema-reference.sql').write_text('\n'.join(lines),encoding='utf-8')
    write('database-catalog.json',{'development_baseline':'P07-DEV 1.0.0','postgresql_major':18,'status':'REFERENCE_NOT_EXECUTED','rls_status':'REQUIRED_IN_REVIEWED_MIGRATIONS_NOT_INCLUDED','tables':tables,'application_guards':['owner and same task/result relationship','immutable contracts/bindings/results','all state transitions','paid/free entitlement verification','refund and revision quota locked transactions','lease fence and tombstone before publish','nine artifact readback before READY']})


def supporting_assets():
    stages=[
      ('RECEIVE','已授权上传或文字','原件/hash/source_id','API','同摘要/许可安全重传','RECEIVED','W03'),
      ('PREFLIGHT','当前源集/用途','可读性/计量/局部建议','JOB','最多3单元语义分析，非完整免费整理','NOT_REQUIRED_YET','W03'),
      ('PARSE','确认合同与源集','SourceUnit/parse_manifest/范围账本','JOB','临时错误且预算允许，最多一次','RUNNING','W03'),
      ('ANALYZE','全确认单元/源角色','对象/主题/字段候选/重要未映射','JOB','可查询或安全幂等外部调用','RUNNING','W04'),
      ('PROPOSE','DISCOVER全量分析','FULL_DRAFT/proposal/preview','JOB','按provider request查回，不能无限重发','WAITING_SCHEMA','W04'),
      ('ADOPT','FULL proposal精确源/用途/版本','immutable binding + job','API','同键返回原binding，旧版本409','QUEUED','W04'),
      ('EXTRACT','binding+确认源+批准decisions','候选/字段/raw/value/evidence/lineage','JOB','检查点与provider调用去重','RUNNING','W05'),
      ('VALIDATE','binding/候选/证据/coverage','六维报告/issues/候选去向','JOB','确定性重跑，不新增事实/删规范','RUNNING','W06'),
      ('BUILD','同结果与规范','staging九文件/readback/hash','JOB','未公开半包可新attempt；预算共享','RUNNING','W06'),
      ('PUBLISH','9文件检查完成+当前fence/epoch','READY/result pointer/轮次消费/outbox','TRANSACTION','重复返回同一发布，删除取消先胜则拒绝','SUCCEEDED','W06')]
    write('pipeline-contract.json',{'development_baseline':'P07-DEV 1.0.0','status':'DESIGNED_NOT_IMPLEMENTED','budget':DOMAIN['budget'],'clock':'one active compute lease per processing contract; cumulative active elapsed ms including provider wait; queue/user wait excluded','retry_max':1,'stages':[dict(stage=a,input=b,output=c,executor=d,retry_guard=e,exit_projection=f,work_package=g,checkpoint_keys=['source_set_sha256','binding_sha256','parser_version','model_version','prompt_version','rule_version','input_sha256','output_sha256','usage','attempt_id']) for a,b,c,d,e,f,g in stages]})
    trace={x['requirement_id']:x for x in TRACE}
    tasks=[]
    for r in REQS:
        tr=trace[r['id']]
        tasks.append({'id':'DEV-F'+r['id'][-2:],'title':r['title'],'priority':r['priority'],'work_package':tr['work_package'],'requirement_ids':[r['id']],'api_ids':r['api_ids'],'page_ids':r['page_ids'],'component_ids':r['component_ids'],'acceptance_ids':[x['id'] for x in r['acceptance_criteria']],'exception_case_ids':tr['exception_case_ids'],'dependencies':['DEV-X01'] if tr['work_package']!='W01' else [],'deliverables':['对应领域service/adapter及必要migration','共享合同与适用双端页面','真实相关测试与脱敏证据'],'done_when':[x['criterion'] for x in r['acceptance_criteria']],'status':'PARKED_P1' if r['priority']=='P1' else 'NOT_STARTED','test_status':'NOT_RUN'})
    cross=[
      ('01','原生环境与平台/供应商可行性','W01',[],['项目局部工具/依赖锁','四环境输入/规范导入/真实取用证据','SKU/政策/供应商register'],['无Docker/WSL/VM','精确SDK/依赖版本记录','未证明能力保持关闭']),
      ('02','数据库迁移/角色/隔离','W02',['DEV-X01'],['正式编号迁移','RLS/GRANT与复合FK','真PostgreSQL并发/越权测试'],['新库与升级成功','应用无超级用户/DDL','甲乙资源互换全部拒绝']),
      ('03','队列/fence/outbox与预算恢复','W02',['DEV-X02'],['原生worker/scheduler','检查点/累计预算','故障注入报告'],['旧fence拒绝写','崩溃不漏已付任务','重试/子Run不重置预算']),
      ('04','受限解析与恶意文件防护','W03',['DEV-X02'],['引擎协议/原生进程限制','格式fixtures/攻击样例','资源计量版本'],['进程树回收','不执行脚本/宏/外链','全范围账本和稳定定位']),
      ('05','B32组件与18页双端实现','W07',['DEV-X01','DEV-X02'],['共享tokens/viewmodel','两套原生页面/组件','B三锚点和真机无障碍'],['18页全部状态可达','普通手机流程不依赖Web','双端构建无秘密']),
      ('06','未知写动作和四环境文件恢复','W08',['DEV-X03','DEV-X05'],['operation恢复store','HostAdapter','真实导出/弱网证据'],['后台停止轮询','前台查原动作','缓存不冒充可见导出']),
      ('07','删除/日志脱敏/客服限时授权','W09',['DEV-X02','DEV-X03'],['tombstone和独立ledger','内容清理/撤权','安全反例'],['删除发布竞争安全','恢复先重放撤权','日志不含正文/token']),
      ('08','原渠道资金事实与补偿','W10',['DEV-X01','DEV-X02','DEV-X03'],['正式支付/退款adapter','ledger/对账/运营未决列表','真实原路退款证据'],['重复/晚到/未知不漏款不重收退','错金额单位不发许可','开关与SKU资格匹配']),
      ('09','30组质量集与126AC/24异常回归','W11',['DEV-X04','DEV-X05','DEV-X06','DEV-X07','DEV-X08'],['独立人工答案','Q01—08分层报告','四环境/性能/资金回归'],['至少10组无模板/两主题','无未标记关键严重错误','不以mock充真机/支付PASS']),
      ('10','Windows原生发布/监控/备份恢复','W12',['DEV-X09'],['服务启动停止/CLI','release manifest','恢复/回退/停新单保售后演练'],['不误停其他进程','恢复不复活已删内容','发布证据适用build/app/OS/SKU'])]
    for n,title,w,dep,out,done in cross:
        tasks.append({'id':'DEV-X'+n,'title':title,'priority':'P0','work_package':w,'requirement_ids':[x['requirement_id'] for x in TRACE if x['work_package']==w],'api_ids':[],'page_ids':[],'component_ids':[],'acceptance_ids':[],'exception_case_ids':[],'dependencies':dep,'deliverables':out,'done_when':done,'status':'NOT_STARTED','test_status':'NOT_RUN'})
    write('backlog.json',{'development_baseline':'P07-DEV 1.0.0','business_baseline':'v3.1','status':'PLANNED_NOT_STARTED','estimate_note':'85—118人日/10—14周沿用旧估算，未按v3.1重估；外部审批另列','tasks':tasks})
    pages=[]
    for p in PAGES:
        a=sorted({a for r in REQS if p['page_id'] in r['page_ids'] for a in r['api_ids']})
        pages.append({'page_id':p['page_id'],'title':p['title'],'routes':{'ALIPAY':'pages/'+p['page_id'].lower()+'/index','DOUYIN':'pages/'+p['page_id'].lower()+'/index'},'component_ids':p['component_ids'],'requirement_ids':p['requirement_ids'],'api_ids':a,'states':p['required_states'],'entry_guard':p['entry_precondition'],'submit_guard':p['submit_guard'],'recovery':p['recovery'],'rendered_reference':p.get('rendered_reference'),'accessibility_checks':['screenreader label/order','large font/keyboard/safe area','48 touch reference and 320/375/390/430 widths','state not conveyed by color alone'],'status':'NOT_IMPLEMENTED','test_status':'NOT_RUN'})
    write('ui-implementation-map.json',{'development_baseline':'P07-DEV 1.0.0','design_baseline':'P07-DS-B 1.0.0','business_baseline':'v3.1','pages':pages,'components':[{'component_id':c['id'],'name':c['name'],'page_ids':c['page_ids'],'states':c['states'],'rules':c['rules'],'platforms':['ALIPAY','DOUYIN'],'deliverables':['props/events contract','native view/style on both hosts','state fixtures/accessibility/device evidence'],'status':'NOT_IMPLEMENTED'} for c in COMPONENTS]})
    integrations=[
      ('01','Windows原生工具/依赖锁','W01','开发环境','Node24/Fastify5/Python3.13/PostgreSQL18与两端TS构建精确patch、许可证、原生wheel和哈希'),
      ('02','支付宝四项文件入口/规范/取用','W01','支付宝Android/iOS输入与交付','正式app_alias/SDK/OS实测逐入口选择上传、Excel打开与用户可见取用，非仅缓存'),
      ('03','抖音四项文件入口/规范/取用','W01','抖音Android/iOS输入与交付','同上，独立抖音宿主证据；不能套支付宝结果'),
      ('04','双端原生SDK/生命周期/隐私权限','W01','双端原生构建','精确开发工具/基础库最低版本、登录/后台弱网/键盘/通知与隐私授权错误返回样本'),
      ('05','各平台主体/类目/SKU/OS支付资格','W01','收费','适用主体、目标商品/单位/OS批准、商户、政策及实际文件交付路径证据；未核商业开关关闭'),
      ('06','支付验签/查单/退款/履约契约','W10','收费与售后','官方签名原字节/证书轮换、超时/幂等/限流/ack、正式查单及实际原路退款回执'),
      ('07','24h/2轮/7day候选政策','W01','对应SKU销售','获准商品与实际服务/隐私期限匹配，生效policy_snapshot，已售不追溯收紧'),
      ('08','OCR供应商','W03','扫描PDF/图片自动解析','真实合同的地域/训练/保留/删除、定位/精度/成本/限流、幂等查询与测试'),
      ('09','语义模型供应商','W04','发现与抽取','同类隐私/费用证据、受限JSON输出、上下文/重试/未知调用、独立质量集达标'),
      ('10','PDFRenderer与原生资源封装','W03','PDF页图与安全解析','Windows轮子/许可证、crop/rotation坐标、JobObject进程树/内存/超时反例实测'),
      ('11','数据库权限/RLS/并发租约','W02','安全和可靠执行','真实PostgreSQL新库/升级/RLS角色/复合FK/并发/fence/轮次测试，不用SQLite或容器'),
      ('12','正式HTTPS/域名/服务wrapper','W12','真机/正式环境','有效域名白名单/证书、原生服务精确版本/ACL/进程归属/续期/回退证据'),
      ('13','质量/资源/性能/费用预算','W11','发布','30组/10DISCOVER/两主题、关键错误阻断、明确硬件负载和Q/NFR实际报告'),
      ('14','备份/恢复/删除与供应商副本','W12','隐私和运维','真实RPO/RTO、tombstone重放、在线/外部/备份期限/删除回执；不得预填达标'),
      ('15','平台提审/灰度/售后能力','W12','各环境公开发布','适用build/app/OS/SKU的审核事实，停新单保留原售后演练及告警响应')]
    write('integration-register.json',{'development_baseline':'P07-DEV 1.0.0','status':'NO_INTEGRATION_EVIDENCE_YET','items':[{'id':'INT-'+n,'subject':s,'work_package':w,'blocks':b,'closure_criteria':c,'status':'UNVERIFIED','test_status':'NOT_RUN','evidence_refs':[]} for n,s,w,b,c in integrations]})


def configuration():
    config={'config_version':'1.0.0','app':{'id':'P07','version':'0.0.0-unimplemented','environment':'development','business_baseline':'v3.1','design_baseline':'P07-DS-B 1.0.0'},'paths':{'runtime_root':'runtime','object_root':'runtime/objects','scratch_root':'runtime/scratch','log_root':'runtime/logs'},'http':{'host':'127.0.0.1','port':7307,'public_origin':'http://127.0.0.1:7307','trusted_proxy':[]},'database':{'connection_secret_ref':'runtime/secrets/database-connection.txt','pool_max':10,'statement_timeout_ms':5000},'worker':{'lease_seconds':60,'heartbeat_seconds':15,'poll_ms':2000},'budgets':DOMAIN['budget'],'preflight':{'semantic_units_max':3,'new_tasks_per_day':5},'export':{'download_ttl_seconds':300,'page_size':20,'page_size_max':100},'providers':{'ocr':{'mode':'disabled'},'model':{'mode':'disabled'},'payment':{'mode':'disabled'}},'commerce':{'enabled':False,'approved_sku_ids':[],'policy_snapshot_id':None},'policy_candidates':{'review_hours':24,'revision_rounds':2,'retention_days':7,'enabled_as_entitlement':False},'features':{'release_units':{k:{'file_input':False,'template_input':False,'preview':False,'export':False,'payment':False} for k in ['alipay_android','alipay_ios','douyin_android','douyin_ios']},'web':False,'open_api':False,'source_increments':False,'account_binding':False},'observability':{'log_level':'info','redaction':True,'enabled_metrics':True}}
    def infer(v):
        if isinstance(v,dict): return {'type':'object','additionalProperties':False,'required':list(v),'properties':{k:infer(x) for k,x in v.items()}}
        if isinstance(v,bool): return {'type':'boolean'}
        if isinstance(v,int): return {'type':'integer','minimum':0}
        if isinstance(v,list): return {'type':'array','items':{'type':'string'},'uniqueItems':True}
        if v is None: return {'type':['string','null']}
        return {'type':'string','minLength':1}
    schema=infer(config)
    schema.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:p07:config:1.0.0','title':'P07 development configuration contract','description':'Structure only; runtime cross-field/path/approved-evidence guards mandatory.'})
    schema['properties']['config_version']={'const':'1.0.0'}
    schema['properties']['app']['properties']['environment']={'enum':['development','test','staging','production']}
    for kind in ['ocr','model','payment']:
        schema['properties']['providers']['properties'][kind]={'type':'object','required':['mode'],'additionalProperties':False,'properties':{'mode':{'enum':['disabled','fixture','approved']},'adapter_id':{'type':'string'},'secret_ref':{'type':'string'},'evidence_ref':{'type':'string'}},'if':{'properties':{'mode':{'const':'approved'}}},'then':{'required':['adapter_id','secret_ref','evidence_ref']}}
    schema['properties']['http']['properties']['port'].update(minimum=1,maximum=65535)
    schema['properties']['database']['properties']['pool_max'].update(minimum=1,maximum=100)
    for k,v in DOMAIN['budget'].items(): schema['properties']['budgets']['properties'][k]={'type':'integer','minimum':0 if k=='stage_auto_retries_max' else 1,'maximum':v}
    schema['properties']['export']['properties']['page_size_max']['maximum']=100
    schema['properties']['observability']['properties']['redaction']={'const':True}
    schema['properties']['policy_candidates']['properties']['enabled_as_entitlement']={'const':False}
    commercial_condition = {'properties': {'commerce': {'properties': {'enabled': {'const': True}}}}}
    commercial_properties = {
        'commerce': {'properties': {'approved_sku_ids': {'minItems': 1}, 'policy_snapshot_id': {'type': 'string', 'minLength': 1}}},
        'providers': {'properties': {'payment': {'properties': {'mode': {'const': 'approved'}}}}}
    }
    schema['allOf'] = [{'if': commercial_condition, 'then': {'properties': commercial_properties}}]
    write('config.example.json',config)
    write('config.schema.json',schema)


if __name__=='__main__':
    _active_path = Path(__file__).resolve().parents[1] / 'assets/development/active.json'
    if _active_path.exists() and json.loads(_active_path.read_text(encoding='utf-8-sig')).get('development_baseline') != 'P07-DEV 1.0.0':
        raise SystemExit('Historical v1 generator/sealer is protected. Use the Codex Agent v2 scripts listed in docs/开发/README.md.')
    DEST.mkdir(parents=True,exist_ok=True)
    database()
    supporting_assets()
    configuration()
    print('Built DB/config/pipeline/backlog/UI/integration reference assets; no application or DB executed.')
