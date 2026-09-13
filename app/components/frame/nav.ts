/** Sidebar navigation model — pure helpers, no React (unit-tested in tests/frame-nav.test.ts). */
import type { IconType } from 'react-icons';

export type NavBadge = { value: number; color?: string; tooltip?: string };

export type NavItem = {
  to: string;
  label: string;
  icon: IconType;
  /** Shown as a tooltip in the collapsed sidebar and as a title in the expanded one. */
  description?: string;
  /** Match child routes too (e.g. "/dev/users" keeps "/dev/users/:id" active). Default: exact. */
  matchPrefix?: boolean;
  badge?: NavBadge;
};

export type NavGroup = { label?: string; items: NavItem[] };

/** Accept either a flat list (single unlabeled group) or explicit groups. */
export function normalizeNav(nav: NavItem[] | NavGroup[] | undefined): NavGroup[] {
  if (!nav || nav.length === 0) return [];
  const first = nav[0] as NavItem | NavGroup;
  if ('items' in first) return (nav as NavGroup[]).filter((g) => g.items.length > 0);
  return [{ items: nav as NavItem[] }];
}

export function isNavActive(pathname: string, item: Pick<NavItem, 'to' | 'matchPrefix'>): boolean {
  if (pathname === item.to) return true;
  return Boolean(item.matchPrefix) && pathname.startsWith(`${item.to.replace(/\/$/, '')}/`);
}

/** Attach live badge values (keyed by route) to a nav definition without mutating it. */
export function withBadges(
  groups: NavGroup[],
  badges: Record<string, NavBadge> | undefined,
): NavGroup[] {
  if (!badges) return groups;
  return groups.map((g) => ({
    ...g,
    items: g.items.map((it) =>
      badges[it.to] && badges[it.to].value > 0 ? { ...it, badge: badges[it.to] } : it,
    ),
  }));
}

/** First route in the nav — used as the brand link target. */
export function homePath(groups: NavGroup[], fallback = '/'): string {
  return groups[0]?.items[0]?.to ?? fallback;
}
