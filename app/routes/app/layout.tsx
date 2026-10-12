import { frameInfo } from '@server/app-info';
import { requireUser } from '@server/guard';
import { effectiveDemoTtlHours, getDemo } from '@server/settings-demo';
import { getSidebarCollapsed } from '@server/sidebar';
import { FiGrid, FiHome, FiLayers, FiUser } from 'react-icons/fi';
import { Outlet } from 'react-router';
import { AppFrame, type NavItem } from '~/components/AppFrame';
import { AreaErrorBoundary } from '~/components/errors/AreaErrorBoundary';
import { DemoBanner } from '~/components/frame/DemoBanner';
import type { AppContext } from '~/lib/app-context';
import { demoHoursLeft } from '~/lib/demo-api';
import type { Route } from './+types/layout';

export function meta(_: Route.MetaArgs) {
  return [{ title: 'Makuro' }];
}

const NAV: NavItem[] = [
  { to: '/app', label: 'App', icon: FiLayers },
  { to: '/profile', label: 'Profile', icon: FiUser },
];

const SECONDARY_NAV: Record<string, NavItem[]> = {
  admin: [{ to: '/dashboard', label: 'Dashboard', icon: FiHome }],
  'super-admin': [
    { to: '/dev', label: 'Dev Console', icon: FiGrid },
    { to: '/dashboard', label: 'Dashboard', icon: FiHome },
  ],
};

const BADGE_COLOR: Record<string, string> = {
  user: 'gray',
  admin: 'blue',
  'super-admin': 'grape',
};

export async function loader({ request }: Route.LoaderArgs) {
  const auth = await requireUser(request);
  // Computed server-side so SSR and hydration agree on the hour shown.
  const demoLeft = auth.isDemo
    ? demoHoursLeft(auth.user.createdAt, effectiveDemoTtlHours(await getDemo()))
    : null;
  return { ...auth, demoLeft, collapsed: getSidebarCollapsed(request), ...(await frameInfo()) };
}

function Frame({
  data,
  children,
}: {
  data: Route.ComponentProps['loaderData'];
  children: React.ReactNode;
}) {
  return (
    <AppFrame
      navItems={NAV}
      secondaryNav={SECONDARY_NAV[data.role]}
      role={data.role}
      user={data.user}
      badgeColor={BADGE_COLOR[data.role] ?? 'gray'}
      consoleLabel="App"
      env={data.env}
      branding={data.branding}
      maintenance={data.maintenance}
      version={data.version}
      initialCollapsed={data.collapsed}
    >
      {data.demoLeft !== null && <DemoBanner hoursLeft={data.demoLeft} />}
      {children}
    </AppFrame>
  );
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const ctx: AppContext = { user: loaderData.user, role: loaderData.role };
  return (
    <Frame data={loaderData}>
      <Outlet context={ctx} />
    </Frame>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <AreaErrorBoundary error={error} homePath="/app" homeLabel="Ke app">
      {loaderData ? (node) => <Frame data={loaderData}>{node}</Frame> : undefined}
    </AreaErrorBoundary>
  );
}
