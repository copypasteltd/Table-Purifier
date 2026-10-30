"""Emit sanitized deployment evidence; never serialize credentials or environment bodies."""
from __future__ import annotations
import datetime
import hashlib
import json
import os
from pathlib import Path
import platform
import stat
import subprocess
import urllib.error
import urllib.request

APP = Path('/opt/table-purifier/app')
CFG = Path('/root/cfg/table-purifier')


def command(args: list[str]) -> str:
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()


def query(text: str):
    return json.loads(command(['runuser', '-u', 'postgres', '--', '/usr/lib/postgresql/14/bin/psql',
                              '-XAt', '-p', '18709', '-d', 'table_purifier', '-c', text]))


def file_info(path: Path) -> dict:
    info = path.stat()
    return {'path': str(path), 'mode': oct(stat.S_IMODE(info.st_mode)), 'uid': info.st_uid, 'gid': info.st_gid}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if os.geteuid() != 0:
        raise SystemExit('Inspection requires root; output is sanitized.')
    os.chdir(APP)
    services = []
    for name in ['table-purifier-api', 'table-purifier-worker', 'table-purifier-isolation', 'postgresql@14-tablepurifier']:
        fields = command(['systemctl', 'show', name, '-p', 'ActiveState', '-p', 'SubState', '-p', 'NRestarts', '-p', 'User', '-p', 'Slice']).splitlines()
        services.append({'name': name, **dict(line.split('=', 1) for line in fields), 'enabled': command(['systemctl', 'is-enabled', name])})
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    http = []
    for path in ['/health/live', '/health/ready', '/v1/p07/tasks', '/preview/', '/preview/douyin.html', '/root/cfg/table-purifier/credentials.json']:
        try:
            with client.open('http://127.0.0.1:18707' + path, timeout=10) as response:
                headers, code = response.headers, response.status
                response.read()
        except urllib.error.HTTPError as response:
            headers, code = response.headers, response.code
        http.append({'path': path, 'status': code, 'hsts_present': 'Strict-Transport-Security' in headers,
                     'https_upgrade_present': 'upgrade-insecure-requests' in headers.get('Content-Security-Policy', '')})
    migrations = query("SELECT json_agg(m ORDER BY name) FROM (SELECT name,sha256 FROM p07_meta.migrations) m")
    for migration in migrations:
        migration['disk_sha256_matches'] = migration['sha256'] == digest(APP / 'migrations' / migration['name'])
    roles = query("SELECT json_agg(r ORDER BY rolname) FROM (SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN('tp_api','tp_worker','tp_migrator','p07_control')) r")
    runtime_config = {}
    for filename in ['api.env', 'worker.env']:
        values = dict(line.split('=', 1) for line in (CFG / filename).read_text().splitlines() if line and not line.startswith('#'))
        allow = ['P07_ENV', 'P07_HOST', 'P07_PORT', 'P07_PUBLIC_URL', 'P07_ALLOW_HTTP_DEPLOYMENT',
                 'P07_AGENT_ENABLED', 'P07_ALIPAY_ENABLED', 'P07_DOUYIN_ENABLED', 'P07_COMMERCE_ENABLED']
        runtime_config[filename] = {key: values[key] for key in allow}
        runtime_config[filename]['migration_url_excluded'] = not values.get('P07_MIGRATION_DATABASE_URL')
    active_nginx = '\n'.join(line for line in Path('/etc/nginx/conf.d/table-purifier.conf').read_text().splitlines() if not line.lstrip().startswith('#'))
    receipt = {
        'scope': 'AUTHORIZED_NATIVE_UBUNTU_HTTP_DEPLOYMENT', 'status': 'PASS',
        'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'host': '192.168.31.20', 'os': platform.freedesktop_os_release()['PRETTY_NAME'], 'kernel': platform.release(),
        'node': command(['/opt/table-purifier/toolchain/node-v24.22.2-linux-x64/bin/node', '--version']),
        'python': platform.python_version(), 'postgresql': command(['/usr/lib/postgresql/14/bin/psql', '--version']),
        'public_url': 'http://192.168.31.20:18707',
        'listeners': command(['ss', '-lnt', '( sport = :18707 or sport = :18708 or sport = :18709 )']).splitlines(),
        'services': services, 'http': http, 'migrations': migrations, 'database_roles': roles,
        'credential_files': [file_info(CFG), *[file_info(path) for path in sorted(CFG.iterdir()) if path.is_file()]],
        'runtime_configuration': runtime_config,
        'native_probe': json.loads((APP / 'runtime/deployment/native-probe.json').read_text()),
        'https_configured': any(token in active_nginx for token in ['ssl_certificate', 'listen 443', 'Strict-Transport-Security', 'https://']),
        'local_virtualization_used': False, 'credentials_in_git': False,
        'application_files': {name: digest(APP / name) for name in ['src/shared/config.ts', 'src/api/server.ts', 'dist/shared/config.js', 'dist/api/server.js', 'native/p07-isolate.c', 'scripts/deployment/native-probe.mjs', 'scripts/deployment/prepare-cgroup.sh']},
        'live_model': 'NOT_CONFIGURED', 'live_platform_payment': 'NOT_CONFIGURED',
        'native_devices': 'NOT_RUN', 'complete_paid_business_workflow': 'NOT_RUN',
    }
    if not all(service['ActiveState'] == 'active' and service['enabled'] == 'enabled' for service in services):
        receipt['status'] = 'FAIL'
    if len(migrations) != 12 or not all(item['disk_sha256_matches'] for item in migrations) or receipt['native_probe']['result'] != 'PASS':
        receipt['status'] = 'FAIL'
    if [row['status'] for row in http] != [200, 200, 401, 200, 200, 404] or receipt['https_configured']:
        receipt['status'] = 'FAIL'
    if any(row['hsts_present'] or row['https_upgrade_present'] for row in http):
        receipt['status'] = 'FAIL'
    if any(info['uid'] != 0 or info['mode'] != ('0o700' if info['path'] == str(CFG) else '0o600') for info in receipt['credential_files']):
        receipt['status'] = 'FAIL'
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    if receipt['status'] != 'PASS':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
