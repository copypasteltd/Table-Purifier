import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../src/shared/config.js';
import { canonicalJson,sha256 } from '../src/shared/crypto.js';

// Implementation release only. Frozen business/development/design assets stay immutable.
const api=JSON.parse(await readFile(join(PROJECT_ROOT,'assets/development/v3.0.0/openapi.json'),'utf8'));
const selected:Record<string,unknown>={};
function include(name:string){if(selected[name])return;const definition=api.components.schemas[name];
 if(!definition)throw new Error('Unknown component');selected[name]=definition;
 for(const match of JSON.stringify(definition).matchAll(/#\/components\/schemas\/([A-Za-z0-9_]+)/g))include(match[1]!);}
for(const name of ['SchemaDefinition','FieldSuggestion','Record','Issue','Locator'])include(name);
await writeFile(join(PROJECT_ROOT,'agent/skill/contracts.json'),JSON.stringify({components:{schemas:selected}},null,2)+'\n');
const paths=['skill/SKILL.md','skill/references/data-rules.md','skill/references/tools.md','skill/contracts.json',
 'tools/read_document.py','tools/ocr_image.py','tools/requirements.txt'];
const files=[];
for(const path of paths){const data=await readFile(join(PROJECT_ROOT,'agent',path));files.push({path,bytes:data.length,sha256:sha256(data)});}
const manifest={protocol:'P07-SKILL-1',release_id:'4493fd06-28d7-4c57-b4af-27065515b68e',version:'1.0.0',load_mode:'EAGER_FULL',files};
await mkdir(join(PROJECT_ROOT,'agent/skill'),{recursive:true});
await writeFile(join(PROJECT_ROOT,'agent/skill/manifest.json'),canonicalJson(manifest)+'\n');
process.stdout.write(JSON.stringify({release_id:manifest.release_id,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),
 sha256:sha256(canonicalJson(manifest)+'\n')})+'\n');
