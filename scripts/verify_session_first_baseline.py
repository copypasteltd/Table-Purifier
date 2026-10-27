"""Verify v3.2/DEV3 design artifacts only. No product, paid Agent, virtualization or browser invocation."""
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
DEV = ROOT / 'assets/development/v3.0.0'
HISTORY = ROOT / 'docs/背景/v3.1与开发v2.0-会话流程调整前'
REPORT = ROOT / 'docs/评审/P07-七步会话流程-v3.2-核验-2026-10-27.json'
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
        checks.append({'name': name, 'result': 'PASS' if bool(passed) else 'FAIL', 'detail': str(detail)[:1200]})

    def refs(value, document, name):
        if isinstance(value, dict):
            if '$ref' in value:
                link = value['$ref']; current = document; ok = link.startswith('#/')
                if ok:
                    try:
                        for part in link[2:].split('/'):
                            current = current[unquote(part).replace('~1', '/').replace('~0', '~')]
                    except (KeyError, TypeError):
                        ok = False
                check('ref:' + name + ':' + link, ok)
            for v in value.values(): refs(v, document, name)
        elif isinstance(value, list):
            for v in value: refs(v, document, name)

    def inventory(manifest, prefix):
        paths = [f['project_path'] for f in manifest['files']]
        check(prefix + ':unique_paths', len(set(paths)) == len(paths))
        for row in manifest['files']:
            p = (ROOT / row['project_path']).resolve()
            check(prefix + ':' + row['project_path'], p.is_relative_to(ROOT) and p.is_file()
                  and p.stat().st_size == row['bytes'] and sha(p) == row['sha256'])

    da = read(ROOT / 'assets/development/active.json'); ba = read(ROOT / 'assets/requirements/active.json')
    mp = ROOT / 'assets/development' / da['manifest']; bp = ROOT / 'assets/requirements' / ba['manifest']
    manifest = read(mp); business = read(bp)
    check('current_versions', da['development_baseline'] == 'P07-DEV 3.0.0' and ba['business_baseline'] == 'v3.2'
          and mp == DEV / 'manifest.json' and bp.name == 'baseline.v3.2.json')
    check('current_manifest_hashes', sha(mp) == da['manifest_sha256'] and sha(bp) == ba['manifest_sha256'])
    inventory(manifest, 'development'); inventory(business, 'business')
    check('explicit_business_change', business['authorized_change']['business_contract_change'] is True)
    check('dependencies', manifest['dependencies']['business_manifest_sha256'] == sha(bp)
          and manifest['dependencies']['design_pointer_sha256'] == sha(ROOT / 'assets/design/active.json'))
    check('honest_implementation_status', manifest['implementation_status'] == business['implementation_status'] == 'NOT_IMPLEMENTED'
          and manifest['product_test_status'] == business['product_test_status'] == 'NOT_RUN' and manifest['agent_runtime_test_status'] == 'NOT_RUN')
    snapshot = read(HISTORY / 'snapshot-manifest.json'); archived = {f['original_path']: f for f in snapshot['files']}
    check('152_prior_files', len(archived) == len(snapshot['files']) == 152)
    for f in snapshot['files']:
        p = (HISTORY / f['archive_path']).resolve()
        check('frozen_v3.1_dev2:' + f['original_path'], p.is_relative_to(HISTORY) and p.is_file()
              and p.stat().st_size == f['bytes'] and sha(p) == f['sha256'])
    for old in ['assets/requirements/baseline.v3.1.json', 'assets/development/v2.0.0/manifest.json']:
        saved = HISTORY / archived[old]['archive_path']
        check('old_manifest_retained:' + old, sha(ROOT / old) == sha(saved))
        for f in read(saved)['files']:
            a = archived.get(f['project_path'], {})
            check('old_inventory_record:' + f['project_path'], a.get('sha256') == f['sha256'] and a.get('bytes') == f['bytes'])
    for version, path in [('v3.0', 'docs/背景/v3.0-小程序需求基线'), ('DEV1', 'docs/背景/开发v1.0.0-固定流水线')]:
        folder = ROOT / path
        for row in read(folder / 'snapshot-manifest.json')['files']:
            p = folder / row['archive_path']
            check('frozen_' + version + ':' + row.get('project_path', row.get('original_path', '')), p.is_file() and sha(p) == row['sha256'])
    for receipt in ['output/development/package-receipt.json', 'output/development/package-receipt.v2.0.0.json']:
        r = read(ROOT / receipt); z = ROOT / r['archive']
        check('old_zip_retained:' + receipt, not z.exists() or sha(z) == r['sha256'], 'Old ZIP optional in new handoff, immutable if present.')
    design = subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'scripts/verify_design_baseline.py')], cwd=ROOT,
                            capture_output=True, text=True, encoding='utf-8', timeout=45)
    check('B_frozen_design', design.returncode == 0, design.stdout[-800:] + design.stderr[-300:] if design.returncode else '')

    reqs = read(ROOT / 'assets/requirements/requirements.v3.2.json')['requirements']
    pages = read(ROOT / 'assets/requirements/pages.v3.2.json')['pages']
    trace = read(ROOT / 'assets/requirements/traceability.v3.2.json')['rows']
    catalog = read(ROOT / 'assets/contracts/api-catalog.v3.2.json')['operations']
    ui = read(DEV / 'ui-implementation-map.json'); component_ids = {c['component_id'] for c in ui['components']}
    acs = {a['id'] for r in reqs for a in r['acceptance_criteria']}; ids = {r['id'] for r in reqs}
    check('42_stable_requirements', ids == {f'P07-F{n:02}' for n in range(1, 43)} and len(reqs) == 42)
    check('126_unique_acceptance_criteria', len(acs) == 126 and sum(len(r['acceptance_criteria']) for r in reqs) == 126)
    check('38_P0_4_P1', {r['id'] for r in reqs if r['priority'] == 'P1'} == {'P07-F21','P07-F22','P07-F28','P07-F42'})
    check('18_pages_32_components', len(pages) == len(ui['pages']) == 18 and len(component_ids) == 32)
    check('42_trace_rows', {t['requirement_id'] for t in trace} == ids and len(trace) == 42)
    for r in reqs:
        rid = r['id']; t = next(t for t in trace if t['requirement_id'] == rid)
        check('trace:' + rid, all(t[k] == r[k] for k in ['priority','page_ids','component_ids','api_ids','primary_test_id'])
              and set(t['acceptance_ids']) == {a['id'] for a in r['acceptance_criteria']} and t['implementation_status'] == 'NOT_IMPLEMENTED'
              and t['test_status'] == 'NOT_RUN' and set(r['component_ids']) <= component_ids)
        check('inverse_api:' + rid, set(r['api_ids']) == {o['id'] for o in catalog if rid in o['requirement_ids']})
        check('inverse_pages:' + rid, set(r['page_ids']) == {p['page_id'] for p in pages if rid in p['requirement_ids']})
        check('unified_flow:' + rid, r['workflow_contract'] == 'P07-FLOW-7-1')
    for name, key, count in [('business-rules','rules',24),('nonfunctional','requirements',18),('quality-metrics','metrics',8),('exception-cases','cases',24)]:
        entries = read(ROOT / ('assets/requirements/' + name + '.v3.2.json'))[key]
        check('count:' + name, len(entries) == count and len({x['id'] for x in entries}) == count)
    docs = list((ROOT / 'docs/开发').glob('*.md')); check('19_development_documents', len(docs) == 19)
    sources = set(docs) | {ROOT / row['project_path'] for row in business['files'] if row['project_path'].endswith('.md')}
    links = 0
    for doc in sources:
        for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', doc.read_text(encoding='utf-8-sig')):
            link = link.strip().strip('<>')
            if re.match(r'[A-Za-z][\w+.-]*:', link) or link.startswith('#'): continue
            target = (doc.parent / unquote(link.split('#', 1)[0])).resolve(); links += 1
            check('link:' + doc.name + ':' + link, target.is_relative_to(ROOT) and target.is_file())

    api = read(DEV / 'openapi.json'); transport = read(DEV / 'transport.openapi.json')
    methods = {'get','post','put','patch','delete','head','options'}
    operations = {o['operationId']: (m, p) for p, row in api['paths'].items() for m, o in row.items() if m in methods}
    check('56_distinct_API_routes', len(operations) == len(catalog) == 56 and set(operations) == {o['id'] for o in catalog}
          and len(set(operations.values())) == 56)
    for o in catalog: check('api_route:' + o['id'], operations.get(o['id']) == (o['method'].lower(), o['path']))
    for name, document in [('public',api),('transport',transport)]:
        try: validate(document); ok = True; detail = ''
        except Exception as exc: ok = False; detail = str(exc)
        check('OpenAPI_3.1:' + name, ok, detail); refs(document, document, name)
    for p in DEV.glob('*.schema.json'):
        document = read(p)
        try: Draft202012Validator.check_schema(document); ok = True; detail = ''
        except Exception as exc: ok = False; detail = str(exc)
        check('JSON_Schema:' + p.name, ok, detail); refs(document, document, p.name)
    domain = read(DEV / 'domain.schema.json')
    for filename in ['contract-examples.json', 'agent-contract-examples.json']:
        examples = read(DEV / filename)
        for group, expected in [('examples',True),('invalid_examples',False)]:
            for ex in examples[group]:
                s = read(DEV / ex['schema']) if filename.startswith('agent-') else {'$defs':domain['$defs'],'$ref':'#/$defs/' + ex['schema']}
                v = Draft202012Validator(s, format_checker=FormatChecker())
                check('example:' + ex['name'], v.is_valid(ex['payload']) == expected, '; '.join(str(e) for e in list(v.iter_errors(ex['payload']))[:1]) if expected else '')
    config = read(DEV / 'config.example.json'); cv = Draft202012Validator(read(DEV / 'config.schema.json'), format_checker=FormatChecker())
    check('config_example', cv.is_valid(config), '; '.join(str(e) for e in list(cv.iter_errors(config))[:1]))
    check('disabled_unverified_runtime', not config['agent_runtime']['enabled'] and not config['session_flow']['enabled'] and not config['commerce']['enabled'])
    for group, key, value in [('session_flow','enabled',True),('session_flow','skill_loading_strategy','LAZY'),('session_flow','result_auto_delete',True),
                              ('session_flow','allow_consumer_free_grant',True),('session_flow','accept_input_only_after_ready',False),
                              ('agent_runtime','virtualization_allowed',True),('agent_runtime','app_server_enabled',True)]:
        bad = copy.deepcopy(config); bad[group][key] = value
        check('reject_config:' + key, not cv.is_valid(bad))
    workflow = read(DEV / 'workflow.contract.json'); pipeline = read(DEV / 'pipeline-contract.json'); cleanup = read(DEV / 'cleanup.contract.json')
    check('exact_seven_steps', [s['id'] for s in workflow['steps']] == [f'S{n}' for n in range(1,8)])
    check('all_entrypoints', set(workflow['all_new_processing_entries']) == {'ALIPAY','DOUYIN','WEB_P1','OPEN_API_P1','POST_RESULT_REWORK'})
    check('confirm_and_payment_gates', workflow['confirmation_before_quote'] and workflow['consumer_batch_requires_confirmed_payment'] and not workflow['free_grant_bypass'])
    check('result_preserving_runtime_destruction', not workflow['result_files_auto_delete'] and cleanup['result_preservation_required']
          and cleanup['destroyed_runtime_cannot_resume'] and cleanup['result_path_must_not_be_under_runtime_workspace'] and cleanup['execution_status'] == 'NOT_RUN')
    check('Agent_not_fixed_pipeline', pipeline['execution_owner'] == 'CODEX_AGENT' and pipeline['mandatory_processing_stages'] == [])
    sm = read(DEV / 'skill/manifest.json'); preload = read(DEV / 'skill-preload.contract.json')
    check('full_locked_skill_bundle', len(sm['files']) == 7 and sm['loading_strategy'] == preload['strategy'] == 'EAGER_FULL'
          and preload['skill_manifest_sha256'] == sha(DEV / 'skill/manifest.json') == config['session_flow']['skill_manifest_sha256']
          and not preload['bootstrap_contains_customer_data'])
    for row in sm['files']:
        p = (DEV / 'skill' / row['path']).resolve()
        check('skill_resource:' + row['path'], p.is_relative_to(DEV / 'skill') and p.is_file() and sha(p) == row['sha256']
              and p.stat().st_size == row['bytes'] and row['load_mode'] == 'FULL_CONTENT_BEFORE_INPUT')
    api_s = api['components']['schemas']
    check('no_old_waiting_schema_Run', 'WAITING_SCHEMA' not in api_s['ExecutionStatus']['enum'])
    check('persistent_artifact_contract', api_s['Artifact']['properties']['expires_at']['type'] == 'null'
          and read(DEV / 'artifact-manifest.schema.json')['properties']['expires_at']['type'] == 'null')
    db = read(DEV / 'database-catalog.json'); tables = {t['name']:t for t in db['tables']}
    check('64_reference_tables', len(tables) == len(db['tables']) == 64)
    sql = (DEV / 'schema-reference.sql').read_text(encoding='utf-8')
    try: statements = parse_sql(sql); ok = len(statements) > 64; detail = str(len(statements))
    except Exception as exc: ok = False; detail = str(exc)
    check('PostgreSQL_grammar_only', ok, detail)
    check('SQL_catalog_tables', set(re.findall(r'CREATE TABLE p07\.(\w+)', sql)) == set(tables))
    for t in tables.values():
        columns = {c['name'] for c in t['columns']}
        check('unique_columns:' + t['name'], len(columns) == len(t['columns']))
        for i, f in enumerate(t['foreign_keys']):
            target = tables.get(f['table'], {}); tc = {c['name'] for c in target.get('columns', [])}
            uniques = target.get('unique', []) + [[c['name']] for c in target.get('columns',[]) if 'PRIMARY KEY' in c['sql']]
            check('FK:' + t['name'] + ':' + str(i), set(f['columns']) <= columns and set(f['target_columns']) <= tc
                  and f['target_columns'] in uniques and len(f['columns']) == len(f['target_columns']))
    ep = tables['execution_plans']; epcols = {c['name']:c['sql'] for c in ep['columns']}
    check('draft_plan_before_adoption', 'NOT NULL' not in epcols['binding_id'] and any("status <> 'CONFIRMED'" in c and 'binding_id IS NOT NULL' in c for c in ep['checks']))
    check('result_table_persistence', tables['artifact_sets']['retention_category'] == 'PERSISTENT_RESULT'
          and 'expires_at IS NULL' in next(c['sql'] for c in tables['artifact_sets']['columns'] if c['name']=='expires_at'))
    backlog = read(DEV / 'backlog.json')['tasks']; tasks = {t['id']:t for t in backlog}
    check('66_unimplemented_tasks', len(tasks) == len(backlog) == 66 and all(t['status'] in {'NOT_STARTED','PARKED_P1'} and t['test_status']=='NOT_RUN' for t in backlog)
          and all(t['status']!='PARKED_P1' or t['priority']=='P1' for t in backlog))
    visited = set(); stack = set()
    def visit(n):
        if n in stack or n not in tasks: return False
        if n in visited: return True
        stack.add(n); ok = all(visit(d) for d in tasks[n]['dependencies']); stack.remove(n); visited.add(n); return ok
    check('backlog_DAG', all(visit(n) for n in tasks))
    plan = read(DEV / 'test-plan.json'); cases = plan['cases']
    check('240_planned_cases_NOT_RUN', len({c['case_id'] for c in cases}) == len(cases) == 240
          and all(c['execution_status']=='NOT_RUN' and not c['evidence_refs'] for c in cases))
    check('126_AC_coverage', acs <= {ref for c in cases for ref in c['reference_ids']})
    check('20_new_flow_cases', sum(c['case_id'].startswith('DEVTEST-FLOW-') for c in cases) == 20)
    register = read(DEV / 'integration-register.json')
    check('integrations_NOT_RUN', all(i['status']=='UNVERIFIED' and i['test_status']=='NOT_RUN' and not i['evidence_refs'] for i in register['items']))
    failures = [c for c in checks if c['result']=='FAIL']
    return {'product_id':'P07','business_baseline':'v3.2','development_baseline':'P07-DEV 3.0.0',
            'checked_at':datetime.now(timezone.utc).isoformat(),'result':'PASS' if not failures else 'FAIL',
            'scope':'STATIC_DOCUMENT_CONTRACT_AND_ARCHIVE_ONLY','implementation_status':'NOT_IMPLEMENTED',
            'agent_runtime_tests':'NOT_RUN','product_tests':'NOT_RUN','sql_database_execution':'NOT_RUN','payment_device_cleanup_tests':'NOT_RUN',
            'development_manifest_sha256':sha(mp),'business_manifest_sha256':sha(bp),
            'counts':{'requirements':42,'acceptance_criteria':126,'API':len(operations),'tables':len(tables),'development_documents':len(docs),
                      'tasks':len(tasks),'planned_cases':len(cases),'local_links':links,'development_inventory_files':len(manifest['files'])},
            'tools':{n:importlib.metadata.version(n) for n in ['jsonschema','openapi-spec-validator','pglast']},
            'checks_passed':len(checks)-len(failures),'checks_failed':len(failures),'errors':failures,'checks':checks}


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('--report',action='store_true'); args=parser.parse_args()
    if args.report:
        REPORT.parent.mkdir(parents=True,exist_ok=True)
        if not REPORT.exists(): REPORT.write_text('{"result":"NOT_RUN"}\n',encoding='utf-8')
        if not REPORT.with_suffix('.md').exists(): REPORT.with_suffix('.md').write_text('# 文档静态核验\n\n尚未核验。\n',encoding='utf-8')
    try: report=verify()
    except Exception as exc:
        print(json.dumps({'result':'FAIL','error':str(exc)},ensure_ascii=False));return 1
    if args.report:
        REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        text='# 七步会话流程文档静态核验\n\n'+f"结果：{report['result']}。通过{report['checks_passed']}项，失败{report['checks_failed']}项。\n\n"
        text+='范围：文档、文件哈希、引用、Schema/OpenAPI、SQL语法和映射；不代表SDK/Agent、数据库执行、支付、设备或清理实测通过。\n\n'
        text+='软件NOT_IMPLEMENTED；真实测试NOT_RUN。\n\n'
        text+='业务v3.2，开发P07-DEV 3.0.0。\n\n'+f"开发清单SHA256：`{report['development_manifest_sha256']}`。\n\n"
        text+='[机器报告]('+REPORT.name+')\n'
        if report['errors']: text+='\n'+ '\n'.join('- '+e['name']+': '+e['detail'] for e in report['errors'])+'\n'
        REPORT.with_suffix('.md').write_text(text,encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False,indent=2))
    return 0 if report['result']=='PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
