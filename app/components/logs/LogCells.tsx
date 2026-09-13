import { Avatar, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { TruncatedText } from './TruncatedText';
import { FiCpu, FiMonitor, FiSmartphone, FiTablet } from 'react-icons/fi';
import {
  countryFlag,
  deviceLabel,
  deviceSummary,
  formatDateTime,
  formatRelative,
  locationLabel,
} from '~/lib/visits-format';

/** Structural row shapes so visit and login rows can share these cells. */
export type ClientRow = { ip: string | null; country: string | null; city: string | null };
export type DeviceRow = {
  browser: string | null;
  browserVersion: string | null;
  os: string | null;
  osVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | null;
  language: string | null;
};
export type UserRow = { userId: string | null; userName: string | null; userImage: string | null };

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

/** IP on top, flag + city/country (or "Lokal") below. */
export function ClientCell({ row }: { row: ClientRow }) {
  const flag = countryFlag(row.country);
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <TruncatedText ff="monospace" size="sm" lh={1.3}>
        {row.ip ?? '—'}
      </TruncatedText>
      <TruncatedText size="xs" c="dimmed" lh={1.3}>
        {`${flag ? `${flag} ` : ''}${locationLabel(row)}`}
      </TruncatedText>
    </Stack>
  );
}

const DEVICE_ICON = { desktop: FiMonitor, mobile: FiSmartphone, tablet: FiTablet, bot: FiCpu } as const;

export function DeviceIcon({ type, size = 14 }: { type: DeviceRow['deviceType']; size?: number }) {
  const Icon = (type && DEVICE_ICON[type]) || FiMonitor;
  return (
    <ThemeIcon variant="light" color={type === 'bot' ? 'red' : 'gray'} size="md" radius="md">
      <Icon size={size} />
    </ThemeIcon>
  );
}

export function DeviceCell({ row }: { row: DeviceRow }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <DeviceIcon type={row.deviceType} />
      <Stack gap={0} style={{ minWidth: 0 }}>
        <TruncatedText size="sm" lh={1.3} maw={200}>
          {deviceSummary(row)}
        </TruncatedText>
        <Text size="xs" c="dimmed" lh={1.3}>
          {deviceLabel(row.deviceType)}
          {row.language ? ` · ${row.language}` : ''}
        </Text>
      </Stack>
    </Group>
  );
}

export function UserCell({ row, compact = false, subtitle }: { row: UserRow; compact?: boolean; subtitle?: string | null }) {
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
        <TruncatedText size="sm" fw={500} lh={1.3} maw={180}>
          {row.userName ?? '—'}
        </TruncatedText>
        {!compact && (
          <TruncatedText ff={subtitle ? undefined : 'monospace'} size="xs" c="dimmed" lh={1.3} maw={180}>
            {subtitle ?? row.userId ?? '—'}
          </TruncatedText>
        )}
      </Stack>
    </Group>
  );
}
