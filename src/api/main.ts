import { loadConfig } from '../shared/config.js';
import { safeErrorCode } from '../shared/errors.js';
import { Database } from '../db/database.js';
import { createApplication } from '../application.js';
import { buildServer } from './server.js';

const config=loadConfig();const db=new Database(config.P07_DATABASE_URL);
try{const app=await buildServer(await createApplication(config,db));let closing=false;
 const shutdown=()=>{if(closing)return;closing=true;void app.close().finally(()=>db.close());};
 process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
 await app.listen({host:config.P07_HOST,port:config.P07_PORT});process.stdout.write('P07 API listening.\n');
}catch(error){process.stderr.write(JSON.stringify({code:safeErrorCode(error),service:'api',state:'START_FAILED'})+'\n');await db.close();process.exitCode=1;}
