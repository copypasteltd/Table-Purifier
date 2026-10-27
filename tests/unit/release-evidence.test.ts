import { afterAll,beforeAll,expect,it } from 'vitest';
import { mkdir,rm,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { releaseEvidence,type EvidenceRelease } from '../../src/domain/release-evidence.js';
import { PROJECT_ROOT } from '../../src/shared/config.js';
import { contentHash,newId,sha256 } from '../../src/shared/crypto.js';
const root=join(PROJECT_ROOT,'runtime/tests/release-'+newId()),directory=join(root,'config/release-evidence');
const environment={provider:'ALIPAY' as const,app_alias:'test',os:'ANDROID' as const,host_version:'10.7',base_sdk:'2.9',build_id:'verified-build'};
const release:EvidenceRelease={capability_version:'test-release',flags:{file_input:false,template_input:false,preview:true,export:true,payment:false},sku_id:null,settlement_unit:'CNY_FEN',price_policy:null,evidence_index:{refs:['nonempty-reference-is-insufficient']}};
const verifier=releaseEvidence(root);
// Synthetic unit fixture for verifier mechanics. Not a submitted device/model certification.
function receipt(){return {protocol:'P07-RELEASE-EVIDENCE-1',kind:'REAL_ENVIRONMENT',capability_version:release.capability_version,environment,
 sku_id:null,settlement_unit:'CNY_FEN',price_policy_sha256:contentHash(null),flags_sha256:contentHash(release.flags),verified_at:new Date(Date.now()-1000).toISOString(),
 valid_until:new Date(Date.now()+60_000).toISOString(),reviewed_by:'synthetic-unit-fixture',gates:['SESSION_ISOLATION','WHOLE_RUNTIME_CLEANUP','MODEL_SEVEN_STEPS','PREVIEW','EXPORT'].map(gate_id=>({gate_id,status:'PASS'}))};}
async function save(value:unknown){const text=JSON.stringify(value);await writeFile(join(directory,'receipt.json'),text);return {...release,evidence_index:{refs:['receipt.json'],files:[{path:'receipt.json',sha256:sha256(text)}]}};}
beforeAll(async()=>{await mkdir(directory,{recursive:true});});afterAll(async()=>{await rm(root,{recursive:true,force:true});});
it('requires complete local evidence instead of arbitrary nonempty references',async()=>{expect(await verifier(release,environment)).toBe(false);});
it('binds evidence to the exact host, SDK, enabled flags, SKU and source build',async()=>{
 const bound=await save(receipt());expect(await verifier(bound,environment)).toBe(true);
 expect(await verifier(bound,{...environment,build_id:'unverified-build'})).toBe(false);
 expect(await verifier(bound,{...environment,base_sdk:'3.0'})).toBe(false);
 expect(await verifier({...bound,flags:{...bound.flags,payment:true}},environment)).toBe(false);
 expect(await verifier({...bound,sku_id:'other-sku'},environment)).toBe(false);
});
it('rejects failed or absent gates, expired reports and altered evidence bytes',async()=>{
 const missing=receipt();missing.gates.pop();expect(await verifier(await save(missing),environment)).toBe(false);
 const failed=receipt();failed.gates[0]!.status='NOT_RUN';expect(await verifier(await save(failed),environment)).toBe(false);
 const expired=receipt();expired.valid_until=new Date(Date.now()-1).toISOString();expect(await verifier(await save(expired),environment)).toBe(false);
 const bound=await save(receipt());await writeFile(join(directory,'receipt.json'),'{}');expect(await verifier(bound,environment)).toBe(false);
});
