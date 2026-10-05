/** `upgrade`: replace this binary with a checksum-verified GitHub release asset. */
import { chmod, rename, rm } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { PKG_NAME, PKG_VERSION, RELEASE_REPO } from '../pkg';

const OS = ['linux', 'darwin'];
const ARCH = ['x64', 'arm64'];

/** Release asset name for a platform, or null when no binary is published for it. */
export function assetName(
  platform: string = process.platform,
  arch: string = process.arch,
): string | null {
  return OS.includes(platform) && ARCH.includes(arch) ? `${PKG_NAME}-${platform}-${arch}` : null;
}

/** Parse `sha256sum` output into filename → hex digest. */
export function parseChecksums(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (m) out.set(m[2], m[1].toLowerCase());
  }
  return out;
}

/** Digest for `asset` from checksums.txt content; throws when missing. */
export function pickChecksum(text: string, asset: string): string {
  const sha = parseChecksums(text).get(asset);
  if (!sha) throw new Error(`checksums.txt tidak memuat entri untuk ${asset}`);
  return sha;
}

function downloadBase(): string {
  return process.env.MAKURO_DOWNLOAD_BASE ?? `https://github.com/${RELEASE_REPO}/releases/download`;
}

function apiBase(): string {
  return process.env.MAKURO_API_BASE ?? 'https://api.github.com';
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { 'user-agent': `${PKG_NAME}/${PKG_VERSION}` } });
  if (!res.ok) throw new Error(`Gagal mengunduh ${url}: HTTP ${res.status}`);
  return res;
}

/** Tag of the latest published release (`vX.Y.Z`). */
export async function latestTag(): Promise<string> {
  const body = (await (
    await fetchOk(`${apiBase()}/repos/${RELEASE_REPO}/releases/latest`)
  ).json()) as {
    tag_name?: string;
  };
  if (!body.tag_name) throw new Error('Respons rilis terbaru tidak memuat tag_name');
  return body.tag_name;
}

/** Download `url` and return its bytes only if the sha256 matches. */
export async function downloadVerified(url: string, expectedSha: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(await (await fetchOk(url)).arrayBuffer());
  const actual = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
  if (actual !== expectedSha.toLowerCase()) {
    throw new Error(
      `Checksum tidak cocok untuk ${url} (diharapkan ${expectedSha}, didapat ${actual})`,
    );
  }
  return bytes;
}

/** Fetch + verify the release binary for `tag` (no filesystem writes). */
export async function fetchRelease(tag: string, asset: string): Promise<Uint8Array> {
  const base = `${downloadBase()}/${tag}`;
  const sums = await (await fetchOk(`${base}/checksums.txt`)).text();
  return downloadVerified(`${base}/${asset}`, pickChecksum(sums, asset));
}

/** Atomically swap `target` for `bytes`, keeping the previous file as `<target>.old`. */
export async function replaceBinary(target: string, bytes: Uint8Array): Promise<void> {
  const next = `${target}.new`;
  const old = `${target}.old`;
  let movedOld = false;
  try {
    await Bun.write(next, bytes);
    await chmod(next, 0o755);
    await rename(target, old);
    movedOld = true;
    await rename(next, target);
  } catch (err) {
    await rm(next, { force: true });
    if (movedOld) await rename(old, target);
    const code = (err as NodeJS.ErrnoException).code;
    const hint =
      code === 'EACCES' || code === 'EPERM'
        ? ' — tidak punya izin tulis; jalankan sebagai pemilik binary.'
        : '';
    throw new Error(`Gagal mengganti ${target}: ${(err as Error).message}${hint}`);
  }
}

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { version: { type: 'string' }, check: { type: 'boolean' } },
  });
  if (!Bun.isStandaloneExecutable) {
    console.error('upgrade hanya untuk binary; dari source pakai `git pull`.');
    return 2;
  }
  const asset = assetName();
  if (!asset) {
    console.error(`Tidak ada binary rilis untuk ${process.platform}-${process.arch}.`);
    return 1;
  }
  const current = `v${PKG_VERSION}`;
  const tag = values.version
    ? values.version.startsWith('v')
      ? values.version
      : `v${values.version}`
    : await latestTag();
  if (tag === current) {
    console.log(`Sudah terbaru (${current}).`);
    return 0;
  }
  if (values.check) {
    console.log(
      `Tersedia ${tag} (terpasang ${current}). Jalankan \`${PKG_NAME} upgrade\` untuk memperbarui.`,
    );
    return 0;
  }
  console.log(`Mengunduh ${asset} ${tag}…`);
  const bytes = await fetchRelease(tag, asset);
  await replaceBinary(process.execPath, bytes);
  console.log(`Diperbarui ${current} → ${tag}. Cadangan lama: ${process.execPath}.old`);
  console.log(`Restart service: systemctl restart ${PKG_NAME}`);
  return 0;
}
