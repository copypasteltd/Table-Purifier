import { describe, expect, it } from 'vitest';
import { canonicalJson, contentHash, opaquePayload, readOpaquePayload } from '../../src/shared/crypto.js';

describe('P07-CJ1 cross-language canonical data', () => {
  it('keeps zero, false, null and exact decimal/identifier strings distinct', () => {
    const result=canonicalJson({z:null,b:false,a:0,price:'28.00',id:'00018'});
    expect(result).toBe('{"a":0,"b":false,"id":"00018","price":"28.00","z":null}');
    expect(contentHash({x:'28.00'})).not.toBe(contentHash({x:'28'}));
  });
  it('sorts Unicode scalar values instead of UTF-16 code units', () => {
    expect(canonicalJson({'😀':2,'\uE000':1})).toBe('{"":1,"😀":2}');
    expect(contentHash({b:2,a:1})).toBe(contentHash({a:1,b:2}));
    expect(contentHash('é')).not.toBe(contentHash('e\u0301'));
  });
  it.each([1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,undefined,new Date(),{x:undefined},'\ud800',new Array(1)])(
    'rejects unsupported or ambiguous JSON input %s',value=>expect(()=>canonicalJson(value)).toThrow());
  it('authenticates opaque cursors and rejects tampering', () => {
    const token=opaquePayload('test-key',{owner:'A',version:3});
    expect(readOpaquePayload('test-key',token)).toEqual({owner:'A',version:3});
    expect(()=>readOpaquePayload('other-key',token)).toThrow();
    expect(()=>readOpaquePayload('test-key',token+'x')).toThrow();
  });
});
