"""Verify P07-DEV 2 documentation/contracts/history. Never executes a Codex task or application."""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.metadata
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / 'assets/development/v2.0.0'
HISTORY = ROOT / 'docs/背景/开发v1.0.0-固定流水线'
REPORT = ROOT / 'docs/评审/P07-Codex-Agent开发文档-v2.0.0-核验-2026-10-27.json'
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'runtime/tools/document-validation'))


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def verify():
    from jsonschema import Draft202012Validator, FormatChecker
    from openapi_spec_validator import validate
    from pglast import parse_sql

    checks = []

    def check(name, passed, detail=''):
        checks.append({'name': name, 'result': 'PASS' if bool(passed) else 'FAIL', 'detail': str(detail)[:1600]})

    def local_refs(value, root, label):
        if isinstance(value, dict):
            if '$ref' in value:
                ref = value['$ref']; ok = ref.startswith('#/'); current = root
                if ok:
                    try:
                        for part in ref[2:].split('/'):
                            current = current[unquote(part).replace('~1', '/').replace('~0', '~')]
                    except (KeyError, TypeError):
                        ok = False
                check('ref:' + label + ':' + ref, ok)
            for v in value.values():
                local_refs(v, root, label)
        elif isinstance(value, list):
            for v in value:
                local_refs(v, root, label)

    active = read(ROOT / 'assets/development/active.json')
    manifest_path = (ROOT / 'assets/development' / active['manifest']).resolve()
    check('active_version_and_containment', active['development_baseline'] == 'P07-DEV 2.0.0'
          and manifest_path == ASSET / 'manifest.json')
    manifest = read(manifest_path)
    check('manifest_hash', sha(manifest_path) == active['manifest_sha256'])
    for f in manifest['files']:
        p = (ROOT / f['project_path']).resolve()
        check('inventory:' + f['project_path'], p.is_relative_to(ROOT) and p.is_file()
              and p.stat().st_size == f['bytes'] and sha(p) == f['sha256'])
    check('inventory_paths_unique', len({f['project_path'] for f in manifest['files']}) == len(manifest['files']))
    bactive = read(ROOT / 'assets/requirements/active.json')
    check('business_dependency', manifest['dependencies']['business_manifest_sha256'] == bactive['manifest_sha256'])
    check('design_dependency', manifest['dependencies']['design_pointer_sha256'] == sha(ROOT / 'assets/design/active.json'))
    check('honest_status', manifest['implementation_status'] == 'NOT_IMPLEMENTED'
          and manifest['product_test_status'] == 'NOT_RUN' and manifest['agent_runtime_test_status'] == 'NOT_RUN')

    snapshot = read(HISTORY / 'snapshot-manifest.json')
    archived = {f['original_path']: f for f in snapshot['files']}
    check('original_snapshot_counts', snapshot['development_inventory_count'] == 46 and len(archived) == 54)
    for f in snapshot['files']:
        p = (HISTORY / f['archive_path']).resolve()
        check('frozen_v1:' + f['original_path'], p.is_relative_to(HISTORY) and p.is_file()
              and p.stat().st_size == f['bytes'] and sha(p) == f['sha256'])
    old_manifest = read(HISTORY / 'files/assets/development/v1.0.0/manifest.json')
    for f in old_manifest['files']:
        saved = archived.get(f['project_path'], {})
        check('original_46_inventory:' + f['project_path'], saved.get('sha256') == f['sha256'] and saved.get('bytes') == f['bytes'])
    old_receipt = read(HISTORY / 'files/output/development/package-receipt.json')
    old_zip = ROOT / old_receipt['archive']
    # The original ZIP is retained locally, but intentionally not nested into the new ZIP.
    check('original_v1_handoff_retained', not old_zip.exists() or sha(old_zip) == old_receipt['sha256'],
          'If supplied alongside the docs, the old ZIP must match its retained receipt. Snapshot remains mandatory.')
    business = read(ROOT / 'assets/requirements/baseline.v3.1.json')
    changes = business['engineering_alignment']['changes']
    check('explicit_engineering_alignment', business['engineering_alignment']['business_contract_change'] is False
          and {x['project_path'] for x in changes} == {'README.md', 'AGENTS.md', 'docs/03-架构数据与接口.md',
                  'docs/需求深化/03-整理引擎与规范验收规格.md', 'docs/实施/小程序优先开发任务与里程碑.md'})

    docs = list((ROOT / 'docs/开发').glob('*.md'))
    check('18_current_documents', len(docs) == 18)
    link_sources = docs + [ROOT / f['project_path'] for f in changes]
    links = 0
    for p in link_sources:
        text = p.read_text(encoding='utf-8-sig')
        for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', text):
            link = link.strip().strip('<>')
            if re.match(r'[A-Za-z][\w+.-]*:', link) or link.startswith('#'):
                continue
            target = (p.parent / unquote(link.split('#', 1)[0])).resolve()
            links += 1
            # The root README retains two intentional links to the hackathon's shared index.
            cross_project_index = p == ROOT / 'README.md' and link in {'../README.md', '../需求文档/README.md'}
            allowed = target.is_relative_to(ROOT) or (cross_project_index and target.is_relative_to(ROOT.parent))
            check('link:' + p.name + ':' + link, allowed and target.is_file(),
                  'Shared hackathon index outside this project package' if cross_project_index else '')
    for p in docs:
        text = p.read_text(encoding='utf-8')
        check('current_asset_references:' + p.name, 'development/v1.0.0/' not in text and 'engine-protocol.schema.json' not in text)

    api = read(ASSET / 'openapi.json')
    transport = read(ASSET / 'transport.openapi.json')
    for name, d in [('business', api), ('transport', transport)]:
        try:
            validate(d); ok = True; detail = ''
        except Exception as exc:
            ok = False; detail = str(exc)
        check('openapi_spec:' + name, ok, detail)
        local_refs(d, d, name)
    catalog = read(ROOT / 'assets/contracts/api-catalog.v3.1.json')['operations']
    methods = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options'}
    operations = {o['operationId']: (method, path) for path, row in api['paths'].items()
                  for method, o in row.items() if method in methods}
    check('53_business_operations', len(operations) == 53 and set(operations) == {r['id'] for r in catalog})
    check('4_transport_operations', sum(method in methods for row in transport['paths'].values() for method in row) == 4)
    original_api = read(HISTORY / 'files/assets/development/v1.0.0/openapi.json')
    for key in ['paths', 'components']:
        check('public_contract_preserved:' + key, api[key] == original_api[key])

    for p in ASSET.glob('*.schema.json'):
        d = read(p)
        try:
            Draft202012Validator.check_schema(d); ok = True; detail = ''
        except Exception as exc:
            ok = False; detail = str(exc)
        check('schema:' + p.name, ok, detail)
        local_refs(d, d, p.name)
    config = read(ASSET / 'config.example.json'); cs = read(ASSET / 'config.schema.json')
    cv = Draft202012Validator(cs, format_checker=FormatChecker())
    check('config_example', cv.is_valid(config), '; '.join(str(e) for e in list(cv.iter_errors(config))[:1]))
    check('closed_default_capabilities', not config['agent_runtime']['enabled'] and not config['commerce']['enabled']
          and all(not v for r in config['features']['release_units'].values() for v in r.values())
          and all(not config['features'][k] for k in ['web', 'open_api', 'source_increments', 'account_binding']))
    for name, change in [
        ('unapproved_commerce', lambda d: d['commerce'].update(enabled=True)),
        ('unconfigured_agent', lambda d: d['agent_runtime'].update(enabled=True)),
        ('virtualization', lambda d: d['agent_runtime'].update(virtualization_allowed=True)),
        ('experimental_app_server', lambda d: d['agent_runtime'].update(app_server_enabled=True)),
        ('raw_client_events', lambda d: d['agent_runtime'].update(raw_events_to_client=True)),
    ]:
        bad = copy.deepcopy(config); change(bad)
        check('negative_config:' + name, not cv.is_valid(bad))
    check('no_separate_model_pipeline', 'model' not in config['providers'] and config['agent_runtime']['sdk_package'] == '@openai/codex-sdk')

    domain = read(ASSET / 'domain.schema.json')
    examples = read(ASSET / 'contract-examples.json')
    for group, valid in [('examples', True), ('invalid_examples', False)]:
        for ex in examples[group]:
            s = {'$schema': domain['$schema'], '$defs': domain['$defs'], '$ref': '#/$defs/' + ex['schema']}
            check('domain_example:' + ex['name'], Draft202012Validator(s, format_checker=FormatChecker()).is_valid(ex['payload']) == valid)
    examples = read(ASSET / 'agent-contract-examples.json')
    for group, valid in [('examples', True), ('invalid_examples', False)]:
        for ex in examples[group]:
            v = Draft202012Validator(read(ASSET / ex['schema']), format_checker=FormatChecker())
            check('agent_example:' + ex['name'], v.is_valid(ex['payload']) == valid,
                  '; '.join(str(e) for e in list(v.iter_errors(ex['payload']))[:1]) if valid else '')
    pipeline = read(ASSET / 'pipeline-contract.json')
    check('agent_owns_execution', pipeline['execution_owner'] == 'CODEX_AGENT' and pipeline['control_model'] == 'CODEX_AGENT_LOOP'
          and pipeline['mandatory_processing_stages'] == [] and 'stages' not in pipeline)
    check('business_gates', {g['id'] for g in pipeline['business_gates']} == {'SCOPE', 'ADOPTION', 'REVISION', 'PUBLICATION'})
    check('budget_preserved', pipeline['budget'] == read(HISTORY / 'files/assets/development/v1.0.0/pipeline-contract.json')['budget'])
    check('run_states_preserved', pipeline['execution_status_enum'] == ['QUEUED', 'RUNNING', 'WAITING_SCHEMA', 'SUCCEEDED', 'FAILED', 'CANCELED'])
    tools = read(ASSET / 'agent-tools.contract.json')
    check('generated_code_tool', 'run_generated_script' in {t['name'] for t in tools['tools']} and tools['tool_calls_are_not_jobs'])
    check('no_financial_or_global_tools', {'payment', 'refund', 'database_sql', 'global_filesystem', 'schema_adoption', 'direct_publication'} <= set(tools['no_tools_for']))
    runtime = read(ASSET / 'agent-runtime.contract.json')
    check('official_runtime_and_experimental_disabled', runtime['primary']['package'] == '@openai/codex-sdk' and runtime['app_server']['default'] == 'DISABLED')
    sources = read(ASSET / 'official-source-register.json')
    check('official_sources_only', len(sources['sources']) == 6 and all(x['url'].startswith('https://learn.chatgpt.com/docs/') for x in sources['sources']))
    check('no_live_runtime_claim', sources['runtime_test_status'] == 'NOT_RUN')

    db = read(ASSET / 'database-catalog.json'); tables = {t['name']: t for t in db['tables']}
    check('62_unique_tables', len(tables) == len(db['tables']) == 62)
    sql = (ASSET / 'schema-reference.sql').read_text(encoding='utf-8')
    parsed = parse_sql(sql)
    check('sql_grammar_only', len(parsed) > 62 and 'NOT EXECUTED' in sql and db['status'] == 'REFERENCE_NOT_EXECUTED')
    for name, t in tables.items():
        cols = {c['name'] for c in t['columns']}
        check('sql_table:' + name, sql.count('CREATE TABLE p07.' + name + ' (') == 1 and len(cols) == len(t['columns']))
        for f in t['foreign_keys']:
            target = tables.get(f['table'])
            check('fk:' + name + ':' + ','.join(f['columns']), target is not None and set(f['columns']) <= cols
                  and set(f['target_columns']) <= {c['name'] for c in target['columns']}
                  and (f['target_columns'] == ['id'] or f['target_columns'] in target['unique']))
            if t['owner_scoped'] and f['columns'] != ['owner_id'] and target and target['owner_scoped']:
                check('owner_fk:' + name + ':' + f['table'], f['columns'][0] == f['target_columns'][0] == 'owner_id')
    check('six_agent_tables', {n for n in tables if n.startswith('agent_')} == {
          'agent_workspaces', 'agent_sessions', 'agent_turns', 'agent_events', 'agent_checkpoints', 'agent_tool_invocations'})
    for old in read(HISTORY / 'files/assets/development/v1.0.0/database-catalog.json')['tables']:
        check('business_table_preserved:' + old['name'], tables[old['name']] == old)

    backlog = read(ASSET / 'backlog.json')['tasks']; task_ids = {t['id'] for t in backlog}
    reqs = read(ROOT / 'assets/requirements/requirements.v3.1.json')['requirements']
    check('60_tasks', len(backlog) == len(task_ids) == 60)
    check('42_requirements_covered', {r['id'] for r in reqs} <= {r for t in backlog for r in t['requirement_ids']})
    check('53_apis_covered', set(operations) <= {a for t in backlog for a in t['api_ids']})
    for task in backlog:
        check('task:' + task['id'], set(task['dependencies']) <= task_ids
              and task['status'] in {'NOT_STARTED', 'PARKED_P1'} and task['test_status'] == 'NOT_RUN')
    by_id = {t['id']: t for t in backlog}; visited = set(); visiting = set()

    def visit(n):
        if n in visiting:
            return False
        if n in visited:
            return True
        visiting.add(n)
        ok = all(d in by_id and visit(d) for d in by_id[n]['dependencies'])
        visiting.remove(n); visited.add(n)
        return ok

    check('task_DAG', all(visit(n) for n in task_ids))
    ui = read(ASSET / 'ui-implementation-map.json')
    check('18_pages_32_components', len(ui['pages']) == 18 and len(ui['components']) == 32)
    for p in ui['pages']:
        check('page:' + p['page_id'], set(p['routes']) == {'ALIPAY', 'DOUYIN'} and p['status'] == 'NOT_IMPLEMENTED'
              and p['test_status'] == 'NOT_RUN' and set(p['api_ids']) <= set(operations))
    plan = read(ASSET / 'test-plan.json'); cases = plan['cases']
    check('220_planned_cases', len(cases) == len({c['case_id'] for c in cases}) == 220)
    check('24_Agent_cases', sum(c['kind'] == 'CODEX_AGENT_RUNTIME' for c in cases) == 24)
    check('126_AC_covered', {a['id'] for r in reqs for a in r['acceptance_criteria']} <= {ref for c in cases for ref in c['reference_ids']})
    check('no_product_test_pass', all(c['execution_status'] == 'NOT_RUN' and not c['evidence_refs'] for c in cases)
          and plan['quality_dataset_requirement']['status'] == 'NOT_PREPARED' and all(c['status'] == 'NOT_RUN' for c in plan['device_matrix']))
    register = read(ASSET / 'integration-register.json')
    check('19_unverified_integrations', len(register['items']) == 19 and all(i['status'] == 'UNVERIFIED'
          and i['test_status'] == 'NOT_RUN' and not i['evidence_refs'] for i in register['items']))
    baseline = subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts/verify_requirements_baseline.py')],
                              cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=60)
    check('business_v3_1_and_frozen_B_v3_0', baseline.returncode == 0,
          baseline.stdout[-1800:] + baseline.stderr[-300:] if baseline.returncode else 'Existing requirement/B/history checker passed; no product tests.')
    failed = [c for c in checks if c['result'] == 'FAIL']
    return {
        'product_id': 'P07', 'development_baseline': 'P07-DEV 2.0.0', 'business_baseline': 'v3.1', 'design_baseline': 'P07-DS-B 1.0.0',
        'checked_at': datetime.now(timezone.utc).isoformat(), 'result': 'FAIL' if failed else 'PASS',
        'scope': 'DOCUMENT_STATIC_ONLY: hashes/history, references, OpenAPI, JSON schemas/examples, SQL grammar/catalog, mappings and Agent ownership/gates.',
        'development_manifest_sha256': sha(manifest_path), 'implementation_status': 'NOT_IMPLEMENTED',
        'agent_runtime_tests': 'NOT_RUN', 'product_tests': 'NOT_RUN', 'sql_database_execution': 'NOT_RUN', 'device_and_payment_tests': 'NOT_RUN',
        'counts': {'documents': len(docs), 'business_operations': len(operations), 'tables': len(tables), 'tasks': len(backlog),
                   'planned_cases': len(cases), 'pages': len(ui['pages']), 'components': len(ui['components']), 'local_links': links,
                   'inventory_files': len(manifest['files']), 'frozen_v1_files': len(archived)},
        'tools': {n: importlib.metadata.version(n) for n in ['jsonschema', 'openapi-spec-validator', 'pglast']},
        'checks_passed': len(checks) - len(failed), 'checks_failed': len(failed), 'errors': failed, 'checks': checks,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', action='store_true')
    args = parser.parse_args()
    if args.report:
        REPORT.parent.mkdir(parents=True, exist_ok=True)
        if not REPORT.with_suffix('.md').exists():
            REPORT.with_suffix('.md').write_text('# Codex Agent 开发资料静态核验\n\n核验进行中；尚无PASS结论。产品/Agent/数据库/真机/资金测试均未执行。\n', encoding='utf-8')
    try:
        report = verify()
    except Exception as exc:
        print(json.dumps({'result': 'FAIL', 'error': str(exc)}, ensure_ascii=False))
        return 1
    if args.report:
        REPORT.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        text = '# Codex Agent 开发资料 v2.0.0 静态核验\n\n'
        text += f"2026-10-27｜{report['result']}｜{report['checks_passed']}项文档检查通过，{report['checks_failed']}项失败。\n\n"
        text += '范围为文档/结构化合同/hash/旧版留存、OpenAPI规范、JSON Schema正反例、PostgreSQL语法/目录、需求映射及Agent控制权/业务门槛。\n\n'
        text += '**应用与Codex Agent未实现；真实Agent、数据库执行、真机、支付与产品测试均NOT_RUN。** SQL解析不是迁移成功；查官方资料/CLI帮助不是接入或运行测试。\n\n'
        text += f"18篇文档、53业务操作、62参考表、60未开工任务、220待执行测试、18页/32组件；留存54份旧版文件，包含原46文件开发清单。当前manifest：`{report['development_manifest_sha256']}`。\n\n"
        text += '[完整检查记录](' + REPORT.with_suffix('.json').name + ')。原需求v3.1、v3.0快照及B冻结留存通过既有检查器复核。\n'
        if report['errors']:
            text += '\n失败项：\n\n' + '\n'.join('- ' + e['name'] + ': ' + e['detail'] for e in report['errors']) + '\n'
        REPORT.with_suffix('.md').write_text(text, encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'checks'}, ensure_ascii=False, indent=2))
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    if read(ROOT / 'assets/development/active.json').get('development_baseline') == 'P07-DEV 3.0.0':
        from verify_session_first_baseline import main as _current_main
        raise SystemExit(_current_main())
    raise SystemExit(main())
