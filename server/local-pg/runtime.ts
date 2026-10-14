/** Download, verify and extract the pinned Postgres runtime (embedded-postgres npm tarballs) into the global cache. */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { currentPlatform, type PgPlatform, runtimeDir } from './paths';

export type PgArchive = { url: string; integrity: string };

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/** Registry root for the runtime tarball; MAKURO_PG_REGISTRY points it at a faster mirror (checksum still pinned). */
export function registryRoot(env: NodeJS.ProcessEnv = process.env): string {
  return (env.MAKURO_PG_REGISTRY || DEFAULT_REGISTRY).replace(/\/+$/, '');
}

function tarballUrl(p: PgPlatform, root = registryRoot()): string {
  return `${root}/@embedded-postgres/${p}/-/${p}-18.4.0-beta.17.tgz`;
}

const archive = (p: PgPlatform, integrity: string): PgArchive => ({
  url: tarballUrl(p),
  integrity,
});

/** Pinned tarballs per platform; integrity is npm's `dist.integrity`, baked in at build time. */
export const PG_ARCHIVES: Record<PgPlatform, PgArchive> = {
  'linux-x64': archive(
    'linux-x64',
    'sha512-jVw/MdDtIX/vICH/DKIe6/mHpiCggdx6QVyza4vt/NbcZFsL0KhwglF6F1Koqx3gRBZ9XtN+vi63EsqSyqOSxA==',
  ),
  'linux-arm64': archive(
    'linux-arm64',
    'sha512-TIzjtGnDGSD/LbdW0OWCEcbI+YVT0WKSfSr20TCkkP4UR8zeKe+QCZbO0/CM4hS9EWyZ4cDebjRvpRc3iMi6wg==',
  ),
  'darwin-arm64': archive(
    'darwin-arm64',
    'sha512-Kg1ZMNFzkVIJs3g4V2UYEc5X005km9rGinxFBH8R1sOU2Rblvz4pt2Uf93Pu8Rk273Ue9HIdrbMPpgUqwjUi0Q==',
  ),
  'darwin-x64': archive(
    'darwin-x64',
    'sha512-4tShSYWMxUQTSWoQAdLnHISvRj6L9gTch9/31ASJPg6wgyN64LDRwMcOINEWybM7N0ropJ3nTYhFT3UX1bKY5Q==',
  ),
};

const MARKER = '.ok';

/** Absolute path of a Postgres executable inside the runtime. */
export function pgBin(name: 'initdb' | 'pg_ctl' | 'postgres', dir = runtimeDir()): string {
  return path.join(dir, 'native', 'bin', name);
}

/** Integrity string recorded when the runtime was installed, or null if not installed. */
export async function installedIntegrity(dir = runtimeDir()): Promise<string | null> {
  const marker = Bun.file(path.join(dir, MARKER));
  return (await marker.exists()) ? (await marker.text()).trim() : null;
}

/** True when the runtime finished installing (marker written last) and `postgres` exists. */
export async function runtimeInstalled(dir = runtimeDir()): Promise<boolean> {
  return (await installedIntegrity(dir)) !== null && existsSync(pgBin('postgres', dir));
}

async function sha512Integrity(file: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha512');
  for await (const chunk of Bun.file(file).stream()) hasher.update(chunk);
  return `sha512-${hasher.digest('base64')}`;
}

/** One-line download status: `42% · 12.3/52.6 MB · 1.5 MB/s · ETA 27s` (drops %/ETA when size is unknown). */
export function progressLine(downloaded: number, total: number, bytesPerSec: number): string {
  const mb = (n: number) => (n / 1_048_576).toFixed(1);
  const speed = `${mb(bytesPerSec)} MB/s`;
  if (total > 0) {
    const pct = Math.min(100, Math.round((downloaded / total) * 100));
    const eta = bytesPerSec > 0 ? Math.max(0, Math.round((total - downloaded) / bytesPerSec)) : 0;
    return `${pct}% · ${mb(downloaded)}/${mb(total)} MB · ${speed} · ETA ${eta}s`;
  }
  return `${mb(downloaded)} MB · ${speed}`;
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Gagal mengunduh runtime Postgres ${url}: HTTP ${res.status}`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  const tty = Boolean(process.stderr.isTTY);
  const sink = Bun.file(dest).writer();
  const reader = res.body.getReader();
  const start = Date.now();
  let downloaded = 0;
  let lastTick = 0;
  const render = (final = false): void => {
    const now = Date.now();
    if (!final && now - lastTick < (tty ? 400 : 3000)) return;
    lastTick = now;
    const line = progressLine(downloaded, total, downloaded / Math.max(0.001, (now - start) / 1000));
    process.stderr.write(tty ? `\r  ⬇  ${line}   ` : `  ⬇  ${line}\n`);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    sink.write(value);
    downloaded += value.byteLength;
    render();
  }
  await sink.end();
  render(true);
  if (tty) process.stderr.write('\n');
}

async function untar(file: string, dest: string): Promise<void> {
  // --strip-components drops npm's top-level `package/` dir (GNU and BSD tar both support it).
  const proc = Bun.spawn(['tar', '-xzf', file, '-C', dest, '--strip-components=1'], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`Gagal mengekstrak ${file} (tar exit ${code}): ${stderr.trim()}`);
}

/** Recreate the shared-library symlinks npm cannot ship (same logic as embedded-postgres hydrate-symlinks.js). */
async function hydrateSymlinks(root: string): Promise<void> {
  const listFile = Bun.file(path.join(root, 'native', 'pg-symlinks.json'));
  if (!(await listFile.exists())) return;
  const links = (await listFile.json()) as Array<{ source: string; target: string }>;
  for (const { source, target } of links) {
    const linkPath = path.join(root, target);
    const relSource = path.relative(path.dirname(linkPath), path.join(root, source));
    try {
      await fs.symlink(relSource, linkPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new Error(`Gagal membuat symlink ${target} -> ${source}: ${(err as Error).message}`);
      }
    }
  }
}

export type EnsureRuntimeOptions = {
  /** Local tarball (offline install) instead of downloading. */
  archive?: string;
  dir?: string;
  source?: PgArchive;
  onProgress?: (msg: string) => void;
};

/** Install the runtime if missing (idempotent); verifies sha512 before extracting. Returns the runtime dir. */
export async function ensureRuntime(opts: EnsureRuntimeOptions = {}): Promise<string> {
  const platform = currentPlatform();
  const source = opts.source ?? (platform ? PG_ARCHIVES[platform] : undefined);
  if (!source) {
    throw new Error(
      `Postgres lokal tidak tersedia untuk ${process.platform}-${process.arch}. Pakai DATABASE_URL ke Postgres eksternal.`,
    );
  }
  const dir = opts.dir ?? runtimeDir(platform);
  if (await runtimeInstalled(dir)) return dir;

  const progress = opts.onProgress ?? (() => {});
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const stage = `${dir}.tmp-${process.pid}`;
  const tmpArchive = `${stage}.tgz`;
  try {
    let file = opts.archive;
    if (!file) {
      progress(`Mengunduh runtime Postgres dari ${source.url}`);
      await download(source.url, tmpArchive);
      file = tmpArchive;
    }
    progress('Memverifikasi checksum sha512');
    const actual = await sha512Integrity(file);
    if (actual !== source.integrity) {
      throw new Error(
        `Checksum runtime Postgres tidak cocok (${file}): diharapkan ${source.integrity}, didapat ${actual}`,
      );
    }
    progress(`Mengekstrak ke ${dir}`);
    await fs.rm(stage, { recursive: true, force: true });
    await fs.mkdir(stage, { recursive: true });
    await untar(file, stage);
    await hydrateSymlinks(stage);
    if (!existsSync(pgBin('postgres', stage))) {
      throw new Error(
        `Arsip ${file} tidak berisi native/bin/postgres — bukan paket embedded-postgres?`,
      );
    }
    // Partial leftovers (no marker) are replaced; rename keeps the swap atomic.
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rename(stage, dir);
    await Bun.write(path.join(dir, MARKER), `${source.integrity}\n`);
    return dir;
  } finally {
    await fs.rm(tmpArchive, { force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }
}
