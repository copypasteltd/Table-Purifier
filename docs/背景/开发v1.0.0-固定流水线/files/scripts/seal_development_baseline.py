"""Seal document hashes and navigation provenance. No product deployment or data migration."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'assets/development/v1.0.0'
PROVENANCE=DEST/'provenance/navigation-before-development'


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


def snapshot():
    if (PROVENANCE/'snapshot.json').exists():
        print('Original navigation provenance already retained; no overwrite.');return
    files=[]
    for source,archive in [('README.md','README.md'),('AGENTS.md','AGENTS.md'),('assets/requirements/baseline.v3.1.json','baseline.v3.1.json'),('assets/requirements/active.json','active.json')]:
        src=ROOT/source;dst=PROVENANCE/archive
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        files.append({'project_path':source,'archive_path':archive,'bytes':dst.stat().st_size,'sha256':sha(dst)})
    save(PROVENANCE/'snapshot.json',{'reason':'Original business manifest and root navigation preserved before adding development entry. Business semantic docs and frozen B unchanged.','date':'2026-10-27','files':files})
    print('Retained four original navigation/requirement-pointer files before edit.')


def seal():
    if not (PROVENANCE/'snapshot.json').exists():raise ValueError('Original navigation snapshot required before sealing.')
    business_path=ROOT/'assets/requirements/baseline.v3.1.json'
    business=load(business_path)
    for f in business['files']:
        path=ROOT/f['project_path']
        if f['project_path'] not in {'README.md','AGENTS.md'} and (path.stat().st_size!=f['bytes'] or sha(path)!=f['sha256']):
            raise ValueError('Business content changed outside navigation scope; requires explicit baseline version review: '+f['project_path'])
        f['bytes']=path.stat().st_size;f['sha256']=sha(path)
    business['navigation_maintenance']={'date':'2026-10-27','scope':'Root README/AGENTS development documentation navigation only; business requirement content/version unchanged','original_manifest_archive':'assets/development/v1.0.0/provenance/navigation-before-development/baseline.v3.1.json'}
    save(business_path,business)
    bactive_path=ROOT/'assets/requirements/active.json';bactive=load(bactive_path)
    bactive['manifest_sha256']=sha(business_path);save(bactive_path,bactive)
    paths=list((ROOT/'docs/开发').glob('*.md'))
    paths += [p for p in DEST.rglob('*') if p.is_file() and p.name!='manifest.json']
    paths += [ROOT/'README.md',ROOT/'AGENTS.md']
    paths += [ROOT/'scripts'/name for name in ['build_development_assets.py','build_development_openapi.py','build_development_contracts.py','verify_development_docs.py','seal_development_baseline.py','package_development_docs.py']]
    paths=sorted(set(paths),key=lambda p:p.relative_to(ROOT).as_posix())
    for p in paths:
        if not p.is_file():raise ValueError('Missing inventory file: '+str(p))
    manifest={'schema_version':'1.0','product_id':'P07','development_baseline':'P07-DEV 1.0.0','date':'2026-10-27','status':'DEVELOPMENT_DOCUMENTATION_BASELINE','implementation_status':'NOT_IMPLEMENTED','product_test_status':'NOT_RUN','dependencies':{'business_baseline':'v3.1','business_manifest_sha256':bactive['manifest_sha256'],'design_baseline':'P07-DS-B 1.0.0','design_pointer_sha256':sha(ROOT/'assets/design/active.json')},'files':[{'project_path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in paths],'excluded_outputs':['runtime/**','docs/评审/P07-开发文档-v1.0.0-核验-2026-10-27.*','output/development/**'],'notes':['SQL grammar/spec/schema checks do not execute product/DB/device/payment tests.','Original B and v3.0 snapshots remain frozen.','Navigation-only business inventory reseal retains prior manifest and root files in provenance.']}
    save(DEST/'manifest.json',manifest)
    save(ROOT/'assets/development/active.json',{'product_id':'P07','development_baseline':'P07-DEV 1.0.0','business_baseline':'v3.1','design_baseline':'P07-DS-B 1.0.0','manifest':'v1.0.0/manifest.json','manifest_sha256':sha(DEST/'manifest.json'),'documents':'../../docs/开发/README.md','requirements_pointer':'../requirements/active.json','design_pointer':'../design/active.json','status':'DOCUMENTS_READY_PRODUCT_NOT_IMPLEMENTED','updated_on':'2026-10-27'})
    print('Sealed '+str(len(paths))+' development files; business v3.1 navigation hashes refreshed with original snapshot retained.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot-navigation',action='store_true')
    parser.add_argument('--seal',action='store_true')
    args=parser.parse_args()
    if args.snapshot_navigation:snapshot()
    if args.seal:seal()
