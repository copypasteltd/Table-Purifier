# Native Ubuntu 22.04 HTTP deployment

[中文](README.md) · [Project guide](../../README.en.md) · [Deployment scripts](../../scripts/deployment) · [Verification](verification-2026-10-31.json)

On 2026-10-31 the user explicitly authorized native installation on `192.168.31.20`, a high HTTP port, missing dependencies and plaintext deployment credentials under `/root/cfg/`. This deployment adds no HTTPS listener, certificates, HTTPS redirects or HSTS and invokes no Docker, WSL or virtual machines. Other applications retain their own services and configurations.

## Addresses and scope

| Component | Address / path |
| --- | --- |
| LAN entry | `http://192.168.31.20:18707/` |
| Alipay source preview | `/preview/` |
| Douyin source preview | `/preview/douyin.html` |
| Liveness / migration readiness | `/health/live` / `/health/ready` |
| Existing authenticated business routes | `/v1/p07/*` |
| Internal API | `127.0.0.1:18708` |
| Dedicated PostgreSQL 14 cluster | `127.0.0.1:18709`, cluster `14/tablepurifier` |
| Application | `/opt/table-purifier/app/` |
| Dedicated Node runtime | `/opt/table-purifier/toolchain/node-v24.22.2-linux-x64/` |
| Dedicated Python environment | `/opt/table-purifier/app/runtime/python-tools/` |
| Static source preview | `/opt/table-purifier/site/preview/` |
| Root-only plaintext credentials | `/root/cfg/table-purifier/` |

The root redirects to the documentation preview. It renders actual mini-program templates/controllers using synthetic data and simulated Agent, pricing and order states. Its browser policy blocks API connections. It is not the P1 Web product and cannot accept real material or payments. Native mini programs still require platform configuration, device checks and submission.

API/Worker/database deployment, native confinement probes, live model calls and platform acceptance are separate claims. Readiness only checks the database and the complete migration checksums. Until dedicated model/platform/payment credentials are supplied, the Agent, platform and commerce flags remain disabled and no real customer-ready session is created.

## Installation

The host's existing Node 20 does not meet the project range. A dedicated Node 24.22.2 archive is downloaded from the [official release directory](https://nodejs.org/dist/v24.22.2/) and checked against its SHA-256 list. The existing host Node and other applications are preserved. Other dependencies are system Python 3.10, GCC, PostgreSQL 14, Nginx, Tesseract English/Simplified Chinese and the pinned Python requirements.

1. Check OS, resources and unused ports. Run `scripts/deployment/prerequisites.sh` as root on the authorized host. It installs dependencies and creates the non-login `tablepurifier` system account.
2. In the local source repository run `npm run check`, `node docs/preview/build.mjs` and `python scripts/deployment/package.py`. The ignored `runtime/deploy/` archive includes source, compiled JS and synthetic preview files, excluding credentials and runtime data. Upload it and verify SHA-256 before extracting to the new application directory.
3. Create service-writable `runtime/` and initially `node_modules/`. Use the dedicated Node binary on PATH, retaining `/usr/sbin`. Run `npm ci --omit=dev --no-audit` as `tablepurifier`, without personal npm configuration. Restore dependency ownership to root afterward.
4. Create the dedicated `runtime/python-tools/` Python package environment and install `agent/tools/requirements.txt`. This is not a virtual machine or container.
5. From the application directory run `python3 scripts/deployment/bootstrap.py` as root. It provisions the private cluster and random credentials, runs all twelve migrations, grants separate runtime roles, compiles the native launcher and writes a profile containing real executable checksums. Existing credentials/configuration are reused; the database is never reset.
6. Install the three `table-purifier-*.service` units and `tablepurifier.slice` into `/etc/systemd/system/`, reload systemd, enable/start isolation delegation, then API and Worker. All services are enabled at boot.
7. Copy `_site/preview/` to the dedicated public preview directory and create `douyin.html` by changing only the entry bundle from `ALIPAY.js` to `DOUYIN.js`. Keep static files read-only.
8. Install the project Nginx configuration as `/etc/nginx/conf.d/table-purifier.conf`, validate it and reload Nginx. Only open `18707/tcp` when the existing firewall is already active. Do not enable/reset the host firewall or modify other applications' listeners.

Do not rerun a recursive ownership reset over an existing live application. For a partial failure, inspect the private configuration and dedicated cluster before retrying; never delete a database or rotate credentials simply to restart bootstrap.

## Plaintext credentials and permissions

`/root/cfg/table-purifier/` is root-owned mode `0700`; files are `0600`. As root, inspect `credentials.json` and the configuration files locally. Do not paste them into Git, screenshots or public logs.

| File | Purpose |
| --- | --- |
| `credentials.json` | Database name/host/port, API/Worker/migration usernames and random plaintext passwords, stable token/identity secrets, operator token and system-account authentication notes |
| `api.env` | API settings and API database URL |
| `worker.env` | Worker settings and Worker database URL |
| `migration.env` | Dedicated migration administrator URL; never loaded by a persistent service |
| `README.txt` | Local deployment/maintenance pointers |

Runtime database logins are neither superusers nor `BYPASSRLS` roles nor owners of the business schema. The API inherits `p07_app`; the Worker inherits `p07_worker`. The dedicated cluster migration administrator can provision the fixed internal NOLOGIN roles but is never given to the API or Agent. PostgreSQL listens only on loopback, uses SCRAM for the fixed application logins and permits OS peer administration only for the local `postgres` account.

systemd reads root-only environment files before starting unprivileged services. Agent children receive a separately constructed environment without database URLs, merchant secrets or desktop Codex authentication.

## HTTP forwarding and the final domain

Forward the user's tunnel to **`192.168.31.20:18707`**, using HTTP. The internal API/database ports do not need forwarding. `P07_ALLOW_HTTP_DEPLOYMENT=true` is an explicit production opt-in. For an HTTP public URL, the API emits neither HSTS nor `upgrade-insecure-requests`. This project's Nginx configuration contains no TLS/certificate/HTTPS redirect settings; unrelated existing HTTPS services are untouched.

Once the actual domain is known, set `P07_PUBLIC_URL=http://your-domain` in both runtime environment files and update the explanatory `public_url` in `credentials.json`; restart API/Worker. Generated download/callback addresses use that value. Rebuild mini-program settings separately and complete platform domain/capability validation.

## Service operations and native verification

As root on the server:

```sh
systemctl status table-purifier-api table-purifier-worker table-purifier-isolation postgresql@14-tablepurifier --no-pager
systemctl restart table-purifier-api table-purifier-worker
systemctl stop table-purifier-api table-purifier-worker
systemctl start table-purifier-api table-purifier-worker
journalctl -u table-purifier-api -u table-purifier-worker -n 80 --no-pager
curl --fail http://127.0.0.1:18707/health/live
curl --fail http://127.0.0.1:18707/health/ready
nginx -t
```

Only operate these project services. Do not restart all PostgreSQL clusters or the host. Stop API/Worker before maintaining the delegation unit or database.

The following probe uses the actual non-root identity, filesystem constraints and delegated cgroup. It performs no model request and uses no customer material:

```sh
systemd-run --unit=table-purifier-native-probe --wait --collect --pipe \
  -p User=tablepurifier -p Group=tablepurifier -p Slice=tablepurifier.slice \
  -p WorkingDirectory=/opt/table-purifier/app \
  -p EnvironmentFile=/root/cfg/table-purifier/api.env \
  -p ProtectSystem=strict -p ProtectHome=true -p PrivateTmp=true -p NoNewPrivileges=true \
  -p 'ReadWritePaths=/opt/table-purifier/app/runtime /sys/fs/cgroup/tablepurifier.slice/table-purifier-isolation.service' \
  /opt/table-purifier/toolchain/node-v24.22.2-linux-x64/bin/node scripts/deployment/native-probe.mjs
```

It checks cross-directory denial, read-only control files, writable task space, Python imports and confined execution of the pinned Codex CLI `--version`. It also starts a real parent/child process tree and verifies termination of both processes plus removal of the complete synthetic session/process group. The receipt is `runtime/deployment/native-probe.json`. This is not live model/payment/end-to-end acceptance.

API, Worker and isolation delegation share a project-only `tablepurifier.slice`. Only that project's common ancestor `cgroup.procs` is delegated to the service user, allowing task migration without granting control over the system root or other applications. An idle child supervisor keeps the delegated hierarchy alive; an empty exited oneshot would be removed by systemd. Service write access is limited to project runtime and the delegated task hierarchy.

## Deployed preview screenshots

These screenshots were captured directly from the LAN HTTP endpoint, retaining the synthetic-data labels. Both previews loaded without JavaScript errors or broken images; all browser resources were closed. They verify deployed documentation rendering, not live model or payment acceptance.

![Alipay HTTP source preview with synthetic data](screenshots/alipay-http.png)

[Douyin HTTP preview screenshot](screenshots/douyin-http.png)

## Enabling real capabilities, updates and backups

Supply dedicated model credentials/model/base URL and matching actual processor-policy declarations before enabling Agent. Supply each platform's App ID, merchant/signing information and real capability evidence before enabling its gates. Commerce also requires payment/refund acceptance. Never use desktop authentication, global `auth.json`, fake payment or a healthy HTTP endpoint to bypass these requirements.

Continue updating both READMEs, related documents and CHANGELOG, and commit/push verified source changes to the designated repository. A later deployment update must preserve `runtime/`, private configuration and `/root/cfg/`. Back up the dedicated database plus persistent results and required runtime/configuration as a single recovery point, stop project API/Worker, install verified code/dependencies with the dedicated runtime, migrate, restart and verify health/permissions/native confinement again. Never replace persistent storage with an empty directory or copy Windows `node_modules` onto Linux.

Use OS-peer `pg_dump -p 18709 -d table_purifier -Fc` for database backups without placing credentials in process arguments. Store backups root-only. No external backup target, scheduler or automatic update is installed by default. Successful sessions retain all nine result files under `runtime/results/`; normal cleanup destroys only the corresponding complete task environment.
