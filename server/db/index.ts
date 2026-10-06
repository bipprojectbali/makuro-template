import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { env } from '../env';
import { pgClient } from '../local-pg/client';
import * as schema from './schema';

function resolveDbUrl(): string {
  if (env.NODE_ENV !== 'test') return env.DATABASE_URL;
  // Tests delete rows; falling back to DATABASE_URL would wipe dev data.
  if (!env.DATABASE_URL_TEST) {
    throw new Error(
      'DATABASE_URL_TEST belum di-set — test menolak memakai database dev. Jalankan `bun run test` (mode Postgres lokal menyiapkannya otomatis) atau set DATABASE_URL_TEST di .env.',
    );
  }
  return env.DATABASE_URL_TEST;
}
const dbUrl = resolveDbUrl();

// Process-wide pool: the SSR bundle (build/server/index.js) is a second copy of this module, and dev hot reloads re-evaluate it.
const g = globalThis as typeof globalThis & { __makuroDbClient?: ReturnType<typeof postgres> };
g.__makuroDbClient ??= pgClient(dbUrl, { max: 5 });
const client = g.__makuroDbClient;

export const db = drizzle(client, { schema });
export { schema };
