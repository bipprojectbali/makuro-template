/** test-only: a `sleep` process whose command name is `postgres` (symlink), to fake a live postmaster. */
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function fakePostgres(): Promise<{ pid: number; kill: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fake-pg-'));
  const bin = path.join(dir, 'postgres');
  await symlink(Bun.which('sleep') ?? '/bin/sleep', bin);
  const proc = Bun.spawn([bin, '60'], { stdout: 'ignore', stderr: 'ignore' });
  return {
    pid: proc.pid,
    kill: async () => {
      proc.kill();
      await proc.exited;
      await rm(dir, { recursive: true, force: true });
    },
  };
}
