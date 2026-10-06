/** postgres-js client that understands libpq's `?host=/socket/dir` (postgres-js alone sends it as a startup parameter). */
import postgres from 'postgres';

export function pgClient(url: string, opts: postgres.Options<Record<string, never>> = {}) {
  const u = new URL(url);
  const host = u.searchParams.get('host');
  if (!host) return postgres(url, opts);
  u.searchParams.delete('host');
  return postgres(u.href, { ...opts, host });
}
