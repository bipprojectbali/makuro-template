import { Code, Divider, Drawer, Group, Stack, Text } from '@mantine/core';
import { type AuditRow, TARGET_LABELS } from '~/lib/audit-api';
import { formatDateTime } from '~/lib/visits-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { ActionBadge, ActorCell } from './AuditCells';

/** Full record: who, what, target, structured details, origin. */
export function AuditDetailDrawer({ row, onClose }: { row: AuditRow | null; onClose: () => void }) {
  return (
    <Drawer
      opened={row !== null}
      onClose={onClose}
      position="right"
      size="md"
      title="Detail audit"
      padding="md"
    >
      {row && (
        <Stack gap="lg">
          <Group justify="space-between" wrap="nowrap">
            <ActionBadge action={row.action} />
            <Text size="sm" c="dimmed">
              {formatDateTime(row.createdAt)}
            </Text>
          </Group>
          <Text size="sm">{row.summary}</Text>
          <Divider />
          <Section title="Aktor">
            <ActorCell row={row} />
            {row.actorId && (
              <Field label="Actor ID">
                <Copyable value={row.actorId} />
              </Field>
            )}
          </Section>
          <Divider />
          <Section title="Target">
            <Field label="Jenis">
              <Text size="sm">{TARGET_LABELS[row.targetType] ?? row.targetType}</Text>
            </Field>
            {row.targetId && (
              <Field label="Target ID">
                <Copyable value={row.targetId} />
              </Field>
            )}
          </Section>
          <Divider />
          <Section title="Detail">
            <Code block style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {row.meta ? JSON.stringify(row.meta, null, 2) : '(tidak ada data tambahan)'}
            </Code>
          </Section>
          <Divider />
          <Section title="Asal">
            <Field label="IP">
              {row.ip ? <Copyable value={row.ip} /> : <Text size="sm">—</Text>}
            </Field>
            <Field label="User agent">
              <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                {row.userAgent ?? '—'}
              </Text>
            </Field>
            <Field label="Log ID">
              <Copyable value={row.id} />
            </Field>
          </Section>
        </Stack>
      )}
    </Drawer>
  );
}
