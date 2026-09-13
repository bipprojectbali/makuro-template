import {
  ActionIcon,
  Badge,
  Divider,
  Indicator,
  NavLink,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { Link, useLocation } from 'react-router';
import { isNavActive, type NavGroup, type NavItem } from './nav';

type Props = { groups: NavGroup[]; collapsed: boolean; onNavigate?: () => void };

const nf = new Intl.NumberFormat('id-ID');

function CountBadge({ item }: { item: NavItem }) {
  if (!item.badge) return null;
  return (
    <Tooltip label={item.badge.tooltip} withArrow disabled={!item.badge.tooltip}>
      <Badge
        size="sm"
        variant="filled"
        color={item.badge.color ?? 'red'}
        circle={item.badge.value < 10}
      >
        {item.badge.value > 99 ? '99+' : nf.format(item.badge.value)}
      </Badge>
    </Tooltip>
  );
}

function CollapsedItem({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const icon = (
    <ActionIcon
      component={Link}
      to={item.to}
      onClick={onNavigate}
      variant={active ? 'light' : 'subtle'}
      color={active ? undefined : 'gray'}
      size="lg"
      mx="auto"
      display="block"
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <item.icon size={18} />
    </ActionIcon>
  );
  return (
    <Tooltip
      label={
        item.badge
          ? `${item.label} · ${nf.format(item.badge.value)}`
          : (item.description ?? item.label)
      }
      position="right"
      withArrow
    >
      <div>
        {item.badge ? (
          <Indicator
            color={item.badge.color ?? 'red'}
            size={8}
            offset={6}
            processing={item.badge.value > 0}
          >
            {icon}
          </Indicator>
        ) : (
          icon
        )}
      </div>
    </Tooltip>
  );
}

/** Grouped sidebar navigation; icon-only with tooltips when collapsed. */
export function NavList({ groups, collapsed, onNavigate }: Props) {
  const { pathname } = useLocation();
  return (
    <Stack gap={collapsed ? 'xs' : 'md'} component="nav" aria-label="Navigasi utama">
      {groups.map((g, gi) => (
        <div key={g.label ?? `group-${gi}`}>
          {collapsed
            ? gi > 0 && <Divider mb="xs" />
            : g.label && (
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.4} px="xs" mb={4}>
                  {g.label}
                </Text>
              )}
          <Stack gap={collapsed ? 6 : 2}>
            {g.items.map((item) => {
              const active = isNavActive(pathname, item);
              return collapsed ? (
                <CollapsedItem key={item.to} item={item} active={active} onNavigate={onNavigate} />
              ) : (
                <NavLink
                  key={item.to}
                  component={Link}
                  to={item.to}
                  label={item.label}
                  description={undefined}
                  title={item.description}
                  leftSection={<item.icon size={18} />}
                  rightSection={<CountBadge item={item} />}
                  active={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={onNavigate}
                  variant="light"
                  fw={active ? 600 : 500}
                  style={{ borderRadius: 'var(--mantine-radius-md)' }}
                />
              );
            })}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}
