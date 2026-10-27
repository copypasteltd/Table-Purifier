import { constants } from 'node:fs';
import { lstat,mkdir,open,readdir,realpath,rmdir,stat,unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname,isAbsolute,join,relative,resolve,sep } from 'node:path';
import { type Readable } from 'node:stream';
import { AppError,invariant } from '../shared/errors.js';
import { sha256 } from '../shared/crypto.js';

export const RESULT_FILES = ['standard.xlsx','standard.json','result.xlsx','accepted.csv','result.json',
  'issues.xlsx','provenance.jsonl','validation.json','manifest.json'] as const;
export type ResultFileName=typeof RESULT_FILES[number];
export interface StoredObject {key:string;sha256:string;bytes:number}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function inside(root:string,target:string):boolean {
  const rel=relative(root,target);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);
}
function id(value:string):string {invariant(UUID.test(value),'INVALID_RESOURCE_ID','资源标识无效。',400);return value;}
function keyParts(key:string):string[] {
  const parts=key.split('/');
  invariant(parts.length>=2&&parts.every(part=>/^[A-Za-z0-9_.-]+$/.test(part)&&part!=='.'&&part!=='..'&&!part.endsWith('.')
    &&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),
  'INVALID_OBJECT_KEY','文件访问路径无效。',400);
  return parts;
}

export class LocalStore {
  constructor(readonly root:string,private readonly projectRoot:string) {}
  async initialize():Promise<void> {
    invariant(inside(resolve(this.projectRoot),resolve(this.root)),'STORAGE_OUTSIDE_PROJECT','运行目录必须在项目内。',503);
    await mkdir(this.root,{recursive:true,mode:0o700});
    invariant(inside(await realpath(this.projectRoot),await realpath(this.root)),'STORAGE_OUTSIDE_PROJECT','运行目录不能链接到项目外。',503);
    invariant(!(await lstat(this.root)).isSymbolicLink(),'UNSAFE_OBJECT_PATH','运行目录不能使用符号链接。',503);
    for(const name of ['sessions','intake','results','staging']) {
      const folder=join(this.root,name);await mkdir(folder,{recursive:true,mode:0o700});
      invariant(!(await lstat(folder)).isSymbolicLink(),'UNSAFE_OBJECT_PATH','存储目录不能使用符号链接。',503);
    }
  }

  async path(key:string,createParent=false):Promise<string> {
    const parts=keyParts(key);let current=this.root;
    for(const part of parts.slice(0,-1)) {
      current=join(current,part);
      if(createParent)await mkdir(current,{mode:0o700}).catch(error=>{if(error.code!=='EEXIST')throw error;});
      const info=await lstat(current);
      invariant(info.isDirectory()&&!info.isSymbolicLink(),'UNSAFE_OBJECT_PATH','不允许访问链接或异常文件目录。',403);
    }
    const path=join(this.root,...parts);
    invariant(inside(this.root,path),'UNSAFE_OBJECT_PATH','文件路径越界。',403);
    const info=await lstat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
    invariant(!info||info.isFile()&&!info.isSymbolicLink(),'UNSAFE_OBJECT_PATH','不允许访问链接或特殊文件。',403);
    return path;
  }

  async write(key:string,content:Uint8Array,maxBytes=50_000_000):Promise<StoredObject> {
    invariant(content.byteLength<=maxBytes,'LIMIT_EXCEEDED','文件超出当前大小限制。',413);
    const target=await this.path(key,true);const hash=sha256(content);
    let file;
    try {file=await open(target,'wx',0o600);}
    catch(error) {
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      const existing=await this.inspect(key,maxBytes);
      invariant(existing.sha256===hash&&existing.bytes===content.byteLength,'OBJECT_IMMUTABLE','文件已存在且内容不同。');
      return existing;
    }
    try {await file.writeFile(content);await file.sync();}
    finally {await file.close();}
    return {key,sha256:hash,bytes:content.byteLength};
  }

  async writeStream(key:string,stream:Readable,maxBytes:number,expected?:{bytes:number;sha256:string}):Promise<StoredObject> {
    const target=await this.path(key,true);const file=await open(target,'wx',0o600);
    const hash=createHash('sha256');let bytes=0;let completed=false;
    try {
      for await(const raw of stream) {
        const chunk=Buffer.isBuffer(raw)?raw:Buffer.from(raw as Uint8Array);bytes+=chunk.length;
        invariant(bytes<=maxBytes,'LIMIT_EXCEEDED','文件超过允许大小。',413);hash.update(chunk);
        // FileHandle.writeFile handles partial OS writes; never assume one write consumed a chunk.
        await file.writeFile(chunk);
      }
      const digest=hash.digest('hex');
      invariant(!expected||(bytes===expected.bytes&&digest===expected.sha256),'UPLOAD_HASH_MISMATCH','文件大小或摘要与上传许可不符。',422);
      await file.sync();completed=true;return {key,sha256:digest,bytes};
    } finally {await file.close();if(!completed)await unlink(target).catch(()=>undefined);}
  }

  async read(key:string,maxBytes=50_000_000):Promise<Buffer> {
    const target=await this.path(key);const file=await open(target,constants.O_RDONLY|(process.platform==='win32'?0:constants.O_NOFOLLOW));
    try {
      const info=await file.stat();invariant(info.isFile()&&info.size<=maxBytes,'LIMIT_EXCEEDED','文件不可读取或超出限制。',413);
      return await file.readFile();
    } finally {await file.close();}
  }

  async inspect(key:string,maxBytes=50_000_000):Promise<StoredObject> {
    const target=await this.path(key);const file=await open(target,constants.O_RDONLY|(process.platform==='win32'?0:constants.O_NOFOLLOW));
    try {
      const info=await file.stat();invariant(info.isFile()&&info.size<=maxBytes,'LIMIT_EXCEEDED','文件超出当前大小限制。',413);
      const hash=createHash('sha256');let bytes=0;
      for await(const chunk of file.createReadStream({autoClose:false})) {
        bytes+=chunk.length;invariant(bytes<=maxBytes,'LIMIT_EXCEEDED','文件超出限制。',413);hash.update(chunk);
      }
      return {key,bytes,sha256:hash.digest('hex')};
    } finally {await file.close();}
  }

  /** Delete one authorized regular object; never recurse or follow a link. */
  async removeObject(key:string):Promise<void>{
    const target=await this.path(key).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(!target)return;
    await unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }

  /** Host must first prove no published result row exists. Only an uncommitted reservation is eligible. */
  async discardUnpublishedResult(ownerId:string,resultId:string):Promise<void>{
    await this.removeResultDirectory(ownerId,resultId);
  }
  /** Only an owner-confirmed deletion job may use this; normal session cleanup never calls it. */
  async deleteRequestedResult(ownerId:string,resultId:string):Promise<void>{
    await this.removeResultDirectory(ownerId,resultId);
  }
  private async removeResultDirectory(ownerId:string,resultId:string):Promise<void>{
    const root=join(this.root,'results',id(ownerId),id(resultId));
    const info=await lstat(root).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if(!info)return;
    invariant(info.isDirectory()&&!info.isSymbolicLink(),'UNSAFE_CLEANUP_TARGET','未发布文件目录异常。',503);
    for(const name of await readdir(root)){
      invariant((RESULT_FILES as readonly string[]).includes(name),'UNSAFE_CLEANUP_TARGET','未发布结果目录含有未知对象。',503);
      await this.removeObject(`results/${ownerId}/${resultId}/${name}`);
    }
    await rmdir(root);
  }

  async prepareSession(sessionId:string):Promise<string> {
    const root=join(this.root,'sessions',id(sessionId));
    for(const folder of ['control','inputs/source','inputs/template','work','proposal','candidate','session','tmp']) {
      const key=`sessions/${sessionId}/${folder}/.keep`;
      await this.write(key,Buffer.alloc(0));
    }
    return root;
  }

  async persistResults(sessionId:string,ownerId:string,resultId:string,expected:readonly {name:ResultFileName;sha256:string;bytes:number}[]):Promise<StoredObject[]> {
    id(sessionId);id(ownerId);id(resultId);
    invariant(expected.length===9&&new Set(expected.map(item=>item.name)).size===9
      &&RESULT_FILES.every(name=>expected.some(item=>item.name===name)),
    'ARTIFACT_SET_INCOMPLETE','完整结果包必须包含约定的九个文件。',422);
    invariant(expected.reduce((sum,item)=>sum+item.bytes,0)<=200_000_000,'LIMIT_EXCEEDED','结果包超过本次文件预算。',413);
    const stored:StoredObject[]=[];
    for(const item of expected) {
      const content=await this.read(`sessions/${sessionId}/candidate/${item.name}`);
      invariant(content.length===item.bytes&&sha256(content)===item.sha256,'ARTIFACT_HASH_MISMATCH','候选文件验收后发生变化。',422);
      const saved=await this.write(`results/${ownerId}/${resultId}/${item.name}`,content);
      const readback=await this.inspect(saved.key);
      invariant(readback.sha256===item.sha256&&readback.bytes===item.bytes,'PERSISTENCE_FAILED','结果持久保存校验失败。',503);
      stored.push(saved);
    }
    // File fsync + readback completes before a caller can commit DB result pointers/outbox.
    // POSIX directory fsync also persists new directory entries; never ignore I/O failures.
    if(process.platform!=='win32') {
      for(const folder of [join(this.root,'results',ownerId,resultId),join(this.root,'results',ownerId),join(this.root,'results')]) {
        const directory=await open(folder,'r');try{await directory.sync();}finally{await directory.close();}
      }
    }
    return stored;
  }

  /** Caller must fence/stop every task process before invoking this trusted cleaner. */
  async destroySession(sessionId:string):Promise<{removed_roots:number;deleted_entries:number}> {
    id(sessionId);let removed_roots=0;let deleted_entries=0;
    for(const name of ['sessions','intake']) {
      const root=join(this.root,name,sessionId);
      invariant(inside(join(this.root,name),root),'UNSAFE_CLEANUP_TARGET','运行环境清理路径无效。',503);
      const exists=await lstat(root).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(!exists)continue;
      // Never traverse a link, including Windows directory junctions.
      const remove=async(path:string):Promise<void>=>{
        const entry=await lstat(path);
        if(entry.isDirectory()&&!entry.isSymbolicLink()) {
          for(const name of await readdir(path))await remove(join(path,name));
          await rmdir(path);
        } else {await unlink(path);}
        deleted_entries++;
      };
      await remove(root);removed_roots++;
      const remaining=await lstat(root).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(remaining)throw new AppError('CLEANUP_INCOMPLETE',503,'运行环境尚未完全清理。',{},true);
    }
    return {removed_roots,deleted_entries};
  }
}
