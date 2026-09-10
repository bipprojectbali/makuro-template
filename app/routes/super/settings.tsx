import {
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { requireRole } from '@server/guard';
import { ROLES } from '@server/permissions';
import { getSettings } from '@server/settings';
import { useState } from 'react';
import type { Route } from './+types/settings';

export function meta() {
  return [{ title: 'Settings — Makuro Dev' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ROLES.SUPER_ADMIN);
  return getSettings();
}

export default function SettingsPage({ loaderData }: Route.ComponentProps) {
  const [emailAuth, setEmailAuth] = useState(loaderData.emailAuthEnabled);
  const [signup, setSignup] = useState(loaderData.signupEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAuthEnabled: emailAuth, signupEnabled: signup }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const dirty = emailAuth !== loaderData.emailAuthEnabled || signup !== loaderData.signupEnabled;

  return (
    <Stack gap="lg" maw={600}>
      <Title order={3}>App Settings</Title>

      <Paper withBorder p="lg">
        <Stack gap="md">
          <Title order={5}>Authentication</Title>
          <Divider />

          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text fw={500}>Email &amp; Password login</Text>
              <Text size="sm" c="dimmed">
                Izinkan user login menggunakan email dan password. Nonaktifkan untuk mode
                Google-only.
              </Text>
            </Stack>
            <Switch checked={emailAuth} onChange={(e) => setEmailAuth(e.currentTarget.checked)} />
          </Group>

          <Divider />

          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Group gap="xs">
                <Text fw={500}>User signup</Text>
                {!emailAuth && (
                  <Badge size="xs" color="gray" variant="light">
                    Tidak relevan saat Google-only
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                Izinkan user baru mendaftar sendiri. Nonaktifkan untuk menutup app dari pendaftaran
                publik.
              </Text>
            </Stack>
            <Switch
              checked={signup}
              onChange={(e) => setSignup(e.currentTarget.checked)}
              disabled={!emailAuth}
            />
          </Group>
        </Stack>
      </Paper>

      <Group>
        <Button onClick={save} loading={saving} disabled={!dirty}>
          Simpan
        </Button>
        {saved && (
          <Text size="sm" c="green">
            Tersimpan.
          </Text>
        )}
        {dirty && !saving && (
          <Text size="sm" c="dimmed">
            Ada perubahan yang belum disimpan.
          </Text>
        )}
      </Group>
    </Stack>
  );
}
