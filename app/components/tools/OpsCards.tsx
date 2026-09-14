import { Anchor, Badge, Button, Code, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { formatUptime, type OpsStatus, type ResetTarget, runReset } from '~/lib/ops-api';
import { SettingRow, SettingsCard } from '../settings/SettingsParts';

const nf = new Intl.NumberFormat('id-ID');

function Item({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3}>
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}

export function StatusCard({
  status,
  onRefresh,
  refreshing,
}: {
  status: OpsStatus | undefined;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <SettingsCard
      title="Status proses"
      description="Kondisi server yang menjawab request ini. Di multi-instance, tiap instance berbeda."
      aside={
        <Button size="xs" variant="light" onClick={onRefresh} loading={refreshing}>
          Perbarui
        </Button>
      }
    >
      {status && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
          <Item label="Uptime" value={formatUptime(status.uptimeSeconds)} />
          <Item
            label="Latensi DB"
            value={`${status.dbLatencyMs} ms`}
            hint="select 1 dari proses ini"
          />
          <Item
            label="Memori"
            value={`${nf.format(status.memory.rssMb)} MB`}
            hint={`heap ${nf.format(status.memory.heapUsedMb)} MB`}
          />
          <Item
            label="Runtime"
            value={`Bun ${status.bun}`}
            hint={status.standalone ? 'binary terkompilasi' : 'skrip'}
          />
          <Item
            label="Rate limiter"
            value={`${nf.format(status.limiter.trackedClients)} klien`}
            hint={status.limiter.enabled ? 'aktif' : 'NONAKTIF'}
          />
          <Item
            label="Buffer log"
            value={`${nf.format(status.logBuffer.size)} / ${nf.format(status.logBuffer.capacity)}`}
          />
          <Item label="Versi" value={`v${status.version}`} hint={status.env} />
        </SimpleGrid>
      )}
    </SettingsCard>
  );
}

export function ApiCard() {
  const rows: Array<{ path: string; note: string; to?: string }> = [
    { path: 'GET /api/settings', note: 'Publik: toggle auth, feature flags, branding efektif.' },
    { path: '/api/admin/users', note: 'Direktori user, role, ban (admin+).', to: '/dev/users' },
    {
      path: '/api/analytics/*',
      note: 'Visit, login, rate-limit log + stats/export.',
      to: '/dev/visits',
    },
    { path: '/api/audit', note: 'Jejak audit (read-only).', to: '/dev/audit' },
    { path: '/api/sessions', note: 'Sesi lintas user, cabut sesi.', to: '/dev/sessions' },
    {
      path: '/api/posts',
      note: 'Konten: publik baca, sesi tulis, admin moderasi.',
      to: '/dev/posts',
    },
    {
      path: '/api/file-health',
      note: 'Ukuran file vs limit, risiko konteks.',
      to: '/dev/file-health',
    },
    { path: '/api/logs', note: 'Buffer log server.', to: '/dev/server-logs' },
  ];
  return (
    <SettingsCard
      title="API"
      description="Semua endpoint di bawah /api dibatasi per IP (X-RateLimit-Limit / -Remaining, 429 + Retry-After). /api/auth/* dan /api/mcp dikecualikan."
    >
      <Stack gap={6}>
        {rows.map((r) => (
          <Group key={r.path} gap="sm" wrap="wrap">
            <Code>{r.path}</Code>
            <Text size="sm" c="dimmed" style={{ flex: 1 }}>
              {r.note}
            </Text>
            {r.to && (
              <Anchor component={Link} to={r.to} size="xs" prefetch="intent">
                Buka halaman
              </Anchor>
            )}
          </Group>
        ))}
      </Stack>
    </SettingsCard>
  );
}

export function ResetCard({ targets }: { targets: ResetTarget[] | undefined }) {
  const qc = useQueryClient();
  const reset = useMutation({
    mutationFn: (key: string) => runReset(key),
    onSuccess: (_r, key) => {
      qc.invalidateQueries({ queryKey: ['ops-status'] });
      notifications.show({
        color: 'teal',
        message: `Reset ${targets?.find((t) => t.key === key)?.label ?? key} selesai.`,
      });
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Reset gagal', message: e.message }),
  });
  const confirm = (t: ResetTarget) =>
    modals.openConfirmModal({
      title: `Reset ${t.label}?`,
      children: (
        <Text size="sm">
          {t.description} Berlaku untuk proses ini saja dan dicatat di Audit Log.
        </Text>
      ),
      labels: { confirm: 'Reset', cancel: 'Batal' },
      confirmProps: { color: 'orange' },
      onConfirm: () => reset.mutate(t.key),
    });
  return (
    <SettingsCard
      title="Reset cache & state"
      description="Untuk debugging. Tidak menyentuh database."
      aside={
        <Badge variant="light" color="orange">
          Hati-hati
        </Badge>
      }
    >
      {(targets ?? []).map((t) => (
        <SettingRow
          key={t.key}
          label={t.label}
          description={t.description}
          control={
            <Button
              size="xs"
              variant="default"
              loading={reset.isPending && reset.variables === t.key}
              onClick={() => confirm(t)}
            >
              Reset
            </Button>
          }
        />
      ))}
    </SettingsCard>
  );
}
