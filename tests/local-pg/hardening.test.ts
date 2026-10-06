// Local Postgres hardening: socket-only trust auth, UTC, stale/reused PID locks, orphan recovery.
import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { chmodSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { pgClient } from '../../server/local-pg/client';
import { localDatabaseUrl } from '../../server/local-pg/paths';
import {
  claimOwner,
  dataDirHolder,
  lockHolder,
  releaseOwner,
} from '../../server/local-pg/postmaster';
import { runtimeInstalled } from '../../server/local-pg/runtime';
import { startLocalPg, stopLocalPg } from '../../server/local-pg/server';
import { fakePostgres } from './fake-postgres';

const installed = await runtimeInstalled();
const randomPort = () => 55_900 + Math.floor(Math.random() * 90);
const tmp: string[] = [];
const mkTmp = async (prefix: string) => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tmp.push(d);
  return d;
};
afterAll(async () => {
  await stopLocalPg();
  for (const d of tmp) await fs.rm(d, { recursive: true, force: true });
});

async function scalar(url: string, q: string): Promise<unknown> {
  const sql = pgClient(url, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql.unsafe(q);
    return Object.values(rows[0] ?? {})[0];
  } finally {
    await sql.end({ timeout: 1 });
  }
}

describe('pgClient', () => {
  it('moves ?host=<socket dir> into the socket path instead of a startup parameter', async () => {
    const sql = pgClient(localDatabaseUrl(5999, 'app', '/tmp/s dir'), { max: 1 });
    expect(sql.options.path).toBe('/tmp/s dir/.s.PGSQL.5999');
    expect(sql.options.connection).not.toHaveProperty('host');
    expect(sql.options.database).toBe('app');
    await sql.end();
  });

  it('leaves URLs without ?host untouched', async () => {
    const sql = pgClient('postgres://u@db.example:6543/app', { max: 1 });
    expect(sql.options.host).toEqual(['db.example']);
    expect(sql.options.path).toBeFalsy();
    await sql.end();
  });
});

describe('lockHolder', () => {
  it('only counts a live process named postgres serving the same data dir', async () => {
    const dir = await mkTmp('lock-');
    const file = path.join(dir, 'postmaster.pid');
    expect(lockHolder(file)).toBeNull();
    await Bun.write(file, `${process.pid}\n${dir}\n`); // PID reused by a non-postgres process
    expect(lockHolder(file)).toBeNull();
    const pg = await fakePostgres();
    try {
      await Bun.write(file, `${pg.pid}\n${dir}\n`);
      expect(lockHolder(file)).toMatchObject({ pid: pg.pid, ppid: process.pid });
      expect(dataDirHolder(dir)?.pid).toBe(pg.pid);
      await Bun.write(file, `${pg.pid}\n${os.tmpdir()}\n`); // postgres, but another cluster
      expect(dataDirHolder(dir)).toBeNull();
    } finally {
      await pg.kill();
    }
    await Bun.write(file, `${pg.pid}\n${dir}\n`);
    expect(lockHolder(file)).toBeNull();
  });

  it('flags an orphan by its claimed owner, not by ppid 1 (subreaper: systemd --user, tini)', async () => {
    const dir = await mkTmp('own-');
    const pg = await fakePostgres(); // parent = this test process, ppid !== 1
    try {
      await Bun.write(path.join(dir, 'postmaster.pid'), `${pg.pid}\n${dir}\n`);
      expect(dataDirHolder(dir)?.orphan).toBe(false); // no claim: ppid 1 rule
      claimOwner(dir);
      expect(dataDirHolder(dir)?.orphan).toBe(false); // parent is the live owner
      await Bun.write(path.join(dir, 'postmaster.owner'), '999999\n'); // owner SIGKILLed, child reparented elsewhere
      expect(dataDirHolder(dir)?.orphan).toBe(true);
      releaseOwner(dir);
      expect(await Bun.file(path.join(dir, 'postmaster.owner')).exists()).toBe(false);
    } finally {
      await pg.kill();
    }
  });
});

describe.skipIf(!installed)('local Postgres hardening (real runtime)', () => {
  afterEach(() => stopLocalPg());

  const setup = async () => ({
    dataDir: path.join(await mkTmp('pg-data-'), 'pg'),
    socketDir: await mkTmp('pgs-'),
    port: randomPort(),
  });

  it('listens on a 0700 unix socket only, rejects TCP, and runs in UTC whatever the host TZ', async () => {
    const opts = await setup();
    const tz = process.env.TZ;
    process.env.TZ = 'Asia/Makassar'; // initdb copies the host zone into postgresql.conf
    let pg: Awaited<ReturnType<typeof startLocalPg>>;
    try {
      pg = await startLocalPg(opts);
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
    expect(pg.url).toBe(localDatabaseUrl(opts.port, undefined, opts.socketDir));
    expect(await scalar(pg.url, 'show timezone')).toBe('UTC');
    expect(await scalar(pg.url, 'show listen_addresses')).toBe('');
    expect(statSync(opts.socketDir).mode & 0o777).toBe(0o700);
    expect(await Bun.file(path.join(opts.dataDir, 'pg_hba.conf')).text()).toMatch(
      /^host\s+all\s+all\s+127\.0\.0\.1\/32\s+reject/m,
    );
    const tcp = postgres(`postgres://postgres@127.0.0.1:${opts.port}/postgres`, {
      max: 1,
      connect_timeout: 2,
    });
    // postgres-js queries are lazy thenables: `expect().rejects` never starts them, so await via then().
    const err = await tcp`select 1`.then(
      () => null,
      (e: Error) => e,
    );
    expect(err?.message).toContain('ECONNREFUSED');
    await tcp.end({ timeout: 1 });
    expect(dataDirHolder(opts.dataDir)).not.toBeNull();
  }, 60_000);

  it('refuses a socket dir that other users can enter', async () => {
    const opts = await setup();
    chmodSync(opts.socketDir, 0o755);
    await expect(startLocalPg(opts)).rejects.toThrow('mode 0700');
    const link = path.join(await mkTmp('pgl-'), 's');
    await fs.symlink(opts.socketDir, link);
    chmodSync(opts.socketDir, 0o700);
    await expect(startLocalPg({ ...opts, socketDir: link })).rejects.toThrow('bukan symlink');
  }, 60_000);

  it('starts over lock files whose PID was reused by a non-postgres process', async () => {
    const opts = await setup();
    await (await startLocalPg(opts)).stop();
    expect(await Bun.file(path.join(opts.dataDir, 'postmaster.owner')).exists()).toBe(false);
    const sleeper = Bun.spawn(['sleep', '60']);
    try {
      const lock = `${sleeper.pid}\n${opts.dataDir}\n`;
      await Bun.write(path.join(opts.dataDir, 'postmaster.pid'), lock);
      await Bun.write(path.join(opts.socketDir, `.s.PGSQL.${opts.port}.lock`), lock);
      const pg = await startLocalPg(opts);
      expect(await scalar(pg.url, 'select 1')).toBe(1);
    } finally {
      sleeper.kill();
    }
  }, 60_000);

  it('stops a postmaster orphaned by a SIGKILLed parent, then starts', async () => {
    const opts = await setup();
    const script = `import { startLocalPg } from ${JSON.stringify(path.resolve('server/local-pg/server.ts'))};
await startLocalPg(${JSON.stringify(opts)}); console.log('ready'); setInterval(() => {}, 1e6);`;
    const parent = Bun.spawn([process.execPath, '-e', script], {
      stdout: 'pipe',
      stderr: 'inherit',
    });
    const reader = parent.stdout.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('ready');
    const orphanPid = dataDirHolder(opts.dataDir)?.pid;
    parent.kill('SIGKILL');
    await parent.exited;
    await Bun.sleep(200);
    expect(dataDirHolder(opts.dataDir)).toMatchObject({ pid: orphanPid, orphan: true });

    const pg = await startLocalPg(opts);
    expect(await scalar(pg.url, 'select 1')).toBe(1);
    expect(dataDirHolder(opts.dataDir)?.pid).not.toBe(orphanPid);
  }, 90_000);
});
