import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

// In test mode, use DATABASE_URL_TEST to avoid polluting the main database.
const dbUrl =
  env.NODE_ENV === 'test' && env.DATABASE_URL_TEST ? env.DATABASE_URL_TEST : env.DATABASE_URL;

// Reuse a single connection in dev/test to survive hot reloads.
const globalForDb = globalThis as unknown as { client?: ReturnType<typeof postgres> };

const client = globalForDb.client ?? postgres(dbUrl, { max: 5 });
if (env.NODE_ENV !== 'production') globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
