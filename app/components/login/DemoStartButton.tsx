import { Button, type ButtonProps, Divider, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { FiPlayCircle } from 'react-icons/fi';
import { demoNote, roleLabel, startDemo } from '~/lib/demo-api';

/** Login-card footer: divider, satu tombol demo per role, dan catatan auto-delete. */
export function DemoLoginOption({ ttlHours, roles }: { ttlHours: number; roles: string[] }) {
  return (
    <Stack gap="xs">
      <Divider label="atau jelajahi dulu" labelPosition="center" />
      <DemoRoleButtons roles={roles} fullWidth size="md" radius="md" />
      <Text size="xs" c="dimmed" ta="center">
        Tanpa akun. {demoNote(ttlHours)}.
      </Text>
    </Stack>
  );
}

/**
 * Satu tombol per role yang ditawarkan server, berbagi satu state tertunda supaya
 * pengunjung tidak bisa memulai dua sesi demo sekaligus. Mengembalikan fragment:
 * tata letak (Stack vertikal di kartu login, Group wrap di hero) milik pemanggil.
 */
export function DemoRoleButtons({ roles, ...props }: { roles: string[] } & ButtonProps) {
  const [pending, setPending] = useState<string | null>(null);

  async function start(role: string) {
    setPending(role);
    try {
      // Full navigation so every loader re-runs with the fresh session cookie.
      window.location.assign(await startDemo(role));
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Demo tidak bisa dimulai',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
      setPending(null);
    }
  }

  return (
    <>
      {roles.map((role) => (
        <DemoStartButton
          key={role}
          role={role}
          {...props}
          loading={pending === role}
          disabled={pending !== null && pending !== role}
          onClick={() => start(role)}
        />
      ))}
    </>
  );
}

/** "Coba sebagai <Role>": tombol demo untuk satu role; aksinya disuntik pemanggil. */
function DemoStartButton({ role, ...props }: { role: string; onClick: () => void } & ButtonProps) {
  return (
    <Button variant="light" leftSection={<FiPlayCircle size={16} />} {...props}>
      Coba sebagai {roleLabel(role)}
    </Button>
  );
}
