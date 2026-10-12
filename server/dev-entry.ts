/** Dev entry: local Postgres when DATABASE_URL is empty, migrate, local RustFS when S3_ENDPOINT is empty, then Vite. */
import { bootLocalPg, runMigrations } from './local-pg/boot';
import { bootLocalStorage } from './local-s3/boot';

await bootLocalPg({ migrate: false });
// Must finish before ./dev loads: its imports (./api) read app_setting at module load.
// Dev-only; prod migrates as an explicit deploy step, never on boot.
try {
  await runMigrations(process.env.DATABASE_URL as string);
} catch (err) {
  const { logger } = await import('./logger');
  logger.error({ err }, 'auto-migrate on boot failed; continuing');
}
await bootLocalStorage({ install: true });
await import('./dev');
