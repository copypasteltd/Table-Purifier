"""Seal the authorized seven-step business change, keeping prior snapshots immutable."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEV = ROOT / 'assets/development/v3.0.0'
HISTORY = ROOT / 'docs/背景/v3.1与开发v2.0-会话流程调整前'


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def save(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def inventory(paths):
    rows = []
    for p in sorted(set(paths), key=lambda x: x.relative_to(ROOT).as_posix()):
        if not p.resolve().is_relative_to(ROOT) or not p.is_file():
            raise ValueError('Invalid inventory path: ' + str(p))
        rows.append({'project_path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)})
    return rows


def main():
    snapshot = read(HISTORY / 'snapshot-manifest.json')
    for row in snapshot['files']:
        p = HISTORY / row['archive_path']
        if not p.resolve().is_relative_to(HISTORY) or not p.is_file() or sha(p) != row['sha256'] or p.stat().st_size != row['bytes']:
            raise ValueError('Historical snapshot changed: ' + row['original_path'])
    bpaths = {ROOT / 'README.md', ROOT / 'AGENTS.md', ROOT / 'docs/实施/小程序优先开发任务与里程碑.md'}
    bpaths.update((ROOT / 'docs').glob('0*.md'))
    for folder in ['docs/需求深化', 'docs/小程序']:
        bpaths.update((ROOT / folder).glob('*.md'))
    for folder in ['assets/requirements', 'assets/contracts', 'assets/flows', 'assets/platform']:
        bpaths.update(p for p in (ROOT / folder).glob('*.v3.2.json') if p.name != 'baseline.v3.2.json')
    bpaths.update((ROOT / 'assets/examples/v3.2').glob('*.json'))
    bpaths.update(ROOT / 'scripts' / name for name in ['verify_requirements_baseline.py', 'verify_session_first_baseline.py'])
    business = {
        'schema_version': '2.0', 'product_id': 'P07', 'business_baseline': 'v3.2', 'selected_design': 'P07-DS-B 1.0.0',
        'date': '2026-10-27', 'status': 'SPECIFIED_NOT_IMPLEMENTED', 'implementation_status': 'NOT_IMPLEMENTED',
        'product_test_status': 'NOT_RUN', 'workflow_contract': 'P07-FLOW-7-1',
        'counts': {'functional_requirements': 42, 'P0': 38, 'P1': 4, 'acceptance_criteria': 126, 'business_rules': 24,
                   'page_contracts': 18, 'design_components': 32, 'rendered_design_reference_pages': 3, 'API_contracts': 56,
                   'nonfunctional_requirements': 18, 'quality_metrics': 8, 'exception_scenarios': 24},
        'authorized_change': {'business_contract_change': True,
            'reason': 'User mandates session/full Skill before input, analyze/confirm before pricing, paid batch, then persistent results and whole runtime destruction.',
            'clarification': '结果文件不删除。但是删除整个流程的container。',
            'supersedes': 'v3.1', 'old_manifest_sha256': sha(HISTORY / 'files/assets/requirements/baseline.v3.1.json'),
            'snapshot': (HISTORY / 'snapshot-manifest.json').relative_to(ROOT).as_posix()},
        'design_compatibility': 'B visual archive stays byte-exact; current session/payment/cleanup behavior is defined by v3.2.',
        'design_pointer_sha256': sha(ROOT / 'assets/design/active.json'),
        'files': inventory(bpaths), 'excluded': ['self/active pointers', 'reports', 'runtime', 'output'],
    }
    bp = ROOT / 'assets/requirements/baseline.v3.2.json'; save(bp, business)
    save(ROOT / 'assets/requirements/active.json', {
        'schema_version': '2.0', 'product_id': 'P07', 'business_baseline': 'v3.2', 'status': 'CURRENT_REQUIREMENTS_NOT_IMPLEMENTED',
        'manifest': bp.name, 'manifest_sha256': sha(bp), 'requirements': 'requirements.v3.2.json', 'traceability': 'traceability.v3.2.json',
        'documents': '../../docs/需求深化/README.md', 'design_pointer': '../design/active.json',
        'design_compatibility': '../../docs/需求深化/06-需求追踪与变更管理.md', 'updated_on': '2026-10-27',
    })
    paths = set((ROOT / 'docs/开发').glob('*.md'))
    paths.update(p for p in DEV.rglob('*') if p.is_file() and p != DEV / 'manifest.json')
    paths.update(p for p in HISTORY.rglob('*') if p.is_file())
    paths.update(ROOT / f['project_path'] for f in business['files'])
    paths.update(p for p in (ROOT / 'scripts').glob('*.py'))
    manifest = {
        'schema_version': '3.0', 'product_id': 'P07', 'development_baseline': 'P07-DEV 3.0.0', 'date': '2026-10-27',
        'status': 'SESSION_FIRST_AGENT_DEVELOPMENT_DOCUMENTATION_BASELINE', 'implementation_status': 'NOT_IMPLEMENTED',
        'product_test_status': 'NOT_RUN', 'agent_runtime_test_status': 'NOT_RUN',
        'dependencies': {'business_baseline': 'v3.2', 'business_manifest_sha256': sha(bp),
                         'design_baseline': 'P07-DS-B 1.0.0', 'design_pointer_sha256': sha(ROOT / 'assets/design/active.json')},
        'architecture': {'execution_owner': 'CODEX_AGENT', 'primary_runtime': '@openai/codex-sdk',
                         'workflow': 'P07-FLOW-7-1', 'skill_loading': 'EAGER_FULL_BEFORE_INPUT',
                         'results_persist': True, 'destroy_runtime_after_results': True, 'virtualization': 'FORBIDDEN'},
        'counts': {'development_documents': 19, 'business_operations': 56, 'tables': 64, 'backlog_tasks': 66, 'planned_test_cases': 240},
        'files': inventory(paths), 'history': {'snapshot': (HISTORY / 'snapshot-manifest.json').relative_to(ROOT).as_posix(),
                                               'retained_files': len(snapshot['files'])},
        'excluded_outputs': ['self/active pointers', 'runtime/**', 'output/**', 'docs/评审/**'],
        'notes': ['Documentation/static checks only; no live SDK, process deletion, DB, payment or device test.'],
    }
    save(DEV / 'manifest.json', manifest)
    save(ROOT / 'assets/development/active.json', {
        'product_id': 'P07', 'development_baseline': 'P07-DEV 3.0.0', 'business_baseline': 'v3.2', 'design_baseline': 'P07-DS-B 1.0.0',
        'manifest': 'v3.0.0/manifest.json', 'manifest_sha256': sha(DEV / 'manifest.json'), 'documents': '../../docs/开发/README.md',
        'requirements_pointer': '../requirements/active.json', 'design_pointer': '../design/active.json', 'execution_owner': 'CODEX_AGENT',
        'status': 'DOCUMENTS_READY_PRODUCT_AND_AGENT_NOT_IMPLEMENTED', 'updated_on': '2026-10-27',
    })
    print('Sealed business v3.2 / DEV 3.0.0:', len(business['files']), 'business files,', len(manifest['files']), 'development files; prior 152-file snapshot preserved.')


if __name__ == '__main__':
    main()
