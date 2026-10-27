import { afterEach,describe,expect,it } from 'vitest';
import { mkdir,readFile,rm,symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { LocalStore,RESULT_FILES } from '../../src/storage/local-store.js';
import { PROJECT_ROOT } from '../../src/shared/config.js';
import { newId,sha256 } from '../../src/shared/crypto.js';

const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0))await rm(root,{recursive:true,force:true});});
async function setup(){const root=join(PROJECT_ROOT,'runtime/tests','store-'+newId());roots.push(root);
  const store=new LocalStore(root,PROJECT_ROOT);await store.initialize();return {root,store};}
describe('independent persistent result storage',()=>{
  it('preserves all nine byte-identical results after deleting the entire session and intake',async()=>{
    const {root,store}=await setup();const session=newId(),owner=newId(),result=newId();await store.prepareSession(session);
    await store.write(`intake/${session}/source.txt`,Buffer.from('原始客户资料'));
    const expected=[];
    for(const name of RESULT_FILES){const data=Buffer.from('result:'+name);await store.write(`sessions/${session}/candidate/${name}`,data);
      expected.push({name,sha256:sha256(data),bytes:data.length});}
    const saved=await store.persistResults(session,owner,result,expected);expect(saved).toHaveLength(9);
    expect((await store.destroySession(session)).removed_roots).toBe(2);
    for(const file of saved)expect(sha256(await store.read(file.key))).toBe(file.sha256);
    await expect(readFile(join(root,'sessions',session,'control/.keep'))).rejects.toMatchObject({code:'ENOENT'});
    expect((await store.destroySession(session)).removed_roots).toBe(0);
  });
  it('rejects traversal and never traverses a session junction during cleanup',async()=>{
    const {root,store}=await setup();const session=newId();await store.prepareSession(session);
    for(const key of ['../secret','sessions/../../secret','sessions/C:/file','sessions/CON.txt','sessions/file.'])
      await expect(store.read(key)).rejects.toMatchObject({code:'INVALID_OBJECT_KEY'});
    const independent=join(root,'results','keep');await mkdir(independent);await store.write('results/keep/untouched.txt',Buffer.from('saved'));
    await symlink(independent,join(root,'sessions',session,'linked'),process.platform==='win32'?'junction':'dir');
    await expect(store.read(`sessions/${session}/linked/untouched.txt`)).rejects.toMatchObject({code:'UNSAFE_OBJECT_PATH'});
    await store.destroySession(session);expect((await store.read('results/keep/untouched.txt')).toString()).toBe('saved');
  });
  it('enforces immutable object writes and deletes partial oversize uploads',async()=>{
    const {store}=await setup();await store.write('staging/same.txt',Buffer.from('abc'));
    await expect(store.write('staging/same.txt',Buffer.from('xyz'))).rejects.toMatchObject({code:'OBJECT_IMMUTABLE'});
    await expect(store.writeStream('staging/large.bin',Readable.from([Buffer.alloc(4),Buffer.alloc(5)]),8))
      .rejects.toMatchObject({code:'LIMIT_EXCEEDED'});
    await expect(store.read('staging/large.bin')).rejects.toMatchObject({code:'ENOENT'});
    const data=Buffer.from('中文分块');const saved=await store.writeStream('staging/chunks.txt',Readable.from([data.subarray(0,4),data.subarray(4)]),100,
      {bytes:data.length,sha256:sha256(data)});expect((await store.read(saved.key)).equals(data)).toBe(true);
  });
});
