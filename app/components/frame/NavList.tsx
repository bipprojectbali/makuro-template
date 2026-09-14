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
const TOOLTIP_DELAY_MS = 400;

const badgeValue = (v: number) => (v > 999 ? '999+' : nf.format(v));

/** Filled + colored for alerts, quiet gray for informational counts. */
function CountBadge({ item }: { item: NavItem }) {
  const b = item.badge;
  if (!b) return null;
  const alert = b.tone !== 'info';
  return (
    <Badge
      size="sm"
      variant={alert ? 'filled' : 'light'}
      color={alert ? (b.color ?? 'red') : 'gray'}
      circle={b.value < 10}
      style={{ flexShrink: 0 }}
    >
      {badgeValue(b.value)}
    </Badge>
  );
}

/** Description + what the badge means; shown on hover in both sidebar modes. */
function itemHint(item: NavItem): React.ReactNode {
  const lines = [item.description, item.badge?.tooltip].filter(Boolean);
  if (lines.length === 0) return item.label;
  return (
    <Stack gap={2}>
      {lines.map((l) => (
        <Text key={l} size="xs" lh={1.3}>
          {l}
        </Text>
      ))}
    </Stack>
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
  const b = item.badge;
  const alert = b ? b.tone !== 'info' : false;
  const icon = (
    <ActionIcon
      component={Link}
      to={item.to}
      prefetch="intent"
      onClick={onNavigate}
      variant={active ? 'light' : 'subtle'}
      color={active ? undefined : 'gray'}
      size="lg"
      mx="auto"
      display="block"
      aria-label={b ? `${item.label} (${badgeValue(b.value)})` : item.label}
      aria-current={active ? 'page' : undefined}
    >
      <item.icon size={18} />
    </ActionIcon>
  );
  return (
    <Tooltip
      label={
        <Stack gap={2}>
          <Text size="xs" fw={600} lh={1.3}>
            {item.label}
            {b ? ` · ${badgeValue(b.value)}` : ''}
          </Text>
          {itemHint(item)}
        </Stack>
      }
      position="right"
      withArrow
      multiline
      maw={280}
    >
      <div>
        {b ? (
          <Indicator
            color={alert ? (b.color ?? 'red') : 'gray'}
            size={8}
            offset={6}
            processing={alert}
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
              if (collapsed)
                return (
                  <CollapsedItem
                    key={item.to}
                    item={item}
                    active={active}
                    onNavigate={onNavigate}
                  />
                );
              return (
                <Tooltip
                  key={item.to}
                  label={itemHint(item)}
                  position="right"
                  withArrow
                  multiline
                  maw={280}
                  openDelay={TOOLTIP_DELAY_MS}
                  disabled={!item.description && !item.badge}
                >
                  <NavLink
                    component={Link}
                    to={item.to}
                    prefetch="intent"
                    label={item.label}
                    leftSection={<item.icon size={18} />}
                    rightSection={<CountBadge item={item} />}
                    active={active}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    variant="light"
                    fw={active ? 600 : 500}
                    style={{ borderRadius: 'var(--mantine-radius-md)' }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}
