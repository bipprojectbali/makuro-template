import { describe, expect, it } from 'bun:test';
import { storageChecks } from '../../server/cli/doctor.storage';

describe('doctor storage checks', () => {
  it('external mode reports missing S3_* by name only (never values) and never fails', async () => {
    const checks = await storageChecks({
      env: { S3_ENDPOINT: 'https://s3.example.com', S3_BUCKET: 'b' },
      cwd: '/tmp',
    });
    expect(checks.map((c) => c.name)).toEqual(['Mode', 'Konfigurasi']);
    expect(checks[1]).toMatchObject({ status: 'warn' });
    expect(checks[1]?.detail).toBe('belum di-set: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY');
  });

  it('external mode with every S3_* set is ok', async () => {
    const checks = await storageChecks({
      env: { S3_ENDPOINT: 'x', S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' },
      cwd: '/tmp',
    });
    expect(checks.every((c) => c.status === 'ok')).toBe(true);
    expect(JSON.stringify(checks)).not.toContain('"s"');
  });

  it('local mode lists runtime + data dir and stays warn-at-worst', async () => {
    const checks = await storageChecks({ env: {}, cwd: process.cwd() });
    expect(checks[0]).toMatchObject({ name: 'Mode', detail: 'RustFS lokal' });
    expect(checks.every((c) => c.group === 'Storage' && c.status !== 'fail')).toBe(true);
  });
});
