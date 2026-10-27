"""Static engineering-document verification. Never starts app/DB/device/payment tests."""
from __future__ import annotations

import argparse
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
ASSET = ROOT / 'assets/development/v1.0.0'
LOCAL_TOOLS = ROOT / 'runtime/tools/document-validation'
if LOCAL_TOOLS.exists():
    sys.path.insert(0, str(LOCAL_TOOLS))
sys.dont_write_bytecode = True


def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def verify():
    from jsonschema import Draft202012Validator, FormatChecker
    checks=[]
    tools={}
    def check(name,ok,detail=''):
        checks.append({'name':name,'result':'PASS' if ok else 'FAIL','detail':str(detail)[:1200]})
    def within(path):
        return path.resolve().is_relative_to(ROOT.resolve())
    active=read(ROOT/'assets/development/active.json')
    manifest_path=(ROOT/'assets/development'/active['manifest']).resolve()
    check('active_manifest_containment',within(manifest_path))
    manifest=read(manifest_path)
    check('active_manifest_hash',sha(manifest_path)==active['manifest_sha256'])
    for f in manifest['files']:
        p=(ROOT/f['project_path']).resolve()
        check('inventory:'+f['project_path'],within(p) and p.is_file() and p.stat().st_size==f['bytes'] and sha(p)==f['sha256'])
    business=read(ROOT/'assets/requirements/active.json')
    check('business_baseline_dependency',business['business_baseline']=='v3.1' and manifest['dependencies']['business_manifest_sha256']==business['manifest_sha256'])
    design=read(ROOT/'assets/design/active.json')
    check('design_pointer_dependency',manifest['dependencies']['design_pointer_sha256']==sha(ROOT/'assets/design/active.json'))
    check('product_test_status_honest',manifest['implementation_status']=='NOT_IMPLEMENTED' and manifest['product_test_status']=='NOT_RUN')
    links=0
    docs=list((ROOT/'docs/开发').glob('*.md'))
    check('16_development_documents',len(docs)==16)
    for doc in docs:
        content=doc.read_text(encoding='utf-8')
        check('document_baselines:'+doc.name,'v3.1' in content and ('P07-DEV' in content or doc.name=='README.md'))
        for link in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',content):
            link=link.strip().strip('<>')
            if re.match(r'[A-Za-z][\w+.-]*:',link) or link.startswith('#'):continue
            target=(doc.parent/unquote(link.split('#',1)[0])).resolve()
            links+=1
            check('link:'+doc.name+':'+link,within(target) and target.exists())

    api=read(ASSET/'openapi.json')
    transport=read(ASSET/'transport.openapi.json')
    catalog=read(ROOT/'assets/contracts/api-catalog.v3.1.json')['operations']
    operations={op['operationId']:(method.upper(),path,op) for path,item in api['paths'].items() for method,op in item.items() if method in {'get','post','put','delete','patch'}}
    check('53_unique_business_operations',len(operations)==53 and set(operations)=={a['id'] for a in catalog})
    for a in catalog:
        method,path,op=operations[a['id']]
        check('api_mapping:'+a['id'],method==a['method'] and path==a['path'] and op['x-requirement-ids']==a['requirement_ids'])
        check('api_not_implemented:'+a['id'],op['x-implementation-status']=='NOT_IMPLEMENTED')
        if a['idempotency_required'] and a['id']!='P07-API53':
            check('idempotency:'+a['id'],any(p['name']=='Idempotency-Key' and p['required'] for p in op['parameters']))
        if a['id'] in {'P07-API38','P07-API40','P07-API41','P07-API42','P07-API43'}:
            check('P1_disabled:'+a['id'],op.get('x-default-enabled') is False)
    check('callback_raw_auth',operations['P07-API53'][2].get('x-auth-mode')=='PROVIDER_RAW_SIGNATURE_REQUIRED' and operations['P07-API53'][2]['security']==[])
    check('internal_auth',operations['P07-API39'][2]['security']==[{'OperatorSession':[]}])
    check('four_transport_operations',sum(len(v) for v in transport['paths'].values())==4)
    try:
        from openapi_spec_validator import OpenAPIV31SpecValidator
        tools['openapi-spec-validator']=importlib.metadata.version('openapi-spec-validator')
        for name,doc in [('business',api),('transport',transport)]:
            errors=list(OpenAPIV31SpecValidator(doc).iter_errors())
            check('full_openapi_schema:'+name,not errors,'; '.join(str(e) for e in errors[:2]))
    except ImportError as exc:
        check('full_openapi_validator_available',False,str(exc))
    def refs(node,document,where):
        if isinstance(node,dict):
            if '$ref' in node:
                target=node['$ref']
                valid=target.startswith('#/')
                try:
                    v=document
                    for part in target.removeprefix('#/').split('/'):
                        v=v[part.replace('~1','/').replace('~0','~')]
                except (KeyError,TypeError):valid=False
                check('ref:'+where+':'+target,valid)
            for k,v in node.items():refs(v,document,where+'/'+str(k))
        elif isinstance(node,list):
            for i,v in enumerate(node):refs(v,document,where+'/'+str(i))
    refs(api,api,'openapi');refs(transport,transport,'transport')
    for n,schema in api['components']['schemas'].items():
        try:
            Draft202012Validator.check_schema(schema);valid=True;detail=''
        except Exception as exc:valid=False;detail=str(exc)
        check('domain_schema:'+n,valid,detail)
    for name in ['config.schema.json','domain.schema.json','engine-protocol.schema.json','artifact-manifest.schema.json']:
        schema=read(ASSET/name)
        try:
            Draft202012Validator.check_schema(schema);valid=True;detail=''
        except Exception as exc:valid=False;detail=str(exc)
        check('json_schema:'+name,valid,detail)
        refs(schema,schema,name)
    config=read(ASSET/'config.example.json');config_schema=read(ASSET/'config.schema.json')
    errors=list(Draft202012Validator(config_schema,format_checker=FormatChecker()).iter_errors(config))
    check('config_example_valid',not errors,'; '.join(str(e) for e in errors[:2]))
    check('no_commerce_or_P1_defaults',not config['commerce']['enabled'] and not any(config['features'][k] for k in ['web','open_api','source_increments','account_binding']) and all(not value for unit in config['features']['release_units'].values() for value in unit.values()))
    bad=json.loads(json.dumps(config));bad['commerce']['enabled']=True
    check('unapproved_commerce_config_rejected',not Draft202012Validator(config_schema).is_valid(bad))
    domain=read(ASSET/'domain.schema.json')
    examples=read(ASSET/'contract-examples.json')
    for group,expected in [('examples',True),('invalid_examples',False)]:
        for ex in examples[group]:
            schema={'$schema':domain['$schema'],'$defs':domain['$defs'],'$ref':'#/$defs/'+ex['schema']}
            errors=list(Draft202012Validator(schema,format_checker=FormatChecker()).iter_errors(ex['payload']))
            check('example:'+ex['name'],(not errors)==expected,'; '.join(str(e) for e in errors[:1]) if expected else 'Invalid control must be rejected')
    db=read(ASSET/'database-catalog.json');tables={t['name']:t for t in db['tables']}
    check('unique_table_names',len(tables)==len(db['tables']))
    sql=(ASSET/'schema-reference.sql').read_text(encoding='utf-8')
    for name,t in tables.items():
        cols={c['name'] for c in t['columns']}
        check('sql_table:'+name,sql.count('CREATE TABLE p07.'+name+' (')==1 and len(cols)==len(t['columns']))
        for fk in t['foreign_keys']:
            target=tables.get(fk['table'])
            unique=target is not None and (fk['target_columns']==['id'] or fk['target_columns'] in target['unique'])
            exists=target is not None and set(fk['target_columns'])<={c['name'] for c in target['columns']} and set(fk['columns'])<=cols
            check('foreign_key:'+name+':'+','.join(fk['columns']),unique and exists)
            if t['owner_scoped'] and fk['columns']!=['owner_id'] and tables[fk['table']]['owner_scoped']:
                check('owner_fk:'+name+':'+fk['table'],fk['columns'][0]=='owner_id' and fk['target_columns'][0]=='owner_id')
    try:
        from pglast import parse_sql
        tools['pglast']=importlib.metadata.version('pglast')
        statements=parse_sql(sql)
        check('postgresql_grammar_parse',len(statements)>len(tables),'Parsed '+str(len(statements))+' statements; no DB execution')
    except ImportError as exc:
        check('postgresql_grammar_parser_available',False,str(exc))
    except Exception as exc:
        check('postgresql_grammar_parse',False,str(exc))
    check('ddl_not_claimed_executed',db['status']=='REFERENCE_NOT_EXECUTED' and 'NOT EXECUTED' in sql)
    check('rls_limit_explicit',db['rls_status']=='REQUIRED_IN_REVIEWED_MIGRATIONS_NOT_INCLUDED')
    for index in ['runs_one_active_per_task','runs_one_root_per_contract','operations_one_pending_batch','revision_one_live_per_batch','jobs_ready','outbox_unsent']:
        check('critical_index:'+index,index in sql)
    backlog=read(ASSET/'backlog.json')['tasks'];task_ids={t['id'] for t in backlog}
    reqs=read(ROOT/'assets/requirements/requirements.v3.1.json')['requirements']
    check('42_requirements_in_backlog',{r['id'] for r in reqs}<={r for t in backlog for r in t['requirement_ids']})
    check('53_apis_in_backlog',set(operations)<={a for t in backlog for a in t['api_ids']})
    check('12_P0_work_packages_in_backlog',{t['work_package'] for t in backlog if t['priority']=='P0'}=={'W'+str(i).zfill(2) for i in range(1,13)})
    check('4_P1_parked_packages',{t['work_package'] for t in backlog if t['priority']=='P1'}=={'P1-F21','P1-F22','P1-F28','P1-F42'})
    for task in backlog:
        check('backlog:'+task['id'],set(task['dependencies'])<=task_ids and task['status'] in {'NOT_STARTED','PARKED_P1'} and task['test_status']=='NOT_RUN' and task['deliverables'] and task['done_when'])
    visiting=set();visited=set();byid={t['id']:t for t in backlog}
    def visit(n):
        if n in visiting:return False
        if n in visited:return True
        visiting.add(n)
        ok=all(visit(d) for d in byid[n]['dependencies'])
        visiting.remove(n);visited.add(n)
        return ok
    check('backlog_dependency_DAG',all(visit(n) for n in byid))
    ui=read(ASSET/'ui-implementation-map.json')
    check('18_pages_32_components',len(ui['pages'])==18 and len(ui['components'])==32)
    for p in ui['pages']:
        check('ui:'+p['page_id'],set(p['routes'])=={'ALIPAY','DOUYIN'} and p['status']=='NOT_IMPLEMENTED' and p['test_status']=='NOT_RUN' and set(p['api_ids'])<=set(operations))
    plan=read(ASSET/'test-plan.json');cases=plan['cases']
    check('196_planned_cases',len(cases)==196 and len({c['case_id'] for c in cases})==196)
    check('126_ACs_in_test_plan',{a['id'] for r in reqs for a in r['acceptance_criteria']}<={x for c in cases for x in c['reference_ids']})
    check('no_fake_test_pass',all(c['execution_status']=='NOT_RUN' and not c['evidence_refs'] for c in cases) and plan['quality_dataset_requirement']['status']=='NOT_PREPARED' and all(c['status']=='NOT_RUN' for c in plan['device_matrix']))
    register=read(ASSET/'integration-register.json')
    check('external_integrations_unverified',all(i['status']=='UNVERIFIED' and i['test_status']=='NOT_RUN' and not i['evidence_refs'] for i in register['items']))
    baseline=subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/verify_requirements_baseline.py')],cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=60)
    check('business_and_B_frozen_baseline',baseline.returncode==0,baseline.stdout[-1500:]+baseline.stderr[-300:] if baseline.returncode else 'Current business inventory, v3.0 snapshot and B archive verified by existing checker')
    tools['jsonschema']=importlib.metadata.version('jsonschema')
    failed=[c for c in checks if c['result']=='FAIL']
    return {'product_id':'P07','development_baseline':'P07-DEV 1.0.0','business_baseline':'v3.1','design_baseline':'P07-DS-B 1.0.0','checked_at':datetime.now(timezone.utc).isoformat(),'result':'PASS' if not failed else 'FAIL','scope':'DOCUMENT_STATIC_ONLY: files/links/hashes, JSON Schema examples, OpenAPI specification, PostgreSQL grammar/catalog, coverage mappings','implementation_status':'NOT_IMPLEMENTED','product_tests':'NOT_RUN','sql_database_execution':'NOT_RUN','device_and_payment_tests':'NOT_RUN','counts':{'development_documents':len(docs),'business_operations':len(operations),'infrastructure_operations':4,'tables':len(tables),'backlog_tasks':len(backlog),'pages':len(ui['pages']),'components':len(ui['components']),'planned_test_cases':len(cases),'local_links':links,'inventory_files':len(manifest['files'])},'tools':tools,'checks_passed':len(checks)-len(failed),'checks_failed':len(failed),'errors':failed,'checks':checks}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report',action='store_true')
    args=parser.parse_args()
    try:report=verify()
    except Exception as exc:
        print(json.dumps({'result':'FAIL','error':str(exc)},ensure_ascii=False));return 1
    if args.report:
        path=ROOT/'docs/评审/P07-开发文档-v1.0.0-核验-2026-10-27.json'
        path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='checks'},ensure_ascii=False,indent=2))
    return 0 if report['result']=='PASS' else 1


if __name__=='__main__':
    _active_path = Path(__file__).resolve().parents[1] / 'assets/development/active.json'
    if _active_path.exists() and json.loads(_active_path.read_text(encoding='utf-8-sig')).get('development_baseline') == 'P07-DEV 3.0.0':
        from verify_session_first_baseline import main as _current_main
        raise SystemExit(_current_main())
    if _active_path.exists() and json.loads(_active_path.read_text(encoding='utf-8-sig')).get('development_baseline') == 'P07-DEV 2.0.0':
        from verify_codex_agent_docs import main as _current_main
        raise SystemExit(_current_main())
    raise SystemExit(main())
