import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import { FiDatabase, FiHome, FiList, FiLogIn, FiShield, FiUsers } from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavItem } from '~/components/AppFrame';
import type { AppContext } from '~/lib/app-context';
import type { Route } from './+types/layout';

const NAV: NavItem[] = [
  { to: '/dev', label: 'Users', icon: FiUsers },
  { to: '/dev/db-schema', label: 'DB Schema', icon: FiDatabase },
  { to: '/dev/visits', label: 'Visits', icon: FiList },
  { to: '/dev/login-logs', label: 'Login Logs', icon: FiLogIn },
  { to: '/dev/rate-limit-logs', label: 'Rate Limits', icon: FiShield },
];
const OTHER: NavItem[] = [{ to: '/dashboard', label: 'Dashboard', icon: FiHome }];

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireRole(request, ROLES.SUPER_ADMIN);
  return { ...auth, collapsed: getSidebarCollapsed(request) };
}

export default function SuperLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  return (
    <AppFrame
      navItems={NAV}
      secondaryNav={OTHER}
      role={loaderData.role}
      user={loaderData.user}
      badgeColor="grape"
      initialCollapsed={loaderData.collapsed}
    >
      <Outlet context={ctx} />
    </AppFrame>
  );
}
