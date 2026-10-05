/** Dev entry: start local Postgres when DATABASE_URL is empty (dev.ts migrates on its own), then the Vite dev server. */
import { bootLocalPg } from './local-pg/boot';

await bootLocalPg({ migrate: false });
await import('./dev');
