/** Starts a real native PostgreSQL child process. No container, WSL or system account changes. */
import EmbeddedPostgres from 'embedded-postgres';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { PROJECT_ROOT } from '../src/shared/config.js';
import { randomToken } from '../src/shared/crypto.js';
import { migrate } from '../src/db/migrate.js';

const root=join(PROJECT_ROOT,'runtime','dev-postgres');
await mkdir(root,{recursive:true});
const secretsPath=join(root,'credentials.json');
let credentials: { adminPassword:string; appPassword:string; workerPassword:string; tokenSecret:string };
try { credentials=JSON.parse(await readFile(secretsPath,'utf8')); }
catch(error) {
  if ((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;
  credentials={adminPassword:randomToken(),appPassword:randomToken(),workerPassword:randomToken(),tokenSecret:randomToken()};
  await writeFile(secretsPath,JSON.stringify(credentials),{flag:'wx',mode:0o600});
}
const port=15439;
const database=new EmbeddedPostgres({databaseDir:join(root,'data'),user:'p07_dev_admin',password:credentials.adminPassword,
  port,persistent:true,authMethod:'scram-sha-256',createPostgresUser:false,
  initdbFlags:[process.platform==='win32'?'--encoding=SQL_ASCII':'--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],
  onLog:()=>undefined,onError:()=>undefined});
let stopping=false;
async function stop() { if(stopping)return;stopping=true;await database.stop(); }
try {
  try { await access(join(root,'data','PG_VERSION')); } catch { await database.initialise(); }
  await database.start();
  const adminUrl=`postgresql://p07_dev_admin:${encodeURIComponent(credentials.adminPassword)}@127.0.0.1:${port}/postgres`;
  const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
  const exists=await admin.query("SELECT 1 FROM pg_database WHERE datname='p07'");
  if(!exists.rowCount)await admin.query("CREATE DATABASE p07 TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'");
  await admin.end();
  const migrationUrl=adminUrl.replace(/\/postgres$/,'/p07');
  const applied=await migrate(migrationUrl,join(PROJECT_ROOT,'migrations'));
  const setup=new pg.Client({connectionString:migrationUrl});await setup.connect();
  for(const [name,password,role] of [['p07_api_dev',credentials.appPassword,'p07_app'],['p07_worker_dev',credentials.workerPassword,'p07_worker']]) {
    if(!(await setup.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount) {
      // Only fixed identifiers and application-generated base64url secrets are interpolated.
      await setup.query(`CREATE ROLE ${name} LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}'`);
    }
    await setup.query(`GRANT ${role} TO ${name}`);
  }
  const version=(await setup.query('SHOW server_version')).rows[0]!.server_version;await setup.end();
  const envPath=join(PROJECT_ROOT,'.env');
  try { await access(envPath); }
  catch {
    let template=await readFile(join(PROJECT_ROOT,'.env.example'),'utf8');
    const values: Record<string,string>={P07_DATABASE_URL:`postgresql://p07_api_dev:${credentials.appPassword}@127.0.0.1:${port}/p07`,
      P07_WORKER_DATABASE_URL:`postgresql://p07_worker_dev:${credentials.workerPassword}@127.0.0.1:${port}/p07`,P07_MIGRATION_DATABASE_URL:migrationUrl,P07_TOKEN_SECRET:credentials.tokenSecret};
    template=template.split('\n').map(line=>{const key=line.split('=',1)[0]!;return key in values?`${key}=${values[key]}`:line;}).join('\n');
    await writeFile(envPath,template,{flag:'wx',mode:0o600});
  }
  const workerUrl=`postgresql://p07_worker_dev:${credentials.workerPassword}@127.0.0.1:${port}/p07`;
  await writeFile(join(root,'connections.json'),JSON.stringify({migrationUrl,
    appUrl:`postgresql://p07_api_dev:${credentials.appPassword}@127.0.0.1:${port}/p07`,workerUrl}),{mode:0o600});
  console.log(JSON.stringify({status:'READY',server_version:version,port,database:'p07',applied,
    note:'Native PostgreSQL. Credentials only in project-local ignored files. Ctrl+C stops the child process.'}));
  process.on('SIGINT',()=>void stop().then(()=>process.exit(0)));
  process.on('SIGTERM',()=>void stop().then(()=>process.exit(0)));
  await new Promise<void>(()=>undefined);
} catch(error) { await stop().catch(()=>undefined);throw error; }
