import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env';
import * as schema from './schema';

// Reuse a single connection in dev to survive hot reloads.
const globalForDb = globalThis as unknown as { client?: ReturnType<typeof postgres> };

const client = globalForDb.client ?? postgres(env.DATABASE_URL, { max: 10 });
if (env.NODE_ENV !== 'production') globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
