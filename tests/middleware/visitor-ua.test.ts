import { describe, expect, it } from 'bun:test';
import { parseUserAgent } from '../../server/middleware/visitor-ua';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.60 Safari/537.36';
const FIREFOX_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const EDGE_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80';
const CHROME_ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const CHROME_ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SAMSUNG =
  'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';

describe('parseUserAgent', () => {
  it('detects Chrome on macOS as desktop with short versions', () => {
    const r = parseUserAgent(CHROME_MAC);
    expect(r).toEqual({
      browser: 'Chrome',
      browserVersion: '125.0',
      os: 'macOS',
      osVersion: '10.15',
      deviceType: 'desktop',
    });
  });

  it('detects Firefox on Windows 10/11', () => {
    const r = parseUserAgent(FIREFOX_WIN);
    expect(r.browser).toBe('Firefox');
    expect(r.browserVersion).toBe('126.0');
    expect(r.os).toBe('Windows');
    expect(r.osVersion).toBe('10/11');
    expect(r.deviceType).toBe('desktop');
  });

  it('detects Safari on iPhone as mobile iOS', () => {
    const r = parseUserAgent(SAFARI_IPHONE);
    expect(r.browser).toBe('Safari');
    expect(r.browserVersion).toBe('17.4');
    expect(r.os).toBe('iOS');
    expect(r.osVersion).toBe('17.4');
    expect(r.deviceType).toBe('mobile');
  });

  it('prefers Edge over the embedded Chrome token', () => {
    expect(parseUserAgent(EDGE_WIN).browser).toBe('Edge');
  });

  it('prefers Samsung Internet over the embedded Chrome token', () => {
    expect(parseUserAgent(SAMSUNG).browser).toBe('Samsung Internet');
  });

  it('classifies Android phone vs tablet by the Mobile token', () => {
    expect(parseUserAgent(CHROME_ANDROID_PHONE).deviceType).toBe('mobile');
    expect(parseUserAgent(CHROME_ANDROID_TABLET).deviceType).toBe('tablet');
    expect(parseUserAgent(CHROME_ANDROID_PHONE).os).toBe('Android');
    expect(parseUserAgent(CHROME_ANDROID_PHONE).osVersion).toBe('14');
  });

  it('uses Client Hints for platform and mobile flag when present', () => {
    const headers = new Headers({
      'sec-ch-ua-platform': '"Windows"',
      'sec-ch-ua-platform-version': '"15.0.0"',
      'sec-ch-ua-mobile': '?1',
    });
    const r = parseUserAgent(CHROME_MAC, headers);
    expect(r.os).toBe('Windows');
    expect(r.osVersion).toBe('15.0');
    expect(r.deviceType).toBe('mobile');
  });

  it('ignores the Unknown platform hint', () => {
    const headers = new Headers({ 'sec-ch-ua-platform': '"Unknown"' });
    expect(parseUserAgent(CHROME_MAC, headers).os).toBe('macOS');
  });

  it('marks bots as device type bot regardless of UA', () => {
    const r = parseUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)', null, true);
    expect(r.deviceType).toBe('bot');
    expect(parseUserAgent('', null, true).deviceType).toBe('bot');
  });

  it('returns all-null for empty or unknown UA', () => {
    expect(parseUserAgent('')).toEqual({
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null,
      deviceType: null,
    });
    const r = parseUserAgent('curl/8.4.0');
    expect(r.browser).toBeNull();
    expect(r.os).toBeNull();
    expect(r.deviceType).toBe('desktop');
  });
});
