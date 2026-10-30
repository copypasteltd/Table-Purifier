import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/shared/config.js';

const production = {
  P07_ENV: 'production', P07_TOKEN_SECRET: 'test-only-dedicated-token-secret-123456789',
  P07_AGENT_ENABLED: 'false', P07_ALIPAY_ENABLED: 'false', P07_DOUYIN_ENABLED: 'false',
  P07_COMMERCE_ENABLED: 'false', P07_ALLOW_HTTP_DEPLOYMENT: undefined,
};

describe('explicit production transport configuration', () => {
  it('requires an explicit HTTP opt-in while retaining HTTPS by default', () => {
    expect(() => loadConfig({ ...production, P07_PUBLIC_URL: 'http://192.168.31.20:18707' }, false))
      .toThrow('P07_ALLOW_HTTP_DEPLOYMENT=true');
    const http = loadConfig({ ...production, P07_PUBLIC_URL: 'http://192.168.31.20:18707', P07_ALLOW_HTTP_DEPLOYMENT: 'true' }, false);
    expect(http.P07_ENV).toBe('production');
    expect(http.P07_ALLOW_HTTP_DEPLOYMENT).toBe(true);
    expect(loadConfig({ ...production, P07_PUBLIC_URL: 'https://example.test' }, false).P07_ALLOW_HTTP_DEPLOYMENT).toBe(false);
  });

  it('rejects non-HTTP protocols and ambiguous boolean values even with an opt-in', () => {
    expect(() => loadConfig({ ...production, P07_PUBLIC_URL: 'ftp://example.test', P07_ALLOW_HTTP_DEPLOYMENT: 'true' }, false)).toThrow();
    expect(() => loadConfig({ ...production, P07_PUBLIC_URL: 'http://example.test', P07_ALLOW_HTTP_DEPLOYMENT: 'yes' }, false)).toThrow();
  });
});
