/**
 * Object storage (S3-compatible: local RustFS, MinIO, R2, AWS) via Bun's native S3 client.
 * Config is read from process.env at call time because local boot fills S3_* after env.ts loads.
 */
const g = globalThis as typeof globalThis & {
  __makuroStorage?: { key: string; client: Bun.S3Client };
};

const REQUIRED = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const;

/** True when every S3_* setting needed by `storage()` is present. */
export function storageEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return REQUIRED.every((k) => Boolean(env[k]));
}

/** Shared S3 client for the configured bucket; throws when storage is not configured. */
export function storage(): Bun.S3Client {
  if (!storageEnabled()) {
    throw new Error(
      'Storage belum dikonfigurasi (S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY).',
    );
  }
  const e = process.env;
  const key = REQUIRED.map((k) => e[k]).join('\n') + (e.S3_REGION ?? '');
  if (g.__makuroStorage?.key !== key) {
    g.__makuroStorage = {
      key,
      client: new Bun.S3Client({
        endpoint: e.S3_ENDPOINT,
        bucket: e.S3_BUCKET,
        accessKeyId: e.S3_ACCESS_KEY_ID,
        secretAccessKey: e.S3_SECRET_ACCESS_KEY,
        region: e.S3_REGION || 'us-east-1',
      }),
    };
  }
  return g.__makuroStorage.client;
}
