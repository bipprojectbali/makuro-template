/** `backup`: cold tar.gz snapshot of the local Postgres data dir, with retention. */
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { backupDir, dataDir, isLocalMode } from '../local-pg/paths';
import { dataDirHolder } from '../local-pg/postmaster';
import { PKG_NAME } from '../pkg';

export const DEFAULT_KEEP = 7;

/** `YYYYMMDD-HHMMSS` in local time. */
export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Delete the oldest archives beyond `keep` (names sort chronologically); returns removed paths. */
export async function prune(dir: string, keep: number): Promise<string[]> {
  const prefix = `${PKG_NAME}-`;
  const archives = (await readdir(dir))
    .filter((f) => f.startsWith(prefix) && f.endsWith('.tar.gz'))
    .sort();
  const old = archives.slice(0, Math.max(0, archives.length - keep)).map((f) => path.join(dir, f));
  await Promise.all(old.map((f) => rm(f)));
  return old;
}

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { out: { type: 'string' }, keep: { type: 'string', default: String(DEFAULT_KEEP) } },
  });
  const keep = Number(values.keep);
  if (!Number.isInteger(keep) || keep < 1) {
    console.error('--keep harus bilangan bulat ≥ 1.');
    return 2;
  }
  if (!isLocalMode()) {
    console.log('DATABASE_URL menunjuk ke Postgres eksternal — backup bukan tugas perintah ini.');
    console.log('Gunakan: pg_dump "$DATABASE_URL" -Fc -f backup.dump');
    return 2;
  }
  const data = dataDir();
  if (!existsSync(data)) {
    console.error(
      `Folder data Postgres lokal tidak ditemukan: ${data}. Jalankan \`${PKG_NAME} init\` dulu.`,
    );
    return 1;
  }
  // ponytail: cold backup (server must be stopped → short downtime); hot backup = pg_dump via Postgres Docker or pg_basebackup.
  const holder = dataDirHolder(data);
  if (holder) {
    console.error(`Postgres lokal sedang berjalan (PID ${holder.pid}). Hentikan server dulu:`);
    console.error(
      `  systemctl stop ${PKG_NAME} && ${PKG_NAME} backup && systemctl start ${PKG_NAME}`,
    );
    return 1;
  }

  const outDir = values.out ? path.resolve(process.cwd(), values.out) : backupDir();
  await mkdir(outDir, { recursive: true });
  const target = path.join(outDir, `${PKG_NAME}-${stamp()}.tar.gz`);
  const partial = `${target}.partial`;
  const tar = Bun.spawn(['tar', '-czf', partial, '-C', path.dirname(data), path.basename(data)], {
    stdout: 'ignore',
    stderr: 'pipe',
  });
  const [code, stderr] = await Promise.all([tar.exited, new Response(tar.stderr).text()]);
  if (code !== 0) {
    await rm(partial, { force: true });
    console.error(`Backup gagal (tar exit ${code}): ${stderr.trim()}`);
    return 1;
  }
  await rename(partial, target);
  const { size } = await stat(target);
  console.log(`Backup tersimpan: ${target} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  for (const f of await prune(outDir, keep)) console.log(`Dihapus (retensi ${keep}): ${f}`);
  console.log(
    `Restore (server mati): pindahkan ${data} lalu \`tar -xzf ${target} -C ${path.dirname(data)}\``,
  );
  return 0;
}
