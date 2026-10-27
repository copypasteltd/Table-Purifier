"""Read and verify every archived byte and reject credentials/runtime paths; no extraction or execution."""
from __future__ import annotations
import hashlib
import json
import pathlib
import stat
import zipfile
from package_source import ARCHIVED_RECEIPTS

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'source'
PREFIX = '表格修复站源码/'

def main() -> None:
    receipt = json.loads((OUT / 'package-receipt.json').read_text(encoding='utf-8'))
    path = ROOT / receipt['archive']
    assert path.resolve().parent == OUT.resolve(), 'Archive escaped source output'
    assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt['sha256'], 'Archive checksum mismatch'
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), 'Duplicate archive names'
        raw = archive.read(PREFIX + 'SOURCE_MANIFEST.json')
        assert hashlib.sha256(raw).hexdigest() == receipt['manifest_sha256'], 'Manifest checksum mismatch'
        manifest = json.loads(raw)
        expected = {PREFIX + item['path']: item for item in manifest['files']}
        assert set(names) == set(expected) | {PREFIX + 'SOURCE_MANIFEST.json'}, 'Unlisted or missing files'
        assert len(expected) == receipt['files'], 'Source count mismatch'
        for name, item in expected.items():
            relative = pathlib.PurePosixPath(item['path'])
            assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in item['path']
            assert not any(part in {'node_modules','runtime','__pycache__','.git','output','dist','coverage'} for part in relative.parts) or relative.as_posix() in ARCHIVED_RECEIPTS
            assert relative.name not in {'.env','config.local.json','douyin-product.json','processor-policy.json','isolation-profile.json'}
            assert not (relative.name.startswith('.env.') and relative.name != '.env.example')
            assert relative.suffix.lower() not in {'.pem','.key','.pfx','.p12','.zip','.exe','.dll','.pyc'}
            if relative.parts[:2] == ('config','release-evidence') and relative.suffix == '.json':
                assert relative.name.endswith('.example.json'), 'Actual release evidence must not ship'
            info = archive.getinfo(name)
            assert not stat.S_ISLNK(info.external_attr >> 16), 'Archive link rejected'
            data = archive.read(name)
            assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'], 'Source checksum mismatch: ' + name
            source = ROOT / item['path']
            assert source.is_file() and source.read_bytes() == data, 'Archive is stale: ' + name
    print(json.dumps({'status':'PASS','files':len(expected),'archive_sha256':receipt['sha256']},ensure_ascii=False))

if __name__ == '__main__':
    main()
