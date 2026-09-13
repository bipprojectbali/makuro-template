/** Pure display helpers for visitor logs (no React) — unit-tested in tests/visits-format.test.ts. */

const LOCALE = 'id-ID';

const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const relativeFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

/** "13 Sep 2026, 08.25.48" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

/** "baru saja", "5 menit yang lalu", "kemarin", … relative to `now`. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffSec = Math.round((t - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'baru saja';
  if (abs < 3600) return relativeFmt.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400) return relativeFmt.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 30 * 86_400) return relativeFmt.format(Math.round(diffSec / 86_400), 'day');
  return formatDateTime(iso);
}

/** ISO 3166-1 alpha-2 → regional indicator emoji ("ID" → 🇮🇩). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

let regionNames: Intl.DisplayNames | null = null;
/** "ID" → "Indonesia" (localized); falls back to the code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return 'Tidak diketahui';
  try {
    regionNames ??= new Intl.DisplayNames([LOCALE], { type: 'region' });
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    // Intl.DisplayNames unsupported or invalid code — the raw code is still informative.
    return code;
  }
}

/** Loopback / RFC1918 / link-local addresses — the visitor is on the same machine or LAN. */
export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return /^f[cd][0-9a-f]{2}:/i.test(ip) || /^fe80:/i.test(ip);
}

/** Location label for a row: "Jakarta, Indonesia" / "Indonesia" / "Lokal" / "Tidak diketahui". */
export function locationLabel(row: {
  country: string | null;
  city: string | null;
  ip: string | null;
}): string {
  if (row.country) {
    const name = countryName(row.country);
    return row.city ? `${row.city}, ${name}` : name;
  }
  return isPrivateIp(row.ip) ? 'Lokal' : 'Tidak diketahui';
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: 'Desktop',
  mobile: 'Mobile',
  tablet: 'Tablet',
  bot: 'Bot',
};

export function deviceLabel(type: string | null | undefined): string {
  return (type && DEVICE_LABELS[type]) ?? 'Tidak diketahui';
}

/** "Chrome 125.0 · macOS 10.15" — omits missing parts. */
export function deviceSummary(row: {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
}): string {
  const b = row.browser ? [row.browser, row.browserVersion].filter(Boolean).join(' ') : '';
  const o = row.os ? [row.os, row.osVersion].filter(Boolean).join(' ') : '';
  return [b, o].filter(Boolean).join(' · ') || 'Tidak dikenali';
}

/** "search:google" → "Search · Google"; "ai:anthropic" → "AI · Anthropic". */
export function botKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'Bot';
  const [group, name] = kind.split(':');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const groupLabel = group === 'ai' ? 'AI' : group === 'seo-crawler' ? 'SEO crawler' : cap(group);
  return name ? `${groupLabel} · ${cap(name)}` : groupLabel;
}

/** Referer host for compact display: "https://google.com/search" → "google.com". */
export function refererHost(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host || null;
  } catch {
    return referer;
  }
}

/** Percentage helper for breakdown bars (0–100, 1 decimal max). */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
