import { frameInfo } from '@server/app-info';
import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import { devSidebarBadges } from '@server/sidebar-badges';
import {
  FiClipboard,
  FiDatabase,
  FiEdit3,
  FiFileText,
  FiGrid,
  FiHome,
  FiKey,
  FiList,
  FiLogIn,
  FiMonitor,
  FiSettings,
  FiShield,
  FiTerminal,
  FiTool,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavGroup, type NavItem } from '~/components/AppFrame';
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
        to: '/dev/sessions',
        label: 'Sessions',
        icon: FiMonitor,
        description: 'Perangkat yang sedang masuk, cabut sesi',
      },
      {
        to: '/dev/posts',
        label: 'Posts',
        icon: FiEdit3,
        description: 'Konten contoh: buat, edit, moderasi',
      },
      {
        to: '/dev/api-keys',
        label: 'API Keys',
        icon: FiKey,
        description: 'Kunci akses API: scope, rotasi, pemakaian',
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
        to: '/dev/server-logs',
        label: 'Server Logs',
        icon: FiTerminal,
        description: 'Error dan warning proses server',
      },
      {
        to: '/dev/audit',
        label: 'Audit Log',
        icon: FiClipboard,
        description: 'Jejak aksi admin: role, ban, settings, purge',
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
    label: 'Tools',
    items: [
      {
        to: '/dev/tools',
        label: 'Tools & MCP',
        icon: FiTool,
        description: 'Akses agent, status proses, reset cache',
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
  // Sidebar counters — cached briefly server-side, every source fails soft.
  const navBadges = await devSidebarBadges();
  return { ...auth, collapsed: getSidebarCollapsed(request), navBadges, ...(await frameInfo()) };
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
      branding={loaderData.branding}
      maintenance={loaderData.maintenance}
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
