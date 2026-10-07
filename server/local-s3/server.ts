/** Start/stop the local RustFS as a child process (one per process, shared via globalThis). */
import fs from 'node:fs/promises';
import path from 'node:path';
import { PKG_NAME } from '../pkg';
import { localS3Endpoint, localS3Port, s3Dir, s3RuntimeDir } from './paths';
import { rustfsBin, s3RuntimeInstalled } from './runtime';

export type S3Keys = { accessKeyId: string; secretAccessKey: string };
export type LocalS3 = S3Keys & { endpoint: string; stop: () => Promise<void> };
export type StartLocalS3Options = {
  dir?: string;
  port?: number;
  runtime?: string;
  timeoutMs?: number;
};

const DEFAULT_START_TIMEOUT_MS = 30_000;
const STOP_TIMEOUT_MS = 10_000;
const POLL_MS = 100;
const OUTPUT_TAIL = 8_192;
const PID_FILE = 'rustfs.pid';

const g = globalThis as typeof globalThis & { __makuroLocalS3?: Promise<LocalS3> };

/** Start (or reuse) the local RustFS; resolves once `/health/ready` answers 200. */
export function startLocalS3(opts: StartLocalS3Options = {}): Promise<LocalS3> {
  g.__makuroLocalS3 ??= boot(opts).catch((err) => {
    g.__makuroLocalS3 = undefined;
    throw err;
  });
  return g.__makuroLocalS3;
}

/** Stop the RustFS started by this process, if any. */
export async function stopLocalS3(): Promise<void> {
  const running = g.__makuroLocalS3;
  if (!running) return;
  await (await running).stop();
  g.__makuroLocalS3 = undefined;
}

/** Credentials stored in `<dir>/keys.json`, or null when not created yet. */
export async function readKeys(dir = s3Dir()): Promise<S3Keys | null> {
  const file = Bun.file(path.join(dir, 'keys.json'));
  return (await file.exists()) ? ((await file.json()) as S3Keys) : null;
}

/** Load the instance credentials, generating random ones (mode 0600) on first boot. */
export async function ensureKeys(dir = s3Dir()): Promise<S3Keys> {
  const existing = await readKeys(dir);
  if (existing) return existing;
  const hex = (n: number) => Buffer.from(crypto.getRandomValues(new Uint8Array(n))).toString('hex');
  const keys: S3Keys = { accessKeyId: hex(10), secretAccessKey: hex(20) };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'keys.json'), JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

/** True when RustFS at `endpoint` is ready to serve S3 (`/health` alone answers before storage quorum). */
export async function s3Healthy(endpoint: string): Promise<boolean> {
  try {
    return (await fetch(`${endpoint}/health/ready`, { signal: AbortSignal.timeout(1_000) })).ok;
  } catch {
    // Refused / timed out = nothing listening there yet.
    return false;
  }
}

async function portInUse(port: number): Promise<boolean> {
  try {
    const sock = await Bun.connect({ hostname: '127.0.0.1', port, socket: { data() {} } });
    sock.end();
    return true;
  } catch {
    // ECONNREFUSED: free.
    return false;
  }
}

/** PID of a live RustFS recorded in `<dir>/rustfs.pid`, or null (stale files are ignored). */
function volumeHolder(pidText: string | null): number | null {
  const pid = Number(pidText);
  if (!pid) return null;
  const ps = Bun.spawnSync(['ps', '-p', String(pid), '-o', 'comm='], { stdout: 'pipe' });
  return ps.stdout.toString().trim().endsWith('rustfs') ? pid : null;
}

/**
 * Start RustFS without the process singleton (tests boot throwaway instances).
 * RustFS itself accepts a second instance on the same port (SO_REUSEPORT) or the same volume,
 * so both are refused here before spawning.
 */
export async function boot(opts: StartLocalS3Options = {}): Promise<LocalS3> {
  const runtime = opts.runtime ?? s3RuntimeDir();
  if (!(await s3RuntimeInstalled(runtime))) {
    throw new Error(
      `Runtime RustFS belum terpasang di ${runtime} — jalankan \`${PKG_NAME} init\` dulu.`,
    );
  }
  const dir = opts.dir ?? s3Dir();
  const port = opts.port ?? localS3Port();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_START_TIMEOUT_MS;
  const volume = path.join(dir, 'data');
  const pidFile = path.join(dir, PID_FILE);

  const pidRef = Bun.file(pidFile);
  const holder = volumeHolder((await pidRef.exists()) ? await pidRef.text() : null);
  if (holder) {
    throw new Error(
      `RustFS lain (pid ${holder}) sudah memakai data dir ${dir}. Hentikan proses itu atau set LOCAL_S3_DIR lain.`,
    );
  }
  if (await portInUse(port)) {
    throw new Error(
      `Port ${port} (storage lokal) sudah dipakai proses lain. Hentikan proses itu atau set LOCAL_S3_PORT lain.`,
    );
  }
  await fs.mkdir(volume, { recursive: true }); // RustFS exits with "Volume not found" otherwise
  const keys = await ensureKeys(dir);

  // Minimal env: the child never needs app secrets. Console off: it binds :9001 by default.
  const proc = Bun.spawn([rustfsBin(runtime), 'server', volume, '--address', `127.0.0.1:${port}`], {
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? dir,
      RUSTFS_ACCESS_KEY: keys.accessKeyId,
      RUSTFS_SECRET_KEY: keys.secretAccessKey,
      RUSTFS_CONSOLE_ENABLE: 'false',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await Bun.write(pidFile, String(proc.pid));
  // Parent dying (crash, process.exit) must not orphan RustFS.
  process.once('exit', () => {
    if (proc.exitCode === null) proc.kill('SIGTERM');
  });
  // Drain output continuously (a full pipe would block RustFS): buffer while starting, forward once ready.
  let tail = '';
  let ready = false;
  const drain = async (stream: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of stream) {
      const text = decoder.decode(chunk, { stream: true });
      if (ready) process.stderr.write(text.replace(/^(?=.)/gm, '[s3] '));
      else tail = (tail + text).slice(-OUTPUT_TAIL);
    }
  };
  void drain(proc.stdout);
  void drain(proc.stderr);

  const stop = async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.kill('SIGTERM');
      const done = await Promise.race([
        proc.exited.then(() => true),
        Bun.sleep(STOP_TIMEOUT_MS).then(() => false),
      ]);
      if (!done) {
        proc.kill('SIGKILL');
        await proc.exited;
      }
    }
    await fs.rm(pidFile, { force: true });
  };

  const endpoint = localS3Endpoint(port);
  const deadline = Date.now() + timeoutMs;
  while (!(await s3Healthy(endpoint))) {
    if (proc.exitCode !== null) {
      await fs.rm(pidFile, { force: true });
      throw new Error(`RustFS berhenti saat start (exit ${proc.exitCode}): ${tail.trim()}`);
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`RustFS tidak siap dalam ${timeoutMs / 1000}s: ${tail.trim()}`);
    }
    await Bun.sleep(POLL_MS);
  }
  ready = true;
  return { endpoint, ...keys, stop };
}
