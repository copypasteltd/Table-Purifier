import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from './database.js';
import { sha256 } from '../shared/crypto.js';

/** Compare the complete immutable migration history, rather than just a live SQL connection. */
export async function migrationReadiness(db:Database,directory:string):Promise<()=>Promise<boolean>>{
 const files=(await readdir(directory)).filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
 const expected=new Map(await Promise.all(files.map(async name=>[name,sha256(await readFile(join(directory,name)))] as const)));
 return async()=>{const rows=(await db.pool.query<{name:string;sha256:string}>('SELECT name,sha256 FROM p07_meta.migrations')).rows;
  return expected.size>0&&rows.length===expected.size&&rows.every(row=>expected.get(row.name)===row.sha256);
 };
}
