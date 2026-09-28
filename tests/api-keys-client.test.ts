import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import {
  buildKeyQuery,
  DEFAULT_KEY_FILTERS,
  daysUntil,
  deleteApiKey,
  fetchApiKey,
  hasActiveKeyFilters,
  maskedKey,
  rateLimitLabel,
} from '../app/lib/api-keys-api';
import {
  buildUsageQuery,
  DEFAULT_USAGE_FILTERS,
  hasActiveUsageFilters,
  statusClass,
  usageExportUrl,
} from '../app/lib/api-keys-usage-api';
import { fmtTokens } from '../app/lib/file-health-api';

describe('api-keys-api helpers', () => {
  it('builds a query with only the active filters', () => {
    expect(buildKeyQuery({ ...DEFAULT_KEY_FILTERS, page: 2, limit: 10 }).toString()).toBe(
      'page=2&limit=10',
    );
    const q = buildKeyQuery({ search: '  ci ', status: 'revoked', ownerId: 'u1', scope: 'mcp' });
    expect(Object.fromEntries(q)).toEqual({
      search: 'ci',
      status: 'revoked',
      ownerId: 'u1',
      scope: 'mcp',
    });
    expect(hasActiveKeyFilters(DEFAULT_KEY_FILTERS)).toBe(false);
    expect(hasActiveKeyFilters({ ...DEFAULT_KEY_FILTERS, search: '   ' })).toBe(false);
    expect(hasActiveKeyFilters({ ...DEFAULT_KEY_FILTERS, scope: 'mcp' })).toBe(true);
  });

  it('formats keys, expiry and rate limits for display', () => {
    expect(maskedKey({ start: 'mk_live_ab12', prefix: 'mk_live_' })).toBe('mk_live_ab12…');
    expect(maskedKey({ start: null, prefix: null })).toBe('mk_live_…');
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('2026-01-02T12:00:00Z', now)).toBe(2);
    expect(daysUntil('2025-12-31T00:00:00Z', now)).toBe(-1);
    expect(rateLimitLabel({ rateLimitMax: null, rateLimitTimeWindow: null })).toBe(
      'Tanpa batas khusus',
    );
    expect(rateLimitLabel({ rateLimitMax: 60, rateLimitTimeWindow: 30_000 })).toBe(
      '60 req / 30 dtk',
    );
    expect(rateLimitLabel({ rateLimitMax: 600, rateLimitTimeWindow: 60_000 })).toBe(
      '600 req / 1 mnt',
    );
    expect(rateLimitLabel({ rateLimitMax: 5000, rateLimitTimeWindow: 7_200_000 })).toBe(
      '5000 req / 2 jam',
    );
  });
});

describe('api-keys-api request errors', () => {
  let spy: ReturnType<typeof spyOn> | undefined;
  afterEach(() => spy?.mockRestore());
  const respond = (res: Response) => {
    spy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () => res) as unknown as typeof fetch,
    );
  };

  it('surfaces the server error message', async () => {
    respond(Response.json({ error: 'Key tidak ditemukan' }, { status: 404 }));
    await expect(fetchApiKey('a/b')).rejects.toThrow('Key tidak ditemukan');
    expect(spy?.mock.calls[0][0]).toBe('/api/api-keys/a%2Fb');
  });

  it('falls back to message, then to a generic method/url/status text', async () => {
    respond(Response.json({ message: 'Rate limit' }, { status: 429 }));
    await expect(fetchApiKey('k')).rejects.toThrow('Rate limit');
    spy?.mockRestore();
    respond(new Response('<html>502</html>', { status: 502 }));
    await expect(deleteApiKey('k')).rejects.toThrow('DELETE /api/api-keys/k gagal (502)');
  });
});

describe('api-keys-usage-api helpers', () => {
  it('builds the list and export query from filters', () => {
    expect(buildUsageQuery(DEFAULT_USAGE_FILTERS).toString()).toBe('days=7');
    const f = {
      ...DEFAULT_USAGE_FILTERS,
      keyId: 'k1',
      status: '5xx' as const,
      method: 'POST',
      search: ' /x ',
    };
    expect(Object.fromEntries(buildUsageQuery(f))).toEqual({
      keyId: 'k1',
      status: '5xx',
      method: 'POST',
      search: '/x',
      days: '7',
    });
    expect(usageExportUrl(DEFAULT_USAGE_FILTERS)).toBe('/api/api-keys/usage/export?days=7');
  });

  it('detects active filters, including a non-default window', () => {
    expect(hasActiveUsageFilters(DEFAULT_USAGE_FILTERS)).toBe(false);
    expect(hasActiveUsageFilters({ ...DEFAULT_USAGE_FILTERS, days: '30' })).toBe(true);
    expect(hasActiveUsageFilters({ ...DEFAULT_USAGE_FILTERS, method: 'GET' })).toBe(true);
  });

  it('classifies HTTP statuses', () => {
    expect([200, 304, 400, 499, 500, 503].map(statusClass)).toEqual([
      'ok',
      'ok',
      'client',
      'client',
      'server',
      'server',
    ]);
  });
});

describe('file-health-api fmtTokens', () => {
  it('keeps small counts and compacts thousands in id-ID', () => {
    expect(fmtTokens(999)).toBe('999');
    expect(fmtTokens(12_400)).toBe('12,4 rb');
    expect(fmtTokens(1000)).toBe('1 rb');
  });
});
