import { loadConfig } from '../shared/config.js';
import { invariant,safeErrorCode } from '../shared/errors.js';
import { Database } from '../db/database.js';
import { createApplication } from '../application.js';
import { WorkerEngine } from './engine.js';

const config=loadConfig();invariant(config.P07_WORKER_DATABASE_URL,'WORKER_DATABASE_REQUIRED','后台任务须使用独立工作角色。',503);
const db=new Database(config.P07_WORKER_DATABASE_URL,config.P07_WORKER_CONCURRENCY*4+4),shutdown=new AbortController();
process.once('SIGINT',()=>shutdown.abort());process.once('SIGTERM',()=>shutdown.abort());
try{const app=await createApplication(config,db);
 const engine=new WorkerEngine(db,config,app.contracts,app.store,app.runtime,app.commerce,error=>process.stderr.write(JSON.stringify({service:'worker',code:safeErrorCode(error)})+'\n'),app.payments);
 await Promise.all(Array.from({length:config.P07_WORKER_CONCURRENCY},(_,i)=>engine.run(shutdown.signal,'worker-'+process.pid+'-'+i)));
}catch(error){process.stderr.write(JSON.stringify({service:'worker',code:safeErrorCode(error),state:'START_FAILED'})+'\n');process.exitCode=1;}
finally{await db.close();}
