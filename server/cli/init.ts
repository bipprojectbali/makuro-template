/** `init`: write `.env` (fresh auth secret), install local Postgres (+ migrate) and RustFS storage, optional systemd unit. */
import { chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { runMigrations } from '../local-pg/boot';
import { isLocalMode } from '../local-pg/paths';
import { ensureRuntime } from '../local-pg/runtime';
import { startLocalPg } from '../local-pg/server';
import { localTarget } from '../local-s3/boot';
import { currentS3Platform, isLocalStorageMode, unsupportedMessage } from '../local-s3/paths';
import { ensureS3Runtime } from '../local-s3/runtime';
import { startLocalS3 } from '../local-s3/server';
import { PKG_NAME } from '../pkg';
import { ensureBucket } from '../storage/bucket';

const DEFAULT_PORT = 3005;
type DbMode = 'local' | 'external';

function randomSecret(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
}

function isPostgresUrl(url: string): boolean {
  return URL.canParse(url) && /^postgres(ql)?:$/.test(new URL(url).protocol);
}

/** `.env` body for a fresh install; never logged (holds the auth secret and maybe DB credentials). */
export function envFileContent(mode: DbMode, databaseUrl?: string): string {
  const base = `http://localhost:${DEFAULT_PORT}`;
  const db =
    mode === 'external'
      ? `DATABASE_URL=${databaseUrl}`
      : `# DATABASE_URL sengaja tidak diisi: \`${PKG_NAME} start\` menjalankan Postgres lokal (data di ./data/pg).\n# Isi DATABASE_URL untuk pindah ke Postgres eksternal (Docker/managed).`;
  return [
    `# Dibuat oleh \`${PKG_NAME} init\`.`,
    'NODE_ENV=production',
    `PORT=${DEFAULT_PORT}`,
    `APP_URL=${base}`,
    `BETTER_AUTH_URL=${base}`,
    `BETTER_AUTH_SECRET=${randomSecret()}`,
    db,
    `# S3_ENDPOINT sengaja tidak diisi: \`${PKG_NAME} start\` menjalankan storage lokal RustFS (data di ./data/s3).`,
    '# Isi S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY untuk S3 eksternal.',
    '# Email super-admin, pisahkan dengan koma.',
    'SUPER_ADMIN_EMAILS=',
    '',
  ].join('\n');
}

/** Install RustFS and boot it once so keys + bucket exist. Storage is optional, so any failure only warns. */
async function initLocalStorage(archive?: string): Promise<void> {
  try {
    await setupLocalStorage(archive);
  } catch (err) {
    console.warn(
      `! Storage lokal belum disiapkan: ${err instanceof Error ? err.message : String(err)}`,
    );
    console.warn('  `start` akan mencoba lagi; tanpa storage, unggah file mengembalikan 503.');
  }
}

async function setupLocalStorage(archive?: string): Promise<void> {
  if (!isLocalStorageMode()) {
    console.log('✓ S3_ENDPOINT terisi — storage memakai S3 eksternal.');
    return;
  }
  if (!currentS3Platform()) {
    console.warn(`! ${unsupportedMessage()}`);
    return;
  }
  await ensureS3Runtime({ archive, onProgress: (msg) => console.log(`  ${msg}`) });
  const s3 = await startLocalS3();
  try {
    await ensureBucket(localTarget(s3));
  } finally {
    await s3.stop();
  }
  console.log('✓ Storage lokal (RustFS) siap.');
}

function ask(question: string, fallback: string): string {
  return (prompt(`${question} [${fallback}]`) ?? '').trim() || fallback;
}

export async function run(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      yes: { type: 'boolean', short: 'y' },
      db: { type: 'string' },
      'database-url': { type: 'string' },
      'pg-archive': { type: 'string' },
      's3-archive': { type: 'string' },
      systemd: { type: 'boolean' },
      force: { type: 'boolean' },
    },
  });
  const interactive = Boolean(process.stdin.isTTY) && !values.yes;

  const mode = (values.db ??
    (interactive ? ask('Mode database (local/external)?', 'local') : 'local')) as DbMode;
  if (mode !== 'local' && mode !== 'external') {
    console.error(`--db harus "local" atau "external", bukan "${mode}".`);
    return 2;
  }
  let databaseUrl = values['database-url'];
  if (mode === 'external') {
    databaseUrl ??= interactive ? ask('DATABASE_URL Postgres eksternal?', '') : undefined;
    if (!databaseUrl || !isPostgresUrl(databaseUrl)) {
      console.error(
        'Mode external butuh --database-url=postgres://user:pass@host:5432/db yang valid.',
      );
      return 2;
    }
  }
  if (values.systemd && !Bun.isStandaloneExecutable) {
    console.error('--systemd hanya untuk binary hasil build (bukan `bun run`).');
    return 2;
  }

  try {
    const envPath = path.join(process.cwd(), '.env');
    if ((await Bun.file(envPath).exists()) && !values.force) {
      console.log('✓ .env sudah ada — dipertahankan (pakai --force untuk menimpa).');
    } else {
      await writeFile(envPath, envFileContent(mode, databaseUrl), { mode: 0o600 });
      await chmod(envPath, 0o600);
      console.log(`✓ .env ditulis (mode ${mode}, BETTER_AUTH_SECRET baru dibuat).`);
    }

    if (mode === 'local') {
      if (!isLocalMode()) {
        console.warn(
          '! DATABASE_URL terisi di .env/lingkungan — `start` akan memakai database eksternal itu.',
        );
      }
      await ensureRuntime({
        archive: values['pg-archive'],
        onProgress: (msg) => console.log(`  ${msg}`),
      });
      const pg = await startLocalPg();
      try {
        await runMigrations(pg.url);
      } finally {
        await pg.stop();
      }
      console.log('✓ Postgres lokal siap dan migrasi diterapkan.');
    }
    await initLocalStorage(values['s3-archive']);

    if (values.systemd) {
      const { writeSystemdUnit } = await import('./systemd');
      const unit = await writeSystemdUnit({ execPath: process.execPath, cwd: process.cwd() });
      const name = path.basename(unit);
      console.log(`✓ Unit systemd ditulis: ${unit}`);
      console.log(
        `  sudo cp ${unit} /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now ${name}`,
      );
    }
  } catch (err) {
    console.error(`✗ init gagal: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  console.log(`\nLangkah berikutnya:\n  ${PKG_NAME} doctor\n  ${PKG_NAME} start`);
  return 0;
}
