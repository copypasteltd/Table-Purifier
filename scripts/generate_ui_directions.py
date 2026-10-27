"""Generate the five approved visual concepts through the existing Sub2 skill CLI.
No gateway configuration or secrets are copied into this project.
"""
from pathlib import Path
import argparse, concurrent.futures, json, subprocess, sys, time
from datetime import datetime, timezone
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/imagegen/miniapp-style-selection-2026-10-27'
CLI=Path('C:/Users/carzy/.codex/skills/sub2-image-gen/scripts/sub2_image_gen.py')
def run_one(style):
    target=OUT/style['image_file']
    if target.exists():
        try:
            with Image.open(target) as im:
                im.verify()
            return {'id':style['id'],'status':'EXISTS_VALID','file':str(target)}
        except Exception:
            return {'id':style['id'],'status':'EXISTS_INVALID_NOT_OVERWRITTEN','file':str(target)}
    start=time.monotonic()
    print(json.dumps({'event':'START','id':style['id'],'model':'gpt-image-2.5'},ensure_ascii=False),flush=True)
    cmd=[sys.executable,str(CLI),'generate','--model','gpt-image-2.5','--size','1536x1024','--quality','high','--n','1','--output-format','png','--prompt-file',str(OUT/style['prompt_file']),'--out',str(target)]
    try:
        p=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=900)
        status='GENERATED' if p.returncode==0 and target.exists() else 'FAILED'
        result={'id':style['id'],'status':status,'exit_code':p.returncode,'elapsed_seconds':round(time.monotonic()-start,1),'file':str(target)}
        # Raw CLI output is kept in memory only; do not persist tokens or gateway configuration.
        if status=='GENERATED':
            with Image.open(target) as im:
                result['dimensions']=list(im.size)
                im.verify()
        else:
            import re
            raw=(p.stderr or p.stdout or 'No gateway error text')[-3000:]
            raw=re.sub(r'(?i)(bearer\s+)[^\s\"\']+',r'\1[REDACTED]',raw)
            raw=re.sub(r'sk-[A-Za-z0-9_-]+','[REDACTED]',raw)
            raw=re.sub(r'(?i)((?:api[_-]?key|authorization)\s*[:=]\s*)[^\s,]+',r'\1[REDACTED]',raw)
            result['error']=raw
    except Exception as exc:
        result={'id':style['id'],'status':'FAILED','error_type':type(exc).__name__,'elapsed_seconds':round(time.monotonic()-start,1)}
    print(json.dumps({'event':'FINISH',**result},ensure_ascii=False),flush=True)
    return result
if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--execute',action='store_true')
    ap.add_argument('--styles',nargs='*',default=['A','B','C','D','E'])
    ap.add_argument('--workers',type=int,choices=[1,2],default=2)
    args=ap.parse_args()
    if not args.execute:
        ap.error('Use --execute to request generation; existing valid images are skipped.')
    manifest=json.loads((OUT/'design-directions.json').read_text(encoding='utf-8'))
    selected=[s for s in manifest['styles'] if s['id'] in args.styles]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        results=list(pool.map(run_one,selected))
    receipt={'recorded_at':datetime.now(timezone.utc).isoformat(),'provider_route':'sub2-image-gen skill CLI','model':'gpt-image-2.5','results':results,'product_implementation_status':'NOT_IMPLEMENTED'}
    (OUT/'generation-run.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if any(r['status'] not in ['GENERATED','EXISTS_VALID'] for r in results):
        raise SystemExit(1)
