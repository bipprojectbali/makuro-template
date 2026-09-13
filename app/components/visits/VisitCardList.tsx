import { ActionIcon, Checkbox, Group, Paper, Skeleton, Stack, Text } from '@mantine/core';
import { FiTrash2 } from 'react-icons/fi';
import type { VisitRow } from '~/lib/visits-api';
import {
  countryFlag,
  deviceSummary,
  formatRelative,
  locationLabel,
  refererHost,
} from '~/lib/visits-format';
import { TypeBadge, UserCell } from './VisitCells';
import type { VisitListHandlers } from './VisitTable';

const SKELETON_KEYS = ['s0', 's1', 's2', 's3'];

type Props = VisitListHandlers & {
  rows: VisitRow[];
  loading: boolean;
  empty: React.ReactNode;
};

/** Mobile card list (< sm): all key data visible without horizontal scroll. */
export function VisitCardList({ rows, loading, empty, selected, deletingId, ...h }: Props) {
  if (loading) {
    return (
      <Stack gap="xs">
        {SKELETON_KEYS.map((k) => (
          <Skeleton key={k} h={96} radius="md" />
        ))}
      </Stack>
    );
  }
  if (rows.length === 0)
    return (
      <Paper withBorder radius="md">
        {empty}
      </Paper>
    );

  return (
    <Stack gap="xs">
      {rows.map((r) => {
        const flag = countryFlag(r.country);
        const ref = refererHost(r.referer);
        return (
          <Paper
            key={r.id}
            withBorder
            p="sm"
            radius="md"
            bg={selected.has(r.id) ? 'var(--mantine-primary-color-light)' : undefined}
            onClick={() => h.onOpen(r)}
            style={{ cursor: 'pointer' }}
          >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
              <Checkbox
                size="sm"
                mt={2}
                aria-label="Pilih kunjungan"
                checked={selected.has(r.id)}
                onChange={() => h.onToggle(r.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0 }}
              />
              <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                <Group gap="xs" wrap="nowrap" align="center">
                  <TypeBadge row={r} size="xs" />
                  <Text ff="monospace" size="sm" fw={500} truncate style={{ minWidth: 0 }}>
                    {r.path}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" truncate>
                  {formatRelative(r.createdAt)} · {r.ip ?? '—'}
                  {flag ? ` · ${flag}` : ' ·'} {locationLabel(r)}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {deviceSummary(r)}
                  {ref ? ` · dari ${ref}` : ''}
                </Text>
                {r.userId && <UserCell row={r} compact />}
              </Stack>
              <ActionIcon
                size="md"
                color="red"
                variant="subtle"
                loading={deletingId === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  h.onDelete(r);
                }}
                aria-label="Hapus kunjungan"
                style={{ flexShrink: 0 }}
              >
                <FiTrash2 size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        );
      })}
    </Stack>
  );
}
