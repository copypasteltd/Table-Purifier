"""Generate one logo through the explicitly supplied sub2-image-gen skill, never another provider."""
from __future__ import annotations
import argparse
import ast
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'assets/brand/logo-exploration/2026-11-01/concepts.json'


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', required=True)
    parser.add_argument('--skill-script', type=Path, required=True)
    parser.add_argument('--force', action='store_true', help='Explicitly request a replacement image when output already exists.')
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    concept = next(row for row in catalog['concepts'] if row['id'] == args.id)
    script = args.skill_script.resolve(strict=True)
    # Read secret literals only to redact a possible gateway error; never emit or persist them.
    private_literals = set()
    tree = ast.parse(script.read_text(encoding='utf-8-sig'))
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and re.search('key|token|password', target.id, re.I) for target in node.targets):
            private_literals.update(child.value for child in ast.walk(node.value) if isinstance(child, ast.Constant) and isinstance(child.value, str) and len(child.value) >= 12)
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and re.search('key|token|password', node.target.id, re.I) and node.value:
            private_literals.update(child.value for child in ast.walk(node.value) if isinstance(child, ast.Constant) and isinstance(child.value, str) and len(child.value) >= 12)
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values):
                if isinstance(key, ast.Constant) and isinstance(key.value, str) and re.search('key|token|password', key.value, re.I):
                    private_literals.update(child.value for child in ast.walk(value) if isinstance(child, ast.Constant) and isinstance(child.value, str) and len(child.value) >= 12)
    output = ROOT / 'output/imagegen/table-purifier-logos-2026-11-01'
    output.mkdir(parents=True, exist_ok=True)
    target = output / (concept['slug'] + '.png')
    if target.exists() and not args.force:
        print(json.dumps({'id': concept['id'], 'status': 'EXISTS_NOT_REGENERATED', 'file': target.relative_to(ROOT).as_posix()}, ensure_ascii=False))
        return 0
    command = [sys.executable, str(script), 'generate', '--prompt-file', str(CATALOG.parent / concept['prompt']),
               '--model', catalog['model'], '--size', catalog['size'], '--quality', catalog['quality'],
               '--output-format', 'png', '--background', catalog['background'], '--n', '1', '--out', str(target)]
    if args.force:
        command.append('--force')
    start = time.monotonic()
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=1200)
    receipt = {'id': concept['id'], 'name_zh': concept['name_zh'], 'requested_model': catalog['model'],
               'size_requested': catalog['size'], 'quality_requested': catalog['quality'], 'background_requested': catalog['background'],
               'at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'elapsed_seconds': round(time.monotonic() - start, 2),
               'prompt_sha256': hashlib.sha256((CATALOG.parent / concept['prompt']).read_bytes()).hexdigest(), 'fallback_model_used': False}
    if result.returncode or not target.is_file():
        error = result.stderr + '\n' + result.stdout
        for value in private_literals:
            error = error.replace(value, '[REDACTED]')
        error = re.sub(r'Bearer\s+\S+|sk-[\w-]+', '[REDACTED]', error, flags=re.I)
        receipt.update({'status': 'FAILED', 'exit_code': result.returncode, 'gateway_error': error.strip()[-2500:]})
    else:
        with Image.open(target) as picture:
            picture.verify()
        with Image.open(target) as picture:
            alpha = picture.convert('RGBA').getchannel('A').getextrema()
            receipt.update({'status': 'GENERATED', 'file': target.relative_to(ROOT).as_posix(),
                            'width': picture.width, 'height': picture.height, 'mode': picture.mode,
                            'alpha_extrema': list(alpha), 'has_transparent_pixels': alpha[0] < 255,
                            'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
    (output / (concept['slug'] + '.receipt.json')).write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(receipt, ensure_ascii=False))
    return 0 if receipt['status'] == 'GENERATED' else 1


if __name__ == '__main__':
    raise SystemExit(main())
