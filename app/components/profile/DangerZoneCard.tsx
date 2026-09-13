import { Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { authClient } from '~/lib/auth-client';
import { SettingsCard } from '../settings/SettingsParts';

function DeleteForm({
  email,
  needsPassword,
  onClose,
}: {
  email: string;
  needsPassword: boolean;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const ready =
    typed.trim().toLowerCase() === email.toLowerCase() && (!needsPassword || password.length > 0);
  const submit = async () => {
    setBusy(true);
    const { error } = await authClient.deleteUser(needsPassword ? { password } : {});
    setBusy(false);
    if (error) {
      notifications.show({
        color: 'red',
        title: 'Gagal menghapus akun',
        message: error.message ?? 'Server menolak. Coba masuk ulang lalu ulangi.',
      });
      return;
    }
    onClose();
    window.location.assign('/login');
  };
  return (
    <Stack gap="sm">
      <Text size="sm">
        Semua data akun, sesi, dan akun tertaut akan dihapus permanen. Ketik{' '}
        <strong>{email}</strong> untuk konfirmasi.
      </Text>
      <TextInput
        value={typed}
        onChange={(e) => setTyped(e.currentTarget.value)}
        placeholder={email}
        inputMode="email"
        data-autofocus
      />
      {needsPassword && (
        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          autoComplete="current-password"
        />
      )}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button color="red" onClick={submit} loading={busy} disabled={!ready}>
          Hapus akun saya
        </Button>
      </Group>
    </Stack>
  );
}

/** Irreversible actions, visually separated and double-confirmed. */
export function DangerZoneCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const open = () => {
    const id = modals.open({
      title: 'Hapus akun permanen?',
      children: (
        <DeleteForm email={email} needsPassword={hasPassword} onClose={() => modals.close(id)} />
      ),
    });
  };
  return (
    <SettingsCard title="Zona berbahaya" description="Tindakan di sini tidak bisa dibatalkan.">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Stack gap={2} style={{ flex: '1 1 260px' }}>
          <Group gap="xs">
            <FiAlertTriangle size={14} color="var(--mantine-color-red-6)" />
            <Text fw={500}>Hapus akun</Text>
          </Group>
          <Text size="sm" c="dimmed">
            Menghapus profil, semua sesi, dan akun tertaut. Log aktivitas anonim tetap tersimpan
            untuk keperluan audit.
          </Text>
        </Stack>
        <Button color="red" variant="outline" size="sm" onClick={open}>
          Hapus akun…
        </Button>
      </Group>
    </SettingsCard>
  );
}
