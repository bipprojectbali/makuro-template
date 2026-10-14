import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { isLocalMode, localPgDb, localPgPort, socketDir } from './server/local-pg/paths';

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './server/db/schema.auth.ts',
    './server/db/schema.app.ts',
    './server/db/schema.logs.ts',
    './server/db/schema.keys.ts',
  ],
  out: './server/db/migrations',
  // Mirror the app's mode: embedded cluster over its unix socket when DATABASE_URL is empty.
  dbCredentials: isLocalMode()
    ? { host: socketDir(), port: localPgPort(), user: 'postgres', database: localPgDb() }
    : { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
