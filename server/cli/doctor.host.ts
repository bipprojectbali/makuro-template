/** Host checks for `doctor`: writable dir, free disk, app port, backup age. */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { backupDir, dataDir } from '../local-pg/paths';
import { PKG_NAME } from '../pkg';
import type { Check, CheckStatus, DoctorContext } from './doctor.checks';

export const DISK_WARN_BYTES = 1024 ** 3;
export const DISK_FAIL_BYTES = 200 * 1024 ** 2;
export const BACKUP_MAX_AGE_DAYS = 7;
const DAY_MS = 86_400_000;

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function nearestExisting(dir: string): Promise<string> {
  let d = dir;
  while (!existsSync(d) && path.dirname(d) !== d) d = path.dirname(d);
  return d;
}

async function portFree(port: number): Promise<boolean> {
  try {
    const s = Bun.listen({ hostname: '0.0.0.0', port, socket: { data() {} } });
    s.stop(true);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE' || /in use/i.test(errMsg(err)))
      return false;
    throw err;
  }
}

async function latestBackup(dir: string): Promise<{ file: string; mtimeMs: number } | null> {
  if (!existsSync(dir)) return null;
  const glob = new Bun.Glob(`${PKG_NAME}-*.tar.gz`);
  let best: { file: string; mtimeMs: number } | null = null;
  for await (const file of glob.scan({ cwd: dir })) {
    const { mtimeMs } = await fs.stat(path.join(dir, file));
    if (!best || mtimeMs > best.mtimeMs) best = { file, mtimeMs };
  }
  return best;
}

export async function hostChecks(ctx: DoctorContext, local: boolean): Promise<Check[]> {
  const g = 'Host' as const;
  const checks: Check[] = [];
  const target = await nearestExisting(local ? dataDir() : ctx.cwd);
  try {
    await fs.access(target, fs.constants.W_OK);
    checks.push({ group: g, name: 'Bisa ditulis', status: 'ok', detail: target });
  } catch (err) {
    checks.push({
      group: g,
      name: 'Bisa ditulis',
      status: 'fail',
      detail: `${target}: ${errMsg(err)}`,
    });
  }
  try {
    const st = await fs.statfs(target);
    const free = st.bavail * st.bsize;
    const gib = (free / 1024 ** 3).toFixed(1);
    const status: CheckStatus =
      free < DISK_FAIL_BYTES ? 'fail' : free < DISK_WARN_BYTES ? 'warn' : 'ok';
    checks.push({ group: g, name: 'Disk kosong', status, detail: `${gib} GiB` });
  } catch (err) {
    checks.push({
      group: g,
      name: 'Disk kosong',
      status: 'warn',
      detail: `tidak terbaca: ${errMsg(err)}`,
    });
  }
  const port = Number(ctx.env.PORT ?? 3000);
  if (Number.isInteger(port) && port > 0) {
    try {
      checks.push(
        (await portFree(port))
          ? { group: g, name: `Port ${port}`, status: 'ok', detail: 'bebas' }
          : {
              group: g,
              name: `Port ${port}`,
              status: 'warn',
              detail: 'port dipakai (server mungkin sedang berjalan)',
            },
      );
    } catch (err) {
      checks.push({
        group: g,
        name: `Port ${port}`,
        status: 'warn',
        detail: `tidak bisa dicek: ${errMsg(err)}`,
      });
    }
  }
  if (local) {
    const dir = backupDir();
    const last = await latestBackup(dir);
    if (!last) {
      checks.push({
        group: g,
        name: 'Backup',
        status: 'warn',
        detail: `belum ada di ${dir}`,
        hint: `jalankan \`${PKG_NAME} backup\``,
      });
    } else {
      const days = (Date.now() - last.mtimeMs) / DAY_MS;
      checks.push({
        group: g,
        name: 'Backup',
        status: days > BACKUP_MAX_AGE_DAYS ? 'warn' : 'ok',
        detail: `${last.file} (${days.toFixed(1)} hari lalu)`,
      });
    }
  }
  return checks;
}
