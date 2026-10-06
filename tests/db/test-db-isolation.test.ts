import { afterEach, expect, test } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '../../server/db';
import { prepareTestDb } from '../../server/local-pg/test-db';

const ROOT = path.join(import.meta.dir, '../..');

// cwd = tmpdir so Bun does not auto-load the project's .env into the child.
async function importIn(env: Record<string, string>, mod: string) {
  const proc = Bun.spawn(
    ['bun', '-e', `await import(${JSON.stringify(path.join(ROOT, mod))}); process.exit(0);`],
    {
      cwd: os.tmpdir(),
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  return { err, code };
}

const BASE = {
  DATABASE_URL: 'postgres://user@127.0.0.1:1/none', // test-only
  BETTER_AUTH_SECRET: 'test-only-secret',
};

test('empty optional env values are treated as unset', async () => {
  const r = await importIn(
    { ...BASE, DATABASE_URL_TEST: '', MCP_ADMIN_TOKEN: '', GOOGLE_CLIENT_ID: '' },
    'server/env.ts',
  );
  expect(r.err).not.toContain('Invalid environment variables');
  expect(r.code).toBe(0);
});

test('db refuses to load in test mode without DATABASE_URL_TEST', async () => {
  const r = await importIn({ ...BASE, NODE_ENV: 'test' }, 'server/db/index.ts');
  expect(r.code).not.toBe(0);
  expect(r.err).toContain('DATABASE_URL_TEST belum di-set');
});

test('the test run is connected to the test database, not dev', async () => {
  const url = process.env.DATABASE_URL_TEST;
  expect(url).toBeTruthy();
  expect(process.env.DATABASE_URL).toBe(url);
  const rows = await db.execute<{ name: string }>(sql`select current_database() as name`);
  expect(rows[0]?.name).toBe(new URL(url as string).pathname.slice(1));
});

const saved = { test: process.env.DATABASE_URL_TEST, main: process.env.DATABASE_URL };
afterEach(() => {
  process.env.DATABASE_URL_TEST = saved.test;
  process.env.DATABASE_URL = saved.main;
});

test('prepareTestDb keeps an explicit DATABASE_URL_TEST and points DATABASE_URL at it', async () => {
  process.env.DATABASE_URL_TEST = 'postgres://u@db.example/custom_test'; // test-only
  process.env.DATABASE_URL = 'postgres://u@db.example/dev'; // test-only
  await prepareTestDb();
  expect(process.env.DATABASE_URL_TEST).toBe('postgres://u@db.example/custom_test');
  expect(process.env.DATABASE_URL).toBe('postgres://u@db.example/custom_test');
});
