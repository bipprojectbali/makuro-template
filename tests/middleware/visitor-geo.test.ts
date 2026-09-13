import { describe, expect, it } from 'bun:test';
import {
  normalizeCountry,
  primaryLanguage,
  resolveGeo,
  sanitizeReferer,
} from '../../server/middleware/visitor-geo';

describe('resolveGeo', () => {
  it('reads Cloudflare headers', () => {
    const h = new Headers({ 'cf-ipcountry': 'id', 'cf-region-code': 'JK', 'cf-ipcity': 'Jakarta' });
    expect(resolveGeo(h)).toEqual({ country: 'ID', region: 'JK', city: 'Jakarta' });
  });

  it('reads Vercel headers and decodes the percent-encoded city', () => {
    const h = new Headers({
      'x-vercel-ip-country': 'BR',
      'x-vercel-ip-country-region': 'SP',
      'x-vercel-ip-city': 'S%C3%A3o%20Paulo',
    });
    expect(resolveGeo(h)).toEqual({ country: 'BR', region: 'SP', city: 'São Paulo' });
  });

  it('reads CloudFront and nginx-style headers', () => {
    expect(resolveGeo(new Headers({ 'cloudfront-viewer-country': 'SG' })).country).toBe('SG');
    expect(resolveGeo(new Headers({ 'x-country-code': 'JP', 'x-city': 'Tokyo' })).city).toBe(
      'Tokyo',
    );
  });

  it('returns nulls when no proxy header is present', () => {
    expect(resolveGeo(new Headers())).toEqual({ country: null, region: null, city: null });
  });
});

describe('normalizeCountry', () => {
  it('upper-cases valid codes', () => {
    expect(normalizeCountry('us')).toBe('US');
  });

  it('drops Cloudflare sentinels and malformed values', () => {
    expect(normalizeCountry('XX')).toBeNull();
    expect(normalizeCountry('T1')).toBeNull();
    expect(normalizeCountry('USA')).toBeNull();
    expect(normalizeCountry('')).toBeNull();
    expect(normalizeCountry(null)).toBeNull();
  });
});

describe('primaryLanguage', () => {
  it('returns the first tag without quality weight', () => {
    expect(primaryLanguage('id-ID,id;q=0.9,en;q=0.8')).toBe('id-ID');
    expect(primaryLanguage('en')).toBe('en');
  });

  it('returns null for wildcard or missing header', () => {
    expect(primaryLanguage('*')).toBeNull();
    expect(primaryLanguage(null)).toBeNull();
  });
});

describe('sanitizeReferer', () => {
  it('strips the query string and fragment', () => {
    expect(sanitizeReferer('https://google.com/search?q=secret#x')).toBe(
      'https://google.com/search',
    );
  });

  it('returns null for non-URL values', () => {
    expect(sanitizeReferer('about:client')).toBeNull();
    expect(sanitizeReferer(null)).toBeNull();
  });
});
