/** Where the local RustFS runtime, data and credentials live (env-free: runs before `.env` is validated). */
import os from 'node:os';
import path from 'node:path';
import { PKG_NAME } from '../pkg';

export const RUSTFS_VERSION = '1.0.1';
export const DEFAULT_LOCAL_S3_PORT = 54330;
const BUCKET_MAX = 58; // S3 allows 63; leaves room for the `-test` suffix

export type S3Platform = 'linux-x64' | 'linux-arm64' | 'darwin-arm64';
const PLATFORMS: readonly S3Platform[] = ['linux-x64', 'linux-arm64', 'darwin-arm64'];

/** Host platform when RustFS publishes a build for it, else null (darwin-x64 has none). */
export function currentS3Platform(): S3Platform | null {
  const p = `${process.platform}-${process.arch}` as S3Platform;
  return PLATFORMS.includes(p) ? p : null;
}

/** Global cache dir of the extracted RustFS binary for one platform. */
export function s3RuntimeDir(platform: S3Platform | null = currentS3Platform()): string {
  if (!platform) throw new Error(unsupportedMessage());
  const cache = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(cache, PKG_NAME, 'rustfs', RUSTFS_VERSION, platform);
}

/** Message for hosts without a RustFS build. */
export function unsupportedMessage(): string {
  return `Storage lokal (RustFS) tidak tersedia untuk ${process.platform}-${process.arch} — set S3_ENDPOINT ke S3 eksternal.`;
}

/** Local storage root (relative to cwd unless absolute): holds `data/` (the volume) and `keys.json`. */
export function s3Dir(): string {
  return path.resolve(process.cwd(), process.env.LOCAL_S3_DIR || './data/s3');
}

/** HTTP port of the local RustFS (bound to 127.0.0.1 only). */
export function localS3Port(): number {
  return Number(process.env.LOCAL_S3_PORT || DEFAULT_LOCAL_S3_PORT);
}

/** Endpoint URL of the local RustFS on `port`. */
export function localS3Endpoint(port = localS3Port()): string {
  return `http://127.0.0.1:${port}`;
}

/** Sanitize to S3 bucket rules: [a-z0-9-], 3..58 chars, no leading/trailing dash. */
export function toBucketName(s: string): string {
  const name = s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, BUCKET_MAX)
    .replace(/^-|-$/g, '');
  return name.length >= 3 ? name : `${name || 'app'}-storage`;
}

/** Bucket of the local RustFS: LOCAL_S3_BUCKET, else the package name (both sanitized). */
export function localS3Bucket(env: Record<string, string | undefined> = process.env): string {
  return toBucketName(env.LOCAL_S3_BUCKET || PKG_NAME);
}

/** Local mode = no external S3_ENDPOINT configured. */
export function isLocalStorageMode(env: Record<string, string | undefined> = process.env): boolean {
  return !env.S3_ENDPOINT;
}
