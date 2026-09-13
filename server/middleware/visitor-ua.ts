/**
 * Lightweight User-Agent / Client Hints parser for visitor analytics.
 *
 * Written in-house on purpose: `ua-parser-js` 2.x moved to AGPLv3 (unsuitable
 * for proprietary apps built from this template) and the MIT alternatives
 * (bowser, detect-browser) have been unmaintained for years. We only need the
 * browser family, OS family, coarse versions and a device class — a handful
 * of regexes covers >95% of real traffic.
 *
 * Client Hints (`Sec-CH-UA-*`) are preferred when present because Chromium
 * freezes the OS version in the UA string.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot';

export type ParsedUserAgent = {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: DeviceType | null;
};

const EMPTY: ParsedUserAgent = {
  browser: null,
  browserVersion: null,
  os: null,
  osVersion: null,
  deviceType: null,
};

// Order matters: more specific brands first (Edge/Opera embed "Chrome").
const BROWSERS: Array<[string, RegExp]> = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+[\d.]*)/],
  ['Opera', /(?:OPR|Opera)\/(\d+[\d.]*)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+[\d.]*)/],
  ['Brave', /Brave\/(\d+[\d.]*)/],
  ['Vivaldi', /Vivaldi\/(\d+[\d.]*)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+[\d.]*)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+[\d.]*)/],
  ['Safari', /Version\/(\d+[\d.]*).*Safari/],
  ['Internet Explorer', /(?:MSIE |Trident\/.*rv:)(\d+[\d.]*)/],
];

const OSES: Array<[string, RegExp, ((m: RegExpMatchArray) => string | null)?]> = [
  ['iOS', /(?:iPhone|iPad|iPod).*?OS (\d+[_\d]*)/, (m) => m[1].replace(/_/g, '.')],
  ['Android', /Android (\d+[\d.]*)/],
  ['Windows', /Windows NT (\d+[\d.]*)/, (m) => WINDOWS_NT[m[1]] ?? m[1]],
  ['macOS', /Mac OS X (\d+[_\d.]*)/, (m) => m[1].replace(/_/g, '.')],
  ['Chrome OS', /CrOS [^ ]+ (\d+[\d.]*)/],
  ['Linux', /Linux/],
];

// Marketing names for Windows NT kernel versions.
const WINDOWS_NT: Record<string, string> = {
  '10.0': '10/11',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7',
};

/** Short version: keep at most major.minor (e.g. "125.0.6422.60" → "125.0"). */
function shortVersion(v: string | null | undefined): string | null {
  if (!v) return null;
  const parts = v.split('.').filter(Boolean);
  return parts.slice(0, 2).join('.') || null;
}

function detectDevice(ua: string, mobileHint: string | null): DeviceType {
  if (mobileHint === '?1') return 'mobile';
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return 'tablet';
  if (/Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|webOS|BlackBerry|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/** Map the `Sec-CH-UA-Platform` header ("macOS", "Windows", …) to our OS names. */
function osFromHint(platform: string | null): string | null {
  if (!platform) return null;
  const p = platform.replace(/"/g, '').trim();
  if (!p || p === 'Unknown') return null;
  return p === 'Chrome OS' ? 'Chrome OS' : p;
}

/**
 * Parse a User-Agent string (plus optional request headers for Client Hints)
 * into browser/OS/device fields. Bots get `deviceType: 'bot'` when `isBot` is
 * set so device breakdowns stay meaningful.
 */
export function parseUserAgent(
  ua: string | null | undefined,
  headers?: Headers | null,
  isBot = false,
): ParsedUserAgent {
  const raw = (ua ?? '').trim();
  if (!raw) return isBot ? { ...EMPTY, deviceType: 'bot' } : EMPTY;

  let browser: string | null = null;
  let browserVersion: string | null = null;
  for (const [name, re] of BROWSERS) {
    const m = raw.match(re);
    if (m) {
      browser = name;
      browserVersion = shortVersion(m[1]);
      break;
    }
  }

  let os: string | null = null;
  let osVersion: string | null = null;
  for (const [name, re, pick] of OSES) {
    const m = raw.match(re);
    if (m) {
      os = name;
      osVersion = shortVersion(pick ? pick(m) : m[1]);
      break;
    }
  }

  // Client Hints override the (often frozen) UA-derived platform.
  const hintOs = osFromHint(headers?.get('sec-ch-ua-platform') ?? null);
  if (hintOs) os = hintOs;
  const hintOsVersion = headers?.get('sec-ch-ua-platform-version')?.replace(/"/g, '') ?? null;
  if (hintOs && hintOsVersion) osVersion = shortVersion(hintOsVersion);

  const deviceType: DeviceType = isBot
    ? 'bot'
    : detectDevice(raw, headers?.get('sec-ch-ua-mobile') ?? null);

  return { browser, browserVersion, os, osVersion, deviceType };
}
