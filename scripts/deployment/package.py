"""Build a deployment archive from non-ignored source, compiled JS and the synthetic preview."""
from __future__ import annotations
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'runtime/deploy'
OUT.mkdir(parents=True, exist_ok=True)
paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).decode('utf-8').split('\0')
files = {path: ROOT / path for path in paths if path and (ROOT / path).is_file()}
for prefix in ['dist', 'runtime/docs-preview']:
    for path in (ROOT / prefix).rglob('*'):
        if path.is_file():
            name = path.relative_to(ROOT).as_posix()
            if prefix == 'runtime/docs-preview':
                name = '_site/preview/' + path.relative_to(ROOT / prefix).as_posix()
            files[name] = path
if 'dist/api/main.js' not in files or '_site/preview/index.html' not in files:
    raise SystemExit('Build the backend and documentation preview first.')
manifest = {
    'source_base_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'working_tree_dirty': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT)),
    'scope': 'NATIVE_UBUNTU_HTTP; SYNTHETIC_BROWSER_PREVIEW; NO_RUNTIME_DATA_OR_CREDENTIALS',
    'files': [],
}
archive_path = OUT / 'table-purifier-deploy.tar.gz'
with tarfile.open(archive_path, 'w:gz') as archive:
    for name, path in sorted(files.items()):
        if path.is_symlink() or not path.resolve().is_relative_to(ROOT):
            raise SystemExit('Unsafe package path.')
        if any(part in name.split('/') for part in ['.git', 'node_modules']) or path.name in ['.env', 'config.local.json', 'credentials.json'] or path.name.endswith('.env') or path.suffix.lower() in {'.pem', '.key', '.p12', '.pfx'}:
            raise SystemExit('Private file selected for deployment.')
        data = path.read_bytes()
        info = tarfile.TarInfo(name)
        info.size, info.mode, info.mtime = len(data), 0o644, 0
        archive.addfile(info, io.BytesIO(data))
        manifest['files'].append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    data = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    info = tarfile.TarInfo('deployment-manifest.json')
    info.size, info.mode, info.mtime = len(data), 0o644, 0
    archive.addfile(info, io.BytesIO(data))
receipt = {'archive': str(archive_path.relative_to(ROOT)), 'bytes': archive_path.stat().st_size,
           'sha256': hashlib.sha256(archive_path.read_bytes()).hexdigest(), 'files': len(files),
           'source_base_commit': manifest['source_base_commit'], 'working_tree_dirty': manifest['working_tree_dirty']}
(OUT / 'package-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt))
