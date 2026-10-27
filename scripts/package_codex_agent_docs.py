"""Package the verified Codex Agent design and its current requirement/design references; exclude runtime."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/development'


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def permitted_content_path(relative):
    if relative.startswith(('runtime/', 'node_modules/')) or '__pycache__' in relative:
        return False
    # Frozen B references its retained five-style comparison in this synthetic design output.
    if relative.startswith('output/'):
        return relative.startswith('output/imagegen/miniapp-style-selection-2026-10-27/') or relative in {
            'output/design/P07-B-jade-folders-design-v1.0.0.zip',
            'output/requirements/P07-完整需求与B设计参照-v3.1.zip',
        }
    return True


def main():
    report_path = ROOT / 'docs/评审/P07-Codex-Agent开发文档-v2.0.0-核验-2026-10-27.json'
    report = read(report_path)
    active = read(ROOT / 'assets/development/active.json')
    manifest_path = ROOT / 'assets/development' / active['manifest']
    if (report['result'] != 'PASS' or report['development_manifest_sha256'] != sha(manifest_path)
            or active['manifest_sha256'] != sha(manifest_path)):
        raise ValueError('Current matching passing static report required before packaging.')
    paths = set()
    manifests = [manifest_path, ROOT / 'assets/requirements/baseline.v3.1.json', ROOT / 'assets/design/b-jade-folders/v1.0.0/manifest.json']
    for manifest in manifests:
        for f in read(manifest)['files']:
            name = f.get('project_path')
            if name:
                p = ROOT / name
                if p.stat().st_size != f['bytes'] or sha(p) != f['sha256']:
                    raise ValueError('Inventory changed after verification: ' + name)
                paths.add(p)
        paths.add(manifest)
    for folder in ['docs/开发', 'docs/需求深化', 'docs/小程序', 'docs/背景/开发v1.0.0-固定流水线',
                   'docs/背景/v3.0-小程序需求基线', 'assets/development/v2.0.0', 'assets/requirements',
                   'assets/contracts', 'assets/design', 'assets/examples/v3.1', 'assets/platform', 'assets/flows']:
        paths.update(p for p in (ROOT / folder).rglob('*') if p.is_file())
    paths.update([ROOT / 'README.md', ROOT / 'AGENTS.md', ROOT / 'assets/development/active.json', report_path, report_path.with_suffix('.md'),
                  ROOT / 'docs/评审/P07-开发文档-v1.0.0-核验-2026-10-27.json', ROOT / 'docs/评审/P07-开发文档-v1.0.0-核验-2026-10-27.md'])
    paths.update(ROOT / 'scripts' / n for n in ['verify_requirements_baseline.py', 'verify_design_baseline.py'])
    # Add existing local link closure without following network, runtime or package outputs.
    pending = list(paths)
    while pending:
        p = pending.pop()
        if p.suffix.lower() not in {'.md', '.html', '.svg'}:
            continue
        text = p.read_text(encoding='utf-8-sig')
        links = re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', text)
        links += re.findall(r'(?:src|href)=["\x27]([^"\x27]+)["\x27]', text)
        for link in links:
            link = link.strip().strip('<>')
            if re.match(r'[A-Za-z][\w+.-]*:', link) or link.startswith('#'):
                continue
            target = (p.parent / unquote(link.split('#', 1)[0])).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file():
                continue
            rel = target.relative_to(ROOT).as_posix()
            if not permitted_content_path(rel):
                raise ValueError('Runtime/dependency/output reference cannot be packaged: ' + rel)
            if target not in paths:
                paths.add(target); pending.append(target)
    for p in paths:
        rel = p.relative_to(ROOT).as_posix()
        if not p.is_file() or not permitted_content_path(rel):
            raise ValueError('Invalid package path: ' + rel)
    OUT.mkdir(parents=True, exist_ok=True)
    archive = OUT / 'P07-Codex-Agent完整开发文档与需求设计参照-v2.0.0.zip'
    with ZipFile(archive, 'w', compression=ZIP_DEFLATED, compresslevel=6) as z:
        for p in sorted(paths, key=lambda p: p.relative_to(ROOT).as_posix()):
            z.write(p, p.relative_to(ROOT).as_posix())
    with ZipFile(archive) as z:
        bad = z.testzip()
        if bad:
            raise ValueError('ZIP CRC failed: ' + bad)
    receipt = {'archive': archive.relative_to(ROOT).as_posix(), 'sha256': sha(archive), 'bytes': archive.stat().st_size,
               'file_count': len(paths), 'development_baseline': 'P07-DEV 2.0.0', 'status': 'DOCUMENT_HANDOFF_ONLY',
               'implementation_status': 'NOT_IMPLEMENTED', 'agent_runtime_tests': 'NOT_RUN', 'product_tests': 'NOT_RUN',
               'verification_report': report_path.relative_to(ROOT).as_posix(),
               'development_manifest_sha256': active['manifest_sha256'],
               'excluded': ['runtime', 'dependencies', 'customer data', 'secrets', 'nested old ZIP']}
    (OUT / 'package-receipt.v2.0.0.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    if read(ROOT / 'assets/development/active.json').get('development_baseline') == 'P07-DEV 3.0.0':
        from package_session_first_docs import main as _current_main
        raise SystemExit(_current_main())
    main()
