/** Download, verify (sha256) and extract the pinned RustFS release zip into the global cache. */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  currentS3Platform,
  RUSTFS_VERSION,
  type S3Platform,
  s3RuntimeDir,
  unsupportedMessage,
} from './paths';

export type S3Archive = { url: string; sha256: string };

const RELEASES = `https://github.com/rustfs/rustfs/releases/download/${RUSTFS_VERSION}`;
const archive = (asset: string, sha256: string): S3Archive => ({
  url: `${RELEASES}/${asset}`,
  sha256,
});

/** Pinned release zips (musl on Linux: no glibc requirement); hashes from the release SHA256SUMS. */
export const S3_ARCHIVES: Record<S3Platform, S3Archive> = {
  'linux-x64': archive(
    `rustfs-linux-x86_64-musl-v${RUSTFS_VERSION}.zip`,
    'a834096dafa1f1a55825a2cdaf49d006a193978d344f2d508c2be475133738a3',
  ),
  'linux-arm64': archive(
    `rustfs-linux-aarch64-musl-v${RUSTFS_VERSION}.zip`,
    'd2533e293204597416cb8d30790ea35df14cb4521633fa3574c64333141bafdf',
  ),
  'darwin-arm64': archive(
    `rustfs-macos-aarch64-v${RUSTFS_VERSION}.zip`,
    '18aac7101c3484b98f93de64a0609aaa8e02aba072ba7927172c4b2eae7d4843',
  ),
};

const MARKER = '.ok';

/** Absolute path of the `rustfs` executable inside the runtime dir. */
export function rustfsBin(dir = s3RuntimeDir()): string {
  return path.join(dir, 'rustfs');
}

/** True when the runtime finished installing (marker written last) and the binary exists. */
export async function s3RuntimeInstalled(dir = s3RuntimeDir()): Promise<boolean> {
  return (await Bun.file(path.join(dir, MARKER)).exists()) && existsSync(rustfsBin(dir));
}

async function sha256(file: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  for await (const chunk of Bun.file(file).stream()) hasher.update(chunk);
  return hasher.digest('hex');
}

async function unzip(file: string, dest: string): Promise<void> {
  if (!Bun.which('unzip')) {
    throw new Error(
      'Perintah `unzip` tidak ditemukan — pasang dulu (mis. `sudo apt install unzip`) lalu ulangi.',
    );
  }
  const proc = Bun.spawn(['unzip', '-q', '-o', file, '-d', dest], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0)
    throw new Error(`Gagal mengekstrak ${file} (unzip exit ${code}): ${stderr.trim()}`);
}

export type EnsureS3RuntimeOptions = {
  /** Local zip (offline install) instead of downloading. */
  archive?: string;
  dir?: string;
  source?: S3Archive;
  onProgress?: (msg: string) => void;
};

/** Install RustFS if missing (idempotent); verifies sha256 before extracting. Returns the runtime dir. */
export async function ensureS3Runtime(opts: EnsureS3RuntimeOptions = {}): Promise<string> {
  const platform = currentS3Platform();
  const source = opts.source ?? (platform ? S3_ARCHIVES[platform] : undefined);
  if (!source) throw new Error(unsupportedMessage());
  const dir = opts.dir ?? s3RuntimeDir(platform);
  if (await s3RuntimeInstalled(dir)) return dir;

  const progress = opts.onProgress ?? (() => {});
  await fs.mkdir(path.dirname(dir), { recursive: true });
  const stage = `${dir}.tmp-${process.pid}`;
  const tmpArchive = `${stage}.zip`;
  try {
    let file = opts.archive;
    if (!file) {
      progress(`Mengunduh RustFS dari ${source.url}`);
      const res = await fetch(source.url);
      if (!res.ok) throw new Error(`Gagal mengunduh RustFS ${source.url}: HTTP ${res.status}`);
      await Bun.write(tmpArchive, res);
      file = tmpArchive;
    }
    progress('Memverifikasi checksum sha256');
    const actual = await sha256(file);
    if (actual !== source.sha256) {
      throw new Error(
        `Checksum RustFS tidak cocok (${file}): diharapkan ${source.sha256}, didapat ${actual}`,
      );
    }
    progress(`Mengekstrak ke ${dir}`);
    await fs.rm(stage, { recursive: true, force: true });
    await fs.mkdir(stage, { recursive: true });
    await unzip(file, stage);
    if (!existsSync(rustfsBin(stage))) {
      throw new Error(`Arsip ${file} tidak berisi file \`rustfs\` — bukan rilis RustFS?`);
    }
    await fs.chmod(rustfsBin(stage), 0o755);
    // Partial leftovers (no marker) are replaced; rename keeps the swap atomic.
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rename(stage, dir);
    await Bun.write(path.join(dir, MARKER), `${source.sha256}\n`);
    return dir;
  } finally {
    await fs.rm(tmpArchive, { force: true });
    await fs.rm(stage, { recursive: true, force: true });
  }
}
