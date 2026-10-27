import { join } from 'node:path';
import { loadConfig } from '../src/shared/config.js';
import { migrate } from '../src/db/migrate.js';

const config = loadConfig();
if (!config.P07_MIGRATION_DATABASE_URL) throw new Error('Set P07_MIGRATION_DATABASE_URL; never use the application URL for migration.');
console.log(JSON.stringify({ applied: await migrate(config.P07_MIGRATION_DATABASE_URL, join(config.projectRoot, 'migrations')) }));
