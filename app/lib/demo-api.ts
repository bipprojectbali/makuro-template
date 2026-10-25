/** Client for the public demo sandbox (/api/demo) plus pure display helpers. */

export type DemoStatus = { enabled: boolean; ttlHours: number; roles: string[] };

const HOUR_MS = 3_600_000;
const START_FALLBACK = 'Gagal memulai demo. Coba lagi beberapa saat lagi.';

export async function fetchDemoStatus(): Promise<DemoStatus> {
  const res = await fetch('/api/demo', { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Gagal memuat status demo (${res.status})`);
  return res.json() as Promise<DemoStatus>;
}

/**
 * Starts (or reuses) a demo session as `role` (server default when omitted);
 * resolves to the redirect path chosen by the server, throws the server's message.
 */
export async function startDemo(role?: string): Promise<string> {
  const res = await fetch('/api/demo/start', {
    method: 'POST',
    credentials: 'same-origin',
    ...(role
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role }) }
      : {}),
  });
  const body = (await res.json().catch(() => null)) as { redirect?: string; error?: string } | null;
  if (!res.ok || !body?.redirect) throw new Error(body?.error || START_FALLBACK);
  return body.redirect;
}

/** Whole hours until the demo account expires (rounded up, never negative). */
export function demoHoursLeft(
  createdAt: Date | string,
  ttlHours: number,
  now: number = Date.now(),
): number {
  const expiresAt = new Date(createdAt).getTime() + ttlHours * HOUR_MS;
  return Math.max(0, Math.ceil((expiresAt - now) / HOUR_MS));
}

export function demoNote(ttlHours: number): string {
  return `Data demo dihapus otomatis dalam ${ttlHours} jam`;
}

/**
 * Role id → label tombol ('super-admin' → 'Super Admin'). Transformasi, bukan peta,
 * supaya role baru dari server langsung tampil tanpa perlu memperbarui daftar di sini.
 */
export function roleLabel(role: string): string {
  return role
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
