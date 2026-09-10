import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSidebarCollapsed } from '@server/sidebar';
import { FiUser } from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavItem } from '~/components/AppFrame';
import type { AppContext } from '~/lib/app-context';
import type { Route } from './+types/layout';

const NAV: NavItem[] = [{ to: '/profile', label: 'Profile', icon: FiUser }];

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireRole(request, ROLES.USER);
  return { ...auth, collapsed: getSidebarCollapsed(request) };
}

export default function UserLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  return (
    <AppFrame
      navItems={NAV}
      role={loaderData.role}
      user={loaderData.user}
      badgeColor="gray"
      initialCollapsed={loaderData.collapsed}
    >
      <Outlet context={ctx} />
    </AppFrame>
  );
}
