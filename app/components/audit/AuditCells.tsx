import { Avatar, Badge, Group, Stack, Text, Tooltip } from '@mantine/core';
import { type AuditRow, actionMeta, TARGET_LABELS } from '~/lib/audit-api';
import { TruncatedText } from '../logs/TruncatedText';

export function ActionBadge({ action, size = 'sm' }: { action: string; size?: 'xs' | 'sm' }) {
  const m = actionMeta(action);
  return (
    <Tooltip label={action} withArrow>
      <Badge variant="light" color={m.color} size={size} style={{ flexShrink: 0 }}>
        {m.label}
      </Badge>
    </Tooltip>
  );
}

/** Actor avatar + name/email; "Sistem" when no actor was attached. */
export function ActorCell({ row }: { row: AuditRow }) {
  if (!row.actorId && !row.actorEmail) {
    return (
      <Text size="sm" c="dimmed">
        Sistem
      </Text>
    );
  }
  return (
    <Group gap="xs" wrap="nowrap">
      <Avatar
        src={row.actorImage}
        size={26}
        radius="xl"
        name={row.actorName ?? row.actorEmail ?? undefined}
        color="initials"
        imageProps={{ referrerPolicy: 'no-referrer' }}
      />
      <Stack gap={0} style={{ minWidth: 0 }}>
        <TruncatedText size="sm" fw={500} lh={1.3} maw={180}>
          {row.actorName ?? row.actorEmail ?? row.actorId ?? '—'}
        </TruncatedText>
        <TruncatedText size="xs" c="dimmed" lh={1.3} maw={180}>
          {row.actorEmail ?? row.actorId ?? ''}
        </TruncatedText>
      </Stack>
    </Group>
  );
}

export function TargetCell({ row }: { row: AuditRow }) {
  return (
    <Stack gap={0} style={{ minWidth: 0 }}>
      <Text size="xs" c="dimmed" lh={1.3}>
        {TARGET_LABELS[row.targetType] ?? row.targetType}
      </Text>
      {row.targetId && (
        <TruncatedText ff="monospace" size="xs" lh={1.3} maw={160}>
          {row.targetId}
        </TruncatedText>
      )}
    </Stack>
  );
}
