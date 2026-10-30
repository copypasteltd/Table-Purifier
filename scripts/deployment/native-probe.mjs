// Physical Linux isolation and cleanup check. No model calls or customer data.
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { loadConfig } from '../../dist/shared/config.js';
import { LocalStore } from '../../dist/storage/local-store.js';
import { NativeIsolation, confinedProcess } from '../../dist/agent/isolation.js';

const config = loadConfig({}, false);
const store = new LocalStore(config.storageRoot, config.projectRoot);
await store.initialize();
const isolation = await NativeIsolation.load(config, store);
const session = randomUUID();
const exists = path => access(path).then(() => true, () => false);
let proof, cleanup, failure, liveChild, processIds = [], liveScope;
let treeWasLive = false;
let codexVersion = null;
try {
  await store.prepareSession(session);
  await isolation.prepare(session);
  proof = await isolation.probe(session, AbortSignal.timeout(30000));
  const cliScope = await isolation.scope(session, isolation.profile.codex, false);
  const cliOutput = await confinedProcess(isolation.profile.launcher, ['--version'], cliScope.env, '', AbortSignal.timeout(10000), 1024);
  if (!/^codex-cli 0\.164\.0\s*$/.test(cliOutput)) throw new Error('PINNED_CLI_VERSION_MISMATCH');
  await isolation.verify(cliScope);
  codexVersion = cliOutput.trim();
  liveScope = await isolation.scope(session, isolation.profile.python, false);
  const source = 'import os,sys,json,subprocess,time\n' +
    'child=subprocess.Popen([sys.executable,"-I","-c","import time;time.sleep(120)"])\n' +
    'print(json.dumps({"parent":os.getpid(),"child":child.pid}),flush=True)\n' +
    'time.sleep(120)';
  liveChild = spawn(isolation.profile.launcher, ['-I', '-c', source], { env: liveScope.env, stdio: ['ignore', 'pipe', 'ignore'] });
  liveChild.on('error', () => {});
  const ids = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('PROCESS_TREE_START_TIMEOUT')), 10000);
    let output = '';
    liveChild.stdout.on('data', data => {
      output += data.toString();
      if (output.length > 1024) { clearTimeout(timeout); reject(new Error('UNEXPECTED_PROBE_OUTPUT')); }
      if (output.includes('\n')) {
        clearTimeout(timeout);
        try { resolve(JSON.parse(output.split('\n')[0])); } catch { reject(new Error('INVALID_PROBE_OUTPUT')); }
      }
    });
    liveChild.once('error', () => { clearTimeout(timeout); reject(new Error('PROCESS_TREE_START_FAILED')); });
    liveChild.once('exit', () => { clearTimeout(timeout); reject(new Error('PROCESS_TREE_EXITED_EARLY')); });
  });
  processIds = [ids.parent, ids.child];
  const members = (await readFile(join(isolation.profile.cgroup_root, session, 'cgroup.procs'), 'utf8')).trim().split(/\s+/).map(Number);
  treeWasLive = processIds.every(pid => Number.isInteger(pid) && pid > 1 && members.includes(pid));
  if (!treeWasLive || (await isolation.verify(liveScope)).pid !== ids.parent) throw new Error('PROCESS_TREE_NOT_CONFINED');
} catch (error) {
  failure = /^[A-Z0-9_]{1,100}$/.test(error?.code ?? '') ? error.code : 'NATIVE_PROBE_FAILED';
} finally {
  try {
    await isolation.stop(session, true);
    if (liveChild && liveChild.exitCode === null && liveChild.signalCode === null) await once(liveChild, 'close');
    cleanup = await store.destroySession(session);
  } catch {
    failure = 'NATIVE_PROBE_CLEANUP_FAILED';
  }
}
const cleared = !await exists(join(store.root, 'sessions', session)) &&
  !await exists(join(isolation.profile.cgroup_root, session));
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
for (let n = 0; n < 40 && processIds.some(alive); n++) await delay(50);
const treeKilled = treeWasLive && processIds.length === 2 && processIds.every(pid => !alive(pid));
const receipt = {
  kind: 'ACTUAL_UBUNTU_NATIVE_PROBE', at: new Date().toISOString(),
  model_calls: 0, customer_data: false, ...(proof ?? {}),
  confined_codex_version: codexVersion,
  session_and_process_group_removed: cleared, live_process_tree_killed: treeKilled, cleanup,
  result: !failure && cleared && treeKilled ? 'PASS' : 'FAIL', ...(failure ? { error_code: failure } : {}),
};
await mkdir(join(store.root, 'deployment'), { recursive: true });
await writeFile(join(store.root, 'deployment/native-probe.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(receipt));
if (receipt.result !== 'PASS') process.exitCode = 1;
