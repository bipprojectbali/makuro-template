import { Alert, Button, Group, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { FiPlayCircle, FiUserPlus } from 'react-icons/fi';
import { signOut } from '~/lib/auth-client';

/** Shown on every /app page while the visitor is a temporary demo user. */
export function DemoBanner({ hoursLeft }: { hoursLeft: number }) {
  const [loading, setLoading] = useState(false);

  async function leaveDemo() {
    setLoading(true);
    const { error } = await signOut();
    if (error) {
      notifications.show({
        color: 'red',
        title: 'Gagal keluar dari demo',
        message: error.message ?? 'Coba lagi.',
      });
      setLoading(false);
      return;
    }
    window.location.assign('/login?mode=signup');
  }

  const confirm = () =>
    modals.openConfirmModal({
      title: 'Buat akun asli?',
      children: (
        <Text size="sm">
          Anda akan keluar dari mode demo. Data demo tidak ikut dipindahkan ke akun baru dan tetap
          dihapus otomatis saat masa demo berakhir.
        </Text>
      ),
      labels: { confirm: 'Keluar & buat akun', cancel: 'Tetap di demo' },
      onConfirm: leaveDemo,
    });

  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<FiPlayCircle size={16} />}
      mb="md"
      title={`Mode demo — data dihapus dalam ${hoursLeft} jam`}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="xs">
        <Text size="sm" style={{ flex: '1 1 240px' }}>
          Anda memakai akun demo sementara. Beberapa fitur seperti API key, foto profil, dan
          pengaturan keamanan dinonaktifkan.
        </Text>
        <Button
          size="sm"
          variant="filled"
          color="yellow"
          leftSection={<FiUserPlus size={14} />}
          loading={loading}
          onClick={confirm}
        >
          Buat akun asli
        </Button>
      </Group>
    </Alert>
  );
}
