import { Code, List, Paper, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { requireUser } from '@server/guard';
import { FiLayers } from 'react-icons/fi';
import { useApp } from '~/lib/app-context';
import type { Route } from './+types/home';

export function meta() {
  return [{ title: 'App — Makuro' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

const wrap = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

/** Product home placeholder: guidance for whoever builds the app, replaced by the real home. */
export default function AppHome() {
  const { user } = useApp();

  return (
    <Stack gap="md" p={{ base: 'sm', md: 'md' }} maw={880}>
      <div>
        <Title order={3}>Halo, {user.name || 'pengguna'}</Title>
        <Text size="sm" c="dimmed">
          Ini area produk aplikasi Anda. Semua user yang sudah masuk bisa membukanya.
        </Text>
      </div>

      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="xs" ta="center">
          <ThemeIcon size={48} radius="xl" variant="light">
            <FiLayers size={24} />
          </ThemeIcon>
          <Text fw={600}>Belum ada fitur</Text>
          <Text size="sm" c="dimmed" maw={520}>
            Mulai bangun di <Code>app/routes/app/</Code>. Halaman ini hanya panduan — ganti dengan
            beranda aplikasi Anda.
          </Text>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper withBorder radius="md" p="md">
          <Text fw={600} mb="xs">
            Tambah halaman
          </Text>
          <List type="ordered" size="sm" spacing={6}>
            <List.Item>
              Buat <Code>app/routes/app/nama.tsx</Code> dengan <Code>meta()</Code>.
            </List.Item>
            <List.Item>
              Daftarkan di layout app pada <Code>app/routes.ts</Code>.
            </List.Item>
            <List.Item>
              Panggil <Code>requireUser(request)</Code> di loader — atau <Code>requireAnyRole</Code>{' '}
              bila fitur khusus role tertentu.
            </List.Item>
            <List.Item>
              Tambahkan ke <Code>NAV</Code> di <Code>app/routes/app/layout.tsx</Code>.
            </List.Item>
          </List>
        </Paper>
        <Paper withBorder radius="md" p="md">
          <Text fw={600} mb="xs">
            Tambah endpoint
          </Text>
          <List type="ordered" size="sm" spacing={6}>
            <List.Item>
              Tambah route di <Code>server/api/app.ts</Code> — otomatis butuh login.
            </List.Item>
            <List.Item>
              Panggil dari client (bertipe, via <Code>~/lib/eden</Code>):
              <Code block mt={4} style={wrap}>
                {'await client.api.app.whoami.get()'}
              </Code>
            </List.Item>
            <List.Item>
              API key mengaksesnya dengan scope <Code>app:read</Code> / <Code>app:write</Code>.
            </List.Item>
          </List>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
