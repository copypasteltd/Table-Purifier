import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { sha256 } from '../shared/crypto.js';

export async function migrate(connectionString: string, directory: string): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock(7007,3000)');
    await client.query(`CREATE SCHEMA IF NOT EXISTS p07_meta;
      CREATE TABLE IF NOT EXISTS p07_meta.migrations(
        name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());`);
    const files = (await readdir(directory)).filter(file => /^\d{4}_.+\.sql$/.test(file)).sort();
    for (const name of files) {
      const text = await readFile(join(directory, name), 'utf8'); const hash = sha256(text);
      const old = await client.query<{ sha256: string }>('SELECT sha256 FROM p07_meta.migrations WHERE name=$1', [name]);
      if (old.rows[0]) {
        if (old.rows[0].sha256 !== hash) throw new Error('Applied migration was modified: ' + name);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(text);
        await client.query('INSERT INTO p07_meta.migrations(name,sha256) VALUES($1,$2)', [name, hash]);
        await client.query('COMMIT'); applied.push(name);
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock(7007,3000)').catch(() => undefined);
    await client.end();
  }
}
