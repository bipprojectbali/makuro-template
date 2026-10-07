/** Create a bucket with one SigV4-signed request: Bun.S3Client has no bucket-level API (env-free). */
export type BucketTarget = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

const PAYLOAD = 'UNSIGNED-PAYLOAD';
const hmac = (key: string | Uint8Array, data: string) =>
  new Bun.CryptoHasher('sha256', key).update(data).digest() as Uint8Array;

/** Signed `PUT /<bucket>` (path-style). Exported for tests. */
export function createBucketRequest(t: BucketTarget, now = new Date()): Request {
  const region = t.region ?? 'us-east-1';
  const url = new URL(`/${encodeURIComponent(t.bucket)}`, t.endpoint);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers = { host: url.host, 'x-amz-content-sha256': PAYLOAD, 'x-amz-date': amzDate };
  const signed = Object.keys(headers).join(';');
  const canonical = [
    'PUT',
    url.pathname,
    '',
    ...Object.entries(headers).map(([k, v]) => `${k}:${v}`),
    '',
    signed,
    PAYLOAD,
  ].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    new Bun.CryptoHasher('sha256').update(canonical).digest('hex'),
  ].join('\n');
  let key = hmac(`AWS4${t.secretAccessKey}`, day);
  for (const part of [region, 's3', 'aws4_request']) key = hmac(key, part);
  const signature = Buffer.from(hmac(key, toSign)).toString('hex');
  return new Request(url, {
    method: 'PUT',
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${t.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    },
  });
}

/** Create the bucket if missing (idempotent: "already owned by you" counts as success). */
export async function ensureBucket(t: BucketTarget): Promise<void> {
  const res = await fetch(createBucketRequest(t));
  if (res.ok) return;
  const body = await res.text();
  const code = body.match(/<Code>(\w+)<\/Code>/)?.[1] ?? `HTTP ${res.status}`;
  if (code === 'BucketAlreadyOwnedByYou') return;
  throw new Error(`Gagal membuat bucket "${t.bucket}" di ${t.endpoint}: ${code}`);
}
