import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { isLocalMode, localPgDb, localPgPort, socketDir } from './server/local-pg/paths';

const databaseUrl = process.env.DATABASE_URL;

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
  // Testing databaseUrl first is what lets TypeScript narrow it; isLocalMode() already
  // implies it is set whenever that check is false.
  dbCredentials:
    databaseUrl && !isLocalMode()
      ? { url: databaseUrl }
      : { host: socketDir(), port: localPgPort(), user: 'postgres', database: localPgDb() },
  verbose: true,
  strict: true,
});
