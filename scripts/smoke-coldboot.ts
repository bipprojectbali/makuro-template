/**
 * Cold-boot smoke: run a compiled binary from an EMPTY directory with a clean env,
 * exactly as a fresh install would — `init --yes --db=local` → `doctor --json` →
 * `start` → black-box checks → shutdown, then verify the child Postgres stopped.
 *
 *   bun scripts/smoke-coldboot.ts ./makuro-template
 *
 * HOME/XDG_CACHE_HOME are kept so the Postgres binaries cache is reused between runs.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runChecks } from './smoke-server.checks';

const INIT_TIMEOUT_MS = Number(process.env.SMOKE_INIT_TIMEOUT_MS ?? 300_000);
const BOOT_TIMEOUT_MS = Number(process.env.SMOKE_BOOT_TIMEOUT_MS ?? 60_000);
const STOP_TIMEOUT_MS = 15_000;

async function freePort(): Promise<number> {
  const probe = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
  const { port } = probe;
  probe.stop(true);
  return port;
}

async function isListening(port: number): Promise<boolean> {
  try {
    const sock = await Bun.connect({ hostname: '127.0.0.1', port, socket: { data() {} } });
    sock.end();
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === 'ECONNREFUSED') return false;
    throw new Error(`Gagal memeriksa port ${port}: ${(err as Error).message}`);
  }
}

async function waitFor(cond: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await cond()) return true;
    await Bun.sleep(300);
  }
  return false;
}

async function run(
  bin: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
) {
  const proc = Bun.spawn([bin, ...args], { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  clearTimeout(timer);
  return { code, out, err };
}

type DoctorReport = { ok: boolean; checks: { name: string; status: string; detail?: string }[] };

async function main(): Promise<number> {
  const binArg = process.argv[2];
  if (!binArg) {
    console.error('Pemakaian: bun scripts/smoke-coldboot.ts <path-binary>');
    return 2;
  }
  const bin = path.resolve(binArg);
  if (!(await Bun.file(bin).exists())) {
    console.error(`Binary tidak ditemukan: ${bin}`);
    return 2;
  }

  const cwd = await mkdtemp(path.join(tmpdir(), 'coldboot-'));
  const port = await freePort();
  const pgPort = await freePort();
  const s3Port = await freePort();
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? cwd,
    ...(process.env.XDG_CACHE_HOME ? { XDG_CACHE_HOME: process.env.XDG_CACHE_HOME } : {}),
    NODE_ENV: 'production',
    PORT: String(port),
    LOCAL_PG_DIR: path.join(cwd, 'data/pg'),
    LOCAL_PG_PORT: String(pgPort),
    LOCAL_S3_DIR: path.join(cwd, 'data/s3'),
    LOCAL_S3_PORT: String(s3Port),
    BETTER_AUTH_SECRET: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
    TRUSTED_PROXIES: '',
  };
  let server: ReturnType<typeof Bun.spawn> | undefined;

  try {
    console.log(`cwd=${cwd}  PORT=${port}  LOCAL_PG_PORT=${pgPort}  LOCAL_S3_PORT=${s3Port}\n`);

    const init = await run(bin, ['init', '--yes', '--db=local'], cwd, env, INIT_TIMEOUT_MS);
    console.log(`${init.code === 0 ? '✅' : '❌'} init --yes --db=local (exit ${init.code})`);
    if (init.code !== 0) {
      console.error(init.out, init.err);
      return 1;
    }

    const doctor = await run(bin, ['doctor', '--json'], cwd, env, BOOT_TIMEOUT_MS);
    try {
      const report = JSON.parse(doctor.out) as DoctorReport;
      const bad = report.checks.filter((c) => c.status !== 'ok');
      console.log(
        `${report.ok ? '✅' : '⚠️ '} doctor: ${report.checks.length - bad.length}/${report.checks.length} ok`,
      );
      for (const c of bad) console.log(`     ${c.status.padEnd(4)} ${c.name} ${c.detail ?? ''}`);
    } catch (err) {
      console.error(
        `❌ doctor --json bukan JSON valid (exit ${doctor.code}): ${(err as Error).message}`,
      );
      console.error(doctor.err);
      return 1;
    }

    const proc = Bun.spawn([bin, 'start'], { cwd, env, stdout: 'pipe', stderr: 'pipe' });
    server = proc;
    const base = `http://127.0.0.1:${port}`;
    const up = await waitFor(async () => {
      if (proc.exitCode !== null) return true;
      const r = await fetch(`${base}/api/version`).catch(() => undefined); // not listening yet
      return r?.ok ?? false;
    }, BOOT_TIMEOUT_MS);
    if (!up || proc.exitCode !== null) {
      console.error(
        `❌ start: server tidak siap dalam ${BOOT_TIMEOUT_MS / 1000}s (exit ${proc.exitCode})`,
      );
      proc.kill();
      console.error(await new Response(proc.stderr).text());
      return 1;
    }
    console.log(`✅ start → ${base}\n`);

    const results = await runChecks(base);
    for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(42)} ${r.detail}`);
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} pemeriksaan lulus\n`);

    proc.kill('SIGTERM');
    const exited = await Promise.race([
      proc.exited.then(() => true),
      Bun.sleep(STOP_TIMEOUT_MS).then(() => false),
    ]);
    server = undefined;
    if (!exited) {
      proc.kill('SIGKILL');
      console.error(`❌ server tidak berhenti dalam ${STOP_TIMEOUT_MS / 1000}s setelah SIGTERM`);
      return 1;
    }
    const pgStopped = await waitFor(async () => !(await isListening(pgPort)), STOP_TIMEOUT_MS);
    console.log(
      `${pgStopped ? '✅' : '❌'} Postgres anak berhenti (port ${pgPort} ${pgStopped ? 'bebas' : 'masih listen'})`,
    );
    const s3Stopped = await waitFor(async () => !(await isListening(s3Port)), STOP_TIMEOUT_MS);
    console.log(
      `${s3Stopped ? '✅' : '❌'} RustFS anak berhenti (port ${s3Port} ${s3Stopped ? 'bebas' : 'masih listen'})`,
    );
    return failed || !pgStopped || !s3Stopped ? 1 : 0;
  } finally {
    if (server && server.exitCode === null) {
      server.kill('SIGKILL');
      await server.exited;
    }
    await rm(cwd, { recursive: true, force: true });
  }
}

try {
  process.exit(await main());
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
