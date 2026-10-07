/** Dev entry: local Postgres when DATABASE_URL is empty (dev.ts migrates), local RustFS when S3_ENDPOINT is empty, then Vite. */
import { bootLocalPg } from './local-pg/boot';
import { bootLocalStorage } from './local-s3/boot';

await bootLocalPg({ migrate: false });
await bootLocalStorage({ install: true });
await import('./dev');
