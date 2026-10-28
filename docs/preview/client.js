// Documentation-only fixtures. The production client is never modified or imported here.
import {quotationFixture} from './quotation-fixture.js';
export const state = {};
export const sampleText = '【合成演示资料，不对应真实人员或交易】\n样例甲，插画组，报名费 29.90 元，2026-10-26。\n样例乙，摄影组，报名费 59.00 元，2026-10-27。\n样例丙，插画组，报名费待确认，2026-10-27。';
let schema = {
  schema_id: 'demo-schema', version: 1, row_kind: '一位活动报名者对应一行',
  identity_keys: ['name'], locale: 'zh-CN', timezone: 'Asia/Shanghai', rules: [],
  rounding_policy: 'HALF_UP', export_policy: { formula_policy: 'ESCAPE' },
  fields: [
    { field_id: 'name', label: '报名者', type: 'TEXT', description: '只采用原资料中的报名标识', required: true, nullable: false },
    { field_id: 'group', label: '活动组别', type: 'ENUM', enum_values: ['插画组', '摄影组'], closed_enum: true, description: '统一组别写法，保留原始含义', required: true, nullable: false },
    { field_id: 'amount', label: '报名费', type: 'DECIMAL', scale: 2, unit: 'CNY', description: '精确到分；没有依据的费用留待确认', required: true, nullable: true },
    { field_id: 'date', label: '报名日期', type: 'DATE', description: '统一为 YYYY-MM-DD', required: true, nullable: false },
  ].map((f, order) => ({ unit: null, ...f, order })),
};
const names = ['样例甲', '样例乙', '样例丙'];
let records = names.map((name, ordinal) => ({
  record_id: `demo-record-${ordinal + 1}`, ordinal, disposition: ordinal === 2 ? 'NEEDS_REVIEW' : 'ACCEPTED',
  fields: [name, ordinal === 1 ? '摄影组' : '插画组', ['29.90', '59.00', null][ordinal], ordinal ? '2026-10-27' : '2026-10-26']
    .map((typed_value, i) => ({ field_id: schema.fields[i].field_id, typed_value,
      status: typed_value === null ? 'MISSING' : 'EXTRACTED', evidence_ids: ['demo-evidence'] })),
}));
export let issue = { issue_id: 'demo-issue', record_id: 'demo-record-3', field_id: 'amount', severity: 'BLOCKER',
  message: '样例丙的报名费尚无明确依据，请保留待确认或由你补充。', evidence_ids: ['demo-evidence'],
  allowed_decisions: ['USER_VALUE', 'KEEP_UNRESOLVED'] };
let evidence = { evidence_id: 'demo-evidence', source_unit_id: 'demo-unit-3',
  excerpt: '样例丙，插画组，报名费待确认，2026-10-27。',
  locator: { page_or_ordinal: 3, path: '文字资料 / 第 3 条' }, limitations: ['只保留结果所需摘录；此预览使用合成数据。'] };
const artifactNames = ['standard.xlsx', 'standard.json', 'result.xlsx', 'accepted.csv', 'result.json', 'issues.xlsx', 'provenance.jsonl', 'validation.json', 'manifest.json'];
const artifacts = artifactNames.map((name, i) => ({ artifact_id: `demo-file-${i}`, name, bytes: [9432, 1536, 10812, 186, 2974, 8012, 1390, 764, 2531][i], sha256: '0'.repeat(64) }));
let database, created = 0, analysis = 0, batch = 0;
const copy = x => x === undefined ? undefined : structuredClone(x);
const registration={schema,records,issue,evidence};
const wait = () => new Promise(resolve => setTimeout(resolve, 65));
export function reset(stage = 'empty',scenario='registration') {
  const fixture=scenario==='quotation'?quotationFixture():registration;
  ({schema,records,issue,evidence}=copy(fixture));
  for (const key of Object.keys(state)) delete state[key];
  const unit = __P07_PROVIDER__ === 'ALIPAY' ? 'CNY_FEN' : 'DOUYIN_DIAMOND';
  database = {
    session: { session_id: 'demo-session', version: 1, status: 'READY_FOR_INPUT', idle_expires_at: '2026-10-28T18:30:00+08:00' },
    task: { task_id: 'demo-task', agent_session_id: 'demo-session', version: 1, source_set_version: 1, goal_version: 1,
      mode: 'DISCOVER', goal: '汇总活动报名信息，一位报名者对应一行', sources: [], latest_preflight: { processing_units: 3 } },
    proposal: { proposal_id: 'demo-proposal', version: 1, schema, coverage: { read_units: 3, confirmed_units: 3 },
      preview_records: records, unmapped_important: [] },
    plan: { plan_id: 'demo-plan', version: 1, plan_hash: 'documentation-plan-hash', status: 'PROPOSED', estimated_records: 3,
      strategy_summary: '逐条归并活动报名资料，统一字段与日期，缺失费用留待确认。',
      limitations: ['报名费缺少依据时不填猜测值；示例报价仅用于文档演示。'] },
    quote: { quote_id: 'demo-quote', access_mode: 'PAID', amount: { amount_minor: unit === 'CNY_FEN' ? 199 : 12, amount_unit: unit }, expires_at: '2026-10-28T18:00:00+08:00' },
    order: { order_id: 'DEMO-NOT-A-REAL-ORDER', payment_status: 'PENDING', fulfillment_status: 'NOT_STARTED', refund_status: 'NONE', refunded_minor: 0,
      amount: { amount_minor: unit === 'CNY_FEN' ? 199 : 12, amount_unit: unit } },
    run: { run_id: 'demo-run', version: 1, execution_status: 'RUNNING', stage: 'AGENT_BATCH', quality_status: 'NEEDS_REVIEW', result_version: null },
    template: { template_id: 'demo-template', name: '活动报名信息规范', version: 1, schema }, binding: null, contract: null,
  };
  created = analysis = batch = 0;
  if (stage !== 'empty') {
    state.session = copy(database.session);
    if (stage !== 'ready') {
      database.task.sources = fixture.sources?copy(fixture.sources):[{ source_id: 'demo-source', name: '活动报名文字资料', role: 'SOURCE', status: 'RECEIVED', bytes: new TextEncoder().encode(sampleText).length }];
      if(scenario==='quotation'){database.task.goal='汇总供应商报价，一件商品一行';database.proposal.preview_records=copy(records.slice(0,2));}
      state.task = copy(database.task); state.consent = 'demo-consent';
      database.session.status = 'WAITING_CONFIRMATION';
      state.proposal = copy(database.proposal);
    }
  }
  if (['plan', 'quoted', 'delivered'].includes(stage)) {
    database.binding = 'demo-binding'; database.session.status = 'QUOTABLE';
  }
  if (['quoted', 'delivered'].includes(stage)) {
    database.contract = 'demo-contract'; database.plan.status = 'CONFIRMED'; state.quote = copy(database.quote);
    state.confirmation = { contract_id: database.contract, contract_hash: 'documentation-contract-hash' };
  }
  if (stage === 'delivered') complete();
  if (state.session) state.session = copy(database.session);
  state.capability = { flags: { agent: true, file_input: false, template_input: false, export: true, paid_batch: true } };
}
function complete() {
  database.session.status = 'CLOSED'; database.run.execution_status = 'SUCCEEDED'; database.run.stage = 'PUBLISHED'; database.run.result_version = 1;
  database.order.payment_status = 'CONFIRMED'; database.order.fulfillment_status = 'DELIVERABLE';
  database.task.current_run_id = 'demo-run'; database.task.current_result_version = 1;
  database.task.sources.forEach(s => { s.status = 'PURGED'; });
  state.task = copy(database.task); state.run = copy(database.run); state.order = copy(database.order); state.resultSchema = copy(schema);
}
export async function api(path, method = 'GET', body) {
  await wait(); const route = path.split('?')[0];
  if (route === '/capabilities') return copy(state.capability);
  if (route === '/privacy/policies') return { policy_version: 'DEMO-POLICY / 文档合成示例', processors: [],
    purposes: ['仅处理你主动提交的资料，用于规范推荐、整理与结果验收。'],
    retention_categories: [{ category: 'TASK_RUNTIME', limitations: '产出持久保存后清理整个任务环境和原始资料。' }, { category: 'RESULT', limitations: '最终九文件持续保留；主动隐私删除单独处理。' }] };
  if (route === '/privacy/consents') return { consent_id: 'demo-consent' };
  if (route === '/agent-sessions' && method === 'POST') {
    database.session.status = 'INITIALIZING'; created = Date.now(); return copy(database.session);
  }
  if (route.startsWith('/agent-sessions/')) {
    if (route.includes('demo-rework')) return { session_id: 'demo-rework', version: 1, status: 'READY_FOR_INPUT' };
    if (created && Date.now() - created > 700 && database.session.status === 'INITIALIZING') database.session.status = 'READY_FOR_INPUT';
    if (analysis && Date.now() - analysis > 1200 && database.session.status === 'ANALYZING') database.session.status = 'WAITING_CONFIRMATION';
    if (batch && Date.now() - batch > 1300) complete();
    return copy(database.session);
  }
  if (route === '/tasks') {
    if (method === 'POST') { database.task.mode = body.mode; database.task.goal = body.optional_goal || database.task.goal; return copy(database.task); }
    return { items: database.task.sources.length ? [copy(database.task)] : [], next_cursor: null };
  }
  if (route.endsWith('/sources')) {
    database.task.sources.push({ source_id: 'demo-source', name: '活动报名文字资料', bytes: new TextEncoder().encode(body.text).length, role: 'SOURCE', status: 'RECEIVED' });
    database.session.status = 'INPUT_RECEIVED'; return copy(database.task.sources[0]);
  }
  if(method==='DELETE'&&route.includes('/sources/')){database.task.sources=database.task.sources.filter(s=>s.source_id!==route.split('/').at(-1));database.task.version++;return {};}
  if (route.endsWith('/preflight')) { analysis = Date.now(); database.session.status = 'ANALYZING'; return { status: 'QUEUED' }; }
  if (route.endsWith('/schema-proposal')) return copy(database.proposal);
  if (route.endsWith('/schema-adoptions')) { database.binding = 'demo-binding'; database.session.status = 'QUOTABLE'; return { binding_id: database.binding }; }
  if (route.endsWith('/confirmations')) { database.contract = 'demo-contract'; database.plan.status = 'CONFIRMED'; return { contract_id: database.contract, contract_hash: 'documentation-contract-hash' }; }
  if (route.endsWith('/quotes')) return copy(database.quote);
  if (route === '/orders' && method === 'POST') { database.session.status = 'AWAITING_PAYMENT'; return copy(database.order); }
  if (route.endsWith('/checkout')) return { provider_checkout_payload: { query_required: false, mode: 'DOCUMENTATION_FIXTURE' } };
  if (route === '/orders') return { items: state.order ? [copy(database.order)] : [], next_cursor: null };
  if (route.startsWith('/orders/')) return copy(database.order);
  if (route.endsWith('/runs') && method === 'POST') {
    if (database.order.payment_status !== 'CONFIRMED') throw new Error('文档夹具尚未模拟服务端付款确认。');
    batch = Date.now(); database.session.status = 'BATCH_RUNNING'; database.task.current_run_id = 'demo-run'; return copy(database.run);
  }
  if (route.endsWith('/records')) return { records: copy(records), counts: { total_candidates: 3, accepted: 2, needs_review: 1, excluded: 0 }, next_cursor: null };
  if (route.endsWith('/issues')) return { issues: [copy(issue)], affected_records: 1, next_cursor: null };
  if (route.endsWith('/artifacts')) return { artifacts: copy(artifacts), result_version: 1 };
  if (route.startsWith('/evidence/')) return copy(evidence);
  if (route.startsWith('/runs/')) return copy(database.run);
  if (route.endsWith('/download-link')) return { signed_url: 'https://documentation-fixture.invalid/no-real-file' };
  if (route === '/private-templates') return { items: [copy(database.template)], next_cursor: null };
  if (route.startsWith('/private-templates/')) return copy(database.template);
  if (route.startsWith('/tasks/')) return copy(database.task);
  throw new Error(`Unimplemented documentation fixture: ${method} ${route}`);
}
export function mockPaymentConfirmation() { database.order.payment_status = 'CONFIRMED'; }
export async function readPlan() { await wait(); return { plan: copy(database.plan), binding_id: database.binding, contract_id: database.contract, contract_hash: database.contract ? 'documentation-contract-hash' : null }; }
export async function businessTransport() { return { is_correction: false, authorization: { status: 'NOT_REQUESTED' } }; }
export async function refreshTask() { if (state.task) state.task = copy(database.task); return state.task; }
export async function resultSchema() { state.resultSchema = copy(schema); return state.resultSchema; }
export async function orderContext() { return { task_id: database.task.task_id, session_id: database.session.session_id }; }
export async function prepareRework() { return { session_id: 'demo-rework' }; }
export function clearDraft() { for (const k of Object.keys(state)) if (k !== 'capability') state[k] = null; }
export async function restore() {}
export function remember() {}
export function deletionReference() { return null; }
export function rememberDeletion() {}
reset();
