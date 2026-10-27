import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';

export const newId = (): string => randomUUID();
export const randomToken = (): string => randomBytes(32).toString('base64url');
export const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
export const hmac = (secret: string, value: string): string => createHmac('sha256', secret).update(value).digest('hex');

export function constantTimeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function scalarCompare(a: string, b: string): number {
  const aa = Array.from(a); const bb = Array.from(b);
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
    const difference = aa[i]!.codePointAt(0)! - bb[i]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return aa.length - bb.length;
}

function validString(value: string): string {
  for (const char of value) {
    const point = char.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff) throw new AppError('INVALID_JSON_VALUE', 422, '内容包含无效字符。');
  }
  return JSON.stringify(value);
}

/** P07-CJ1: scalar key order, exact safe integers, UTF-8, no Unicode normalization. */
export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return validString(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new AppError('INVALID_JSON_VALUE', 422, '数值必须为安全整数，十进制事实请使用字符串。');
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (Array.isArray(value)) return '[' + Array.from(value, canonicalJson).join(',') + ']';
  if (typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    const object = value as Record<string, unknown>;
    return '{' + Object.keys(object).sort(scalarCompare).map(key => validString(key) + ':' + canonicalJson(object[key])).join(',') + '}';
  }
  throw new AppError('INVALID_JSON_VALUE', 422, '内容不是可规范化的 JSON 数据。');
}

export const contentHash = (value: unknown): string => sha256(canonicalJson(value));

export function opaquePayload(secret: string, value: unknown): string {
  const encoded = Buffer.from(canonicalJson(value)).toString('base64url');
  return `${encoded}.${hmac(secret, encoded)}`;
}

export function readOpaquePayload<T>(secret: string, token: string): T {
  if (token.length > 8192) throw new AppError('INVALID_CURSOR', 400, '无效的分页或访问凭据。');
  const parts = token.split('.');
  if (parts.length !== 2 || !constantTimeEqual(hmac(secret, parts[0]!), parts[1]!)) {
    throw new AppError('INVALID_CURSOR', 400, '无效的分页或访问凭据。');
  }
  try { return JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8')) as T; }
  catch { throw new AppError('INVALID_CURSOR', 400, '无效的分页或访问凭据。'); }
}
