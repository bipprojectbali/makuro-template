/**
 * Pure helpers for the account switcher (multiSession plugin). Shared between
 * server and client via the @server/* alias; no framework or IO here.
 */

export type DeviceSessionEntry = {
  session: { token: string };
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
};

export type AccountOption = {
  token: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  active: boolean;
};

/**
 * Map raw device sessions to display options, flag the one matching
 * activeToken, and list the active account first.
 */
export function toAccountOptions(
  sessions: DeviceSessionEntry[],
  activeToken: string | null | undefined,
): AccountOption[] {
  return sessions
    .map((entry) => ({
      token: entry.session.token,
      userId: entry.user.id,
      name: entry.user.name?.trim() || entry.user.email || 'Account',
      email: entry.user.email ?? '',
      image: entry.user.image ?? null,
      active: entry.session.token === activeToken,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));
}
