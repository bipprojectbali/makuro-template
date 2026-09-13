import { Avatar, Badge, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { FiCpu, FiMonitor, FiSmartphone, FiTablet } from 'react-icons/fi';
import type { VisitRow } from '~/lib/visits-api';
import {
  botKindLabel,
  countryFlag,
  deviceLabel,
  deviceSummary,
  formatDateTime,
  formatRelative,
  locationLabel,
  refererHost,
} from '~/lib/visits-format';

/** Shared table/card cells for a visit row — keeps desktop and mobile views consistent. */

export function TypeBadge({ row, size = 'sm' }: { row: VisitRow; size?: 'xs' | 'sm' }) {
  if (!row.isBot) {
    return (
      <Badge color="teal" variant="light" size={size} style={{ flexShrink: 0 }}>
        Human
      </Badge>
    );
  }
  return (
    <Tooltip label={botKindLabel(row.botKind)} withArrow>
      <Badge color="red" variant="light" size={size} style={{ flexShrink: 0 }}>
        Bot
      </Badge>
    </Tooltip>
  );
}

export function TimeCell({ iso }: { iso: string }) {
  return (
    <Tooltip label={formatDateTime(iso)} withArrow openDelay={300}>
      <Stack gap={0}>
        <Text size="sm" lh={1.3} style={{ whiteSpace: 'nowrap' }}>
          {formatRelative(iso)}
        </Text>
        <Text size="xs" c="dimmed" lh={1.3} style={{ whiteSpace: 'nowrap' }}>
          {formatDateTime(iso)}
        </Text>
      </Stack>
    </Tooltip>
  );
}

export function VisitorCell({ row }: { row: VisitRow }) {
  const flag = countryFlag(row.country);
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <Text ff="monospace" size="sm" lh={1.3} truncate>
        {row.ip ?? '—'}
      </Text>
      <Text size="xs" c="dimmed" lh={1.3} truncate>
        {flag ? `${flag} ` : ''}
        {locationLabel(row)}
      </Text>
    </Stack>
  );
}

export function PathCell({ row, maw = 260 }: { row: VisitRow; maw?: number }) {
  const ref = refererHost(row.referer);
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <Tooltip label={row.path} withArrow openDelay={400} disabled={row.path.length < 32}>
        <Text ff="monospace" size="sm" lh={1.3} truncate maw={maw}>
          {row.path}
        </Text>
      </Tooltip>
      {ref && (
        <Text size="xs" c="dimmed" lh={1.3} truncate maw={maw}>
          dari {ref}
        </Text>
      )}
    </Stack>
  );
}

const DEVICE_ICON = {
  desktop: FiMonitor,
  mobile: FiSmartphone,
  tablet: FiTablet,
  bot: FiCpu,
} as const;

export function DeviceIcon({ type, size = 14 }: { type: VisitRow['deviceType']; size?: number }) {
  const Icon = (type && DEVICE_ICON[type]) || FiMonitor;
  return (
    <ThemeIcon variant="light" color={type === 'bot' ? 'red' : 'gray'} size="md" radius="md">
      <Icon size={size} />
    </ThemeIcon>
  );
}

export function DeviceCell({ row }: { row: VisitRow }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <DeviceIcon type={row.deviceType} />
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text size="sm" lh={1.3} truncate maw={200}>
          {deviceSummary(row)}
        </Text>
        <Text size="xs" c="dimmed" lh={1.3}>
          {deviceLabel(row.deviceType)}
          {row.language ? ` · ${row.language}` : ''}
        </Text>
      </Stack>
    </Group>
  );
}

export function UserCell({ row, compact = false }: { row: VisitRow; compact?: boolean }) {
  if (!row.userId) {
    return (
      <Text size="sm" c="dimmed">
        Anonim
      </Text>
    );
  }
  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar src={row.userImage} size={compact ? 20 : 26} radius="xl">
        {row.userName ? row.userName.charAt(0).toUpperCase() : '?'}
      </Avatar>
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500} lh={1.3} truncate maw={160}>
          {row.userName ?? '—'}
        </Text>
        {!compact && (
          <Text ff="monospace" size="xs" c="dimmed" lh={1.3} truncate maw={160}>
            {row.userId}
          </Text>
        )}
      </Stack>
    </Group>
  );
}
