/** Client helpers for /profile: own login history + session/account display helpers. */
import { parseUserAgent } from '@server/middleware/visitor-ua';
import type { LoginRow } from './login-logs-api';
import { deviceLabel, deviceSummary } from './visits-format';

export type MyLogins = { rows: LoginRow[]; total: number };

export async function fetchMyLogins(limit = 10): Promise<MyLogins> {
  const res = await fetch(`/api/me/logins?limit=${limit}`);
  if (!res.ok) throw new Error(`Gagal memuat riwayat login (${res.status})`);
  return res.json();
}

/** Shape returned by authClient.listSessions(). */
export type DeviceSession = {
  id: string;
  token: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Shape returned by authClient.listAccounts(). */
export type LinkedAccount = {
  id: string;
  providerId: string;
  accountId?: string;
  createdAt?: string | Date;
};

/** "Chrome 125 · macOS 14 · Desktop" from a raw session user agent. */
export function describeSession(userAgent: string | null | undefined): {
  summary: string;
  device: string;
} {
  const p = parseUserAgent(userAgent ?? '');
  return { summary: deviceSummary(p), device: deviceLabel(p.deviceType) };
}

export function isCurrentSession(
  s: Pick<DeviceSession, 'token'>,
  currentToken: string | null | undefined,
): boolean {
  return Boolean(currentToken) && s.token === currentToken;
}

export function hasPasswordAccount(accounts: LinkedAccount[]): boolean {
  return accounts.some((a) => a.providerId === 'credential');
}

/** Provider display name. */
export function providerLabel(id: string): string {
  if (id === 'credential') return 'Email & password';
  return id.charAt(0).toUpperCase() + id.slice(1);
}
