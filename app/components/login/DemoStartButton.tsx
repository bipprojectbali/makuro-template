import { Button, type ButtonProps, Divider, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { FiPlayCircle } from 'react-icons/fi';
import { demoNote, startDemo } from '~/lib/demo-api';

/** Login-card footer: divider, full-width demo button, and the auto-delete note. */
export function DemoLoginOption({ ttlHours }: { ttlHours: number }) {
  return (
    <Stack gap="xs">
      <Divider label="atau jelajahi dulu" labelPosition="center" />
      <DemoStartButton fullWidth size="md" radius="md" />
      <Text size="xs" c="dimmed" ta="center">
        Tanpa akun. {demoNote(ttlHours)}.
      </Text>
    </Stack>
  );
}

/** "Coba Demo": signs the visitor in as a temporary demo user, then hard-navigates to /app. */
export function DemoStartButton(props: ButtonProps) {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      // Full navigation so every loader re-runs with the fresh session cookie.
      window.location.assign(await startDemo());
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Demo tidak bisa dimulai',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
      setLoading(false);
    }
  }

  return (
    <Button
      variant="light"
      leftSection={<FiPlayCircle size={16} />}
      {...props}
      loading={loading}
      onClick={start}
    >
      Coba Demo
    </Button>
  );
}
