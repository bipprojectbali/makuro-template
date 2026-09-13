import {
  Avatar,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { type AuditStats, actionMeta, TARGET_LABELS } from '~/lib/audit-api';
import { percent } from '~/lib/visits-format';
import { BreakdownPanel } from '../logs/BreakdownPanel';
import { TruncatedText } from '../logs/TruncatedText';

const nf = new Intl.NumberFormat('id-ID');

type Actor = AuditStats['topActors'][number];

function ActorRow({
  a,
  total,
  onActor,
}: {
  a: Actor;
  total: number;
  onActor: (id: string) => void;
}) {
  const pct = percent(a.count, total);
  const label = a.name ?? a.email ?? 'Sistem';
  const body = (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Avatar src={a.image} size={20} radius="xl" name={label} color="initials" />
          <TruncatedText size="sm" style={{ minWidth: 0 }}>
            {label}
          </TruncatedText>
        </Group>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {nf.format(a.count)} · {pct}%
        </Text>
      </Group>
      <Progress value={pct} size="xs" radius="xl" />
    </Stack>
  );
  if (!a.actorId) return <div>{body}</div>;
  return (
    <UnstyledButton
      onClick={() => onActor(a.actorId as string)}
      aria-label={`Filter aktor ${label}`}
    >
      {body}
    </UnstyledButton>
  );
}

function TopActors({ stats, onActor }: { stats: AuditStats; onActor: (id: string) => void }) {
  const total = Math.max(1, stats.total);
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} mb="sm">
        Aktor paling aktif
      </Text>
      {stats.topActors.length === 0 ? (
        <Text size="sm" c="dimmed">
          Belum ada data.
        </Text>
      ) : (
        <Stack gap="xs">
          {stats.topActors.map((a) => (
            <ActorRow key={a.actorId ?? 'system'} a={a} total={total} onActor={onActor} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export function AuditBreakdown({
  stats,
  onActor,
  onAction,
  onTarget,
}: {
  stats: AuditStats;
  onActor: (id: string) => void;
  onAction: (a: string) => void;
  onTarget: (t: string) => void;
}) {
  const total = Math.max(1, stats.total);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
      <TopActors stats={stats} onActor={onActor} />
      <BreakdownPanel
        title="Aksi"
        items={stats.topActions}
        total={total}
        render={(k) => (k ? actionMeta(k).label : '—')}
        onSelect={onAction}
      />
      <BreakdownPanel
        title="Jenis target"
        items={stats.targets}
        total={total}
        render={(k) => (k ? (TARGET_LABELS[k] ?? k) : '—')}
        onSelect={onTarget}
      />
    </SimpleGrid>
  );
}
