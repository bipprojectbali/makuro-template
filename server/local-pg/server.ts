/** Start/stop the local Postgres cluster as a child process (one per process, shared via globalThis). */
import { existsSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PKG_NAME } from '../pkg';
import { pgClient } from './client';
import {
  dataDir as defaultDataDir,
  socketDir as defaultSocketDir,
  LOCAL_PG_DB,
  localDatabaseUrl,
  localPgPort,
  runtimeDir,
} from './paths';
import { claimOwner, dataDirHolder, lockHolder, releaseOwner } from './postmaster';
import { pgBin, runtimeInstalled } from './runtime';

export type LocalPg = { url: string; stop: () => Promise<void> };
export type StartLocalPgOptions = {
  dataDir?: string;
  port?: number;
  socketDir?: string;
  runtime?: string;
  timeoutMs?: number;
};

const DEFAULT_START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;
const POLL_MS = 100;
const STDERR_TAIL = 8_192;
const SOCKET_PATH_MAX = 103; // macOS sun_path is 104 bytes including the NUL

const g = globalThis as typeof globalThis & { __makuroLocalPg?: Promise<LocalPg> };

/** Start (or reuse) the local cluster; resolves once it accepts connections and the app database exists. */
export function startLocalPg(opts: StartLocalPgOptions = {}): Promise<LocalPg> {
  g.__makuroLocalPg ??= boot(opts).catch((err) => {
    g.__makuroLocalPg = undefined;
    throw err;
  });
  return g.__makuroLocalPg;
}

/** Stop the cluster started by this process, if any. */
export async function stopLocalPg(): Promise<void> {
  const running = g.__makuroLocalPg;
  if (running) await (await running).stop();
}

async function run(cmd: string[], what: string): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' });
  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (code !== 0) throw new Error(`${what} gagal (exit ${code}): ${(err || out).trim()}`);
}

/** The socket dir is the only access control (trust auth): it must be ours, 0700, and not a symlink. */
function ensureSocketDir(dir: string, port: number): void {
  const sock = path.join(dir, `.s.PGSQL.${port}`);
  if (Buffer.byteLength(sock) > SOCKET_PATH_MAX) {
    throw new Error(
      `Path socket Postgres terlalu panjang (${sock}). Set LOCAL_PG_SOCKET_DIR ke direktori pendek, mis. /tmp/pg-$USER.`,
    );
  }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const st = lstatSync(dir);
  if (!st.isDirectory() || st.uid !== process.getuid?.() || (st.mode & 0o077) !== 0) {
    throw new Error(
      `Direktori socket ${dir} harus direktori milik user ini dengan mode 0700 (bukan symlink). Hapus direktori itu atau set LOCAL_PG_SOCKET_DIR.`,
    );
  }
}

/** Clear what a previous run left behind: stop an orphaned postmaster, drop lock files whose PID is not Postgres. */
async function reclaimLocks(data: string, sockLock: string, runtime: string): Promise<void> {
  const holder = dataDirHolder(data);
  if (holder && !holder.orphan) {
    throw new Error(
      `Postgres lain (pid ${holder.pid}) sudah memakai data dir ${data}. Hentikan proses itu dulu.`,
    );
  }
  if (holder) {
    console.warn(
      `[local-pg] menghentikan postmaster yatim (pid ${holder.pid}) dari run sebelumnya`,
    );
    await run([pgBin('pg_ctl', runtime), 'stop', '-D', data, '-m', 'fast', '-w'], 'pg_ctl stop');
  }
  // Postgres itself refuses a lock file whose PID is alive, even when that PID was reused by an unrelated process.
  rmSync(path.join(data, 'postmaster.pid'), { force: true });
  if (!lockHolder(sockLock)) rmSync(sockLock, { force: true });
}

async function boot(opts: StartLocalPgOptions): Promise<LocalPg> {
  if (process.getuid?.() === 0) {
    throw new Error(
      'Postgres menolak berjalan sebagai root — jalankan aplikasi sebagai user biasa (non-root).',
    );
  }
  const runtime = opts.runtime ?? runtimeDir();
  if (!(await runtimeInstalled(runtime))) {
    throw new Error(
      `Runtime Postgres lokal belum terpasang di ${runtime} — jalankan \`${PKG_NAME} init\` dulu.`,
    );
  }
  const data = opts.dataDir ?? defaultDataDir();
  const port = opts.port ?? localPgPort();
  const sockDir = opts.socketDir ?? defaultSocketDir();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_START_TIMEOUT_MS;

  if (!existsSync(path.join(data, 'PG_VERSION'))) {
    await fs.mkdir(path.dirname(data), { recursive: true });
    await run(
      [
        pgBin('initdb', runtime),
        '-D',
        data,
        '-U',
        'postgres',
        '--auth-local=trust',
        '--auth-host=reject',
        '-E',
        'UTF8',
        '--locale=C',
      ],
      'initdb',
    );
  }
  ensureSocketDir(sockDir, port);
  await reclaimLocks(data, path.join(sockDir, `.s.PGSQL.${port}.lock`), runtime);
  claimOwner(data);

  // No TCP listener: trust over 127.0.0.1 would let any local user in as superuser. UTC keeps tests host-independent.
  const proc = Bun.spawn(
    [
      pgBin('postgres', runtime),
      '-D',
      data,
      '-p',
      String(port),
      '-c',
      'listen_addresses=',
      '-c',
      `unix_socket_directories=${sockDir}`,
      '-c',
      'unix_socket_permissions=0700',
      '-c',
      'timezone=UTC',
      '-c',
      'log_timezone=UTC',
    ],
    { stdout: 'ignore', stderr: 'pipe' },
  );
  // Parent dying (crash, process.exit) must not orphan the postmaster; SIGINT lets it shut down cleanly on its own.
  process.once('exit', () => {
    if (proc.exitCode === null) proc.kill('SIGINT');
  });
  // Drain stderr continuously (a full pipe would block Postgres): buffer while starting, forward once ready.
  let tail = '';
  let ready = false;
  void (async () => {
    const decoder = new TextDecoder();
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk, { stream: true });
      if (ready) process.stderr.write(text.replace(/^(?=.)/gm, '[pg] '));
      else tail = (tail + text).slice(-STDERR_TAIL);
    }
  })();

  const stop = async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGINT'); // "fast shutdown": aborts sessions, checkpoints, exits cleanly.
      const done = await Promise.race([
        proc.exited.then(() => true),
        Bun.sleep(STOP_TIMEOUT_MS).then(() => false),
      ]);
      if (!done) {
        proc.kill('SIGKILL');
        await proc.exited;
      }
    }
    releaseOwner(data);
    g.__makuroLocalPg = undefined;
  };

  const adminUrl = localDatabaseUrl(port, 'postgres', sockDir);
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (!ready) {
    if (proc.exitCode !== null) {
      throw new Error(`Postgres berhenti saat start (exit ${proc.exitCode}): ${tail.trim()}`);
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(
        `Postgres tidak siap dalam ${timeoutMs / 1000}s (${(lastErr as Error)?.message ?? 'tanpa error'}): ${tail.trim()}`,
      );
    }
    const sql = pgClient(adminUrl, { max: 1, connect_timeout: 1, onnotice: () => {} });
    try {
      await sql`select 1`;
      const exists = await sql`select 1 from pg_database where datname = ${LOCAL_PG_DB}`;
      if (exists.length === 0) await sql`create database ${sql(LOCAL_PG_DB)}`;
      ready = true;
    } catch (err) {
      lastErr = err;
      await Bun.sleep(POLL_MS);
    } finally {
      await sql.end({ timeout: 1 });
    }
  }
  return { url: localDatabaseUrl(port, LOCAL_PG_DB, sockDir), stop };
}
