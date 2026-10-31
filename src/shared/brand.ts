import { readFileSync } from 'node:fs';

// Both src/shared and dist/shared resolve to the versioned repository asset.
const identity:unknown=JSON.parse(readFileSync(new URL('../../assets/brand/current.json',import.meta.url),'utf8'));
if(!identity||typeof identity!=='object'||!('name_zh' in identity)||typeof identity.name_zh!=='string'||!identity.name_zh.trim())
 throw new Error('A valid product brand name is required.');
export const PRODUCT_NAME=identity.name_zh;
