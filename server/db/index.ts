import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { env } from '../env';
import { pgClient } from '../local-pg/client';
import * as schema from './schema';

// In test mode, use DATABASE_URL_TEST to avoid polluting the main database.
const dbUrl =
  env.NODE_ENV === 'test' && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL;

// Process-wide pool: the SSR bundle (build/server/index.js) is a second copy of this module, and dev hot reloads re-evaluate it.
const g = globalThis as typeof globalThis & { __makuroDbClient?: ReturnType<typeof postgres> };
g.__makuroDbClient ??= pgClient(dbUrl, { max: 5 });
const client = g.__makuroDbClient;

export const db = drizzle(client, { schema });
export { schema };
