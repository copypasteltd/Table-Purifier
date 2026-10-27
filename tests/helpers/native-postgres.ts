import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { mkdir,rm } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { PROJECT_ROOT } from '../../src/shared/config.js';
import { randomToken,newId } from '../../src/shared/crypto.js';
import { migrate } from '../../src/db/migrate.js';
import { Database } from '../../src/db/database.js';
import { inside } from '../../src/storage/local-store.js';

async function freePort():Promise<number> {
  const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('No local test port.');
  await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));return address.port;
}

export async function nativePostgres() {
  const root=join(PROJECT_ROOT,'runtime','tests','postgres-'+newId());await mkdir(root,{recursive:true});
  const password=randomToken();const port=await freePort();const messages:string[]=[];
  const postgres=new EmbeddedPostgres({databaseDir:join(root,'data'),user:'p07_test_admin',password,port,persistent:true,
    authMethod:'scram-sha-256',createPostgresUser:false,initdbFlags:[process.platform==='win32'?'--encoding=SQL_ASCII':'--encoding=UTF8','--locale=C'],
    postgresFlags:['-h','127.0.0.1','-c','max_connections=30','-c','shared_buffers=16MB'],
    onLog:(line:string)=>{messages.push(line);if(messages.length>20)messages.shift();},
    onError:(line:unknown)=>{messages.push(String(line));if(messages.length>20)messages.shift();}});
  const bootstrapUrl=`postgresql://p07_test_admin:${password}@127.0.0.1:${port}/postgres`;
  const adminUrl=bootstrapUrl.replace(/\/postgres$/,'/p07_test');
  let admin:pg.Pool|undefined;let app:Database|undefined;let worker:Database|undefined;
  try {
    await postgres.initialise();await postgres.start();
    const bootstrap=new pg.Client({connectionString:bootstrapUrl});await bootstrap.connect();
    try { await bootstrap.query("CREATE DATABASE p07_test TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'"); }
    finally { await bootstrap.end(); }
    await migrate(adminUrl,join(PROJECT_ROOT,'migrations'));
    admin=new pg.Pool({connectionString:adminUrl,max:3});
    await admin.query(`CREATE ROLE p07_test_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}';
      GRANT p07_app TO p07_test_app;
      CREATE ROLE p07_test_worker LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${password}';
      GRANT p07_worker TO p07_test_worker;`);
    app=new Database(`postgresql://p07_test_app:${password}@127.0.0.1:${port}/p07_test`,3);
    worker=new Database(`postgresql://p07_test_worker:${password}@127.0.0.1:${port}/p07_test`,3);
    return {admin,app,worker,adminUrl,root,async close(){
      await app!.close();await worker!.close();await admin!.end();await postgres.stop();
      if(!inside(join(PROJECT_ROOT,'runtime','tests'),root))throw new Error('Unsafe test cleanup path.');
      await rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:150});
    }};
  } catch(error) {
    await app?.close();await worker?.close();await admin?.end();await postgres.stop().catch(()=>undefined);
    throw new Error(`Native PostgreSQL test failed: ${String(error)}\n${messages.join('\n').split(password).join('[redacted]')}`);
  }
}
