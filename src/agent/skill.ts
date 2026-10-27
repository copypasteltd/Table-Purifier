import { lstat,readFile,realpath } from 'node:fs/promises';
import { isAbsolute,join,relative,sep } from 'node:path';
import { z } from 'zod';
import { contentHash,sha256 } from '../shared/crypto.js';
import { invariant } from '../shared/errors.js';

const manifestSchema=z.object({protocol:z.literal('P07-SKILL-1'),release_id:z.uuid(),version:z.string(),load_mode:z.literal('EAGER_FULL'),
 files:z.array(z.object({path:z.string(),bytes:z.number().int().positive(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(6)}).strict();
export interface FullSkill {releaseId:string;manifestHash:string;context:string;contextHash:string;fileCount:number;bytes:number;}

/** All actual contents are verified and composed before creating any customer-input slot. */
export async function loadFullSkill(agentRoot:string,contextTokens:number):Promise<FullSkill>{
 const manifestBytes=await readFile(join(agentRoot,'skill/manifest.json'));
 const manifest=manifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
 const root=await realpath(agentRoot);const chunks:string[]=[];const unique=new Set<string>();
 for(const file of manifest.files){
  invariant(!isAbsolute(file.path)&&!file.path.split(/[\\/]/).some(p=>p==='..'||p==='.'||!p)&&!unique.has(file.path),
   'SKILL_PATH_INVALID','业务技能文件路径无效或重复。',503);unique.add(file.path);
  const path=join(root,file.path),rel=relative(root,await realpath(path));
  invariant(rel!==''&&!isAbsolute(rel)&&!rel.startsWith('..'+sep)&&rel!=='..'&&!(await lstat(path)).isSymbolicLink(),
   'SKILL_PATH_INVALID','业务技能不允许路径外链。',503);
  const data=await readFile(path);
  invariant(data.length===file.bytes&&sha256(data)===file.sha256,'SKILL_HASH_MISMATCH','业务技能缺件或内容校验失败。',503);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(data);
  chunks.push(`<p07_resource path="${file.path}" sha256="${file.sha256}" bytes="${file.bytes}">\n${text}\n</p07_resource>`);
 }
 for(const required of ['skill/SKILL.md','skill/contracts.json','tools/read_document.py','tools/requirements.txt'])
  invariant(unique.has(required),'SKILL_INCOMPLETE','完整业务技能缺少必要正文或工具源码。',503);
 const manifestHash=sha256(manifestBytes);
 const context=`<p07_full_skill protocol="P07-SKILL-1" manifest_sha256="${manifestHash}">\n${chunks.join('\n')}\n</p07_full_skill>`;
 const bytes=Buffer.byteLength(context);
 // UTF-8 byte count is a conservative token upper bound, including multilingual data.
 // Reserve 16K for runtime/tool/system instructions; over-budget means refusal, never lazy loading.
 invariant(bytes+16_384<contextTokens,'SKILL_CONTEXT_EXCEEDED','完整技能超过模型上下文预算，不允许降级为摘要加载。',503);
 return {releaseId:manifest.release_id,manifestHash,context,contextHash:sha256(context),fileCount:manifest.files.length,bytes};
}

export function requestContainsFullSkill(body:unknown,skill:FullSkill):boolean{
 if(!body||typeof body!=='object')return false;
 const request=body as {instructions?:unknown;input?:unknown};
 if(typeof request.instructions==='string'&&request.instructions.includes(skill.context))return true;
 if(!Array.isArray(request.input))return false;
 return request.input.some((item:unknown)=>{
  if(!item||typeof item!=='object')return false;
  const message=item as {role?:string;content?:unknown};if(message.role!=='developer'&&message.role!=='system')return false;
  if(typeof message.content==='string')return message.content.includes(skill.context);
  return Array.isArray(message.content)&&message.content.some((c:unknown)=>!!c&&typeof c==='object'
   &&typeof (c as {text?:unknown}).text==='string'&&((c as {text:string}).text).includes(skill.context));
 });
}

export const unitScopeHash=(units:readonly {unit_id:string;sha256:string}[])=>contentHash(units.map(u=>({id:u.unit_id,sha256:u.sha256})));
