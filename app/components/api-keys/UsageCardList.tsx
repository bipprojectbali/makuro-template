import { Badge, Group, Paper, Skeleton, Stack, Text, UnstyledButton } from '@mantine/core';
import type { ReactNode } from 'react';
import { statusClass, type UsageLogRow } from '~/lib/api-keys-usage-api';
import { useTimeFormat } from '~/lib/time-format';
import { countryFlag } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';

const SKELETON_KEYS = ['c0', 'c1', 'c2', 'c3', 'c4'];
const STATUS_COLOR = { ok: 'teal', client: 'orange', server: 'red' } as const;

export function StatusBadge({ status }: { status: number }) {
  return (
    <Badge size="xs" variant="light" color={STATUS_COLOR[statusClass(status)]}>
      {status}
    </Badge>
  );
}

type Props = {
  rows: UsageLogRow[];
  loading: boolean;
  empty: ReactNode;
  onKey: (keyId: string) => void;
};

/**
 * Mobile view of the usage log. The desktop table needs 720px, so below `sm` each
 * request becomes a card instead — every column stays readable without side-scrolling.
 */
export function UsageCardList({ rows, loading, empty, onKey }: Props) {
  const { dateTime: formatDateTime, relative: formatRelative } = useTimeFormat();

  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} h={82} radius="md" />
        ))}
      </Stack>
    );
  }
  if (rows.length === 0) return <>{empty}</>;

  return (
    <Stack gap="xs">
      {rows.map((r) => (
        <Paper key={r.id} withBorder p="sm" radius="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
            <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
              <TruncatedText ff="monospace" size="sm" fw={500} style={{ minWidth: 0 }}>
                {`${r.method} ${r.path}`}
              </TruncatedText>
              <UnstyledButton onClick={() => onKey(r.keyId)} style={{ minWidth: 0 }}>
                <TruncatedText size="xs" c="dimmed" style={{ minWidth: 0 }}>
                  {`${r.keyName ?? '(tanpa nama)'} · ${r.ownerEmail ?? r.keyStart ?? '—'}`}
                </TruncatedText>
              </UnstyledButton>
              <Text size="xs" c="dimmed" title={formatDateTime(r.createdAt)}>
                {[
                  formatRelative(r.createdAt),
                  r.durationMs != null ? `${r.durationMs} ms` : null,
                  r.ip ? `${r.ip}${r.country ? ` ${countryFlag(r.country)}` : ''}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Stack>
            <div style={{ flexShrink: 0 }}>
              <StatusBadge status={r.status} />
            </div>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
