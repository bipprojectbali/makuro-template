/** Where the local Postgres runtime, data and backups live (env-free: runs before `.env` is validated). */
import os from 'node:os';
import path from 'node:path';
import { PKG_NAME } from '../pkg';

export const PG_VERSION = '18.4.0';
export const PG_PKG_VERSION = '18.4.0-beta.17';
export const DEFAULT_LOCAL_PG_PORT = 54329;

export type PgPlatform = 'linux-x64' | 'linux-arm64' | 'darwin-arm64' | 'darwin-x64';
const PLATFORMS: readonly PgPlatform[] = ['linux-x64', 'linux-arm64', 'darwin-arm64', 'darwin-x64'];

/** Host platform as an embedded-postgres package suffix, or null when unsupported. */
export function currentPlatform(): PgPlatform | null {
  const p = `${process.platform}-${process.arch}` as PgPlatform;
  return PLATFORMS.includes(p) ? p : null;
}

/** Global cache dir of the extracted Postgres runtime for one platform. */
export function runtimeDir(platform: PgPlatform | null = currentPlatform()): string {
  if (!platform)
    throw new Error(`Platform ${process.platform}-${process.arch} tidak didukung Postgres lokal.`);
  const cache = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(cache, PKG_NAME, 'pg', PG_VERSION, platform);
}

/** Postgres data directory (relative to cwd unless absolute). */
export function dataDir(): string {
  return path.resolve(process.cwd(), process.env.LOCAL_PG_DIR ?? './data/pg');
}

/** Directory where `backup` writes archives. */
export function backupDir(): string {
  return path.resolve(process.cwd(), process.env.BACKUP_DIR ?? './backups');
}

/** TCP port of the local Postgres (127.0.0.1 only). */
export function localPgPort(): number {
  return Number(process.env.LOCAL_PG_PORT ?? DEFAULT_LOCAL_PG_PORT);
}

/** Database name inside the local cluster (package name, sanitized to an unquoted identifier). */
export const LOCAL_PG_DB = PKG_NAME.toLowerCase().replace(/[^a-z0-9_]/g, '_');

/** Local mode = no external DATABASE_URL, or LOCAL_PG_DIR forces it. */
export function isLocalMode(env: Record<string, string | undefined> = process.env): boolean {
  return !env.DATABASE_URL || Boolean(env.LOCAL_PG_DIR);
}

/** Connection URL of the local cluster (trust auth on loopback). */
export function localDatabaseUrl(port = localPgPort()): string {
  return `postgres://postgres@127.0.0.1:${port}/${LOCAL_PG_DB}`;
}

/** Drizzle migrations folder: embedded in the binary VFS, or the source tree. */
export function migrationsFolder(): string {
  return Bun.isStandaloneExecutable
    ? path.join(import.meta.dir, 'migrations')
    : path.join(import.meta.dir, '../db/migrations');
}
