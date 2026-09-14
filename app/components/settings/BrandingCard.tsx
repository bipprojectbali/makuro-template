import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { type Branding, type BrandingSettings, saveBranding } from '~/lib/settings-api';
import { OverrideBadge, SettingsCard } from './SettingsParts';

const URL_RE = /^https?:\/\/\S+$|^mailto:\S+$/i;

/** App name, tagline and support link used by the shell, meta tags and login page. */
export function BrandingCard({
  settings,
  defaults,
}: {
  settings: BrandingSettings;
  defaults: Branding;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandingSettings>(settings);
  useEffect(() => setForm(settings), [settings]);
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  const urlError =
    form.supportUrl?.trim() && !URL_RE.test(form.supportUrl.trim())
      ? 'Harus URL http(s) atau mailto:'
      : null;
  const save = useMutation({
    mutationFn: () => saveBranding(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-overview'] });
      notifications.show({
        color: 'teal',
        message: 'Branding disimpan. Muat ulang halaman untuk melihat di sidebar.',
      });
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Gagal menyimpan branding', message: e.message }),
  });
  const field = (
    key: keyof BrandingSettings,
    label: string,
    placeholder: string,
    description: string,
  ) => (
    <TextInput
      label={
        <Group gap={6}>
          <span>{label}</span>
          <OverrideBadge overridden={Boolean(form[key]?.trim())} />
        </Group>
      }
      description={description}
      placeholder={placeholder}
      value={form[key] ?? ''}
      onChange={(e) => setForm({ ...form, [key]: e.currentTarget.value || null })}
      error={key === 'supportUrl' ? urlError : undefined}
      inputMode={key === 'supportUrl' ? 'url' : undefined}
    />
  );
  return (
    <SettingsCard
      title="Branding"
      description="Identitas yang tampil di sidebar, judul tab browser, dan halaman login. Kosong = default template."
    >
      <Stack gap="sm" maw={520}>
        {field('appName', 'Nama aplikasi', defaults.appName, 'Maksimal 60 karakter.')}
        {field('appTagline', 'Tagline', defaults.appTagline, 'Dipakai di deskripsi meta.')}
        {field(
          'supportUrl',
          'URL dukungan',
          'https://… atau mailto:…',
          'Opsional; ditampilkan di halaman error dan maintenance nantinya.',
        )}
        <Text size="xs" c="dimmed">
          Pratinjau judul tab: <strong>{form.appName?.trim() || defaults.appName}</strong> —{' '}
          {form.appTagline?.trim() || defaults.appTagline}
        </Text>
      </Stack>
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button variant="subtle" color="gray" size="sm" onClick={() => setForm(settings)}>
            Batalkan
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!dirty || Boolean(urlError)}
        >
          Simpan branding
        </Button>
      </Group>
    </SettingsCard>
  );
}
