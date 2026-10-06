/** Boot-time glue: start the local cluster, point DATABASE_URL at it, migrate, stop on exit signals. */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { pgClient } from './client';
import { isLocalMode, migrationsFolder } from './paths';
import { startLocalPg } from './server';

const g = globalThis as typeof globalThis & { __makuroLocalPgSignals?: boolean };

/** Apply Drizzle migrations to `url` with a short-lived client; returns the applied-migration count. */
export async function runMigrations(url: string, folder = migrationsFolder()): Promise<number> {
  const client = pgClient(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: folder });
    const [row] = await client<
      { n: number }[]
    >`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return row?.n ?? 0;
  } finally {
    await client.end({ timeout: 5 });
  }
}

/** In local mode: start Postgres, set process.env.DATABASE_URL, migrate (default), stop on SIGINT/SIGTERM. */
export async function bootLocalPg(opts: { migrate?: boolean } = {}): Promise<boolean> {
  if (!isLocalMode()) return false;
  const pg = await startLocalPg();
  process.env.DATABASE_URL = pg.url;
  if (opts.migrate ?? true) await runMigrations(pg.url);

  if (!g.__makuroLocalPgSignals) {
    g.__makuroLocalPgSignals = true;
    const shutdown = (signal: string) => {
      pg.stop().then(
        () => process.exit(0),
        (err: unknown) => {
          console.error(`[local-pg] gagal menghentikan Postgres saat ${signal}:`, err);
          process.exit(1);
        },
      );
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  }
  return true;
}
