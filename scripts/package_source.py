"""Create a deterministic source-only archive. Never starts services or includes runtime data."""
from __future__ import annotations
import hashlib
import json
import pathlib
import stat
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'source'
ARCHIVE = OUT / 'P07-source-0.1.0.zip'
PREFIX = '表格修复站源码/'
ROOT_FILES = ['SOURCE_README.md', 'README.md', 'README.en.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md', '.gitattributes', '.env.example', '.gitignore', '.npmrc',
              'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.build.json', 'vitest.config.ts']
DIRECTORIES = ['src', 'miniapp', 'agent', 'migrations', 'native', 'config', 'tests', 'scripts', 'assets', 'docs']
BLOCKED_NAMES = {'.env', 'config.local.json', 'douyin-product.json', 'processor-policy.json', 'isolation-profile.json'}
BLOCKED_PARTS = {'node_modules', 'runtime', '__pycache__', '.git', 'output', 'coverage', 'dist'}
ARCHIVED_RECEIPTS = {
    'docs/背景/开发v1.0.0-固定流水线/files/output/development/package-receipt.json',
    'docs/背景/v3.1与开发v2.0-会话流程调整前/files/output/development/package-receipt.v2.0.0.json',
    'docs/背景/v3.1与开发v2.0-会话流程调整前/files/docs/背景/开发v1.0.0-固定流水线/files/output/development/package-receipt.json',
}

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def selected(path: pathlib.Path) -> bool:
    relative = path.relative_to(ROOT)
    if any(part in BLOCKED_PARTS for part in relative.parts) and relative.as_posix() not in ARCHIVED_RECEIPTS:
        return False
    if path.name in BLOCKED_NAMES or (path.name.startswith('.env.') and path.name != '.env.example'):
        return False
    if path.suffix.lower() in {'.pem', '.key', '.pfx', '.p12', '.pyc', '.zip', '.exe', '.dll'}:
        return False
    if relative.parts[:2] == ('config', 'release-evidence') and path.suffix == '.json':
        return path.name.endswith('.example.json')
    return True

def main() -> None:
    files = [ROOT / name for name in ROOT_FILES]
    for directory in DIRECTORIES:
        files.extend(path for path in (ROOT / directory).rglob('*') if path.is_file() and selected(path))
    files = sorted(set(files), key=lambda path: path.relative_to(ROOT).as_posix())
    rows = []
    content = {}
    for path in files:
        if path.is_symlink() or path.resolve() != path:
            raise RuntimeError('Source links are not allowed: ' + str(path.relative_to(ROOT)))
        relative = path.relative_to(ROOT).as_posix()
        data = path.read_bytes()
        content[relative] = data
        rows.append({'path': relative, 'bytes': len(data), 'sha256': digest(data)})
    manifest = {'protocol': 'P07-SOURCE-1', 'version': '0.1.0', 'entry': 'README.md', 'english_entry': 'README.en.md',
                'business': 'v3.2', 'development': 'P07-DEV3.0.0', 'design': 'B1.0.0',
                'scope': 'SOURCE_ONLY_NO_DEPLOYMENT_NO_CREDENTIALS_NO_RUNTIME_DATA', 'files': rows}
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    OUT.mkdir(parents=True, exist_ok=True)
    if OUT.is_symlink() or OUT.resolve() != OUT:
        raise RuntimeError('Source output must be a real directory inside this project.')
    with zipfile.ZipFile(ARCHIVE, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in [*content.items(), ('SOURCE_MANIFEST.json', manifest_bytes)]:
            info = zipfile.ZipInfo(PREFIX + name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | 0o644) << 16
            archive.writestr(info, data)
    (OUT / 'source-manifest.json').write_bytes(manifest_bytes)
    result = {'archive': ARCHIVE.relative_to(ROOT).as_posix(), 'files': len(rows), 'bytes': ARCHIVE.stat().st_size,
              'sha256': digest(ARCHIVE.read_bytes()), 'manifest_sha256': digest(manifest_bytes)}
    (OUT / 'package-receipt.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
