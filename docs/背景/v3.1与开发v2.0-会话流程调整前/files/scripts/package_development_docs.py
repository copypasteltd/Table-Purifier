"""Package only reviewable docs/reference assets; excludes runtime/dependencies/customer data."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote
from zipfile import ZIP_DEFLATED, ZipFile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/development'


def main():
    report=ROOT/'docs/评审/P07-开发文档-v1.0.0-核验-2026-10-27.json'
    if not report.exists() or json.loads(report.read_text(encoding='utf-8'))['result']!='PASS':
        raise ValueError('A passing development static-verification report is required before packaging.')
    paths=set()
    for folder in ['docs/开发','docs/需求深化','docs/小程序','docs/设计定型/B-青绿资料夹-v1.0.0','assets/development','assets/requirements','assets/contracts','assets/design','assets/examples/v3.1','assets/platform','assets/flows']:
        paths.update(p for p in (ROOT/folder).rglob('*') if p.is_file())
    paths.update(ROOT/'docs'/name for name in ['01-产品需求PRD.md','02-功能需求与用户流程.md','03-架构数据与接口.md','04-计费交易与运营.md','05-验收测试与实施计划.md'])
    paths.update(p for p in (ROOT/'docs/背景/v3.0-小程序需求基线').rglob('*') if p.is_file())
    paths.update([ROOT/'README.md',ROOT/'AGENTS.md',report,report.with_suffix('.md'),ROOT/'docs/实施/小程序优先开发任务与里程碑.md',ROOT/'docs/资料/双小程序官方能力复核-v3.1-2026-10-27.md'])
    paths.update(ROOT/'scripts'/name for name in ['build_development_assets.py','build_development_openapi.py','build_development_contracts.py','verify_development_docs.py','seal_development_baseline.py','package_development_docs.py','verify_requirements_baseline.py','verify_design_baseline.py'])
    # Include every existing frozen inventory dependency so offline integrity checks remain useful.
    for inventory in [ROOT/'assets/requirements/baseline.v3.1.json',ROOT/'assets/design/b-jade-folders/v1.0.0/manifest.json']:
        data=json.loads(inventory.read_text(encoding='utf-8-sig'))
        for f in data['files']:
            relative=f.get('project_path')
            if relative:paths.add(ROOT/relative)
    # Retain local reference closure, including historical comparison pages/images.
    # Never pull runtime/customer files into a public documentation handoff.
    pending=list(paths)
    visited=set()
    while pending:
        source=pending.pop()
        if source in visited or source.suffix.lower() not in {'.md','.html','.css'}:continue
        visited.add(source)
        content=source.read_text(encoding='utf-8-sig')
        links=re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',content)
        links+=re.findall(r'(?:src|href)=["\x27]([^"\x27]+)["\x27]',content)
        for link in links:
            link=link.strip().strip('<>')
            if re.match(r'[A-Za-z][\w+.-]*:',link) or link.startswith('#'):continue
            target=(source.parent/unquote(link.split('#',1)[0])).resolve()
            if not target.is_relative_to(ROOT.resolve()) or not target.is_file():continue
            relative=target.relative_to(ROOT).as_posix()
            if relative.startswith(('runtime/','node_modules/')) or '__pycache__' in relative:
                raise ValueError('Unsafe documentation reference cannot be packaged: '+relative)
            if target not in paths:paths.add(target);pending.append(target)
    for p in paths:
        if not p.resolve().is_relative_to(ROOT.resolve()) or not p.is_file():raise ValueError('Invalid package path: '+str(p))
        rel=p.relative_to(ROOT).as_posix()
        if rel.startswith(('runtime/','node_modules/')) or '__pycache__' in rel:raise ValueError('Runtime/dependency file rejected: '+rel)
    OUT.mkdir(parents=True,exist_ok=True)
    archive=OUT/'P07-完整开发文档与需求设计参照-v1.0.0.zip'
    with ZipFile(archive,'w',compression=ZIP_DEFLATED,compresslevel=6) as z:
        for p in sorted(paths,key=lambda x:x.relative_to(ROOT).as_posix()):z.write(p,p.relative_to(ROOT).as_posix())
    with ZipFile(archive) as z:
        bad=z.testzip()
        if bad:raise ValueError('Archive CRC failed: '+bad)
    checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
    receipt={'archive':archive.relative_to(ROOT).as_posix(),'sha256':checksum,'bytes':archive.stat().st_size,'file_count':len(paths),'status':'DOCUMENT_HANDOFF_ONLY','implementation_status':'NOT_IMPLEMENTED','product_tests':'NOT_RUN','excluded':['runtime','dependencies','customer data','merchant secrets'],'verification_report':report.relative_to(ROOT).as_posix()}
    (OUT/'package-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(receipt,ensure_ascii=False,indent=2))


if __name__=='__main__':
    _active_path = Path(__file__).resolve().parents[1] / 'assets/development/active.json'
    if _active_path.exists() and json.loads(_active_path.read_text(encoding='utf-8-sig')).get('development_baseline') == 'P07-DEV 2.0.0':
        from package_codex_agent_docs import main as _current_main
        raise SystemExit(_current_main())
    raise SystemExit(main())
