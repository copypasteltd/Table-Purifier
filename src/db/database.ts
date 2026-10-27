import pg, { type PoolClient, type QueryResultRow } from 'pg';
import { invariant } from '../shared/errors.js';

const { Pool } = pg;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// JSON protocol numbers must remain safe; money/versions can never silently round.
pg.types.setTypeParser(20, value => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds protocol safe range.');
  return number;
});

export type Transaction = PoolClient;

export class Database {
  readonly pool: pg.Pool;
  constructor(connectionString: string, max = 10) {
    this.pool = new Pool({ connectionString, max, connectionTimeoutMillis: 10_000,
      application_name: 'p07', statement_timeout: 15_000, idle_in_transaction_session_timeout: 15_000 });
  }

  async assertApplicationRole(): Promise<void> {
    const result = await this.pool.query<{ rolsuper: boolean; rolbypassrls: boolean; owns_schema: boolean }>(`
      SELECT r.rolsuper, r.rolbypassrls,
        (SELECT nspowner=r.oid FROM pg_namespace WHERE nspname='p07') AS owns_schema
      FROM pg_roles r WHERE r.rolname=current_user`);
    const role = result.rows[0];
    invariant(role && !role.rolsuper && !role.rolbypassrls && !role.owns_schema,
      'DATABASE_ROLE_UNSAFE', '应用数据库角色必须与迁移角色分离。', 503);
  }

  async withOwner<T>(ownerId: string, action: (tx: Transaction) => Promise<T>): Promise<T> {
    invariant(UUID.test(ownerId), 'INVALID_OWNER', '账号信息无效。', 401);
    const tx = await this.pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query("SELECT set_config('p07.owner_id',$1,true)", [ownerId]);
      const value = await action(tx);
      await tx.query('COMMIT');
      return value;
    } catch (error) {
      await tx.query('ROLLBACK');
      throw error;
    } finally { tx.release(); }
  }

  async close(): Promise<void> { await this.pool.end(); }
}

export async function one<T extends QueryResultRow>(tx: Transaction, sql: string, values: unknown[] = []): Promise<T | undefined> {
  const result = await tx.query<T>(sql, values);
  return result.rows[0];
}

export function sqlIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw new Error('Unsafe SQL identifier.');
  return '"' + value + '"';
}

/** Columns are from application source, not user-provided field names. Values always bind. */
export async function insertRow(tx: Transaction, table: string, row: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(row);
  await tx.query(`INSERT INTO p07.${sqlIdentifier(table)} (${keys.map(sqlIdentifier).join(',')})
    VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})`, keys.map(key => row[key]));
}
