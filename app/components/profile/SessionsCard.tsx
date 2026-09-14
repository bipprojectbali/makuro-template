import { Badge, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { FiLogOut, FiMonitor, FiSmartphone } from 'react-icons/fi';
import { authClient } from '~/lib/auth-client';
import { type DeviceSession, describeSession, isCurrentSession } from '~/lib/profile-api';
import { formatDateTime, formatRelative } from '~/lib/visits-format';
import { SettingsCard } from '../settings/SettingsParts';

type Props = {
  sessions: DeviceSession[];
  currentToken: string | null | undefined;
  loading: boolean;
  onChanged: () => void;
};

/** Devices currently signed in; revoke one or all others. */
export function SessionsCard({ sessions, currentToken, loading, onChanged }: Props) {
  const others = sessions.filter((s) => !isCurrentSession(s, currentToken));
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });
  const revokeOne = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token });
      if (error) throw new Error(error.message ?? 'Server menolak');
    },
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Perangkat dikeluarkan.' });
      onChanged();
    },
    onError: fail('Gagal mengeluarkan perangkat'),
  });
  const revokeOthers = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message ?? 'Server menolak');
    },
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Semua perangkat lain dikeluarkan.' });
      onChanged();
    },
    onError: fail('Gagal mengeluarkan perangkat lain'),
  });

  const confirmOthers = () =>
    modals.openConfirmModal({
      title: 'Keluarkan semua perangkat lain?',
      children: (
        <Text size="sm">
          {others.length} sesi lain akan diputus dan harus masuk ulang. Perangkat ini tetap masuk.
        </Text>
      ),
      labels: { confirm: 'Keluarkan perangkat lain', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => revokeOthers.mutate(),
    });

  return (
    <SettingsCard
      title="Perangkat yang masuk"
      description="Sesi aktif akun ini. Keluarkan perangkat yang tidak Anda kenali."
      aside={
        others.length > 0 ? (
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<FiLogOut size={12} />}
            loading={revokeOthers.isPending}
            onClick={confirmOthers}
          >
            Keluarkan {others.length} lainnya
          </Button>
        ) : undefined
      }
    >
      {loading && (
        <Text size="sm" c="dimmed">
          Memuat…
        </Text>
      )}
      {!loading && sessions.length === 0 && (
        <Text size="sm" c="dimmed">
          Tidak ada sesi aktif.
        </Text>
      )}
      <Stack gap="sm">
        {sessions.map((s) => {
          const d = describeSession(s.userAgent);
          const current = isCurrentSession(s, currentToken);
          const Icon = d.device === 'Mobile' || d.device === 'Tablet' ? FiSmartphone : FiMonitor;
          return (
            <Group key={s.id} justify="space-between" wrap="wrap" gap="xs">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                <Icon size={18} style={{ flexShrink: 0, opacity: 0.7 }} />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" fw={500} lh={1.3}>
                      {d.summary}
                    </Text>
                    {current && (
                      <Badge size="xs" variant="light" color="teal">
                        Perangkat ini
                      </Badge>
                    )}
                  </Group>
                  <Tooltip
                    label={`Masuk ${formatDateTime(String(s.createdAt))} · berakhir ${formatDateTime(String(s.expiresAt))}`}
                    withArrow
                  >
                    <Text size="xs" c="dimmed" lh={1.3}>
                      {s.ipAddress ?? 'IP tidak diketahui'} · aktif{' '}
                      {formatRelative(String(s.updatedAt))}
                    </Text>
                  </Tooltip>
                </Stack>
              </Group>
              {!current && (
                <Button
                  size="xs"
                  variant="subtle"
                  color="red"
                  loading={revokeOne.isPending && revokeOne.variables === s.token}
                  onClick={() => revokeOne.mutate(s.token)}
                >
                  Keluarkan
                </Button>
              )}
            </Group>
          );
        })}
      </Stack>
    </SettingsCard>
  );
}
