/** Ban state helpers shared by guards, the /banned page and the API. Pure — no DB. */

export type BanFields = {
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
};

export type BanInfo = {
  active: boolean;
  permanent: boolean;
  reason: string | null;
  /** ISO timestamp when a temporary ban lifts; null when permanent or not banned. */
  until: string | null;
};

/** Better Auth's placeholder when an admin banned without giving a reason. */
const NO_REASON_PLACEHOLDER = 'No reason';

/** Banned and (no expiry, or expiry still in the future). Expired bans are treated as lifted. */
export function isBanActive(u: BanFields | null | undefined, now = Date.now()): boolean {
  if (!u?.banned) return false;
  if (!u.banExpires) return true;
  return new Date(u.banExpires).getTime() > now;
}

export function describeBan(u: BanFields | null | undefined, now = Date.now()): BanInfo {
  const active = isBanActive(u, now);
  const reason = u?.banReason?.trim();
  return {
    active,
    permanent: active && !u?.banExpires,
    reason: reason && reason !== NO_REASON_PLACEHOLDER ? reason : null,
    until: active && u?.banExpires ? new Date(u.banExpires).toISOString() : null,
  };
}
