import { lstat,mkdir,readFile,realpath,rmdir,writeFile } from 'node:fs/promises';
import { dirname,isAbsolute,join,relative,sep } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import { constantTimeEqual,newId,randomToken,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';
import type { Config } from '../shared/config.js';
import { projectPath } from '../shared/config.js';
import type { LocalStore } from '../storage/local-store.js';

const profileSchema=z.object({protocol:z.literal('P07-NATIVE-1'),id:z.string().regex(/^[a-z0-9_-]{1,80}$/),
 launcher:z.string(),launcher_sha256:z.string().regex(/^[a-f0-9]{64}$/),codex:z.string(),codex_sha256:z.string().regex(/^[a-f0-9]{64}$/),
 python:z.string(),read_only_roots:z.array(z.string()).min(1).max(30),cgroup_root:z.string(),
 memory_bytes:z.number().int().min(268435456).max(8589934592),process_limit:z.number().int().min(8).max(128),
 cpu_quota_percent:z.number().int().min(10).max(400)}).strict();
type Profile=z.infer<typeof profileSchema>;
const UUID=/^[a-f0-9-]{36}$/;
const SYSTEM_READ_ROOTS=['/usr/bin','/usr/lib','/usr/lib64','/usr/local/lib','/lib','/lib64','/etc/ssl/certs',
 '/etc/ld.so.cache','/etc/resolv.conf','/etc/hosts','/etc/localtime','/usr/share/zoneinfo','/usr/share/locale',
 '/usr/share/tesseract-ocr','/usr/share/tessdata'];
const within=(root:string,path:string)=>path===root||path.startsWith(root+sep);
export interface LaunchScope {env:Record<string,string>;receiptKey:string;nonce:string;}

export class NativeIsolation {
 private constructor(readonly profile:Profile,private readonly config:Config,private readonly store:LocalStore){}
 static async load(config:Config,store:LocalStore):Promise<NativeIsolation>{
  invariant(process.platform==='linux'&&process.getuid?.()!==0,'NATIVE_LINUX_REQUIRED','Agent 需要非 root 的 Ubuntu 原生隔离运行环境。',503);
  const profilePath=projectPath(config.projectRoot,config.P07_ISOLATION_PROFILE);
  invariant(!(await lstat(profilePath)).isSymbolicLink(),'ISOLATION_PROFILE_INVALID','隔离配置不能使用外链。',503);
  const profile=profileSchema.parse(JSON.parse(await readFile(profilePath,'utf8')));
  for(const [path,hash] of [[profile.launcher,profile.launcher_sha256],[profile.codex,profile.codex_sha256]]){
   invariant(isAbsolute(path!)&&!(await lstat(path!)).isSymbolicLink()&&sha256(await readFile(path!))===hash,
    'ISOLATION_BINARY_MISMATCH','原生隔离或 Codex 可执行文件不符合已核验版本。',503);
  }
  // The native CLI loads sibling command-runner/resources and its package metadata.
  // Grant only this pinned platform package, never the whole project or node_modules.
  const codexPackage=dirname(dirname(profile.codex)),metadataPath=join(codexPackage,'codex-package.json');
  invariant(within(join(config.projectRoot,'node_modules'),codexPackage)&&await realpath(codexPackage)===codexPackage
   &&!(await lstat(metadataPath)).isSymbolicLink(),'CODEX_PACKAGE_INVALID','Codex 必须来自本项目锁定的原生平台包。',503);
  const metadata=JSON.parse(await readFile(metadataPath,'utf8'));
  invariant(metadata.layoutVersion===1&&metadata.version==='0.164.0'&&metadata.variant==='codex'
   &&metadata.entrypoint===relative(codexPackage,profile.codex).split(sep).join('/')&&metadata.resourcesDir==='codex-resources'&&metadata.pathDir==='codex-path',
   'CODEX_PACKAGE_INVALID','Codex 原生包版本或资源布局与 SDK 锁定版本不一致。',503);
  invariant(profile.cgroup_root.startsWith('/sys/fs/cgroup/')&&await realpath(profile.cgroup_root)===profile.cgroup_root,
   'CGROUP_NOT_DELEGATED','缺少已授权的原生 cgroup-v2 任务目录。',503);
  const systemRoots:string[]=[];
  for(const root of profile.read_only_roots){
   invariant(isAbsolute(root)&&!/[\r\n]/.test(root)&&SYSTEM_READ_ROOTS.some(r=>within(r,root)),
    'ISOLATION_READ_SCOPE_INVALID','系统只读依赖目录过宽或包含客户/服务数据。',503);
   const resolved=await realpath(root);
   invariant((SYSTEM_READ_ROOTS.some(r=>within(r,resolved))||(root==='/etc/resolv.conf'&&['/run/systemd/resolve/resolv.conf','/run/systemd/resolve/stub-resolv.conf'].includes(resolved)))&&!within(config.projectRoot,resolved),
    'ISOLATION_READ_SCOPE_INVALID','系统依赖链接指向了未授权目录。',503);
   systemRoots.push(resolved);
  }
  // Ubuntu venv/bin/python is normally a symlink to /usr/bin. Grant the verified
  // venv separately, never runtime/, the project, or another customer's session.
  const toolRuntime=join(config.projectRoot,'runtime/python-tools');
  const pythonExecutable=await realpath(profile.python);
  invariant(await realpath(toolRuntime)===toolRuntime&&!(await lstat(toolRuntime)).isSymbolicLink()
   &&within(toolRuntime,profile.python)&&(await lstat(join(toolRuntime,'pyvenv.cfg'))).isFile()
   &&SYSTEM_READ_ROOTS.some(r=>within(r,pythonExecutable))
   &&/^include-system-site-packages\s*=\s*false\s*$/im.test(await readFile(join(toolRuntime,'pyvenv.cfg'),'utf8')),
   'TOOL_RUNTIME_INVALID','工具解释器必须来自本项目专用 Python 环境。',503);
  profile.read_only_roots=[...new Set(systemRoots)];
  return new NativeIsolation(profile,config,store);
 }
 async prepare(sessionId:string):Promise<void>{
  invariant(UUID.test(sessionId),'INVALID_SESSION','会话标识无效。',400);
  const leaf=join(this.profile.cgroup_root,sessionId);
  await mkdir(leaf,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
  invariant(!(await lstat(leaf)).isSymbolicLink()&&await realpath(leaf)===leaf,'CGROUP_UNSAFE','任务进程目录无效。',503);
  await writeFile(join(leaf,'memory.max'),String(this.profile.memory_bytes));
  await writeFile(join(leaf,'memory.swap.max'),'0');
  await writeFile(join(leaf,'pids.max'),String(this.profile.process_limit));
  await writeFile(join(leaf,'cpu.max'),`${this.profile.cpu_quota_percent*1000} 100000`);
  invariant((await readFile(join(leaf,'cgroup.procs'),'utf8')).trim()==='','STALE_TASK_PROCESS','旧任务进程尚未退出。',503);
 }
 async scope(sessionId:string,executable:string,batch:boolean,extraRead:string[]=[]):Promise<LaunchScope>{
  invariant(UUID.test(sessionId),'INVALID_SESSION','会话标识无效。',400);
  const root=join(this.store.root,'sessions',sessionId);
  const receiptKey=`sessions/${sessionId}/control/process-${newId()}.json`;const receiptPath=await this.store.path(receiptKey,true);
  const nonce=sha256(randomToken());
  const writes=[...['work','proposal','session','tmp',...(batch?['candidate']:[])].map(p=>join(root,p)),'/dev/null'];
  const reads=[...this.profile.read_only_roots,executable===this.profile.codex?dirname(dirname(this.profile.codex)):dirname(await realpath(executable)),
   ...(executable===this.profile.python?[join(this.config.projectRoot,'runtime/python-tools')]:[]),join(root,'inputs'),join(root,'control'),...extraRead];
  for(const path of [...reads,...writes])invariant(!/[\r\n]/.test(path),'ISOLATION_PATH_INVALID','隔离目录无效。',503);
  return {receiptKey,nonce,env:{PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',
   HOME:join(root,'session'),CODEX_HOME:join(root,'session/codex'),TMPDIR:join(root,'tmp'),TMP:join(root,'tmp'),TEMP:join(root,'tmp'),
   PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',P07_EXECUTABLE:executable,
   P07_CGROUP_PROCS:join(this.profile.cgroup_root,sessionId,'cgroup.procs'),P07_PROCESS_RECEIPT:receiptPath,
   P07_PROCESS_NONCE:nonce,P07_READ_ROOTS:reads.join('\n'),P07_WRITE_ROOTS:writes.join('\n')}};
 }
 async verify(scope:LaunchScope):Promise<{pid:number;landlock_abi:number;seccomp:true;no_new_privs:true}>{
  const receipt=JSON.parse((await this.store.read(scope.receiptKey,1024)).toString('utf8'));
  invariant(Number.isSafeInteger(receipt.pid)&&receipt.pid>1&&receipt.landlock_abi>=1&&receipt.seccomp===true
   &&receipt.no_new_privs===true&&constantTimeEqual(receipt.nonce??'',scope.nonce),
   'NATIVE_ISOLATION_UNVERIFIED','本次进程没有通过原生隔离验证。',503);
  return {pid:receipt.pid,landlock_abi:receipt.landlock_abi,seccomp:true,no_new_privs:true};
 }
 async stop(sessionId:string,remove=false):Promise<void>{
  invariant(UUID.test(sessionId),'INVALID_SESSION','会话标识无效。',400);
  const leaf=join(this.profile.cgroup_root,sessionId);
  const info=await lstat(leaf).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!info)return;
  invariant(!info.isSymbolicLink()&&await realpath(leaf)===leaf,'CGROUP_UNSAFE','清理目标进程目录无效。',503);
  await writeFile(join(leaf,'cgroup.kill'),'1');
  const deadline=Date.now()+10_000;
  while((await readFile(join(leaf,'cgroup.events'),'utf8')).includes('populated 1')){
   invariant(Date.now()<deadline,'TASK_PROCESSES_STILL_RUNNING','任务进程尚未全部退出。',503);await delay(50);
  }
  if(remove)await rmdir(leaf);
 }
 /** Physical file-access probe under the exact launcher and allowlists; no model or customer data. */
 async probe(sessionId:string,signal:AbortSignal):Promise<object>{
  const secretKey=`sessions/${sessionId}/control/probe-secret.txt`;
  await this.store.write(secretKey,Buffer.from(randomToken()));
  const forbidden=await this.store.path(secretKey);
  // control is read-only but intentionally readable; use an independent sibling canary for tenant isolation.
  const sibling=await this.store.write(`staging/${newId()}/probe.txt`,Buffer.from(randomToken()));
  const canary=await this.store.path(sibling.key);
  const scope=await this.scope(sessionId,this.profile.python,false);
  const own=join(this.store.root,'sessions',sessionId,'work/probe.txt');
  const source=`import os,json,pypdf,PIL\nchecks=[]\nfor path in ${JSON.stringify([canary,join(this.config.projectRoot,'.env')])}:\n try:\n  open(path,'rb').read(1);checks.append(False)\n except PermissionError:checks.append(True)\n except FileNotFoundError:checks.append(path.endswith('.env'))\ntry:\n open(${JSON.stringify(forbidden)},'w').write('x');checks.append(False)\nexcept PermissionError:checks.append(True)\nopen(${JSON.stringify(own)},'w').write('p07')\nassert all(checks)\nprint(json.dumps({'read_isolated':True,'control_readonly':True,'own_work_writable':True,'tool_dependencies_imported':True}))`;
  try{const output=await confinedProcess(this.profile.launcher,['-I','-c',source],scope.env,'',signal,4096);
   return {...JSON.parse(output),process:await this.verify(scope)};}
  finally{await this.store.removeObject(sibling.key);}
 }
}

export async function confinedProcess(executable:string,args:string[],env:Record<string,string>,input:string,
 signal:AbortSignal,maxOutput=8_000_000,acceptedCodes:number[]=[0]):Promise<string>{
 const child=spawn(executable,args,{env,stdio:['pipe','pipe','pipe'],signal,windowsHide:true});let bytes=0;const chunks:Buffer[]=[];
 child.stdin.on('error',()=>undefined);child.stdin.end(input);
 // Never retain or expose stderr, which may contain customer text or tool paths.
 child.stderr.resume();
 return new Promise((resolve,reject)=>{
  child.stdout.on('data',(part:Buffer)=>{bytes+=part.length;if(bytes>maxOutput){child.kill();reject(new Error('TOOL_OUTPUT_LIMIT'));}else chunks.push(part);});
  child.once('error',()=>reject(new Error('TOOL_PROCESS_FAILED')));
  child.once('close',code=>code!==null&&acceptedCodes.includes(code)?resolve(Buffer.concat(chunks).toString('utf8')):reject(new Error('TOOL_PROCESS_FAILED')));
 });
}
