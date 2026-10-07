/** Boot-time glue: start the local RustFS, create the bucket, point S3_* at it (fail-soft: storage is optional). */
import { type BucketTarget, ensureBucket } from '../storage/bucket';
import { currentS3Platform, isLocalStorageMode, localS3Bucket, unsupportedMessage } from './paths';
import { ensureS3Runtime } from './runtime';
import { type LocalS3, startLocalS3, stopLocalS3 } from './server';

const g = globalThis as typeof globalThis & { __makuroLocalS3Signals?: boolean };

/** Point the shared storage client (`server/storage`) at `t`. */
export function applyStorageEnv(t: BucketTarget): void {
  process.env.S3_ENDPOINT = t.endpoint;
  process.env.S3_BUCKET = t.bucket;
  process.env.S3_ACCESS_KEY_ID = t.accessKeyId;
  process.env.S3_SECRET_ACCESS_KEY = t.secretAccessKey;
  process.env.S3_REGION = t.region ?? 'us-east-1';
}

/** Bucket target for a running local instance. */
export function localTarget(s3: LocalS3, bucket = localS3Bucket()): BucketTarget {
  const { endpoint, accessKeyId, secretAccessKey } = s3;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: 'us-east-1' };
}

/** Stop RustFS on SIGINT/SIGTERM unless someone (bootLocalPg) already handles them; its process.exit fires our exit hook. */
function handleSignals(): void {
  if (g.__makuroLocalS3Signals) return;
  g.__makuroLocalS3Signals = true;
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    if (process.listenerCount(sig) > 0) continue;
    process.once(sig, () => {
      stopLocalS3().then(
        () => process.exit(0),
        (err: unknown) => {
          console.error(`[local-s3] gagal menghentikan RustFS saat ${sig}:`, err);
          process.exit(1);
        },
      );
    });
  }
}

/**
 * In local mode (no S3_ENDPOINT): start RustFS, ensure the bucket, fill S3_*. `install` downloads the runtime when missing.
 * Never throws: on failure it warns and leaves storage disabled so the app still boots.
 */
export async function bootLocalStorage(opts: { install?: boolean } = {}): Promise<boolean> {
  if (!isLocalStorageMode()) return false;
  try {
    if (!currentS3Platform()) throw new Error(unsupportedMessage());
    if (opts.install) await ensureS3Runtime({ onProgress: (m) => console.log(`[local-s3] ${m}`) });
    const s3 = await startLocalS3();
    const target = localTarget(s3);
    await ensureBucket(target);
    applyStorageEnv(target);
    handleSignals();
    return true;
  } catch (err) {
    await stopLocalS3().catch((stopErr: unknown) =>
      console.error('[local-s3] gagal menghentikan RustFS:', stopErr),
    );
    console.warn(
      `[local-s3] storage nonaktif: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}
