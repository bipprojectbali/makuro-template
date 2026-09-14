/** Ban helpers: active/expired/permanent, placeholder reason, ISO until. */
import { describe, expect, test } from 'bun:test';
import { describeBan, isBanActive } from '../server/ban';

const now = Date.parse('2026-09-14T10:00:00Z');

describe('isBanActive / describeBan', () => {
  test('not banned, expired ban, and null user are all inactive', () => {
    expect(isBanActive(null)).toBe(false);
    expect(isBanActive({ banned: false })).toBe(false);
    expect(isBanActive({ banned: true, banExpires: new Date(now - 1000) }, now)).toBe(false);
    expect(describeBan({ banned: true, banExpires: new Date(now - 1000) }, now).active).toBe(false);
  });
  test('permanent ban has no until and drops the placeholder reason', () => {
    const b = describeBan({ banned: true, banReason: 'No reason', banExpires: null }, now);
    expect(b).toEqual({ active: true, permanent: true, reason: null, until: null });
  });
  test('temporary ban exposes the lift time as ISO and the trimmed reason', () => {
    const until = new Date(now + 3 * 86_400_000);
    const b = describeBan(
      { banned: true, banReason: '  spam  ', banExpires: until.toISOString() },
      now,
    );
    expect(b.active).toBe(true);
    expect(b.permanent).toBe(false);
    expect(b.reason).toBe('spam');
    expect(b.until).toBe(until.toISOString());
  });
});
