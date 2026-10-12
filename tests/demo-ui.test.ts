import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { demoHoursLeft, demoNote, startDemo } from '../app/lib/demo-api';

const H = 3_600_000;
const created = new Date('2026-10-12T00:00:00Z');

describe('demoHoursLeft', () => {
  test('full TTL right after start', () => {
    expect(demoHoursLeft(created, 24, created.getTime())).toBe(24);
  });

  test('rounds partial hours up', () => {
    expect(demoHoursLeft(created, 24, created.getTime() + 23.5 * H)).toBe(1);
    expect(demoHoursLeft(created, 24, created.getTime() + 1)).toBe(24);
  });

  test('never negative after expiry', () => {
    expect(demoHoursLeft(created, 24, created.getTime() + 24 * H)).toBe(0);
    expect(demoHoursLeft(created, 24, created.getTime() + 48 * H)).toBe(0);
  });

  test('accepts ISO strings (serialized loader data)', () => {
    expect(demoHoursLeft(created.toISOString(), 2, created.getTime() + H)).toBe(1);
  });
});

test('demoNote states the TTL', () => {
  expect(demoNote(6)).toBe('Data demo dihapus otomatis dalam 6 jam');
});

describe('startDemo', () => {
  afterEach(() => {
    (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
  });

  test('returns the redirect on 200', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ redirect: '/app' }));
    expect(await startDemo()).toBe('/app');
  });

  test('throws the server error message', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        { error: 'Terlalu banyak percobaan demo.', code: 'DEMO_RATE_LIMITED' },
        { status: 429 },
      ),
    );
    await expect(startDemo()).rejects.toThrow('Terlalu banyak percobaan demo.');
  });

  test('falls back to a generic message on a non-JSON error', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(new Response('oops', { status: 500 }));
    await expect(startDemo()).rejects.toThrow('Gagal memulai demo');
  });
});
