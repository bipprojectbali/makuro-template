/** Point the test run at a dedicated bucket so tests never touch dev objects (env-free: runs in the test preload). */
import { ensureBucket } from '../storage/bucket';
import { applyStorageEnv } from './boot';
import { currentS3Platform, isLocalStorageMode, localS3Bucket, localS3Endpoint } from './paths';
import { ensureS3Runtime } from './runtime';
import { readKeys, s3Healthy, startLocalS3 } from './server';

/** Local mode: reuse a running RustFS (e.g. `bun dev`, same LOCAL_S3_DIR) or start one, then use `<bucket>-test`. */
async function localTestTarget() {
  const endpoint = localS3Endpoint();
  const reuse = async () => {
    const keys = await readKeys();
    if (!keys) {
      throw new Error(
        `RustFS di ${endpoint} bukan milik LOCAL_S3_DIR ini (keys.json tidak ada) — set LOCAL_S3_PORT lain.`,
      );
    }
    return { endpoint, ...keys };
  };
  if (await s3Healthy(endpoint)) return reuse();
  await ensureS3Runtime({ onProgress: (m) => console.warn(`[local-s3] ${m}`) });
  // Stopped by the preload's afterAll (bun test emits no 'exit'). A parallel test process may win the race for the port: reuse it then.
  return startLocalS3().catch(async (err) => {
    if (await s3Healthy(endpoint)) return reuse();
    throw err;
  });
}

/** Fill S3_* for tests (fail-soft: storage tests then fail with a clear 503 instead of the whole run). */
export async function prepareTestStorage(): Promise<void> {
  if (!isLocalStorageMode()) {
    if (process.env.S3_BUCKET_TEST) process.env.S3_BUCKET = process.env.S3_BUCKET_TEST;
    return;
  }
  try {
    if (!currentS3Platform()) throw new Error('platform tidak didukung RustFS');
    const { endpoint, accessKeyId, secretAccessKey } = await localTestTarget();
    const target = { endpoint, accessKeyId, secretAccessKey, bucket: `${localS3Bucket()}-test` };
    await ensureBucket(target);
    applyStorageEnv(target);
  } catch (err) {
    console.warn(
      `[local-s3] storage test nonaktif: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
