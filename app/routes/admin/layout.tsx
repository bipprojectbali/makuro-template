import { requireAnyRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import { FiHome, FiUsers } from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavItem } from '~/components/AppFrame';
import type { AppContext } from '~/lib/app-context';
import type { Route } from './+types/layout';

const NAV: NavItem[] = [{ to: '/dashboard', label: 'Dashboard', icon: FiHome }];
const DEV: NavItem[] = [{ to: '/dev', label: 'Dev', icon: FiUsers }];

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireAnyRole(request, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
  return { ...auth, collapsed: getSidebarCollapsed(request) };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  const other = loaderData.role === ROLES.SUPER_ADMIN ? DEV : undefined;
  return (
    <AppFrame
      navItems={NAV}
      secondaryNav={other}
      role={loaderData.role}
      user={loaderData.user}
      badgeColor="blue"
      initialCollapsed={loaderData.collapsed}
    >
      <Outlet context={ctx} />
    </AppFrame>
  );
}
