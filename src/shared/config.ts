import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';
import { z } from 'zod';

export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const boolean = z.enum(['true', 'false']).transform(value => value === 'true');
const integer = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const envSchema = z.object({
  P07_ENV: z.enum(['development', 'test', 'production']).default('development'),
  P07_HOST: z.string().default('127.0.0.1'),
  P07_PORT: integer(1, 65535).default(4317),
  P07_PUBLIC_URL: z.url().default('http://127.0.0.1:4317'),
  P07_DATABASE_URL: z.string().default(''),
  P07_WORKER_DATABASE_URL: z.string().default(''),
  P07_MIGRATION_DATABASE_URL: z.string().default(''),
  P07_STORAGE_ROOT: z.string().default('runtime'),
  P07_TOKEN_SECRET: z.string().default(''),
  P07_IDENTITY_SECRET: z.string().default(''),
  P07_AGENT_ENABLED: boolean.default(false),
  P07_CODEX_MODEL: z.string().default(''),
  P07_CODEX_API_KEY: z.string().default(''),
  P07_CODEX_BASE_URL: z.string().default(''),
  P07_CODEX_PATH: z.string().default(''),
  P07_TESSERACT_PATH: z.string().default(''),
  P07_AGENT_BOOTSTRAP_MS: integer(1000, 300_000).default(120_000),
  P07_AGENT_ANALYSIS_MS: integer(1000, 900_000).default(300_000),
  P07_AGENT_BATCH_MS: integer(1000, 900_000).default(900_000),
  P07_AGENT_ADJUSTMENT_ROUNDS: integer(1, 20).default(5),
  P07_AGENT_IDLE_SECONDS: integer(60, 86400).default(3600),
  P07_AGENT_CONTEXT_TOKENS: integer(8192, 1_000_000).default(64000),
  P07_WORKER_CONCURRENCY: integer(1, 16).default(1),
  P07_ISOLATION_PROFILE: z.string().default(''),
  P07_ALIPAY_ENABLED: boolean.default(false),
  P07_ALIPAY_APP_ID: z.string().default(''),
  P07_ALIPAY_APP_ALIAS: z.string().default('alipay-main'),
  P07_ALIPAY_PRIVATE_KEY_FILE: z.string().default(''),
  P07_ALIPAY_PUBLIC_KEY_FILE: z.string().default(''),
  P07_ALIPAY_GATEWAY: z.url().default('https://openapi.alipay.com/gateway.do'),
  P07_DOUYIN_ENABLED: boolean.default(false),
  P07_DOUYIN_APP_ID: z.string().default(''),
  P07_DOUYIN_APP_ALIAS: z.string().default('douyin-main'),
  P07_DOUYIN_APP_SECRET: z.string().default(''),
  P07_DOUYIN_PRIVATE_KEY_FILE: z.string().default(''),
  P07_DOUYIN_PUBLIC_KEY_FILE: z.string().default(''),
  P07_DOUYIN_PRODUCT_FILE: z.string().default(''),
  P07_DOUYIN_MERCHANT_ID: z.string().default(''),
  P07_COMMERCE_ENABLED: boolean.default(false),
  P07_PRICE_POLICY: z.string().default('flat-v1'),
  P07_PRICE_BASE_MINOR: integer(1, 1_000_000).default(100),
  P07_PRICE_UNIT_MINOR: integer(0, 100_000).default(10),
  P07_PRICE_MAX_MINOR: integer(1, 1_000_000).default(3000),
  P07_POLICY_VERSION: z.string().default('privacy-2026-10-27'),
  P07_OPERATOR_TOKEN_HASH: z.string().default(''),
  P07_PROCESSOR_POLICY_FILE: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;
export type Config = Env & { projectRoot: string; storageRoot: string };

export function projectPath(root: string, path: string): string {
  const absolute = resolve(root, path); const rel = relative(root, absolute);
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) throw new Error('Path must stay inside the project.');
  return absolute;
}

export function loadConfig(overrides: Record<string, string | undefined> = {}, loadDotenv = true): Config {
  if (loadDotenv) dotenv({ path: resolve(PROJECT_ROOT, '.env'), quiet: true });
  const env = envSchema.parse({ ...process.env, ...overrides });
  const storageRoot = projectPath(PROJECT_ROOT, env.P07_STORAGE_ROOT);
  if (env.P07_ENV !== 'test' && env.P07_TOKEN_SECRET.length < 32) throw new Error('P07_TOKEN_SECRET must contain at least 32 characters.');
  if(env.P07_ENV!=='test'&&(env.P07_ALIPAY_ENABLED||env.P07_DOUYIN_ENABLED)&&env.P07_IDENTITY_SECRET.length<32)
    throw new Error('Platform identity storage requires a stable, dedicated P07_IDENTITY_SECRET.');
  if (env.P07_ENV === 'production' && !env.P07_PUBLIC_URL.startsWith('https://')) throw new Error('Production requires an HTTPS public URL.');
  if (env.P07_AGENT_ENABLED && (!env.P07_CODEX_MODEL || !env.P07_CODEX_API_KEY || !env.P07_ISOLATION_PROFILE)) {
    throw new Error('Agent requires dedicated model authentication and a verified native isolation profile.');
  }
  if (env.P07_PRICE_MAX_MINOR < env.P07_PRICE_BASE_MINOR) throw new Error('Price cap cannot be below base price.');
  if (env.P07_COMMERCE_ENABLED && !env.P07_ALIPAY_ENABLED && !env.P07_DOUYIN_ENABLED) throw new Error('Commerce requires a configured platform.');
  return { ...env,P07_IDENTITY_SECRET:env.P07_IDENTITY_SECRET||(env.P07_ENV==='test'?env.P07_TOKEN_SECRET:''),projectRoot: PROJECT_ROOT, storageRoot };
}
