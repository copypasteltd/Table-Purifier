import { defineConfig } from 'vitest/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const testTemp=resolve('runtime/tmp');
mkdirSync(testTemp,{recursive:true});

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    maxWorkers: 2,
    fileParallelism: false,
    reporters: ['default'],
    env: { TEMP: testTemp, TMP: testTemp, TMPDIR: testTemp },
  },
});
