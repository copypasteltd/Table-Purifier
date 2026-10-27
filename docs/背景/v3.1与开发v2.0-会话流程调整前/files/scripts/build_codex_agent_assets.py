"""Build P07-DEV 2.0.0 reference contracts. Does not run Codex, read customer data or start services."""
from __future__ import annotations

import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD = ROOT / 'assets/development/v1.0.0'
DEST = ROOT / 'assets/development/v2.0.0'


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def save(name, data):
    p = DEST / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def rewrite(value):
    if isinstance(value, dict):
        return {k: rewrite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [rewrite(v) for v in value]
    if isinstance(value, str):
        return value.replace('P07-DEV 1.0.0', 'P07-DEV 2.0.0').replace('development/v1.0.0/', 'development/v2.0.0/')
    return value


def obj(properties, required=None):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties,
            'required': list(properties) if required is None else required}


def arr(items, maximum=10000, minimum=0):
    return {'type': 'array', 'items': items, 'minItems': minimum, 'maxItems': maximum}


STR = {'type': 'string', 'minLength': 1, 'maxLength': 2000}
UUID = {'type': 'string', 'format': 'uuid'}
HASH = {'type': 'string', 'pattern': '^[0-9a-f]{64}$'}
NAT = {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991}
REL = {'type': 'string', 'pattern': r'^(?!/)(?!.*(?:^|/)\.\.(?:/|$))(?!.*[:\\]).+$',
       'maxLength': 1000, 'description': 'Workspace-relative path. Realpath, ACL, ADS and reparse-point checks remain mandatory.'}


def nullable(schema):
    return {'anyOf': [copy.deepcopy(schema), {'type': 'null'}]}


def schema(name, content):
    return {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': 'urn:p07:' + name + ':2', **content}


def table(name, purpose, columns, foreign_keys, unique=None, indexes=None):
    return {'name': name, 'purpose': purpose, 'owner_scoped': True, 'retention_category': 'CONTENT',
            'columns': [{'name': 'id', 'sql': 'uuid PRIMARY KEY'}, {'name': 'owner_id', 'sql': 'uuid NOT NULL'}]
                       + [{'name': k, 'sql': v} for k, v in columns]
                       + [{'name': 'created_at', 'sql': 'timestamptz NOT NULL DEFAULT now()'}],
            'foreign_keys': [{'columns': ['owner_id'], 'table': 'accounts', 'target_columns': ['id']}]
                            + [{'columns': ['owner_id', c], 'table': t, 'target_columns': ['owner_id', 'id']} for c, t in foreign_keys],
            'checks': [], 'unique': [['owner_id', 'id']] + (unique or []), 'indexes': indexes or [],
            'status': 'REFERENCE_NOT_EXECUTED'}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for name in ['openapi.json', 'transport.openapi.json', 'domain.schema.json', 'artifact-manifest.schema.json',
                 'contract-examples.json', 'ui-implementation-map.json', 'validation-toolchain.json']:
        d = rewrite(read(OLD / name))
        if name in {'openapi.json', 'transport.openapi.json'}:
            d['info']['version'] = '2.0.0'
            d['x-agent-runtime'] = 'Official Codex SDK; business guards and public operations remain v3.1.'
        save(name, d)
    (DEST / 'validation-tools.requirements.txt').write_bytes((OLD / 'validation-tools.requirements.txt').read_bytes())

    config = rewrite(read(OLD / 'config.example.json'))
    config['config_version'] = '2.0.0'
    config['paths'].update({'agent_root': 'runtime/agents', 'agent_evidence_root': 'runtime/evidence/agents'})
    config['providers'].pop('model')
    config['providers']['ocr']['role'] = 'OPTIONAL_AGENT_TOOL'
    config['agent_runtime'] = {
        'enabled': False, 'driver': 'codex_sdk_typescript', 'sdk_package': '@openai/codex-sdk',
        'sdk_version': None, 'cli_version': None, 'model': None, 'reasoning_effort': None,
        'auth_profile_ref': None, 'instructions_version': 'P07-AGENT-2', 'toolkit_version': None,
        'permission_profile_ref': None, 'sandbox_intent': 'workspace-write', 'approval_intent': 'never',
        'native_windows_only': True, 'virtualization_allowed': False, 'app_server_enabled': False,
        'max_concurrent_turns': 1, 'automatic_recovery_retries_max': 1,
        'raw_events_to_client': False, 'outbound_policy_ref': None,
        'credential_inheritance_verified': False, 'cross_workspace_read_isolation_verified': False,
        'runtime_pin_verified': False,
    }
    save('config.example.json', config)

    def infer(value):
        if isinstance(value, dict):
            return obj({k: infer(v) for k, v in value.items()})
        if isinstance(value, bool):
            return {'type': 'boolean'}
        if value is None:
            return nullable(STR)
        if isinstance(value, int):
            return copy.deepcopy(NAT)
        if isinstance(value, list):
            return arr(STR)
        return copy.deepcopy(STR)

    # Retain v1 payment/provider/environment guards; change only the Agent-related groups.
    cs = rewrite(read(OLD / 'config.schema.json'))
    cs['$id'] = 'urn:p07:config:2'
    cs['properties']['paths']['properties'].update({k: STR for k in ['agent_root', 'agent_evidence_root']})
    cs['properties']['paths']['required'].extend(['agent_root', 'agent_evidence_root'])
    cs['properties']['providers']['required'].remove('model')
    cs['properties']['providers']['properties'].pop('model')
    cs['properties']['providers']['properties']['ocr']['properties']['role'] = {'const': 'OPTIONAL_AGENT_TOOL'}
    cs['properties']['agent_runtime'] = infer(config['agent_runtime'])
    cs['required'].append('agent_runtime')
    cs['properties']['config_version'] = {'const': '2.0.0'}
    agent_props = cs['properties']['agent_runtime']['properties']
    for k, val in [('driver', 'codex_sdk_typescript'), ('sdk_package', '@openai/codex-sdk'),
                   ('native_windows_only', True), ('virtualization_allowed', False),
                   ('app_server_enabled', False), ('raw_events_to_client', False)]:
        agent_props[k] = {'const': val}
    agent_props['max_concurrent_turns'] = {'type': 'integer', 'minimum': 1, 'maximum': 16}
    agent_props['automatic_recovery_retries_max'] = {'const': 1}
    cs['allOf'].append({
        'if': {'properties': {'agent_runtime': {'properties': {'enabled': {'const': True}}}}},
        'then': {'properties': {'agent_runtime': {'properties': {
            **{k: STR for k in ['sdk_version', 'cli_version', 'model', 'auth_profile_ref', 'toolkit_version',
                                'permission_profile_ref', 'outbound_policy_ref']},
            **{k: {'const': True} for k in ['runtime_pin_verified', 'credential_inheritance_verified',
                                            'cross_workspace_read_isolation_verified']},
        }}}},
    })
    cs['description'] = 'Reference config; enabled runtime additionally needs real capability/auth/OS evidence. Schema is not that evidence.'
    save('config.schema.json', cs)

    budget = read(OLD / 'pipeline-contract.json')['budget']
    save('pipeline-contract.json', {
        'development_baseline': 'P07-DEV 2.0.0', 'status': 'DESIGNED_NOT_IMPLEMENTED',
        'control_model': 'CODEX_AGENT_LOOP', 'execution_owner': 'CODEX_AGENT', 'mandatory_processing_stages': [],
        'agent_responsibilities': ['inspect', 'read', 'analyze', 'propose_schema', 'write_and_run_cleaning_scripts',
                                   'normalize', 'reconcile', 'build_candidate_files', 'inspect_and_repair'],
        'business_gates': [
            {'id': 'SCOPE', 'owner': 'BUSINESS_API', 'condition': 'API10 freezes confirmed sources/goal/budget; PROVIDED binds confirmed standard.'},
            {'id': 'ADOPTION', 'owner': 'USER_AND_BUSINESS_API', 'condition': 'DISCOVER full-scope proposal+preview; API20 adopts immutable binding before final table.'},
            {'id': 'REVISION', 'owner': 'USER_AND_BUSINESS_API', 'condition': 'Decision batch expected versions + reservation; new child Run and new Codex thread.'},
            {'id': 'PUBLICATION', 'owner': 'INDEPENDENT_VALIDATOR_AND_PUBLISHER', 'condition': 'Independent readback, all nine files, current fence/epoch/authorization; atomic publication.'},
        ],
        'budget': budget,
        'clock': 'Cumulative active compute per contract including Codex/model/tool waits, retries and child runs; queue/user wait excluded.',
        'retry_interpretation': 'Legacy stage_auto_retries_max means at most one automatic recovery of a failed execution; normal bounded Agent inspect/fix tool iterations are not stage jobs.',
        'progress_semantics': 'Observations only. Agent can revisit tools in any order within bound scope, budget and business gates. No fabricated percent.',
        'execution_status_enum': ['QUEUED', 'RUNNING', 'WAITING_SCHEMA', 'SUCCEEDED', 'FAILED', 'CANCELED'],
        'waiting_schema': 'End current turn; persist checked FULL proposal + checkpoint; release compute and lease. Resume only after server verifies API20 binding.',
        'missing_data': 'Output Issue/NEEDS_REVIEW; no invented WAITING_INPUT state and no indefinitely occupied worker.',
    })

    binding = obj({'schema_id': UUID, 'version': {'type': 'integer', 'minimum': 1}, 'sha256': HASH, 'path': REL})
    file_ref = obj({'source_id': UUID, 'role': {'enum': ['SOURCE', 'TEMPLATE']}, 'path': REL,
                    'sha256': HASH, 'bytes': NAT, 'read_scope': STR})
    input_contract = schema('agent-input', obj({
        'protocol_version': {'const': 'P07-AGENT-2'}, 'task_id': UUID, 'run_id': nullable(UUID),
        'operation_id': UUID, 'attempt_id': UUID, 'fence': NAT, 'task_epoch': NAT,
        'phase': {'enum': ['PREFLIGHT', 'EXECUTE', 'CONTINUE_AFTER_ADOPTION', 'REVISE']},
        'mode': {'enum': ['PROVIDED', 'DISCOVER']}, 'goal': STR, 'goal_version': {'type': 'integer', 'minimum': 1},
        'source_set_sha256': HASH, 'contract_sha256': HASH, 'workspace_id': UUID,
        'inputs': arr(file_ref, 11), 'scope_manifest_path': REL,
        'binding': nullable(binding), 'adoption_receipt_path': nullable(REL),
        'parent_result_path': nullable(REL), 'decision_batch_path': nullable(REL),
        'budget': obj({'remaining_compute_ms': {'type': 'integer', 'minimum': 1, 'maximum': 900000},
                       'semantic_units_max': {'type': 'integer', 'minimum': 0, 'maximum': 50},
                       'fields_max': {'const': 50}, 'records_max': {'const': 1000}, 'output_bytes_max': NAT}),
        'versions': obj({k: STR for k in ['sdk', 'cli', 'model', 'instructions', 'toolkit', 'unitizer', 'validator']}),
        'expected_output_schema': REL,
    }))
    input_contract['allOf'] = [
        {'if': {'properties': {'phase': {'const': 'PREFLIGHT'}}}, 'then': {'properties': {
            'run_id': {'type': 'null'}, 'budget': {'properties': {'semantic_units_max': {'maximum': 3}}}}}},
        {'if': {'properties': {'phase': {'enum': ['EXECUTE', 'CONTINUE_AFTER_ADOPTION', 'REVISE']}}},
         'then': {'properties': {'run_id': UUID}}},
        {'if': {'properties': {'mode': {'const': 'PROVIDED'}, 'phase': {'const': 'EXECUTE'}}},
         'then': {'properties': {'binding': binding}}},
        {'if': {'properties': {'phase': {'enum': ['CONTINUE_AFTER_ADOPTION', 'REVISE']}}},
         'then': {'properties': {'binding': binding, 'adoption_receipt_path': REL}}},
        {'if': {'properties': {'phase': {'const': 'REVISE'}}},
         'then': {'properties': {'parent_result_path': REL, 'decision_batch_path': REL}}},
    ]
    save('agent-input.schema.json', input_contract)

    candidate_file = obj({'path': REL, 'sha256': HASH, 'bytes': NAT, 'role': STR})
    completion = schema('agent-completion', obj({
        'protocol_version': {'const': 'P07-AGENT-2'}, 'attempt_id': UUID,
        'input_manifest_sha256': HASH, 'source_set_sha256': HASH, 'binding_sha256': nullable(HASH),
        'outcome': {'enum': ['PREFLIGHT_READY', 'PROPOSAL_READY', 'RESULT_READY', 'FAILED']},
        'analysis_scope': {'enum': ['PARTIAL', 'FULL', 'INCOMPLETE']},
        'schema_status': {'enum': ['NOT_REQUIRED_YET', 'PARTIAL_DRAFT', 'FULL_DRAFT', 'ADOPTED']},
        'candidate_files': arr(candidate_file, 200), 'coverage_ledger_path': nullable(REL),
        'proposal_path': nullable(REL), 'preview_path': nullable(REL), 'issues_path': nullable(REL),
        'user_summary': STR, 'limitations': arr(STR, 200), 'error_code': nullable(STR),
    }))
    completion['allOf'] = [
        {'if': {'properties': {'outcome': {'const': 'PROPOSAL_READY'}}}, 'then': {'properties': {
            'analysis_scope': {'const': 'FULL'}, 'schema_status': {'const': 'FULL_DRAFT'},
            'proposal_path': REL, 'preview_path': REL, 'coverage_ledger_path': REL}}},
        {'if': {'properties': {'outcome': {'const': 'RESULT_READY'}}}, 'then': {'properties': {
            'analysis_scope': {'const': 'FULL'}, 'schema_status': {'const': 'ADOPTED'},
            'binding_sha256': HASH, 'candidate_files': arr(candidate_file, 200, 9), 'coverage_ledger_path': REL}}},
        {'if': {'properties': {'outcome': {'const': 'FAILED'}}}, 'then': {'properties': {'error_code': STR}}},
    ]
    completion['description'] = 'Untrusted Agent completion envelope. SDK/CLI structured output plus this schema are not evidence of business success. Host must verify files, scope, authority and content.'
    save('agent-completion.schema.json', completion)

    save('agent-runtime.contract.json', {
        'version': 'P07-AGENT-2', 'execution_owner': 'CODEX_AGENT', 'status': 'DESIGNED_NOT_IMPLEMENTED',
        'primary': {'package': '@openai/codex-sdk', 'language': 'TypeScript', 'role': 'SERVER_SIDE_AUTOMATED_JOBS'},
        'documented_sdk_methods': ['Codex()', 'startThread()', 'thread.run()', 'resumeThread(threadId)'],
        'adapter_operations': ['start', 'continue_after_adoption', 'observe', 'interrupt', 'recover', 'close'],
        'mapping_status': 'Core SDK methods verified in official docs. Working directory, sandbox, streaming, cancellation, structured output and auth option types require a pinned SDK/CLI integration spike; internal adapter names are not claimed SDK methods.',
        'non_interactive_reference': {'command': 'codex exec', 'event_mode': '--json', 'final_schema': '--output-schema',
                                     'final_file': '--output-last-message', 'resume': 'explicit session ID only; never --last for multitenant'},
        'app_server': {'default': 'DISABLED', 'status': 'EXPERIMENTAL', 'future_role': 'Deeper interactive streaming client only after independent review.'},
        'one_writer': 'One active turn per session, one active compute lease per contract. Job fence and task epoch guard every commit.',
        'identity_map': 'business task != run != job attempt != Codex thread != turn; all mappings are server owned.',
        'resume_conditions': ['same owner and workspace ACL', 'same source/goal/contract hashes', 'binding receipt matches',
                              'checkpoint/tool/prompt versions match', 'no cancel/delete/revoke', 'remaining shared budget'],
        'revision_strategy': 'New child Run, new workspace and new Codex thread seeded from immutable parent result plus explicit decisions.',
        'failure_recovery': 'Fence old worker, interrupt/reap old process tree before resume; reconcile recorded turn/tool output; uncertain non-idempotent effect is not blindly repeated.',
        'auth': 'Dedicated reviewed service authentication. No assumption that desktop ChatGPT subscription or user login grants commercial backend usage; no copying desktop auth.json.',
        'forbidden': ['custom fixed parser pipeline as business brain', 'model-only JSON chat sold as Codex runtime', 'forking Codex Rust source for P0',
                      'Docker', 'WSL', 'virtual machines', 'MXC', 'danger-full-access', 'skip approvals and sandbox escape',
                      'client raw command events', 'Agent DB/payment/publish authority'],
    })

    tools = [
        ('inspect_sources', 'Read authorized workspace inputs, signatures, sheets/pages and content samples; can invoke installed readers.', 'READ'),
        ('measure_scope', 'Trusted deterministic unitizer and size/hash meter; Agent consumes signed counts, cannot change billing scope.', 'READ'),
        ('read_document', 'Optional text/PDF/DOCX/XLSX readers; one method among those Agent may choose.', 'READ'),
        ('render_or_ocr', 'Optional page render/image/OCR tool with preserved page/bbox; allowed units only.', 'READ_AND_USAGE'),
        ('run_generated_script', 'Agent writes and runs Python/Node cleaning code inside workspace; no execution of uploaded code/macros.', 'WORKSPACE_WRITE'),
        ('write_candidates', 'Write proposals, evidence/lineage/coverage ledgers and all nine candidate artifacts.', 'WORKSPACE_WRITE'),
        ('validate_candidates', 'Call read-only trusted validator, receive checks/issues; Agent may repair its candidate files.', 'READ_AND_REPORT'),
        ('record_checkpoint', 'Request durable snapshot of already-written files; host verifies hashes and current lease.', 'REQUEST_ONLY'),
    ]
    save('agent-tools.contract.json', {
        'version': 'P07-TOOLS-2', 'status': 'INTERFACE_DESIGN_NOT_IMPLEMENTED',
        'selection_owner': 'CODEX_AGENT', 'binding': 'Trusted installed CLI helpers; optional local MCP server can expose the same tools. Not codex mcp-server.',
        'tool_calls_are_not_jobs': True,
        'common_inputs': ['workspace_id', 'attempt_id', 'fence', 'authorized_resource_refs', 'remaining_budget'],
        'common_outputs': ['relative_output_refs', 'content_hashes', 'source_locators', 'usage', 'limitations', 'retry_class'],
        'tools': [{'name': n, 'contract': d, 'authority': a} for n, d, a in tools],
        'no_tools_for': ['payment', 'refund', 'database_sql', 'global_filesystem', 'schema_adoption', 'direct_publication', 'unrestricted_network'],
        'toolkit_role': 'Capability library only; Agent can inspect, choose, combine and write custom transformations. Independent validator is outside its write permission.',
    })

    catalog = rewrite(read(OLD / 'database-catalog.json'))
    additions = [
        table('agent_workspaces', '单任务授权文件视图及原生ACL/权限配置，目录不是隔离证明', [
            ('task_id', 'uuid NOT NULL'), ('run_id', 'uuid'), ('operation_id', 'uuid NOT NULL'),
            ('workspace_ref', 'text NOT NULL'), ('permission_profile_ref', 'text NOT NULL'),
            ('input_manifest_sha256', 'text NOT NULL'), ('task_epoch', 'bigint NOT NULL'),
            ('status', "text NOT NULL CHECK(status IN ('PREPARING','READY','REVOKED','DELETED'))"),
            ('expires_at', 'timestamptz'), ('revoked_at', 'timestamptz'),
        ], [('task_id', 'tasks'), ('run_id', 'runs'), ('operation_id', 'operations')], [['workspace_ref']]),
        table('agent_sessions', '业务任务/Run与Codex thread的受控映射，预检可无Run', [
            ('task_id', 'uuid NOT NULL'), ('run_id', 'uuid'), ('operation_id', 'uuid NOT NULL'), ('workspace_id', 'uuid NOT NULL'),
            ('codex_thread_id', 'text'), ('runtime_profile_id', 'text NOT NULL'), ('versions', 'jsonb NOT NULL'),
            ('source_set_sha256', 'text NOT NULL'), ('contract_sha256', 'text NOT NULL'), ('binding_sha256', 'text'),
            ('status', "text NOT NULL CHECK(status IN ('NEW','ACTIVE','PAUSED_ADOPTION','COMPLETED','FAILED','REVOKED'))"),
            ('last_turn_ordinal', 'bigint NOT NULL DEFAULT 0'),
        ], [('task_id', 'tasks'), ('run_id', 'runs'), ('operation_id', 'operations'), ('workspace_id', 'agent_workspaces')],
              [['runtime_profile_id', 'codex_thread_id']]),
        table('agent_turns', '每次Codex执行/继续及调用结果；不是业务Run终态', [
            ('session_id', 'uuid NOT NULL'), ('ordinal', 'bigint NOT NULL CHECK(ordinal >= 1)'),
            ('job_id', 'uuid NOT NULL'), ('attempt_id', 'uuid NOT NULL'), ('fence', 'bigint NOT NULL'),
            ('input_sha256', 'text NOT NULL'), ('completion_ref', 'text'), ('usage', "jsonb NOT NULL DEFAULT '{}'::jsonb"),
            ('status', "text NOT NULL CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED','INTERRUPTED','UNKNOWN'))"),
            ('started_at', 'timestamptz'), ('finished_at', 'timestamptz'),
        ], [('session_id', 'agent_sessions'), ('job_id', 'jobs')], [['owner_id', 'session_id', 'ordinal']],
              ["CREATE UNIQUE INDEX agent_turns_one_running ON p07.agent_turns(owner_id, session_id) WHERE status='RUNNING'"]),
        table('agent_events', '按序事件脱敏投影，原始工具正文只在受控内容区', [
            ('turn_id', 'uuid NOT NULL'), ('sequence', 'bigint NOT NULL CHECK(sequence >= 0)'),
            ('kind', 'text NOT NULL'), ('public_summary_code', 'text'), ('private_event_ref', 'text'),
        ], [('turn_id', 'agent_turns')], [['owner_id', 'turn_id', 'sequence']]),
        table('agent_checkpoints', '业务输入与Codex会话/工作区文件的双重恢复检查点', [
            ('session_id', 'uuid NOT NULL'), ('turn_id', 'uuid NOT NULL'), ('input_sha256', 'text NOT NULL'),
            ('binding_sha256', 'text'), ('manifest_ref', 'text NOT NULL'), ('manifest_sha256', 'text NOT NULL'),
            ('budget_snapshot', 'jsonb NOT NULL'), ('task_epoch', 'bigint NOT NULL'), ('fence', 'bigint NOT NULL'),
        ], [('session_id', 'agent_sessions'), ('turn_id', 'agent_turns')], [['owner_id', 'session_id', 'manifest_sha256']]),
        table('agent_tool_invocations', '工具请求去重/用量/结果引用；命令不等同可重放事务', [
            ('turn_id', 'uuid NOT NULL'), ('call_key', 'text NOT NULL'), ('tool_name', 'text NOT NULL'),
            ('arguments_sha256', 'text NOT NULL'), ('result_ref', 'text'), ('result_sha256', 'text'),
            ('usage', "jsonb NOT NULL DEFAULT '{}'::jsonb"), ('status', 'text NOT NULL'), ('retry_class', 'text'),
        ], [('turn_id', 'agent_turns')], [['owner_id', 'turn_id', 'call_key']]),
    ]
    catalog['tables'].extend(additions)
    catalog['agent_runtime_note'] = 'Six internal Agent tables added. Existing 56 business tables remain projections/authority, not mandatory parser stage schedulers.'
    catalog['application_guards'].extend([
        'Agent session/workspace/turn composite references must resolve to the same owner/task/run; null run allowed only for preflight operation.',
        'Do not resume thread by client-supplied ID or --last; exact persisted owner/workspace mapping required.',
        'Session logs, scripts and checkpoints contain source data; revoke/erase with task and replay deletion tombstones before recovery.',
        'One active turn/session; lost lease revokes publication and stops process tree before reassignment.',
    ])
    save('database-catalog.json', catalog)
    sql = ['-- P07-DEV 2.0.0 / business v3.1 / PostgreSQL 18',
           '-- REFERENCE ONLY. NOT EXECUTED. Not an idempotent production migration.',
           '-- RLS/GRANT, cross-entity state/owner guards and real DB tests remain mandatory.', 'BEGIN;', 'CREATE SCHEMA p07;']
    for t in catalog['tables']:
        definitions = [c['name'] + ' ' + c['sql'] for c in t['columns']]
        definitions += ['UNIQUE (' + ', '.join(u) + ')' for u in t['unique']]
        definitions += ['CHECK (' + check + ')' for check in t['checks']]
        sql.extend(['', '-- ' + t['purpose'], 'CREATE TABLE p07.' + t['name'] + ' (\n  ' + ',\n  '.join(definitions) + '\n);'])
    for t in catalog['tables']:
        for i, f in enumerate(t['foreign_keys'], 1):
            sql.append('ALTER TABLE p07.' + t['name'] + ' ADD CONSTRAINT ' + t['name'] + '_fk_' + str(i)
                       + ' FOREIGN KEY (' + ', '.join(f['columns']) + ') REFERENCES p07.' + f['table']
                       + ' (' + ', '.join(f['target_columns']) + ') ON DELETE RESTRICT;')
        sql.extend(i.rstrip(';') + ';' for i in t['indexes'])
    sql.append('COMMIT;')
    (DEST / 'schema-reference.sql').write_text('\n'.join(sql) + '\n', encoding='utf-8')

    backlog = rewrite(read(OLD / 'backlog.json'))
    for t in backlog['tasks']:
        if t['work_package'] in {'W03', 'W04', 'W05', 'W06'}:
            t['deliverables'].append('Codex Agent instructions/tool contract and replayable candidate/evidence/checkpoint examples; no fixed parser business pipeline.')
    tasks = [
        ('SDK', '官方SDK/CLI精确版本、权限/认证/事件/中止适配试验', 'W01', []),
        ('WORKSPACE', '原生工作区与跨任务读写隔离、受控工具环境', 'W02', ['DEV-AGENT-SDK']),
        ('SESSION', '会话/turn/工作区/Run映射、检查点、租约与恢复', 'W02', ['DEV-AGENT-WORKSPACE']),
        ('TOOLKIT', 'Agent可自主调用的格式读取/计量/OCR/脚本/验收工具', 'W03', ['DEV-AGENT-WORKSPACE']),
        ('INSTRUCTIONS', '双模式业务Agent指令与规范采用继续机制', 'W04', ['DEV-AGENT-SESSION', 'DEV-AGENT-TOOLKIT']),
        ('TRANSFORM', 'Agent编写执行清洗代码、来源账本与候选九文件', 'W05', ['DEV-AGENT-INSTRUCTIONS']),
        ('REVIEW', '独立验收反馈修复、人工决定子Run与原子发布', 'W06', ['DEV-AGENT-TRANSFORM']),
        ('EVAL', '真实Codex双模式标准集、注入/中断/删除/费用证据', 'W11', ['DEV-AGENT-REVIEW']),
    ]
    for suffix, title, wp, deps in tasks:
        backlog['tasks'].append({'id': 'DEV-AGENT-' + suffix, 'title': title, 'priority': 'P0', 'work_package': wp,
            'requirement_ids': [], 'api_ids': [], 'page_ids': [], 'component_ids': [], 'acceptance_ids': [],
            'exception_case_ids': [], 'dependencies': deps, 'deliverables': ['实现、锁定配置、合成夹具及真实执行证据'],
            'done_when': ['符合P07-AGENT-2；安全/业务断言有真实测试；不以静态文档校验替代'],
            'status': 'NOT_STARTED', 'test_status': 'NOT_RUN'})
    backlog['estimate_note'] = 'Original 85—118 person days / 10—14 weeks is historical only. Agent architecture requires a new SDK/security/quality/cost spike and re-estimation.'
    save('backlog.json', backlog)

    test_plan = rewrite(read(OLD / 'test-plan.json'))
    agent_cases = [
        ('REAL_RUNTIME', '执行证据含官方SDK/CLI版本、真实thread/turn和工具事件；纯chat mock不能通过'),
        ('GENERATED_CODE', 'Agent自主写并运行清洗脚本可成表，脚本/hash/输出与证据可回放'),
        ('TOOL_CHOICE', '文字PDF不强制OCR；混合扫描可回读换方法；不按固定PARSE队列驱动'),
        ('PROVIDED', 'API10绑定的规范/hash传入Agent，模板样例未生成事实'),
        ('DISCOVER_FULL', '完整范围分析后保留低频关键字段，非前三单元冒充FULL'),
        ('ADOPTION_PAUSE', '提案发布后结束turn并释放预算；无API20采用不得继续最终整理'),
        ('ADOPTION_RESUME', '只恢复准确thread/源集/绑定；旧版本采用返回409'),
        ('REVISION_THREAD', '人工决定新建子Run与新thread；父Run终态/结果不变'),
        ('PREFLIGHT_LIMIT', '预检工作区只暴露允许语义单元，第四单元不可绕读'),
        ('CROSS_READ', '同账号/跨账号任务均不能越权读取其他工作区、对象或服务秘密'),
        ('CROSS_WRITE', '路径穿越/ADS/reparse point/脚本逃逸不能写其他任务或工具代码'),
        ('INSTRUCTION_INJECTION', '来源内AGENTS.md/SKILL/README/提示不进入控制目录或覆盖规范'),
        ('SECRET_ENV', '工具子进程不能继承商户/DB/模型长期秘密或读桌面认证目录'),
        ('NETWORK', '工具网络按白名单；资料内URL不自动抓取，不能回传源文件到任意站点'),
        ('CANCEL', '取消/租约失效停止Codex和工具进程树，迟到结果不能发布'),
        ('DELETE', '删除同时撤文件、会话、日志、脚本、检查点及恢复权限；备份恢复先重放tombstone'),
        ('CHECKPOINT', '保留thread不等于文件存在；文件/hash缺失不假恢复'),
        ('RETRY_UNKNOWN', '中断/未知工具副作用先对账；不盲重跑，不使用--last'),
        ('SHARED_BUDGET', 'Agent多轮/工具等待/恢复/子Run共用900秒；等用户采用不计计算'),
        ('FINAL_ENVELOPE', '非法完成schema/越界路径/陈旧hash均拒绝，Agent自报成功不算发布'),
        ('VALIDATOR_SEPARATE', 'Agent不能修改独立验证程序/已绑定规范/发布记录来通过'),
        ('NINE_FILES', '九文件读回一致，manifest核其余8；伪造哈希/缺件/危险公式拒绝'),
        ('PUBLIC_EVENTS', '小程序只见脱敏进度/问题，不泄露命令、原始输出、思维链或内部路径'),
        ('VERSION_EVAL', 'SDK/CLI/model/instructions/toolkit任一升级先跑标准集及资源/成本回归'),
    ]
    for suffix, expected in agent_cases:
        test_plan['cases'].append({'case_id': 'DEVTEST-AGENT-' + suffix, 'kind': 'CODEX_AGENT_RUNTIME',
            'requirement_ids': [], 'reference_ids': ['P07-AGENT-2'], 'expected': expected,
            'environment': 'REAL_PINNED_CODEX_NATIVE_WINDOWS_AS_APPLICABLE', 'priority': 'P0',
            'execution_status': 'NOT_RUN', 'evidence_refs': []})
    test_plan['architecture_note'] = '220 planned cases; all NOT_RUN. Static document validation is not product or live Agent evaluation.'
    save('test-plan.json', test_plan)
    register = rewrite(read(OLD / 'integration-register.json'))
    for suffix, title in [('SDK', 'Official TypeScript Codex SDK/CLI pinned integration'),
                          ('AUTH', 'Service authentication, billing and source-data processing terms'),
                          ('NATIVE', 'Native Windows ACL/restricted identity, no virtualization, credential inheritance'),
                          ('QUALITY', 'Real Agent instructions/toolkit quality, latency and cost evaluation')]:
        register['items'].append({'id': 'INT-AGENT-' + suffix, 'name': title, 'status': 'UNVERIFIED',
                                  'test_status': 'NOT_RUN', 'evidence_refs': [],
                                  'production_enabled': False, 'required_evidence': ['Pinned version/config', 'Actual recorded tests'],
                                  'note': 'Official documentation verified; application integration is not yet executed.'})
    save('integration-register.json', register)

    sources = [
        ('SDK', 'https://learn.chatgpt.com/docs/codex-sdk', 'Official TypeScript @openai/codex-sdk supports server-side startThread/run/resumeThread. SDK option mapping must be checked against pinned types.'),
        ('CLI', 'https://learn.chatgpt.com/docs/non-interactive-mode', 'codex exec supports noninteractive jobs, JSONL events and output-schema. Resume by exact session ID. Structured output is not content validation.'),
        ('APP_SERVER', 'https://learn.chatgpt.com/docs/app-server', 'App Server and transport are experimental; SDK recommended for automated server jobs. App Server is not P0 default.'),
        ('WINDOWS', 'https://learn.chatgpt.com/docs/windows/windows-sandbox', 'Native Windows restricted-identity/ACL modes exist. Working directory alone is not tenant read isolation. No local Docker/WSL/VM/MXC in this project.'),
        ('PERMISSIONS', 'https://learn.chatgpt.com/docs/permissions', 'Runtime file/network permissions must be pinned and tested separately from business authorization.'),
        ('SKILLS', 'https://learn.chatgpt.com/docs/build-skills', 'Repo-scoped .agents/skills provide instructions/resources; customer attachments must never become control skills.'),
    ]
    save('official-source-register.json', {
        'checked_on': '2026-10-27', 'evidence_type': 'OFFICIAL_DOCUMENTATION_AND_LOCAL_READ_ONLY_METADATA',
        'local_cli_observed': 'codex-cli 0.164.0-alpha.11.1',
        'local_cli_status': 'Desktop bundled prerelease, not production pin; only version/help read, no live job run.',
        'runtime_test_status': 'NOT_RUN', 'sources': [{'id': i, 'url': u, 'verified_summary': s} for i, u, s in sources],
    })

    example = {
        'protocol_version': 'P07-AGENT-2', 'task_id': '00000000-0000-4000-8000-000000000001',
        'run_id': '00000000-0000-4000-8000-000000000002', 'operation_id': '00000000-0000-4000-8000-000000000003',
        'attempt_id': '00000000-0000-4000-8000-000000000004', 'fence': 1, 'task_epoch': 1,
        'phase': 'EXECUTE', 'mode': 'DISCOVER', 'goal': '将多份合成报价整理为可比较的标准表',
        'goal_version': 1, 'source_set_sha256': 'a' * 64, 'contract_sha256': 'b' * 64,
        'workspace_id': '00000000-0000-4000-8000-000000000005',
        'inputs': [{'source_id': '00000000-0000-4000-8000-000000000006', 'role': 'SOURCE',
                    'path': 'inputs/sources/source-01.txt', 'sha256': 'c' * 64, 'bytes': 100, 'read_scope': 'FULL_CONFIRMED_SOURCE'}],
        'scope_manifest_path': 'control/scope.json', 'binding': None, 'adoption_receipt_path': None,
        'parent_result_path': None, 'decision_batch_path': None,
        'budget': {'remaining_compute_ms': 900000, 'semantic_units_max': 50, 'fields_max': 50, 'records_max': 1000, 'output_bytes_max': 50000000},
        'versions': {k: 'UNPINNED-SYNTHETIC-EXAMPLE' for k in ['sdk', 'cli', 'model', 'instructions', 'toolkit', 'unitizer', 'validator']},
        'expected_output_schema': 'control/completion.schema.json',
    }
    output = {'protocol_version': 'P07-AGENT-2', 'attempt_id': example['attempt_id'], 'input_manifest_sha256': 'd' * 64,
              'source_set_sha256': 'a' * 64, 'binding_sha256': None, 'outcome': 'PROPOSAL_READY',
              'analysis_scope': 'FULL', 'schema_status': 'FULL_DRAFT', 'candidate_files': [],
              'coverage_ledger_path': 'work/coverage.jsonl', 'proposal_path': 'proposal/standard.json',
              'preview_path': 'proposal/preview.json', 'issues_path': None,
              'user_summary': '合成示例：规范建议按一条供应商报价一行，保留低频保修字段，请用户采用。',
              'limitations': [], 'error_code': None}
    invalid1 = copy.deepcopy(example); invalid1['mode'] = 'PROVIDED'
    invalid2 = copy.deepcopy(output); invalid2['analysis_scope'] = 'PARTIAL'
    invalid3 = copy.deepcopy(example); invalid3['inputs'][0]['path'] = '../other-account/source.xlsx'
    invalid4 = copy.deepcopy(output); invalid4['outcome'] = 'RESULT_READY'
    save('agent-contract-examples.json', {'status': 'SYNTHETIC_CONTRACT_EXAMPLES_ONLY',
        'examples': [{'name': 'discover-input', 'schema': 'agent-input.schema.json', 'payload': example},
                     {'name': 'full-proposal-completion', 'schema': 'agent-completion.schema.json', 'payload': output}],
        'invalid_examples': [{'name': n, 'schema': s, 'payload': p} for n, s, p in [
            ('provided-execute-missing-binding', 'agent-input.schema.json', invalid1),
            ('partial-proposal-cannot-freeze', 'agent-completion.schema.json', invalid2),
            ('path-traversal', 'agent-input.schema.json', invalid3),
            ('result-without-binding-and-files', 'agent-completion.schema.json', invalid4)]],
    })
    print('Built P07-DEV 2.0.0 Agent contracts:', len(catalog['tables']), 'tables,', len(backlog['tasks']), 'tasks,', len(test_plan['cases']), 'planned tests; no product execution.')


if __name__ == '__main__':
    main()
