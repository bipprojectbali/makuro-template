/** SigV4 CreateBucket: stable signature for fixed input, and idempotent against the configured S3 server. */
import { describe, expect, test } from 'bun:test';
import { createBucketRequest, ensureBucket } from '../../server/storage/bucket';

describe('createBucketRequest', () => {
  test('signs a path-style PUT deterministically', () => {
    const r = createBucketRequest(
      {
        endpoint: 'http://127.0.0.1:9000',
        bucket: 'my-bucket',
        accessKeyId: 'AKIDEXAMPLE', // test-only
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', // test-only (AWS docs example)
      },
      new Date('2026-01-02T03:04:05.678Z'),
    );
    expect(r.method).toBe('PUT');
    expect(r.url).toBe('http://127.0.0.1:9000/my-bucket');
    expect(r.headers.get('x-amz-date')).toBe('20260102T030405Z');
    expect(r.headers.get('x-amz-content-sha256')).toBe('UNSIGNED-PAYLOAD');
    expect(r.headers.get('authorization')).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20260102/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=d9be0cb9690400f793d33fc65775d75a1cb977ab734402c31d7c440ec3d5f5b0',
    );
  });
});

describe('ensureBucket (live S3 server)', () => {
  const e = process.env;
  const target = {
    endpoint: e.S3_ENDPOINT as string,
    bucket: e.S3_BUCKET as string,
    accessKeyId: e.S3_ACCESS_KEY_ID as string,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY as string,
    region: e.S3_REGION,
  };

  test('creating twice succeeds; wrong secret fails with context', async () => {
    await ensureBucket(target);
    await ensureBucket(target);
    await expect(ensureBucket({ ...target, secretAccessKey: 'wrong-secret' })).rejects.toThrow(
      /Gagal membuat bucket/,
    );
  });
});
