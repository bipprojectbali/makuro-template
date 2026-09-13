import { countRateLimitLastHour } from '@server/api/analytics-ratelimits.stats.query';
import { frameInfo } from '@server/app-info';
import { scanFileHealth } from '@server/file-health/file-health.scan';
import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import {
  FiDatabase,
  FiFileText,
  FiGrid,
  FiHome,
  FiList,
  FiLogIn,
  FiSettings,
  FiShield,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavBadge, type NavGroup, type NavItem } from '~/components/AppFrame';
import type { AppContext } from '~/lib/app-context';
import type { Route } from './+types/layout';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Dev Console — Makuro' }];
}

const NAV: NavGroup[] = [
  {
    items: [
      { to: '/dev', label: 'Overview', icon: FiGrid, description: 'Ringkasan kondisi aplikasi' },
    ],
  },
  {
    label: 'Kelola',
    items: [
      {
        to: '/dev/users',
        label: 'Users',
        icon: FiUsers,
        description: 'Daftar user, role, ban, impersonasi',
      },
      {
        to: '/dev/db-schema',
        label: 'DB Schema',
        icon: FiDatabase,
        description: 'Diagram tabel dan relasi',
      },
    ],
  },
  {
    label: 'Log & monitoring',
    items: [
      {
        to: '/dev/visits',
        label: 'Visitor Logs',
        icon: FiList,
        description: 'Kunjungan halaman, lokasi, perangkat',
      },
      {
        to: '/dev/login-logs',
        label: 'Login Logs',
        icon: FiLogIn,
        description: 'Siapa masuk, lewat apa, dari mana',
      },
      {
        to: '/dev/rate-limit-logs',
        label: 'Rate Limits',
        icon: FiShield,
        description: 'Request yang ditolak limiter',
      },
      {
        to: '/dev/file-health',
        label: 'File Health',
        icon: FiFileText,
        description: 'Ukuran file vs limit, risiko konteks agent',
      },
    ],
  },
  {
    label: 'Konfigurasi',
    items: [
      {
        to: '/dev/settings',
        label: 'Settings',
        icon: FiSettings,
        description: 'Autentikasi, rate limit, runtime',
      },
    ],
  },
];
const OTHER: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: FiHome },
  { to: '/profile', label: 'Profile', icon: FiUser },
];

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireRole(request, ROLES.SUPER_ADMIN);
  // Sidebar counters — cheap aggregates, failures must not break navigation.
  const [blockedLastHour, filesOver] = await Promise.all([
    countRateLimitLastHour().catch(() => 0),
    scanFileHealth()
      .then((r) => r.summary.over)
      .catch(() => 0),
  ]);
  const navBadges: Record<string, NavBadge> = {
    '/dev/rate-limit-logs': {
      value: blockedLastHour,
      color: 'red',
      tooltip: `${blockedLastHour} request diblokir dalam 1 jam terakhir`,
    },
    '/dev/file-health': {
      value: filesOver,
      color: 'yellow',
      tooltip: `${filesOver} file melewati limit baris`,
    },
  };
  return { ...auth, collapsed: getSidebarCollapsed(request), navBadges, ...frameInfo() };
}

export default function SuperLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  return (
    <AppFrame
      navItems={NAV}
      secondaryNav={OTHER}
      navBadges={loaderData.navBadges}
      consoleLabel="Dev Console"
      env={loaderData.env}
      version={loaderData.version}
      role={loaderData.role}
      user={loaderData.user}
      badgeColor="grape"
      initialCollapsed={loaderData.collapsed}
    >
      <Outlet context={ctx} />
    </AppFrame>
  );
}
