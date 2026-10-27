import { lstat,readFile,realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Schema } from '../shared/contracts.js';
import { contentHash,sha256 } from '../shared/crypto.js';

export interface EvidenceRelease {capability_version:string;flags:Schema['Capability']['flags'];sku_id:string|null;settlement_unit:string;price_policy:unknown;evidence_index:unknown;}
export type EvidenceVerifier=(release:EvidenceRelease,environment:Schema['Environment'])=>Promise<boolean>;
const fileName=z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,100}\.json$/);
const indexSchema=z.object({refs:z.array(fileName).min(1).max(8),files:z.array(z.object({path:fileName,sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(1).max(8)}).passthrough();
const receiptSchema=z.object({protocol:z.literal('P07-RELEASE-EVIDENCE-1'),kind:z.literal('REAL_ENVIRONMENT'),capability_version:z.string(),
 environment:z.object({provider:z.enum(['ALIPAY','DOUYIN']),app_alias:z.string(),os:z.enum(['ANDROID','IOS']),host_version:z.string(),base_sdk:z.string(),build_id:z.string()}).strict(),
 sku_id:z.string().nullable(),settlement_unit:z.string(),price_policy_sha256:z.string(),flags_sha256:z.string(),
 verified_at:z.iso.datetime(),valid_until:z.iso.datetime(),reviewed_by:z.string().min(8).max(200),
 gates:z.array(z.object({gate_id:z.string(),status:z.enum(['PASS','FAIL','NOT_RUN'])}).strict()).max(30)}).strict();

/** Operator-reviewed local evidence is bound to this exact host/SDK/build, SKU, price unit and enabled actions. */
export function releaseEvidence(projectRoot:string):EvidenceVerifier{return async(release,environment)=>{
 try{
  const index=indexSchema.parse(release.evidence_index),root=join(projectRoot,'config/release-evidence');
  if(await realpath(root)!==root||(await lstat(root)).isSymbolicLink()||new Set(index.refs).size!==index.refs.length||index.refs.length!==index.files.length)return false;
  const required=new Set(['SESSION_ISOLATION','WHOLE_RUNTIME_CLEANUP','MODEL_SEVEN_STEPS']);
  for(const [flag,gate]of Object.entries({file_input:'FILE_INPUT',template_input:'TEMPLATE_INPUT',preview:'PREVIEW',export:'EXPORT',payment:'PLATFORM_PAYMENT'}))if(release.flags[flag as keyof typeof release.flags])required.add(gate);
  if(release.flags.payment)for(const gate of ['ORIGINAL_REFUND','PRICE_UNIT','CALLBACK_REPLAY'])required.add(gate);
  const passed=new Set<string>();
  for(const name of index.refs){const item=index.files.find(f=>f.path===name);if(!item)return false;
   const path=join(root,name),info=await lstat(path);if(!info.isFile()||info.isSymbolicLink()||info.size>1_000_000||await realpath(path)!==path)return false;
   const bytes=await readFile(path);if(sha256(bytes)!==item.sha256)return false;const receipt=receiptSchema.parse(JSON.parse(bytes.toString('utf8')));
   if(contentHash(receipt.environment)!==contentHash(environment)||receipt.capability_version!==release.capability_version||receipt.sku_id!==release.sku_id
    ||receipt.settlement_unit!==release.settlement_unit||receipt.flags_sha256!==contentHash(release.flags)||receipt.price_policy_sha256!==contentHash(release.price_policy??null)
    ||Date.parse(receipt.verified_at)>Date.now()||Date.parse(receipt.valid_until)<=Date.now())return false;
   if(new Set(receipt.gates.map(g=>g.gate_id)).size!==receipt.gates.length||receipt.gates.some(g=>g.status!=='PASS'))return false;
   for(const gate of receipt.gates)passed.add(gate.gate_id);
  }
  return [...required].every(g=>passed.has(g));
 }catch{return false;}
};}
