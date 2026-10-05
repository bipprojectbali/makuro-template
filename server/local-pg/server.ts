/** Start/stop the local Postgres cluster as a child process (one per process, shared via globalThis). */
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { PKG_NAME } from '../pkg';
import {
  dataDir as defaultDataDir,
  LOCAL_PG_DB,
  localDatabaseUrl,
  localPgPort,
  runtimeDir,
} from './paths';
import { pgBin, runtimeInstalled } from './runtime';

export type LocalPg = { url: string; stop: () => Promise<void> };
export type StartLocalPgOptions = {
  dataDir?: string;
  port?: number;
  runtime?: string;
  timeoutMs?: number;
};

const DEFAULT_START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;
const POLL_MS = 100;
const STDERR_TAIL = 8_192;

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

function aliveOtherPid(data: string): number | null {
  const pidFile = path.join(data, 'postmaster.pid');
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, 'utf8').split('\n')[0]);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch (err) {
    // ESRCH = stale pid file; Postgres cleans it up itself. EPERM = alive but owned by another user.
    return (err as NodeJS.ErrnoException).code === 'EPERM' ? pid : null;
  }
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
        '--auth=trust',
        '-E',
        'UTF8',
        '--locale=C',
      ],
      'initdb',
    );
  }
  const other = aliveOtherPid(data);
  if (other) {
    throw new Error(
      `Postgres lain (pid ${other}) sudah memakai data dir ${data}. Hentikan proses itu dulu.`,
    );
  }

  // Unix socket disabled: data-dir paths easily exceed macOS's 104-char socket limit; TCP loopback only.
  const proc = Bun.spawn(
    [
      pgBin('postgres', runtime),
      '-D',
      data,
      '-p',
      String(port),
      '-h',
      '127.0.0.1',
      '-c',
      'unix_socket_directories=',
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
    g.__makuroLocalPg = undefined;
  };

  const adminUrl = localDatabaseUrl(port).replace(/\/[^/]+$/, '/postgres');
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
    const sql = postgres(adminUrl, { max: 1, connect_timeout: 1, onnotice: () => {} });
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
  return { url: localDatabaseUrl(port), stop };
}
