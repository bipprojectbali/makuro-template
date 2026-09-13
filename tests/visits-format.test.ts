import { describe, expect, it } from 'bun:test';
import { buildVisitQuery, DEFAULT_FILTERS, hasActiveFilters } from '../app/lib/visits-api';
import {
  botKindLabel,
  countryFlag,
  countryName,
  deviceSummary,
  formatRelative,
  isPrivateIp,
  locationLabel,
  percent,
  refererHost,
} from '../app/lib/visits-format';

describe('visits-format', () => {
  it('formatRelative buckets by age', () => {
    const now = Date.parse('2026-09-13T08:00:00Z');
    const at = (sec: number) => new Date(now - sec * 1000).toISOString();
    expect(formatRelative(at(10), now)).toBe('baru saja');
    expect(formatRelative(at(5 * 60), now)).toContain('5 menit');
    expect(formatRelative(at(3 * 3600), now)).toContain('3 jam');
    expect(formatRelative(at(86_400), now)).toBe('kemarin');
    expect(formatRelative(at(60 * 86_400), now)).toContain('2026');
    expect(formatRelative('not-a-date', now)).toBe('—');
  });

  it('countryFlag builds regional indicator emoji', () => {
    expect(countryFlag('ID')).toBe('🇮🇩');
    expect(countryFlag('us')).toBe('🇺🇸');
    expect(countryFlag(null)).toBe('');
    expect(countryFlag('XXX')).toBe('');
  });

  it('countryName localizes and falls back', () => {
    expect(countryName('ID')).toBe('Indonesia');
    expect(countryName(null)).toBe('Tidak diketahui');
  });

  it('isPrivateIp recognizes loopback and RFC1918 ranges', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('172.16.3.4')).toBe(true);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp(null)).toBe(false);
  });

  it('locationLabel prefers city+country, then Lokal, then unknown', () => {
    expect(locationLabel({ country: 'ID', city: 'Jakarta', ip: '1.1.1.1' })).toBe(
      'Jakarta, Indonesia',
    );
    expect(locationLabel({ country: 'SG', city: null, ip: '1.1.1.1' })).toBe('Singapura');
    expect(locationLabel({ country: null, city: null, ip: '127.0.0.1' })).toBe('Lokal');
    expect(locationLabel({ country: null, city: null, ip: '8.8.8.8' })).toBe('Tidak diketahui');
  });

  it('deviceSummary and botKindLabel format compactly', () => {
    expect(
      deviceSummary({
        browser: 'Chrome',
        browserVersion: '125.0',
        os: 'macOS',
        osVersion: '10.15',
      }),
    ).toBe('Chrome 125.0 · macOS 10.15');
    expect(
      deviceSummary({ browser: null, browserVersion: null, os: 'Linux', osVersion: null }),
    ).toBe('Linux');
    expect(deviceSummary({ browser: null, browserVersion: null, os: null, osVersion: null })).toBe(
      'Tidak dikenali',
    );
    expect(botKindLabel('search:google')).toBe('Search · Google');
    expect(botKindLabel('ai:anthropic')).toBe('AI · Anthropic');
    expect(botKindLabel('monitor')).toBe('Monitor');
    expect(botKindLabel(null)).toBe('Bot');
  });

  it('refererHost and percent', () => {
    expect(refererHost('https://google.com/search')).toBe('google.com');
    expect(refererHost(null)).toBeNull();
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(1, 0)).toBe(0);
  });
});

describe('visits-api query builder', () => {
  it('omits default filters and maps period to days', () => {
    const q = buildVisitQuery({ ...DEFAULT_FILTERS, page: 2, limit: 25, sort: 'desc' });
    expect(q.toString()).toBe('page=2&limit=25&sort=desc');
    const q2 = buildVisitQuery({
      ...DEFAULT_FILTERS,
      type: 'bot',
      country: 'ID',
      period: '7',
      search: ' x ',
    });
    expect(q2.get('type')).toBe('bot');
    expect(q2.get('country')).toBe('ID');
    expect(q2.get('days')).toBe('7');
    expect(q2.get('search')).toBe('x');
  });

  it('hasActiveFilters detects any non-default value', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, device: 'mobile' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, search: '   ' })).toBe(false);
  });
});
