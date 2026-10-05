/**
 * Compile the single-file binary (run `react-router build` first).
 *
 *   bun scripts/build-binary.ts                          → ./<name>            (host)
 *   bun scripts/build-binary.ts --target=bun-linux-x64   → dist/<name>-linux-x64
 *   bun scripts/build-binary.ts --all                    → dist/<name>-{linux,darwin}-{x64,arm64} + dist/checksums.txt
 *
 * Embeds build/client as /$bunfs/root/client and server/db/migrations as
 * /$bunfs/root/migrations (drizzle's migrator reads them via fs from the VFS).
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PKG_NAME } from '../server/pkg';

export const TARGETS = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-darwin-arm64',
  'bun-darwin-x64',
] as const;
export type Target = (typeof TARGETS)[number];
export const DIST_DIR = 'dist';

/** Release asset path for a target: `dist/<name>-<os>-<arch>`. */
export function outfileFor(target: Target, name = PKG_NAME): string {
  return path.join(DIST_DIR, `${name}-${target.replace(/^bun-/, '')}`);
}

/** One `sha256sum`-compatible line: `<hex>  <file>`. */
export function checksumLine(hex: string, file: string): string {
  return `${hex}  ${file}`;
}

export function isTarget(value: string): value is Target {
  return (TARGETS as readonly string[]).includes(value);
}

async function compile(outfile: string, target?: Target): Promise<void> {
  const cmd = [
    process.execPath,
    'build',
    '--compile',
    '--minify',
    ...(target ? [`--target=${target}`] : []),
    '--asset',
    './build/client',
    '--asset',
    './server/db/migrations',
    'server/binary-entry.ts',
    '--outfile',
    outfile,
  ];
  const proc = Bun.spawn(cmd, { stdout: 'inherit', stderr: 'inherit' });
  const code = await proc.exited;
  if (code !== 0)
    throw new Error(`bun build gagal (exit ${code}) untuk ${target ?? 'host'} → ${outfile}`);
}

/** Write dist/checksums.txt covering every release binary in dist/. */
async function writeChecksums(): Promise<void> {
  const files = (await readdir(DIST_DIR)).filter((f) => f.startsWith(`${PKG_NAME}-`)).sort();
  const lines: string[] = [];
  for (const file of files) {
    const hasher = new Bun.CryptoHasher('sha256');
    hasher.update(await Bun.file(path.join(DIST_DIR, file)).arrayBuffer());
    lines.push(checksumLine(hasher.digest('hex'), file));
  }
  await Bun.write(path.join(DIST_DIR, 'checksums.txt'), `${lines.join('\n')}\n`);
  console.log(`checksums.txt: ${files.length} file`);
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { target: { type: 'string', multiple: true }, all: { type: 'boolean' } },
  });
  if (!(await Bun.file('build/server/index.js').exists())) {
    console.error('build/ belum ada — jalankan `react-router build` dulu.');
    return 1;
  }
  const targets = values.all ? [...TARGETS] : (values.target ?? []);
  const invalid = targets.filter((t) => !isTarget(t));
  if (invalid.length) {
    console.error(`Target tidak dikenal: ${invalid.join(', ')}. Pilihan: ${TARGETS.join(', ')}`);
    return 2;
  }
  if (targets.length === 0) {
    await compile(`./${PKG_NAME}`);
    return 0;
  }
  await mkdir(DIST_DIR, { recursive: true });
  for (const t of targets as Target[]) await compile(outfileFor(t), t);
  if (values.all) await writeChecksums();
  return 0;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
