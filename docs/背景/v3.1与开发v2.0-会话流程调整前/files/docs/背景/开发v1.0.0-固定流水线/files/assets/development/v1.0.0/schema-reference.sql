-- P07-DEV 1.0.0 / business v3.1 / PostgreSQL 18
-- REFERENCE ONLY. NOT EXECUTED. Not an idempotent production migration.
-- Application guards, RLS/GRANT, immutable/state triggers require reviewed migrations and DB tests.
BEGIN;
CREATE SCHEMA p07;

-- 隔离账户，不按昵称/手机号跨端合并
CREATE TABLE p07.accounts (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('ACTIVE','DELETION_PENDING','CLOSED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 真实平台身份映射
CREATE TABLE p07.platform_identities (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('ALIPAY','DOUYIN')),
  app_alias text NOT NULL,
  subject_cipher_ref text NOT NULL,
  subject_hash text NOT NULL,
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (provider, app_alias, subject_hash)
);

-- 可撤销会话，只存token摘要
CREATE TABLE p07.sessions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  identity_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (token_hash)
);

-- 草稿与当前工作区指针
CREATE TABLE p07.tasks (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('PROVIDED','DISCOVER')),
  goal text,
  goal_version bigint NOT NULL DEFAULT 1,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  epoch bigint NOT NULL DEFAULT 1,
  current_source_set_id uuid,
  current_run_id uuid,
  current_result_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 原件与直接文本受控对象
CREATE TABLE p07.source_files (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('SOURCE','TEMPLATE')),
  kind text NOT NULL CHECK (kind IN ('FILE','TEXT')),
  display_name text NOT NULL,
  media_type text NOT NULL,
  byte_count bigint NOT NULL CHECK (byte_count >= 0),
  content_sha256 text NOT NULL,
  object_key text NOT NULL,
  status text NOT NULL,
  duplicate_of uuid,
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (object_key),
  CHECK (status IN ('RECEIVED', 'VALIDATING', 'READABLE', 'PARTIAL', 'UNREADABLE', 'EXCLUDED', 'EXPIRED', 'DELETED')),
  CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);

-- 逐文件一次用途许可及接收状态
CREATE TABLE p07.upload_sessions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('SOURCE','TEMPLATE')),
  expected_bytes bigint NOT NULL CHECK(expected_bytes > 0),
  expected_sha256 text NOT NULL,
  expected_mime text NOT NULL,
  display_name text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('ISSUED','RECEIVING','RECEIVED','COMPLETED','FAILED','EXPIRED')),
  source_id uuid,
  received_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (token_hash)
);

-- 草稿资料队列，规范角色分开
CREATE TABLE p07.task_source_links (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  source_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('SOURCE','TEMPLATE')),
  ordinal integer NOT NULL CHECK(ordinal >= 0),
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (task_id, source_id, role)
);

-- 不可变来源集版本
CREATE TABLE p07.source_sets (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  content_sha256 text NOT NULL,
  unitizer_version text NOT NULL,
  scope_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (task_id, version)
);

-- 冻结来源/排除及实测摘要
CREATE TABLE p07.source_set_items (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  source_set_id uuid NOT NULL,
  source_id uuid NOT NULL,
  role text NOT NULL CHECK(role IN ('SOURCE','TEMPLATE')),
  ordinal integer NOT NULL,
  included boolean NOT NULL,
  exclusion_reason text,
  source_sha256 text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (source_set_id, source_id, role),
  CHECK (included OR exclusion_reason IS NOT NULL)
);

-- 有限语义/全范围可读性预检
CREATE TABLE p07.preflights (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  source_set_id uuid NOT NULL,
  goal_version bigint NOT NULL,
  status text NOT NULL CHECK(status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')),
  semantic_units_used integer NOT NULL DEFAULT 0 CHECK(semantic_units_used BETWEEN 0 AND 3),
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 不可变确认范围/预算/政策
CREATE TABLE p07.processing_contracts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  source_set_id uuid NOT NULL,
  goal_version bigint NOT NULL,
  mode text NOT NULL CHECK(mode IN ('PROVIDED','DISCOVER')),
  schema_binding_id uuid,
  contract_sha256 text NOT NULL,
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  confirmed_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, contract_sha256),
  UNIQUE (task_id, version)
);

-- 原单位不可变报价
CREATE TABLE p07.quotes (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  provider text NOT NULL,
  app_alias text NOT NULL,
  os text NOT NULL,
  sku_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  amount_unit text NOT NULL,
  expires_at timestamptz NOT NULL,
  capability_version text NOT NULL,
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 原渠道订单，三轴分开
CREATE TABLE p07.orders (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  quote_id uuid NOT NULL,
  provider text NOT NULL,
  app_alias text NOT NULL,
  sku_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  amount_unit text NOT NULL,
  payment_status text NOT NULL,
  refund_status text NOT NULL,
  fulfillment_status text NOT NULL,
  refunded_minor bigint NOT NULL DEFAULT 0,
  refund_reserved_minor bigint NOT NULL DEFAULT 0,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, contract_id),
  CHECK (payment_status IN ('NOT_REQUIRED', 'NOT_CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'CLOSED', 'UNKNOWN')),
  CHECK (refund_status IN ('NONE', 'REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN')),
  CHECK (fulfillment_status IN ('NOT_STARTED', 'IN_PROGRESS', 'DELIVERABLE', 'DELIVERED', 'FAILED', 'CANCELED')),
  CHECK (refunded_minor >= 0 AND refund_reserved_minor >= 0 AND refunded_minor + refund_reserved_minor <= amount_minor)
);

-- 同商户引用查回原单
CREATE TABLE p07.payment_attempts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  order_id uuid NOT NULL,
  provider text NOT NULL,
  merchant_reference text NOT NULL,
  provider_order_ref text,
  state text NOT NULL,
  request_object_ref text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (provider, merchant_reference),
  UNIQUE (provider, provider_order_ref)
);

-- 原始验签交易事件去重
CREATE TABLE p07.platform_events (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  provider text NOT NULL,
  provider_event_key text NOT NULL,
  order_id uuid NOT NULL,
  event_kind text NOT NULL,
  raw_object_ref text,
  verified_at timestamptz NOT NULL,
  event_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (provider, provider_event_key)
);

-- 不可变支付/退款事实，原单位
CREATE TABLE p07.payment_ledger (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  order_id uuid NOT NULL,
  provider text NOT NULL,
  provider_fact_key text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('PAYMENT','REFUND','FEE','ADJUSTMENT')),
  amount_minor bigint NOT NULL CHECK(amount_minor >= 0),
  amount_unit text NOT NULL,
  fact_at timestamptz NOT NULL,
  event_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (provider, provider_fact_key, kind)
);

-- 退款预留与原单重查
CREATE TABLE p07.refunds (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  order_id uuid NOT NULL,
  provider text NOT NULL,
  merchant_refund_ref text NOT NULL,
  provider_refund_ref text,
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  amount_unit text NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  retry_of uuid,
  operation_id uuid,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (provider, merchant_refund_ref),
  CHECK (status IN ('NONE', 'REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN'))
);

-- 明确免费/原单已付许可
CREATE TABLE p07.entitlement_grants (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  order_id uuid,
  kind text NOT NULL CHECK(kind IN ('FREE','PAID')),
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision_limit integer NOT NULL CHECK(revision_limit >= 0),
  revision_consumed integer NOT NULL DEFAULT 0,
  revision_reserved integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, contract_id),
  CHECK ((kind = 'FREE' AND order_id IS NULL) OR (kind = 'PAID' AND order_id IS NOT NULL)),
  CHECK (revision_consumed >= 0 AND revision_reserved >= 0 AND revision_consumed + revision_reserved <= revision_limit)
);

-- 执行实例，终态保持，修订新建子Run
CREATE TABLE p07.runs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  parent_run_id uuid,
  parent_result_id uuid,
  decision_batch_id uuid,
  execution_status text NOT NULL,
  schema_status text NOT NULL,
  quality_status text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  epoch bigint NOT NULL,
  schema_binding_id uuid,
  current_stage text,
  cancel_requested_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  CHECK (execution_status IN ('QUEUED', 'RUNNING', 'WAITING_SCHEMA', 'SUCCEEDED', 'FAILED', 'CANCELED')),
  CHECK (schema_status IN ('NOT_REQUIRED_YET', 'PARTIAL_DRAFT', 'FULL_DRAFT', 'ADOPTED', 'SUPERSEDED')),
  CHECK (quality_status IN ('NOT_EVALUATED', 'PASSED', 'NEEDS_REVIEW', 'BLOCKED'))
);

-- 同合同累计预算幂等计量
CREATE TABLE p07.run_budget_events (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  run_id uuid NOT NULL,
  attempt_id uuid,
  event_key text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('RESERVE','CONSUME','RELEASE','ADJUST')),
  compute_ms bigint NOT NULL CHECK(compute_ms >= 0),
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (contract_id, event_key)
);

-- 一次阶段租约与检查点
CREATE TABLE p07.stage_attempts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL,
  job_id uuid NOT NULL,
  stage text NOT NULL,
  attempt_no integer NOT NULL CHECK(attempt_no > 0),
  fence bigint NOT NULL CHECK(fence > 0),
  input_sha256 text NOT NULL,
  status text NOT NULL CHECK(status IN ('RUNNING','SUCCEEDED','FAILED','LOST')),
  provider_request_ref text,
  checkpoint_key text,
  versions jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (run_id, stage, attempt_no)
);

-- 不可变解析版本与资源计量
CREATE TABLE p07.parse_manifests (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  source_id uuid NOT NULL,
  source_set_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  parser_version text NOT NULL,
  unitizer_version text NOT NULL,
  object_key text NOT NULL,
  unit_count integer NOT NULL CHECK(unit_count >= 0),
  manifest_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 稳定页/块/区域定位
CREATE TABLE p07.source_units (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  manifest_id uuid NOT NULL,
  source_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK(ordinal >= 0),
  unit_kind text NOT NULL,
  locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_sha256 text NOT NULL,
  text_object_key text,
  readability text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (manifest_id, ordinal)
);

-- 局部/全量版本化规范建议
CREATE TABLE p07.schema_proposals (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid,
  task_id uuid NOT NULL,
  source_set_id uuid NOT NULL,
  goal_version bigint NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  status text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  unmapped jsonb NOT NULL DEFAULT '[]'::jsonb,
  preview_object_key text,
  content_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (task_id, version),
  CHECK (status IN ('NOT_REQUIRED_YET', 'PARTIAL_DRAFT', 'FULL_DRAFT', 'ADOPTED', 'SUPERSEDED'))
);

-- 不可变采用合同
CREATE TABLE p07.schema_bindings (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  source_set_id uuid NOT NULL,
  proposal_id uuid,
  proposal_version bigint,
  goal_version bigint NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_sha256 text NOT NULL,
  adopted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, task_id, content_sha256, source_set_id, goal_version)
);

-- 不可变结果版本
CREATE TABLE p07.result_versions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL,
  run_id uuid NOT NULL,
  binding_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  quality_status text NOT NULL,
  validation_object_key text NOT NULL,
  candidate_count integer NOT NULL CHECK(candidate_count >= 0),
  content_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (task_id, version),
  UNIQUE (run_id),
  CHECK (quality_status IN ('NOT_EVALUATED', 'PASSED', 'NEEDS_REVIEW', 'BLOCKED'))
);

-- 结果候选及唯一去向
CREATE TABLE p07.records (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  result_id uuid NOT NULL,
  stable_key text NOT NULL,
  disposition text NOT NULL,
  exclusion_reason text,
  ordinal integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (result_id, stable_key),
  UNIQUE (result_id, ordinal),
  CHECK (disposition IN ('ACCEPTED', 'NEEDS_REVIEW', 'EXCLUDED')),
  CHECK (disposition <> 'EXCLUDED' OR exclusion_reason IS NOT NULL)
);

-- 原值/精确typed值/事实类别
CREATE TABLE p07.field_values (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  record_id uuid NOT NULL,
  field_id text NOT NULL,
  raw_object_key text,
  typed_value jsonb,
  status text NOT NULL,
  unit text,
  transform_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_version text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (record_id, field_id),
  CHECK (status IN ('EXTRACTED', 'NORMALIZED', 'DERIVED', 'DEFAULTED', 'USER_PROVIDED', 'MISSING', 'CONFLICT', 'UNREADABLE'))
);

-- 依据定位与对象语义
CREATE TABLE p07.evidence (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL,
  source_unit_id uuid NOT NULL,
  locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  excerpt_object_key text,
  excerpt_sha256 text,
  relation_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 字段与多个依据的关联
CREATE TABLE p07.field_evidence (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  field_value_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  relation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (field_value_id, evidence_id)
);

-- 多源补行/一源多行/合并拆分关系
CREATE TABLE p07.record_lineage (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  record_id uuid NOT NULL,
  source_unit_id uuid,
  parent_record_id uuid,
  relation_kind text NOT NULL CHECK(relation_kind IN ('SOURCE_TO_RECORD','MERGED_FROM','SPLIT_FROM')),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  CHECK (source_unit_id IS NOT NULL OR parent_record_id IS NOT NULL)
);

-- 每次执行每个确认单元唯一主去向
CREATE TABLE p07.coverage_entries (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL,
  source_unit_id uuid NOT NULL,
  disposition text NOT NULL CHECK(disposition IN ('READ','UNREADABLE','USER_EXCLUDED')),
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (run_id, source_unit_id)
);

-- 当前结果问题与合法决定
CREATE TABLE p07.issues (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  result_id uuid NOT NULL,
  record_id uuid,
  field_id text,
  code text NOT NULL,
  severity text NOT NULL CHECK(severity IN ('INFO','WARNING','BLOCKER')),
  status text NOT NULL CHECK(status IN ('OPEN','RESOLVED','KEPT_UNRESOLVED')),
  allowed_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 提交前精确范围/影响预览
CREATE TABLE p07.decision_previews (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL,
  result_id uuid NOT NULL,
  expected_result_version bigint NOT NULL,
  preview_sha256 text NOT NULL,
  decisions jsonb NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  impact jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 已批准决定批次，可重试不可重复消费
CREATE TABLE p07.decision_batches (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  preview_id uuid NOT NULL,
  parent_run_id uuid NOT NULL,
  parent_result_id uuid NOT NULL,
  preview_sha256 text NOT NULL,
  billing_class text NOT NULL CHECK(billing_class IN ('USER_REVISION','PLATFORM_CORRECTION')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (preview_id)
);

-- 明确人工动作与原问题关联
CREATE TABLE p07.decisions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  issue_id uuid NOT NULL,
  action text NOT NULL,
  evidence_id uuid,
  user_value jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (batch_id, issue_id),
  CHECK (action IN ('CHOOSE_EVIDENCE', 'USER_VALUE', 'KEEP_UNRESOLVED')),
  CHECK (action <> 'CHOOSE_EVIDENCE' OR evidence_id IS NOT NULL),
  CHECK (action <> 'USER_VALUE' OR user_value IS NOT NULL)
);

-- 未知写动作持久查询与重试链
CREATE TABLE p07.operations (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  kind text NOT NULL,
  task_id uuid,
  run_id uuid,
  decision_batch_id uuid,
  status text NOT NULL,
  retry_of uuid,
  resource_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED'))
);

-- 一次批次一轮预留/消费/释放
CREATE TABLE p07.revision_reservations (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  grant_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('RESERVED','CONSUMED','RELEASED','WAIVED')),
  rounds integer NOT NULL CHECK(rounds IN (0,1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (operation_id)
);

-- 九文件整体状态与manifest
CREATE TABLE p07.artifact_sets (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid NOT NULL,
  result_id uuid NOT NULL,
  status text NOT NULL,
  manifest_sha256 text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (result_id),
  CHECK (status IN ('NOT_READY', 'BUILDING', 'READY', 'FAILED', 'EXPIRED', 'REVOKED'))
);

-- 已发布不可变单文件
CREATE TABLE p07.artifacts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  artifact_set_id uuid NOT NULL,
  name text NOT NULL,
  object_key text NOT NULL,
  sha256 text NOT NULL,
  byte_count bigint NOT NULL CHECK(byte_count >= 0),
  media_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (artifact_set_id, name),
  UNIQUE (object_key),
  CHECK (name IN ('standard.xlsx', 'standard.json', 'result.xlsx', 'accepted.csv', 'result.json', 'issues.xlsx', 'provenance.jsonl', 'validation.json', 'manifest.json')),
  CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

-- 每请求可撤短授权，产物或依据页只读用途
CREATE TABLE p07.download_grants (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  purpose text NOT NULL CHECK(purpose IN ('ARTIFACT','EVIDENCE_PAGE')),
  artifact_id uuid,
  evidence_id uuid,
  source_unit_id uuid,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  result_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (token_hash),
  CHECK ((purpose='ARTIFACT' AND artifact_id IS NOT NULL AND evidence_id IS NULL AND source_unit_id IS NULL) OR (purpose='EVIDENCE_PAGE' AND artifact_id IS NULL AND evidence_id IS NOT NULL AND source_unit_id IS NOT NULL))
);

-- 取用的观察事件，不冒充履约
CREATE TABLE p07.export_attempts (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  artifact_id uuid NOT NULL,
  client_attempt_id uuid NOT NULL,
  observed_action text NOT NULL,
  receipt_source text NOT NULL CHECK(receipt_source IN ('CLIENT','USER','SERVER','VERIFIED_PLATFORM')),
  environment jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL,
  receipt_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, client_attempt_id, observed_action),
  CHECK (observed_action IN ('ARTIFACT_READY', 'FETCHED', 'CACHED', 'OPEN_REQUESTED', 'OPENED', 'EXPORT_REQUESTED', 'USER_CONFIRMED', 'PLATFORM_CONFIRMED', 'FAILED', 'UNKNOWN'))
);

-- 本人主动另存规范头
CREATE TABLE p07.private_templates (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  current_template_version_id uuid,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 不可变去事实规范白名单
CREATE TABLE p07.private_template_versions (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  template_id uuid NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_sha256 text NOT NULL,
  sanitizer_version text NOT NULL,
  consent_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (template_id, version)
);

-- 公开告知及供应商/期限版本
CREATE TABLE p07.privacy_policies (
  id uuid PRIMARY KEY,
  policy_version text NOT NULL,
  environment text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_sha256 text NOT NULL,
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_version, environment)
);

-- 必要/可选用途分开及撤回事实
CREATE TABLE p07.consents (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  scope text NOT NULL,
  action text NOT NULL CHECK(action IN ('GRANT','WITHDRAW')),
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 删除范围/进度/必要保留类别
CREATE TABLE p07.deletion_requests (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK(status IN ('REQUESTED','ACCESS_REVOKED','PURGING','COMPLETED','PARTIAL_FAILED')),
  operation_id uuid,
  remaining_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 先撤权并在恢复后重放的删除事实
CREATE TABLE p07.tombstones (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  deletion_request_id uuid NOT NULL,
  resource_kind text NOT NULL,
  resource_id uuid NOT NULL,
  epoch bigint NOT NULL,
  effective_at timestamptz NOT NULL,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, resource_kind, resource_id)
);

-- 订单售后/无订单帮助的脱敏元数据
CREATE TABLE p07.support_tickets (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  order_id uuid,
  task_id uuid,
  category text NOT NULL,
  note_object_key text,
  status text NOT NULL CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  operation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 客服按任务/目的限时内容授权
CREATE TABLE p07.support_access_grants (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  task_id uuid NOT NULL,
  operator_subject text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 四环境/商品/构建证据与有效开关
CREATE TABLE p07.capability_releases (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  app_alias text NOT NULL,
  os text NOT NULL,
  sku_id text,
  build_id text NOT NULL,
  capability_version text NOT NULL,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_index jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercial_enabled boolean NOT NULL DEFAULT false,
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 同owner/路由/键与请求摘要找回
CREATE TABLE p07.idempotency_records (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  route_id text NOT NULL,
  key_hash text NOT NULL,
  request_sha256 text NOT NULL,
  operation_id uuid,
  response_status integer,
  response_object_ref text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, route_id, key_hash)
);

-- 持久队列，全局领取但带owner上下文
CREATE TABLE p07.jobs (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  run_id uuid,
  operation_id uuid,
  kind text NOT NULL,
  status text NOT NULL CHECK(status IN ('READY','LEASED','DONE','DEAD')),
  dedupe_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_until timestamptz,
  fence bigint NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (owner_id, dedupe_key)
);

-- 业务事实和投递原子提交
CREATE TABLE p07.outbox_events (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  event_key text NOT NULL,
  topic text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  available_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  fence bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id),
  UNIQUE (event_key)
);

-- 脱敏审计，不保存正文/密钥
CREATE TABLE p07.audit_events (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  actor_kind text NOT NULL,
  actor_ref text NOT NULL,
  action text NOT NULL,
  resource_kind text NOT NULL,
  resource_id uuid,
  request_id text NOT NULL,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, id)
);

-- 按原渠道原单位对账批次
CREATE TABLE p07.reconciliation_runs (
  id uuid PRIMARY KEY,
  provider text NOT NULL,
  business_date date NOT NULL,
  status text NOT NULL CHECK(status IN ('PENDING','RUNNING','SUCCEEDED','FAILED')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, business_date)
);
ALTER TABLE p07.platform_identities ADD CONSTRAINT platform_identities_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.sessions ADD CONSTRAINT sessions_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.sessions ADD CONSTRAINT sessions_fk_2 FOREIGN KEY (owner_id, identity_id) REFERENCES p07.platform_identities (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.tasks ADD CONSTRAINT tasks_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.tasks ADD CONSTRAINT tasks_fk_2 FOREIGN KEY (owner_id, current_source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.tasks ADD CONSTRAINT tasks_fk_3 FOREIGN KEY (owner_id, current_run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.tasks ADD CONSTRAINT tasks_fk_4 FOREIGN KEY (owner_id, current_result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
CREATE INDEX tasks_owner_recent ON p07.tasks(owner_id, updated_at DESC, id DESC);
ALTER TABLE p07.source_files ADD CONSTRAINT source_files_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.source_files ADD CONSTRAINT source_files_fk_2 FOREIGN KEY (owner_id, duplicate_of) REFERENCES p07.source_files (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.upload_sessions ADD CONSTRAINT upload_sessions_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.upload_sessions ADD CONSTRAINT upload_sessions_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.upload_sessions ADD CONSTRAINT upload_sessions_fk_3 FOREIGN KEY (owner_id, source_id) REFERENCES p07.source_files (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.task_source_links ADD CONSTRAINT task_source_links_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.task_source_links ADD CONSTRAINT task_source_links_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.task_source_links ADD CONSTRAINT task_source_links_fk_3 FOREIGN KEY (owner_id, source_id) REFERENCES p07.source_files (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.source_sets ADD CONSTRAINT source_sets_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.source_sets ADD CONSTRAINT source_sets_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.source_set_items ADD CONSTRAINT source_set_items_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.source_set_items ADD CONSTRAINT source_set_items_fk_2 FOREIGN KEY (owner_id, source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.source_set_items ADD CONSTRAINT source_set_items_fk_3 FOREIGN KEY (owner_id, source_id) REFERENCES p07.source_files (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.preflights ADD CONSTRAINT preflights_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.preflights ADD CONSTRAINT preflights_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.preflights ADD CONSTRAINT preflights_fk_3 FOREIGN KEY (owner_id, source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.preflights ADD CONSTRAINT preflights_fk_4 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.processing_contracts ADD CONSTRAINT processing_contracts_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.processing_contracts ADD CONSTRAINT processing_contracts_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.processing_contracts ADD CONSTRAINT processing_contracts_fk_3 FOREIGN KEY (owner_id, source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.processing_contracts ADD CONSTRAINT processing_contracts_fk_4 FOREIGN KEY (owner_id, schema_binding_id) REFERENCES p07.schema_bindings (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.quotes ADD CONSTRAINT quotes_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.quotes ADD CONSTRAINT quotes_fk_2 FOREIGN KEY (owner_id, contract_id) REFERENCES p07.processing_contracts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.orders ADD CONSTRAINT orders_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.orders ADD CONSTRAINT orders_fk_2 FOREIGN KEY (owner_id, contract_id) REFERENCES p07.processing_contracts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.orders ADD CONSTRAINT orders_fk_3 FOREIGN KEY (owner_id, quote_id) REFERENCES p07.quotes (owner_id, id) ON DELETE RESTRICT;
CREATE INDEX orders_owner_recent ON p07.orders(owner_id, updated_at DESC, id DESC);
ALTER TABLE p07.payment_attempts ADD CONSTRAINT payment_attempts_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.payment_attempts ADD CONSTRAINT payment_attempts_fk_2 FOREIGN KEY (owner_id, order_id) REFERENCES p07.orders (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.platform_events ADD CONSTRAINT platform_events_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.platform_events ADD CONSTRAINT platform_events_fk_2 FOREIGN KEY (owner_id, order_id) REFERENCES p07.orders (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.payment_ledger ADD CONSTRAINT payment_ledger_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.payment_ledger ADD CONSTRAINT payment_ledger_fk_2 FOREIGN KEY (owner_id, order_id) REFERENCES p07.orders (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.payment_ledger ADD CONSTRAINT payment_ledger_fk_3 FOREIGN KEY (owner_id, event_id) REFERENCES p07.platform_events (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.refunds ADD CONSTRAINT refunds_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.refunds ADD CONSTRAINT refunds_fk_2 FOREIGN KEY (owner_id, order_id) REFERENCES p07.orders (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.refunds ADD CONSTRAINT refunds_fk_3 FOREIGN KEY (owner_id, retry_of) REFERENCES p07.refunds (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.refunds ADD CONSTRAINT refunds_fk_4 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.entitlement_grants ADD CONSTRAINT entitlement_grants_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.entitlement_grants ADD CONSTRAINT entitlement_grants_fk_2 FOREIGN KEY (owner_id, contract_id) REFERENCES p07.processing_contracts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.entitlement_grants ADD CONSTRAINT entitlement_grants_fk_3 FOREIGN KEY (owner_id, order_id) REFERENCES p07.orders (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_3 FOREIGN KEY (owner_id, contract_id) REFERENCES p07.processing_contracts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_4 FOREIGN KEY (owner_id, grant_id) REFERENCES p07.entitlement_grants (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_5 FOREIGN KEY (owner_id, parent_run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_6 FOREIGN KEY (owner_id, parent_result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_7 FOREIGN KEY (owner_id, decision_batch_id) REFERENCES p07.decision_batches (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.runs ADD CONSTRAINT runs_fk_8 FOREIGN KEY (owner_id, schema_binding_id) REFERENCES p07.schema_bindings (owner_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX runs_one_root_per_contract ON p07.runs(owner_id, contract_id) WHERE parent_run_id IS NULL;
CREATE UNIQUE INDEX runs_one_active_per_task ON p07.runs(owner_id, task_id) WHERE execution_status IN ('QUEUED','RUNNING','WAITING_SCHEMA');
ALTER TABLE p07.run_budget_events ADD CONSTRAINT run_budget_events_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.run_budget_events ADD CONSTRAINT run_budget_events_fk_2 FOREIGN KEY (owner_id, contract_id) REFERENCES p07.processing_contracts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.run_budget_events ADD CONSTRAINT run_budget_events_fk_3 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.run_budget_events ADD CONSTRAINT run_budget_events_fk_4 FOREIGN KEY (owner_id, attempt_id) REFERENCES p07.stage_attempts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.stage_attempts ADD CONSTRAINT stage_attempts_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.stage_attempts ADD CONSTRAINT stage_attempts_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.stage_attempts ADD CONSTRAINT stage_attempts_fk_3 FOREIGN KEY (owner_id, job_id) REFERENCES p07.jobs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.parse_manifests ADD CONSTRAINT parse_manifests_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.parse_manifests ADD CONSTRAINT parse_manifests_fk_2 FOREIGN KEY (owner_id, source_id) REFERENCES p07.source_files (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.parse_manifests ADD CONSTRAINT parse_manifests_fk_3 FOREIGN KEY (owner_id, source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.parse_manifests ADD CONSTRAINT parse_manifests_fk_4 FOREIGN KEY (owner_id, attempt_id) REFERENCES p07.stage_attempts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.source_units ADD CONSTRAINT source_units_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.source_units ADD CONSTRAINT source_units_fk_2 FOREIGN KEY (owner_id, manifest_id) REFERENCES p07.parse_manifests (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.source_units ADD CONSTRAINT source_units_fk_3 FOREIGN KEY (owner_id, source_id) REFERENCES p07.source_files (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_proposals ADD CONSTRAINT schema_proposals_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_proposals ADD CONSTRAINT schema_proposals_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_proposals ADD CONSTRAINT schema_proposals_fk_3 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_proposals ADD CONSTRAINT schema_proposals_fk_4 FOREIGN KEY (owner_id, source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_bindings ADD CONSTRAINT schema_bindings_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_bindings ADD CONSTRAINT schema_bindings_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_bindings ADD CONSTRAINT schema_bindings_fk_3 FOREIGN KEY (owner_id, source_set_id) REFERENCES p07.source_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.schema_bindings ADD CONSTRAINT schema_bindings_fk_4 FOREIGN KEY (owner_id, proposal_id) REFERENCES p07.schema_proposals (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.result_versions ADD CONSTRAINT result_versions_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.result_versions ADD CONSTRAINT result_versions_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.result_versions ADD CONSTRAINT result_versions_fk_3 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.result_versions ADD CONSTRAINT result_versions_fk_4 FOREIGN KEY (owner_id, binding_id) REFERENCES p07.schema_bindings (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.records ADD CONSTRAINT records_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.records ADD CONSTRAINT records_fk_2 FOREIGN KEY (owner_id, result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.field_values ADD CONSTRAINT field_values_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.field_values ADD CONSTRAINT field_values_fk_2 FOREIGN KEY (owner_id, record_id) REFERENCES p07.records (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.evidence ADD CONSTRAINT evidence_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.evidence ADD CONSTRAINT evidence_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.evidence ADD CONSTRAINT evidence_fk_3 FOREIGN KEY (owner_id, source_unit_id) REFERENCES p07.source_units (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.field_evidence ADD CONSTRAINT field_evidence_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.field_evidence ADD CONSTRAINT field_evidence_fk_2 FOREIGN KEY (owner_id, field_value_id) REFERENCES p07.field_values (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.field_evidence ADD CONSTRAINT field_evidence_fk_3 FOREIGN KEY (owner_id, evidence_id) REFERENCES p07.evidence (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.record_lineage ADD CONSTRAINT record_lineage_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.record_lineage ADD CONSTRAINT record_lineage_fk_2 FOREIGN KEY (owner_id, record_id) REFERENCES p07.records (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.record_lineage ADD CONSTRAINT record_lineage_fk_3 FOREIGN KEY (owner_id, source_unit_id) REFERENCES p07.source_units (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.record_lineage ADD CONSTRAINT record_lineage_fk_4 FOREIGN KEY (owner_id, parent_record_id) REFERENCES p07.records (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.coverage_entries ADD CONSTRAINT coverage_entries_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.coverage_entries ADD CONSTRAINT coverage_entries_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.coverage_entries ADD CONSTRAINT coverage_entries_fk_3 FOREIGN KEY (owner_id, source_unit_id) REFERENCES p07.source_units (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.issues ADD CONSTRAINT issues_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.issues ADD CONSTRAINT issues_fk_2 FOREIGN KEY (owner_id, result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.issues ADD CONSTRAINT issues_fk_3 FOREIGN KEY (owner_id, record_id) REFERENCES p07.records (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_previews ADD CONSTRAINT decision_previews_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_previews ADD CONSTRAINT decision_previews_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_previews ADD CONSTRAINT decision_previews_fk_3 FOREIGN KEY (owner_id, result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_batches ADD CONSTRAINT decision_batches_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_batches ADD CONSTRAINT decision_batches_fk_2 FOREIGN KEY (owner_id, preview_id) REFERENCES p07.decision_previews (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_batches ADD CONSTRAINT decision_batches_fk_3 FOREIGN KEY (owner_id, parent_run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decision_batches ADD CONSTRAINT decision_batches_fk_4 FOREIGN KEY (owner_id, parent_result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decisions ADD CONSTRAINT decisions_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.decisions ADD CONSTRAINT decisions_fk_2 FOREIGN KEY (owner_id, batch_id) REFERENCES p07.decision_batches (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decisions ADD CONSTRAINT decisions_fk_3 FOREIGN KEY (owner_id, issue_id) REFERENCES p07.issues (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.decisions ADD CONSTRAINT decisions_fk_4 FOREIGN KEY (owner_id, evidence_id) REFERENCES p07.evidence (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.operations ADD CONSTRAINT operations_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.operations ADD CONSTRAINT operations_fk_2 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.operations ADD CONSTRAINT operations_fk_3 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.operations ADD CONSTRAINT operations_fk_4 FOREIGN KEY (owner_id, decision_batch_id) REFERENCES p07.decision_batches (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.operations ADD CONSTRAINT operations_fk_5 FOREIGN KEY (owner_id, retry_of) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX operations_one_pending_batch ON p07.operations(owner_id, decision_batch_id) WHERE status='PENDING' AND decision_batch_id IS NOT NULL;
ALTER TABLE p07.revision_reservations ADD CONSTRAINT revision_reservations_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.revision_reservations ADD CONSTRAINT revision_reservations_fk_2 FOREIGN KEY (owner_id, grant_id) REFERENCES p07.entitlement_grants (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.revision_reservations ADD CONSTRAINT revision_reservations_fk_3 FOREIGN KEY (owner_id, batch_id) REFERENCES p07.decision_batches (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.revision_reservations ADD CONSTRAINT revision_reservations_fk_4 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX revision_one_live_per_batch ON p07.revision_reservations(owner_id, batch_id) WHERE status IN ('RESERVED','CONSUMED','WAIVED');
ALTER TABLE p07.artifact_sets ADD CONSTRAINT artifact_sets_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.artifact_sets ADD CONSTRAINT artifact_sets_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.artifact_sets ADD CONSTRAINT artifact_sets_fk_3 FOREIGN KEY (owner_id, result_id) REFERENCES p07.result_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.artifacts ADD CONSTRAINT artifacts_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.artifacts ADD CONSTRAINT artifacts_fk_2 FOREIGN KEY (owner_id, artifact_set_id) REFERENCES p07.artifact_sets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.download_grants ADD CONSTRAINT download_grants_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.download_grants ADD CONSTRAINT download_grants_fk_2 FOREIGN KEY (owner_id, artifact_id) REFERENCES p07.artifacts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.download_grants ADD CONSTRAINT download_grants_fk_3 FOREIGN KEY (owner_id, evidence_id) REFERENCES p07.evidence (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.download_grants ADD CONSTRAINT download_grants_fk_4 FOREIGN KEY (owner_id, source_unit_id) REFERENCES p07.source_units (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.export_attempts ADD CONSTRAINT export_attempts_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.export_attempts ADD CONSTRAINT export_attempts_fk_2 FOREIGN KEY (owner_id, artifact_id) REFERENCES p07.artifacts (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.private_templates ADD CONSTRAINT private_templates_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.private_templates ADD CONSTRAINT private_templates_fk_2 FOREIGN KEY (owner_id, current_template_version_id) REFERENCES p07.private_template_versions (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.private_template_versions ADD CONSTRAINT private_template_versions_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.private_template_versions ADD CONSTRAINT private_template_versions_fk_2 FOREIGN KEY (owner_id, template_id) REFERENCES p07.private_templates (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.private_template_versions ADD CONSTRAINT private_template_versions_fk_3 FOREIGN KEY (owner_id, consent_id) REFERENCES p07.consents (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.consents ADD CONSTRAINT consents_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.consents ADD CONSTRAINT consents_fk_2 FOREIGN KEY (policy_id) REFERENCES p07.privacy_policies (id) ON DELETE RESTRICT;
ALTER TABLE p07.deletion_requests ADD CONSTRAINT deletion_requests_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.deletion_requests ADD CONSTRAINT deletion_requests_fk_2 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.tombstones ADD CONSTRAINT tombstones_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.tombstones ADD CONSTRAINT tombstones_fk_2 FOREIGN KEY (owner_id, deletion_request_id) REFERENCES p07.deletion_requests (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.support_tickets ADD CONSTRAINT support_tickets_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.support_tickets ADD CONSTRAINT support_tickets_fk_2 FOREIGN KEY (owner_id, order_id) REFERENCES p07.orders (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.support_tickets ADD CONSTRAINT support_tickets_fk_3 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.support_tickets ADD CONSTRAINT support_tickets_fk_4 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.support_access_grants ADD CONSTRAINT support_access_grants_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.support_access_grants ADD CONSTRAINT support_access_grants_fk_2 FOREIGN KEY (owner_id, ticket_id) REFERENCES p07.support_tickets (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.support_access_grants ADD CONSTRAINT support_access_grants_fk_3 FOREIGN KEY (owner_id, task_id) REFERENCES p07.tasks (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.idempotency_records ADD CONSTRAINT idempotency_records_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.idempotency_records ADD CONSTRAINT idempotency_records_fk_2 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.jobs ADD CONSTRAINT jobs_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
ALTER TABLE p07.jobs ADD CONSTRAINT jobs_fk_2 FOREIGN KEY (owner_id, run_id) REFERENCES p07.runs (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE p07.jobs ADD CONSTRAINT jobs_fk_3 FOREIGN KEY (owner_id, operation_id) REFERENCES p07.operations (owner_id, id) ON DELETE RESTRICT;
CREATE INDEX jobs_ready ON p07.jobs(priority DESC, available_at, id) WHERE status='READY';
CREATE INDEX jobs_expired_lease ON p07.jobs(lease_until) WHERE status='LEASED';
ALTER TABLE p07.outbox_events ADD CONSTRAINT outbox_events_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
CREATE INDEX outbox_unsent ON p07.outbox_events(available_at, id) WHERE sent_at IS NULL;
ALTER TABLE p07.audit_events ADD CONSTRAINT audit_events_fk_1 FOREIGN KEY (owner_id) REFERENCES p07.accounts (id) ON DELETE RESTRICT;
COMMIT;
