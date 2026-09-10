import {
  ActionIcon,
  AppShell,
  Badge,
  Burger,
  Button,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { Role } from '@server/permissions';
import { type ReactNode, useState } from 'react';
import type { IconType } from 'react-icons';
import { FiCornerUpLeft, FiZap } from 'react-icons/fi';
import { TbLayoutSidebarLeftCollapse, TbLayoutSidebarLeftExpand } from 'react-icons/tb';
import { Link, useLocation } from 'react-router';
import type { AppUser } from '~/lib/app-context';
import { authClient, useSession } from '~/lib/auth-client';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export type NavItem = { to: string; label: string; icon: IconType };

// Written to cookie so the server can read it on next request (no SSR flash).
const COOKIE = 'mk-sidebar-collapsed';

type Props = {
  navItems: NavItem[];
  role: Role;
  user: AppUser;
  badgeColor: string;
  children: ReactNode;
  /** Cross-area links ("other apps"), pinned below primary nav. */
  secondaryNav?: NavItem[];
  /**
   * Server-resolved initial collapsed state (read from cookie in the layout
   * loader). Lets the server render the correct sidebar width immediately,
   * preventing the expand→collapse flash on hard reload.
   */
  initialCollapsed?: boolean;
};

/**
 * Sidebar-only shell shared by every per-role area layout. No top header. Two
 * nav layers: the page's primary menus scroll in the grow section; cross-area
 * links sit pinned above the footer. Collapse state is stored in a cookie so
 * the server knows the preference and renders the correct width server-side.
 */
export function AppFrame({
  navItems,
  role,
  user,
  badgeColor,
  children,
  secondaryNav,
  initialCollapsed = false,
}: Props) {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  // Initialized from server-resolved value — no useEffect needed, no flash.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const { pathname } = useLocation();
  const { data } = useSession();
  const impersonating = Boolean(
    (data?.session as { impersonatedBy?: string } | undefined)?.impersonatedBy,
  );
  const secondary = secondaryNav ?? [];
  const homePath = navItems[0]?.to ?? '/';
  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      // Cookie persists across hard reloads; server reads it in layout loaders.
      // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is async/Promise-based; document.cookie is intentional for synchronous set.
      document.cookie = `${COOKIE}=${next ? '1' : '0'};path=/;max-age=${365 * 24 * 3600};SameSite=Lax`;
      return next;
    });
  }

  async function stopImpersonating() {
    await authClient.admin.stopImpersonating();
    window.location.assign('/go');
  }

  const renderItem = (item: NavItem) =>
    collapsed ? (
      <Tooltip key={item.to} label={item.label} position="right" withArrow>
        <ActionIcon
          component={Link}
          to={item.to}
          onClick={closeMobile}
          variant={isActive(item.to) ? 'light' : 'subtle'}
          color={isActive(item.to) ? undefined : 'gray'}
          size="lg"
          mx="auto"
          display="block"
          mb={6}
          aria-label={item.label}
        >
          <item.icon size={18} />
        </ActionIcon>
      </Tooltip>
    ) : (
      <NavLink
        key={item.to}
        component={Link}
        to={item.to}
        label={item.label}
        leftSection={<item.icon size={18} />}
        active={isActive(item.to)}
        onClick={closeMobile}
      />
    );

  return (
    <AppShell
      navbar={{
        width: collapsed ? 72 : 240,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="md"
    >
      <Burger
        opened={mobileOpened}
        onClick={toggleMobile}
        hiddenFrom="sm"
        size="sm"
        pos="fixed"
        top={12}
        left={12}
        style={{ zIndex: 200 }}
        aria-label="Toggle navigation"
      />

      <AppShell.Navbar p="sm">
        <AppShell.Section>
          <Group justify={collapsed ? 'center' : 'space-between'} wrap="nowrap" gap="xs">
            {!collapsed && (
              <Link to={homePath} style={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
                <Group gap={8} wrap="nowrap">
                  <FiZap size={20} />
                  <Text fw={700} size="lg">
                    Makuro
                  </Text>
                </Group>
              </Link>
            )}
            <Tooltip
              label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              position="right"
              withArrow
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={toggleCollapsed}
                aria-label="Toggle sidebar"
              >
                {collapsed ? (
                  <TbLayoutSidebarLeftExpand size={20} />
                ) : (
                  <TbLayoutSidebarLeftCollapse size={20} />
                )}
              </ActionIcon>
            </Tooltip>
          </Group>
        </AppShell.Section>

        {impersonating && (
          <AppShell.Section mt="xs">
            {collapsed ? (
              <Tooltip label="Stop impersonating" position="right" withArrow>
                <ActionIcon
                  variant="light"
                  color="orange"
                  size="lg"
                  mx="auto"
                  display="block"
                  onClick={stopImpersonating}
                  aria-label="Stop impersonating"
                >
                  <FiCornerUpLeft size={18} />
                </ActionIcon>
              </Tooltip>
            ) : (
              <Button
                fullWidth
                size="xs"
                variant="light"
                color="orange"
                leftSection={<FiCornerUpLeft size={16} />}
                onClick={stopImpersonating}
              >
                Stop impersonating
              </Button>
            )}
          </AppShell.Section>
        )}

        <AppShell.Section grow my="md" component={ScrollArea}>
          {navItems.map(renderItem)}
          {!collapsed && (
            <Badge mt="md" variant="light" color={badgeColor}>
              {role}
            </Badge>
          )}
        </AppShell.Section>

        {secondary.length > 0 && (
          <AppShell.Section mb="sm">
            <Divider mb="xs" />
            {!collapsed && (
              <Text size="xs" c="dimmed" fw={500} mb={4} px="xs">
                Other apps
              </Text>
            )}
            {secondary.map(renderItem)}
          </AppShell.Section>
        )}

        <AppShell.Section mb="sm">
          <ThemeToggle collapsed={collapsed} />
        </AppShell.Section>

        <AppShell.Section>
          <UserMenu user={user} collapsed={collapsed} />
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
