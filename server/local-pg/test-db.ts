/** Point the test run at a dedicated database so tests never touch dev data (env-free: runs before `.env` is validated). */
import { runMigrations } from './boot';
import { pgClient } from './client';
import { isLocalMode, localDatabaseUrl, localPgDb, localPgPort } from './paths';
import { boot } from './server';

async function reachable(url: string): Promise<boolean> {
  const client = pgClient(url, { max: 1, connect_timeout: 2, onnotice: () => {} });
  try {
    await client`select 1`;
    return true;
  } catch {
    // Missing socket / refused = cluster not running; `boot` below reports any real problem.
    return false;
  } finally {
    await client.end({ timeout: 1 });
  }
}

/** Local mode: reuse the running cluster (e.g. `bun dev`) or start one, create + migrate `<db>_test`, return its URL. */
export async function ensureLocalTestDb(): Promise<string> {
  const port = localPgPort();
  const admin = localDatabaseUrl(port, 'postgres');
  if (!(await reachable(admin))) await boot({}); // stopped by boot's own exit hook
  const name = `${localPgDb()}_test`;
  const client = pgClient(admin, { max: 1, onnotice: () => {} });
  try {
    const rows = await client`select 1 from pg_database where datname = ${name}`;
    if (rows.length === 0) await client`create database ${client(name)}`;
  } finally {
    await client.end({ timeout: 5 });
  }
  const url = localDatabaseUrl(port, name);
  await runMigrations(url);
  return url;
}

/** Ensure DATABASE_URL_TEST is set (auto in local mode) and make DATABASE_URL point at it too. */
export async function prepareTestDb(): Promise<void> {
  if (!process.env.DATABASE_URL_TEST && isLocalMode()) {
    process.env.DATABASE_URL_TEST = await ensureLocalTestDb();
  }
  if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
