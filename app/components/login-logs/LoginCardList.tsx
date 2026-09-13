import { ActionIcon, Avatar, Checkbox, Group, Paper, Skeleton, Stack } from '@mantine/core';
import { FiTrash2 } from 'react-icons/fi';
import type { LoginRow } from '~/lib/login-logs-api';
import { countryFlag, deviceSummary, formatRelative, locationLabel } from '~/lib/visits-format';
import { TruncatedText } from '../logs/TruncatedText';
import { MethodBadge } from './LoginCells';
import type { LoginListHandlers } from './LoginTable';

type Props = LoginListHandlers & { rows: LoginRow[]; loading: boolean; empty: React.ReactNode };

const SKELETON_KEYS = ['s0', 's1', 's2', 's3'];

/** Mobile card list (< sm): all key data visible without horizontal scroll. */
export function LoginCardList({ rows, loading, empty, selected, deletingId, ...h }: Props) {
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
                aria-label="Pilih login"
                checked={selected.has(r.id)}
                onChange={() => h.onToggle(r.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0 }}
              />
              <Group gap="xs" wrap="nowrap" align="flex-start" style={{ flex: 1, minWidth: 0 }}>
                <Avatar src={r.userImage} size={36} radius="xl" style={{ flexShrink: 0 }}>
                  {r.userName ? r.userName.charAt(0).toUpperCase() : '?'}
                </Avatar>
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap">
                    <TruncatedText size="sm" fw={500} style={{ minWidth: 0 }}>
                      {r.userName ?? r.userId}
                    </TruncatedText>
                    <MethodBadge method={r.method} size="xs" />
                  </Group>
                  <TruncatedText size="xs" c="dimmed">
                    {r.userEmail ?? r.userId}
                  </TruncatedText>
                  <TruncatedText size="xs" c="dimmed">
                    {`${formatRelative(r.createdAt)} · ${r.ip ?? '—'}${flag ? ` · ${flag}` : ' ·'} ${locationLabel(r)}`}
                  </TruncatedText>
                  <TruncatedText size="xs" c="dimmed">
                    {deviceSummary(r)}
                  </TruncatedText>
                </Stack>
              </Group>
              <ActionIcon
                size="md"
                color="red"
                variant="subtle"
                loading={deletingId === r.id}
                onClick={(e) => {
                  e.stopPropagation();
                  h.onDelete(r);
                }}
                aria-label="Hapus login log"
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
