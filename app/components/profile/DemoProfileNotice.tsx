import { Alert, List, Text } from '@mantine/core';
import { FiLock } from 'react-icons/fi';

/** Replaces the account-security cards for demo users (the server rejects those actions anyway). */
export function DemoProfileNotice() {
  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<FiLock size={16} />}
      title="Tidak tersedia di mode demo"
    >
      <Text size="sm">Fitur berikut dinonaktifkan untuk akun demo sementara:</Text>
      <List size="sm" mt={4} spacing={2}>
        <List.Item>Foto profil</List.Item>
        <List.Item>Ganti email, password, dan tautan akun Google</List.Item>
        <List.Item>API key pribadi</List.Item>
        <List.Item>Hapus akun (akun demo terhapus otomatis)</List.Item>
      </List>
      <Text size="sm" mt={6}>
        Pakai tombol "Buat akun asli" di atas untuk mendaftar dan membuka semua fitur.
      </Text>
    </Alert>
  );
}
