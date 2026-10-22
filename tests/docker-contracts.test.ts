// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the `${VAR-}` strings are compose shell-expansion syntax asserted verbatim, not TS templates.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dir, '..');
const read = (f: string) => readFileSync(path.join(root, f), 'utf8');

describe('docker contracts', () => {
  test('.dockerignore keeps local data out of the build context', () => {
    // `COPY . .` would drag `data/` (cluster Postgres dev, bisa ratusan MB), `backups/`, dan `dist/` ke build context.
    const ignored = read('.dockerignore')
      .split('\n')
      .map((l) => l.trim());
    for (const entry of ['data', 'backups', 'dist', '.env'])
      expect(ignored, `.dockerignore tidak mengabaikan "${entry}"`).toContain(entry);
  });

  test('image stays non-root and caches the embedded runtimes inside /app', () => {
    const df = read('Dockerfile');
    // `boot()` di server/local-pg/server.ts menolak uid 0 — Postgres lokal tidak mau jalan sebagai root.
    expect(df, 'Dockerfile tanpa USER bun: Postgres lokal menolak jalan sebagai root').toContain(
      'USER bun',
    );
    // `runtimeDir()` (server/local-pg/paths.ts) menaruh binary di $XDG_CACHE_HOME || ~/.cache — di luar volume /app/data.
    expect(
      df,
      'XDG_CACHE_HOME tidak diarahkan ke /app/.cache: tiap container baru mengunduh ulang runtime',
    ).toContain('ENV XDG_CACHE_HOME=/app/.cache');
    expect(df, 'Dockerfile tidak mendeklarasikan VOLUME /app/data').toContain('VOLUME /app/data');
  });

  test('the `embedded` stage bakes both local runtimes', () => {
    // Runtime dipanggang saat build supaya container baru boot tanpa jaringan.
    const stage = read('Dockerfile').split(/^FROM \S+ AS embedded$/m)[1] ?? '';
    expect(stage, 'stage `embedded` tidak memanggil ensureRuntime (Postgres)').toContain(
      'ensureRuntime',
    );
    expect(stage, 'stage `embedded` tidak memanggil ensureS3Runtime (RustFS)').toContain(
      'ensureS3Runtime',
    );
  });

  test('compose passes the mode toggles through instead of hardcoding them', () => {
    // Mode embedded/eksternal dipilih dari ada/tidaknya env var, jadi compose wajib meneruskan (`${VAR-}`), bukan mengeraskan nilainya.
    const yml = read('docker-compose.yml');
    expect(yml, 'DATABASE_URL tidak diteruskan sebagai ${DATABASE_URL-}').toContain(
      'DATABASE_URL: ${DATABASE_URL-}',
    );
    expect(yml, 'S3_ENDPOINT tidak diteruskan sebagai ${S3_ENDPOINT-}').toContain(
      'S3_ENDPOINT: ${S3_ENDPOINT-}',
    );
    expect(yml, 'volume app_data tidak dipasang ke /app/data').toContain('app_data:/app/data');
  });
});
