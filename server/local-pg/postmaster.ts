/** Who holds a Postgres lock file (`postmaster.pid`, `.s.PGSQL.<port>.lock`): line 1 = pid, line 2 = data dir. */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export type LockHolder = { pid: number; dataDir: string; orphan: boolean };

const isMissing = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT';

function procInfo(pid: number): { comm: string; ppid: number } | null {
  if (process.platform === 'linux') {
    // /proc instead of `ps`: slim container images ship without procps.
    let stat: string;
    try {
      stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
    const close = stat.lastIndexOf(')');
    const [, ppid] = stat.slice(close + 2).split(' ');
    return { comm: stat.slice(stat.indexOf('(') + 1, close), ppid: Number(ppid) };
  }
  const ps = Bun.spawnSync(['ps', '-o', 'ppid=,comm=', '-p', String(pid)]);
  const m = ps.stdout
    .toString()
    .trim()
    .match(/^(\d+)\s+(.+)$/);
  return ps.exitCode === 0 && m ? { ppid: Number(m[1]), comm: path.basename(m[2] ?? '') } : null;
}

/** Live `postgres` process named in `file`; null when the file is absent or stale (dead or reused PID). */
export function lockHolder(file: string): LockHolder | null {
  let lines: string[];
  try {
    lines = readFileSync(file, 'utf8').split('\n');
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
  const pid = Number(lines[0]);
  const info = Number.isInteger(pid) && pid > 0 ? procInfo(pid) : null;
  if (info?.comm !== 'postgres') return null;
  return { pid, dataDir: lines[1] ?? '', orphan: info.ppid === 1 };
}

/** Same directory after resolving symlinks; false when either is gone. */
export function sameDir(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch (err) {
    if (isMissing(err)) return false;
    throw err;
  }
}

/** Live postmaster that owns `data` (its `postmaster.pid` names a `postgres` process serving that dir). */
export function dataDirHolder(data: string): LockHolder | null {
  const h = lockHolder(path.join(data, 'postmaster.pid'));
  return h && sameDir(h.dataDir, data) ? h : null;
}
