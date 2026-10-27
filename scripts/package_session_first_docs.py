"""Package verified session-first documentation and frozen design references, excluding runtime/data."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/development'
REPORT = ROOT / 'docs/评审/P07-七步会话流程-v3.2-核验-2026-10-27.json'


def read(p):
    return json.loads(p.read_text(encoding='utf-8-sig'))


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def allowed(relative):
    if relative.startswith(('runtime/', 'node_modules/')) or '__pycache__' in relative or any(x.startswith('.env') for x in Path(relative).parts):
        return False
    if relative.startswith('output/'):
        return relative.startswith('output/imagegen/miniapp-style-selection-2026-10-27/') or relative in {
            'output/design/P07-B-jade-folders-design-v1.0.0.zip', 'output/requirements/P07-完整需求与B设计参照-v3.1.zip'}
    return True


def main():
    da = read(ROOT / 'assets/development/active.json'); ba = read(ROOT / 'assets/requirements/active.json'); report = read(REPORT)
    dm = ROOT / 'assets/development' / da['manifest']; bm = ROOT / 'assets/requirements' / ba['manifest']
    if (da['development_baseline'] != 'P07-DEV 3.0.0' or report['result'] != 'PASS'
            or report['development_manifest_sha256'] != da['manifest_sha256'] or sha(dm) != da['manifest_sha256']
            or report['business_manifest_sha256'] != ba['manifest_sha256'] or sha(bm) != ba['manifest_sha256']):
        raise ValueError('Current matching passing static report and manifests required.')
    design_pointer = ROOT / 'assets/design/active.json'; dp = read(design_pointer)
    design_manifest = ROOT / 'assets/design' / dp['manifest']
    if sha(design_manifest) != dp['manifest_sha256']:
        raise ValueError('Frozen B manifest changed.')
    paths = {dm, bm, design_manifest, REPORT, REPORT.with_suffix('.md'), design_pointer,
             ROOT / 'assets/development/active.json', ROOT / 'assets/requirements/active.json'}
    for manifest in [dm, bm, design_manifest]:
        for row in read(manifest)['files']:
            p = (ROOT / row['project_path']).resolve()
            if not p.is_relative_to(ROOT) or not p.is_file() or sha(p) != row['sha256'] or p.stat().st_size != row['bytes']:
                raise ValueError('Verified inventory changed: ' + row['project_path'])
            paths.add(p)
    for folder in ['docs/背景/v3.0-小程序需求基线', 'docs/背景/开发v1.0.0-固定流水线']:
        paths.update(p for p in (ROOT / folder).rglob('*') if p.is_file())
    # Existing link closure retains historical/synthetic design comparisons without following network URLs.
    pending = list(paths)
    while pending:
        p = pending.pop()
        if p.suffix.lower() not in {'.md','.html','.svg'}: continue
        text = p.read_text(encoding='utf-8-sig')
        links = re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', text) + re.findall(r'(?:src|href)=["\x27]([^"\x27]+)["\x27]', text)
        for link in links:
            link = link.strip().strip('<>')
            if re.match(r'[A-Za-z][\w+.-]*:',link) or link.startswith('#'): continue
            target = (p.parent / unquote(link.split('#',1)[0])).resolve()
            if not target.is_relative_to(ROOT) or not target.is_file(): continue
            rel = target.relative_to(ROOT).as_posix()
            if not allowed(rel): raise ValueError('Disallowed link in package: ' + rel)
            if target not in paths: paths.add(target); pending.append(target)
    for p in paths:
        if not p.is_relative_to(ROOT) or not p.is_file() or not allowed(p.relative_to(ROOT).as_posix()):
            raise ValueError('Invalid package content: ' + str(p))
    OUT.mkdir(parents=True,exist_ok=True)
    archive = OUT / 'P07-七步会话流程与完整开发文档-v3.0.0.zip'
    with ZipFile(archive,'w',compression=ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(paths,key=lambda x:x.relative_to(ROOT).as_posix()): z.write(p,p.relative_to(ROOT).as_posix())
    with ZipFile(archive) as z:
        bad = z.testzip()
        if bad: raise ValueError('ZIP CRC failed: ' + bad)
    receipt = {'archive':archive.relative_to(ROOT).as_posix(),'sha256':sha(archive),'bytes':archive.stat().st_size,'file_count':len(paths),
               'business_baseline':'v3.2','development_baseline':'P07-DEV 3.0.0','status':'DOCUMENT_HANDOFF_ONLY',
               'implementation_status':'NOT_IMPLEMENTED','product_tests':'NOT_RUN','agent_runtime_tests':'NOT_RUN',
               'verification_report':REPORT.relative_to(ROOT).as_posix(),'development_manifest_sha256':sha(dm),'business_manifest_sha256':sha(bm),
               'excluded':['runtime','dependencies','customer data','secrets','nested historical development ZIPs']}
    (OUT / 'package-receipt.v3.0.0.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
