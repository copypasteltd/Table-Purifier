"""Root-only, native Ubuntu deployment bootstrap. No Docker, WSL or TLS setup.

Run after uploading a built app and installing its project-local dependencies.
Existing credentials are reused; this script never resets an existing database.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess

APP = Path('/opt/table-purifier/app')
CFG = Path('/root/cfg/table-purifier')
NODE = Path('/opt/table-purifier/toolchain/node-v24.22.2-linux-x64/bin/node')
DB_PORT = 18709
CGROUP = '/sys/fs/cgroup/tablepurifier.slice/table-purifier-isolation.service'


def run(args: list[str], *, data: str | None = None, quiet: bool = False) -> subprocess.CompletedProcess:
    result = subprocess.run(args, input=data, text=True, capture_output=quiet, check=False)
    if result.returncode:
        # Do not echo SQL, connection strings, environment files or raw DB errors.
        raise RuntimeError(f'Deployment step failed: {args[0]} (exit {result.returncode})')
    return result


def private_file(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
        stream.write(text)
    path.chmod(0o600)


def env_file(path: Path, values: dict[str, str]) -> None:
    # Generated deployment values contain no whitespace, quotes or shell syntax.
    if any('\n' in value or '\r' in value for value in values.values()):
        raise ValueError('Environment values must be single-line.')
    private_file(path, ''.join(f'{key}={value}\n' for key, value in values.items()))


def sql(text: str, database: str = 'postgres') -> None:
    run(['runuser', '-u', 'postgres', '--', '/usr/lib/postgresql/14/bin/psql', '-X', '-q',
         '-v', 'ON_ERROR_STOP=1', '-p', str(DB_PORT), '-d', database], data=text, quiet=True)


def main() -> None:
    if os.geteuid() != 0 or not (APP / 'dist/api/main.js').is_file() or not NODE.is_file():
        raise SystemExit('Run as root after preparing the built application and dedicated Node runtime.')
    os.umask(0o077)
    CFG.mkdir(mode=0o700, parents=True, exist_ok=True)
    CFG.chmod(0o700)
    cluster_config = Path('/etc/postgresql/14/tablepurifier')
    if not cluster_config.exists():
        run(['pg_createcluster', '--port', str(DB_PORT), '--locale', 'C.UTF-8',
             '--start-conf', 'auto', '14', 'tablepurifier'])
    conf = cluster_config / 'conf.d/table-purifier.conf'
    conf.write_text("listen_addresses = '127.0.0.1'\nport = 18709\npassword_encryption = 'scram-sha-256'\n"
                    "max_connections = 50\nshared_buffers = '128MB'\nssl = off\n", encoding='utf-8')
    conf.chmod(0o644)
    hba = cluster_config / 'pg_hba.conf'
    hba.write_text('local all postgres peer\n'
                   'host table_purifier tp_migrator 127.0.0.1/32 scram-sha-256\n'
                   'host table_purifier tp_api 127.0.0.1/32 scram-sha-256\n'
                   'host table_purifier tp_worker 127.0.0.1/32 scram-sha-256\n', encoding='utf-8')
    hba.chmod(0o640)
    # Configuration files of this private cluster belong to postgres.
    run(['chown', '-R', 'postgres:postgres', str(cluster_config)])
    run(['systemctl', 'enable', '--now', 'postgresql@14-tablepurifier.service'])
    run(['pg_ctlcluster', '14', 'tablepurifier', 'reload'])

    credentials_path = CFG / 'credentials.json'
    if credentials_path.exists():
        credentials = json.loads(credentials_path.read_text(encoding='utf-8'))
    else:
        credentials = {
            'database': 'table_purifier', 'database_host': '127.0.0.1', 'database_port': DB_PORT,
            'roles': {name: {'username': user, 'password': secrets.token_hex(32)} for name, user in
                      [('migration', 'tp_migrator'), ('api', 'tp_api'), ('worker', 'tp_worker')]},
            'token_secret': secrets.token_hex(48), 'identity_secret': secrets.token_hex(48),
            'operator_token': secrets.token_hex(48),
            'system_user': {'username': 'tablepurifier', 'password': 'DISABLED; system account, no login shell'},
            'postgres_administrator': {'username': 'postgres', 'password': 'NONE; local OS peer authentication only'},
            'public_url': 'http://192.168.31.20:18707',
        }
        # Save before creating roles so a partial bootstrap can reuse the same credentials.
        private_file(credentials_path, json.dumps(credentials, ensure_ascii=False, indent=2) + '\n')
    roles = credentials['roles']
    for name, role in roles.items():
        user, password = role['username'], role['password']
        if user not in ('tp_migrator', 'tp_api', 'tp_worker') or len(password) != 64 or any(c not in '0123456789abcdef' for c in password):
            raise ValueError('Unexpected deployment role credentials.')
        privilege = 'SUPERUSER' if name == 'migration' else 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS'
        sql(f"DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='{user}') THEN "
            f"CREATE ROLE {user} LOGIN {privilege} PASSWORD '{password}'; END IF; END $$;")
    # Migration functions create and own fixed NOLOGIN control roles; never give this login to a running service.
    exists = run(['runuser', '-u', 'postgres', '--', '/usr/lib/postgresql/14/bin/psql', '-XAt', '-p', str(DB_PORT),
                  '-d', 'postgres', '-c', "SELECT 1 FROM pg_database WHERE datname='table_purifier'"], quiet=True).stdout.strip()
    if exists != '1':
        sql("CREATE DATABASE table_purifier OWNER tp_migrator TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';")
        sql('REVOKE CONNECT ON DATABASE table_purifier FROM PUBLIC; GRANT CONNECT ON DATABASE table_purifier TO tp_migrator,tp_api,tp_worker;')

    def db_url(name: str) -> str:
        role = roles[name]
        return f"postgresql://{role['username']}:{role['password']}@127.0.0.1:{DB_PORT}/table_purifier"

    base = {
        'P07_ENV': 'production', 'P07_HOST': '127.0.0.1', 'P07_PORT': '18708',
        'P07_PUBLIC_URL': credentials['public_url'], 'P07_ALLOW_HTTP_DEPLOYMENT': 'true',
        'P07_STORAGE_ROOT': 'runtime', 'P07_TOKEN_SECRET': credentials['token_secret'],
        'P07_IDENTITY_SECRET': credentials['identity_secret'], 'P07_AGENT_ENABLED': 'false',
        'P07_ALIPAY_ENABLED': 'false', 'P07_DOUYIN_ENABLED': 'false', 'P07_COMMERCE_ENABLED': 'false',
        'P07_CODEX_MODEL': '', 'P07_CODEX_API_KEY': '', 'P07_CODEX_BASE_URL': '',
        'P07_TESSERACT_PATH': '/usr/bin/tesseract',
        'P07_ISOLATION_PROFILE': 'config/isolation-profile.json',
        'P07_OPERATOR_TOKEN_HASH': hashlib.sha256(credentials['operator_token'].encode()).hexdigest(),
    }
    # Runtime files deliberately exclude the migration superuser connection string.
    for filename, values in {
        'api.env': {**base, 'P07_DATABASE_URL': db_url('api')},
        'worker.env': {**base, 'P07_WORKER_DATABASE_URL': db_url('worker')},
        'migration.env': {'P07_MIGRATION_DATABASE_URL': db_url('migration')},
    }.items():
        target = CFG / filename
        if not target.exists():
            env_file(target, values)
    code = """import {migrate} from './dist/db/migrate.js';
import {readFileSync} from 'node:fs';
const line=readFileSync('/root/cfg/table-purifier/migration.env','utf8').trim();
const url=line.slice(line.indexOf('=')+1);
try { console.log(JSON.stringify({applied:await migrate(url,'./migrations')})); }
catch { console.error('MIGRATION_FAILED; inspect the private database locally.'); process.exitCode=1; }
"""
    run([str(NODE), '--input-type=module', '-e', code])
    sql('GRANT p07_app TO tp_api; GRANT p07_worker TO tp_worker; '
        'GRANT USAGE ON SCHEMA p07_meta TO p07_app; GRANT SELECT ON p07_meta.migrations TO p07_app;', 'table_purifier')

    codex_metadata = list((APP / 'node_modules/@openai/codex-linux-x64').glob('**/codex-package.json'))
    if len(codex_metadata) != 1:
        raise RuntimeError('Pinned Codex Linux package missing or ambiguous.')
    metadata = json.loads(codex_metadata[0].read_text(encoding='utf-8'))
    codex = codex_metadata[0].parent / metadata['entrypoint']
    launcher = APP / 'runtime/bin/p07-isolate'
    launcher.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    launcher.parent.chmod(0o755)
    run(['gcc', '-O2', '-Wall', '-Wextra', '-std=gnu11', str(APP / 'native/p07-isolate.c'), '-o', str(launcher)])
    launcher.chmod(0o755)
    profile = {
        'protocol': 'P07-NATIVE-1', 'id': 'ubuntu-22-04-native-18707',
        'launcher': str(launcher), 'launcher_sha256': hashlib.sha256(launcher.read_bytes()).hexdigest(),
        'codex': str(codex), 'codex_sha256': hashlib.sha256(codex.read_bytes()).hexdigest(),
        'python': str(APP / 'runtime/python-tools/bin/python3'),
        'read_only_roots': ['/usr/bin', '/usr/lib', '/etc/ld.so.cache', '/etc/ssl/certs',
                            '/etc/resolv.conf', '/etc/hosts', '/usr/share/tesseract-ocr'],
        'cgroup_root': CGROUP, 'memory_bytes': 2147483648, 'process_limit': 64, 'cpu_quota_percent': 100,
    }
    profile_path = APP / 'config/isolation-profile.json'
    profile_path.write_text(json.dumps(profile, indent=2) + '\n', encoding='utf-8')
    profile_path.chmod(0o644)
    private_file(CFG / 'README.txt',
        'Table Purifier / 表格修复站\nHTTP: http://192.168.31.20:18707\n'
        'API: 127.0.0.1:18708; PostgreSQL: 127.0.0.1:18709\n'
        'Credentials are plaintext in credentials.json; keep this directory root-only.\n'
        'api.env and worker.env are loaded by systemd. migration.env is never loaded by a service.\n'
        'Codex / platform / payment credentials are NOT configured.\n'
        'Do not enable Agent before the dedicated model, actual processor policy and native probe pass.\n'
        'The browser preview uses synthetic fixtures and cannot process real data or payments.\n'
        'Full deployment and maintenance instructions: /opt/table-purifier/app/docs/deployment/README.md\n')
    print('DATABASE_CONFIG_AND_NATIVE_PROFILE_READY; secrets saved only in /root/cfg/table-purifier/')


if __name__ == '__main__':
    os.chdir(APP)
    main()
