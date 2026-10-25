import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { demoHoursLeft, demoNote, roleLabel, startDemo } from '../app/lib/demo-api';

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

describe('roleLabel', () => {
  test('capitalises a single-segment role', () => {
    expect(roleLabel('user')).toBe('User');
    expect(roleLabel('admin')).toBe('Admin');
  });

  test('splits hyphenated roles into words', () => {
    expect(roleLabel('super-admin')).toBe('Super Admin');
  });

  test('is a transformation, not a lookup table (unknown roles still render)', () => {
    expect(roleLabel('content-review-lead')).toBe('Content Review Lead');
  });
});

describe('startDemo', () => {
  afterEach(() => {
    (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
  });

  test('returns the redirect on 200', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ redirect: '/app' }));
    expect(await startDemo()).toBe('/app');
  });

  test('sends no body without a role, JSON body with one', async () => {
    const fetchMock = spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ redirect: '/app' }))
      .mockResolvedValueOnce(Response.json({ redirect: '/dashboard' }));
    await startDemo();
    const firstInit = fetchMock.mock.calls[0]?.[1] as unknown as RequestInit;
    expect(firstInit.body).toBeUndefined();

    expect(await startDemo('admin')).toBe('/dashboard');
    const init = fetchMock.mock.calls[1]?.[1] as unknown as RequestInit;
    expect(init.body).toBe('{"role":"admin"}');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
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
