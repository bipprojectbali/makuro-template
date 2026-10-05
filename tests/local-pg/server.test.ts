// Real Postgres start/stop; skipped unless the runtime is in the global cache (`<name> init` or ensureRuntime()).
import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { bootLocalPg, runMigrations } from '../../server/local-pg/boot';
import { LOCAL_PG_DB } from '../../server/local-pg/paths';
import { runtimeInstalled } from '../../server/local-pg/runtime';
import { startLocalPg, stopLocalPg } from '../../server/local-pg/server';

const installed = await runtimeInstalled();
const randomPort = () => 55_100 + Math.floor(Math.random() * 800);
const journal = (await Bun.file('server/db/migrations/meta/_journal.json').json()) as {
  entries: unknown[];
};

async function scalar(url: string, q: string): Promise<unknown> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql.unsafe(q);
    return Object.values(rows[0] ?? {})[0];
  } finally {
    await sql.end({ timeout: 1 });
  }
}

describe.skipIf(!installed)('local Postgres (real runtime)', () => {
  const tmp: string[] = [];
  const mkData = async () => {
    const d = await fs.mkdtemp(path.join(os.tmpdir(), 'local-pg-data-'));
    tmp.push(d);
    return path.join(d, 'pg');
  };
  afterAll(async () => {
    await stopLocalPg();
    for (const d of tmp) await fs.rm(d, { recursive: true, force: true });
  });

  it('initdb → start → app database exists → reused singleton → stop', async () => {
    const port = randomPort();
    const dataDir = await mkData();
    const a = startLocalPg({ dataDir, port });
    const b = startLocalPg({ dataDir, port });
    expect(b).toBe(a);
    const pg = await a;
    expect(pg.url).toBe(`postgres://postgres@127.0.0.1:${port}/${LOCAL_PG_DB}`);
    expect(await scalar(pg.url, 'select 1 as one')).toBe(1);
    expect(await scalar(pg.url, 'select current_database()')).toBe(LOCAL_PG_DB);

    await pg.stop();
    await expect(scalar(pg.url, 'select 1')).rejects.toThrow();

    // Restart on the existing cluster (no initdb) works and is a fresh instance.
    const again = await startLocalPg({ dataDir, port });
    expect(await scalar(again.url, 'select 1 as one')).toBe(1);
    await again.stop();
  }, 60_000);

  it('runMigrations applies every journal entry and is idempotent', async () => {
    const pg = await startLocalPg({ dataDir: await mkData(), port: randomPort() });
    expect(await runMigrations(pg.url)).toBe(journal.entries.length);
    expect(await runMigrations(pg.url)).toBe(journal.entries.length);
    await pg.stop();
  }, 60_000);

  it('bootLocalPg is a no-op with an external DATABASE_URL, otherwise sets it and migrates', async () => {
    const saved = {
      url: process.env.DATABASE_URL,
      dir: process.env.LOCAL_PG_DIR,
      port: process.env.LOCAL_PG_PORT,
    };
    try {
      process.env.DATABASE_URL = 'postgres://ext@db.example/app';
      delete process.env.LOCAL_PG_DIR;
      expect(await bootLocalPg()).toBe(false);
      expect(process.env.DATABASE_URL).toBe('postgres://ext@db.example/app');

      const port = randomPort();
      process.env.LOCAL_PG_DIR = await mkData();
      process.env.LOCAL_PG_PORT = String(port);
      expect(await bootLocalPg()).toBe(true);
      expect(process.env.DATABASE_URL).toBe(`postgres://postgres@127.0.0.1:${port}/${LOCAL_PG_DB}`);
      expect(
        await scalar(
          process.env.DATABASE_URL,
          'select count(*)::int from drizzle.__drizzle_migrations',
        ),
      ).toBe(journal.entries.length);
    } finally {
      await stopLocalPg();
      for (const [k, v] of [
        ['DATABASE_URL', saved.url],
        ['LOCAL_PG_DIR', saved.dir],
        ['LOCAL_PG_PORT', saved.port],
      ] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }, 60_000);
});
