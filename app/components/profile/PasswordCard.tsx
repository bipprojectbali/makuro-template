import { Alert, Button, Checkbox, Group, PasswordInput, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { FiInfo } from 'react-icons/fi';
import { authClient } from '~/lib/auth-client';
import { SettingsCard } from '../settings/SettingsParts';

const MIN_LEN = 8;

/** Change password (credential accounts only); optionally sign out other devices. */
export function PasswordCard({
  hasPassword,
  onChanged,
}: {
  hasPassword: boolean;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revokeOthers, setRevokeOthers] = useState(true);
  const nextError =
    next && next.length < MIN_LEN
      ? `Minimal ${MIN_LEN} karakter`
      : next && next === current
        ? 'Harus berbeda dari password saat ini'
        : null;
  const confirmError = confirm && confirm !== next ? 'Konfirmasi tidak sama' : null;
  const ready = current && next && confirm && !nextError && !confirmError;

  const change = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: revokeOthers,
      });
      if (error) throw new Error(error.message ?? 'Password saat ini salah');
    },
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      notifications.show({
        color: 'teal',
        message: revokeOthers
          ? 'Password diganti. Perangkat lain telah dikeluarkan.'
          : 'Password diganti.',
      });
      onChanged();
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Gagal mengganti password', message: e.message }),
  });

  if (!hasPassword) {
    return (
      <SettingsCard title="Password" description="Keamanan masuk dengan email dan password.">
        <Alert color="blue" variant="light" icon={<FiInfo size={16} />}>
          Akun ini masuk lewat provider eksternal dan belum punya password. Untuk menambahkan
          password, hubungi admin.
        </Alert>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard title="Password" description="Ganti password secara berkala. Minimal 8 karakter.">
      <Stack gap="sm" maw={420}>
        <PasswordInput
          label="Password saat ini"
          value={current}
          onChange={(e) => setCurrent(e.currentTarget.value)}
          autoComplete="current-password"
          required
        />
        <PasswordInput
          label="Password baru"
          value={next}
          onChange={(e) => setNext(e.currentTarget.value)}
          autoComplete="new-password"
          error={nextError}
          required
        />
        <PasswordInput
          label="Ulangi password baru"
          value={confirm}
          onChange={(e) => setConfirm(e.currentTarget.value)}
          autoComplete="new-password"
          error={confirmError}
          required
        />
        <Checkbox
          label="Keluarkan semua perangkat lain setelah ganti"
          checked={revokeOthers}
          onChange={(e) => setRevokeOthers(e.currentTarget.checked)}
        />
      </Stack>
      <Group justify="flex-end">
        <Text size="xs" c="dimmed" style={{ flex: 1 }}>
          Sesi di perangkat ini tetap masuk.
        </Text>
        <Button
          size="sm"
          onClick={() => change.mutate()}
          loading={change.isPending}
          disabled={!ready}
        >
          Ganti password
        </Button>
      </Group>
    </SettingsCard>
  );
}
