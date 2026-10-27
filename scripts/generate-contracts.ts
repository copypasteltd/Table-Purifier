import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import openapiTS,{astToString} from 'openapi-typescript';
import { PROJECT_ROOT } from '../src/shared/config.js';

const path=join(PROJECT_ROOT,'assets/development/v3.0.0/openapi.json');
const document=JSON.parse(await readFile(path,'utf8'));
const result=await openapiTS(document);
await mkdir(join(PROJECT_ROOT,'src/shared/generated'),{recursive:true});
await writeFile(join(PROJECT_ROOT,'src/shared/generated/contracts.d.ts'),astToString(result),'utf8');
console.log('Generated shared TypeScript types from the sealed 56-operation API contract.');
