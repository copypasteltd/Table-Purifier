"""Seal the explicitly requested engineering redesign; preserve business contracts and frozen history."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/development/v2.0.0'
HISTORY = ROOT / 'docs/背景/开发v1.0.0-固定流水线'
ALIGNED = {'README.md', 'AGENTS.md', 'docs/03-架构数据与接口.md',
           'docs/需求深化/03-整理引擎与规范验收规格.md', 'docs/实施/小程序优先开发任务与里程碑.md'}
SCRIPTS = ['build_codex_agent_assets.py', 'build_codex_agent_docs.py', 'seal_codex_agent_baseline.py',
           'verify_codex_agent_docs.py', 'package_codex_agent_docs.py',
           'build_development_assets.py', 'build_development_openapi.py', 'build_development_contracts.py',
           'verify_development_docs.py', 'seal_development_baseline.py', 'package_development_docs.py']


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def save(p, data):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    snapshot = read(HISTORY / 'snapshot-manifest.json')
    for f in snapshot['files']:
        p = HISTORY / f['archive_path']
        if sha(p) != f['sha256'] or p.stat().st_size != f['bytes']:
            raise ValueError('Historical snapshot changed: ' + f['original_path'])
    original_path = HISTORY / 'files/assets/requirements/baseline.v3.1.json'
    business = read(original_path)
    changes = []
    for item in business['files']:
        name = item['project_path']; p = ROOT / name
        if sha(p) != item['sha256'] or p.stat().st_size != item['bytes']:
            if name not in ALIGNED:
                raise ValueError('Out-of-scope business change: ' + name)
            changes.append({'project_path': name, 'before_sha256': item['sha256'], 'after_sha256': sha(p)})
            item['bytes'] = p.stat().st_size; item['sha256'] = sha(p)
    if set(c['project_path'] for c in changes) != ALIGNED:
        raise ValueError('Expected explicit architecture/navigation alignment set differs.')
    business['engineering_alignment'] = {
        'date': '2026-10-27', 'development_baseline': 'P07-DEV 2.0.0',
        'reason': 'User explicitly requested Codex Agent to own all file reading/analysis/cleaning/schema proposal/table generation.',
        'business_contract_change': False,
        'scope': 'Five architecture/engine/implementation/navigation files; functional/API/state/budget contracts unchanged.',
        'original_manifest_archive': original_path.relative_to(ROOT).as_posix(), 'changes': changes,
    }
    business_path = ROOT / 'assets/requirements/baseline.v3.1.json'
    save(business_path, business)
    active_business_path = ROOT / 'assets/requirements/active.json'
    bactive = read(HISTORY / 'files/assets/requirements/active.json')
    bactive['manifest_sha256'] = sha(business_path)
    save(active_business_path, bactive)

    paths = set((ROOT / 'docs/开发').glob('*.md'))
    paths.update(p for p in DEST.rglob('*') if p.is_file() and p.name != 'manifest.json')
    paths.update(p for p in HISTORY.rglob('*') if p.is_file())
    paths.update(ROOT / name for name in ALIGNED)
    paths.update(ROOT / 'scripts' / name for name in SCRIPTS)
    for p in paths:
        if not p.resolve().is_relative_to(ROOT.resolve()) or not p.is_file():
            raise ValueError('Invalid inventory path: ' + str(p))
    ordered = sorted(paths, key=lambda p: p.relative_to(ROOT).as_posix())
    manifest = {
        'schema_version': '2.0', 'product_id': 'P07', 'development_baseline': 'P07-DEV 2.0.0',
        'date': '2026-10-27', 'status': 'CODEX_AGENT_DEVELOPMENT_DOCUMENTATION_BASELINE',
        'implementation_status': 'NOT_IMPLEMENTED', 'product_test_status': 'NOT_RUN', 'agent_runtime_test_status': 'NOT_RUN',
        'dependencies': {'business_baseline': 'v3.1', 'business_manifest_sha256': bactive['manifest_sha256'],
                         'design_baseline': 'P07-DS-B 1.0.0', 'design_pointer_sha256': sha(ROOT / 'assets/design/active.json')},
        'architecture': {'execution_owner': 'CODEX_AGENT', 'primary_runtime': '@openai/codex-sdk',
                         'business_gates_only': True, 'virtualization': 'FORBIDDEN', 'app_server': 'DISABLED_EXPERIMENTAL'},
        'files': [{'project_path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size, 'sha256': sha(p)} for p in ordered],
        'history': {'snapshot': (HISTORY / 'snapshot-manifest.json').relative_to(ROOT).as_posix(),
                    'original_development_inventory_count': 46, 'retained_files': len(snapshot['files']),
                    'original_v1_zip': 'output/development/P07-完整开发文档与需求设计参照-v1.0.0.zip'},
        'excluded_outputs': ['runtime/**', 'output/**', 'docs/评审/P07-Codex-Agent开发文档-v2.0.0-核验-2026-10-27.*'],
        'notes': ['Documentation/static validation only; no live Codex/DB/device/payment tests.',
                  'v3.1 functions/API/state/budget preserved; engineering alignment transparent.',
                  'Frozen B/v3.0 and original v1 bytes/ZIP remain retained.'],
    }
    save(DEST / 'manifest.json', manifest)
    save(ROOT / 'assets/development/active.json', {
        'product_id': 'P07', 'development_baseline': 'P07-DEV 2.0.0', 'business_baseline': 'v3.1',
        'design_baseline': 'P07-DS-B 1.0.0', 'manifest': 'v2.0.0/manifest.json', 'manifest_sha256': sha(DEST / 'manifest.json'),
        'documents': '../../docs/开发/README.md', 'requirements_pointer': '../requirements/active.json',
        'design_pointer': '../design/active.json', 'execution_owner': 'CODEX_AGENT',
        'status': 'DOCUMENTS_READY_PRODUCT_AND_AGENT_NOT_IMPLEMENTED', 'updated_on': '2026-10-27',
    })
    print('Sealed', len(ordered), 'files. Explicitly aligned five documents; preserved business contracts and old snapshot.')


if __name__ == '__main__':
    main()
