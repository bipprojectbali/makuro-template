import { Alert, Badge, Button, Group, Switch, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import { type AuthSettings, saveAuthSettings } from '~/lib/settings-api';
import { SettingRow, SettingsCard } from './SettingsParts';

type Props = { initial: AuthSettings; googleAuthConfigured: boolean };

/** Email/password login and public signup toggles, guarded against locking everyone out. */
export function AuthSettingsCard({ initial, googleAuthConfigured }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AuthSettings>(initial);
  useEffect(() => setForm(initial), [initial]);
  const dirty =
    form.emailAuthEnabled !== initial.emailAuthEnabled ||
    form.signupEnabled !== initial.signupEnabled;
  // With no Google OAuth, email login is the only way in — turning it off locks the app.
  const lockoutRisk = !googleAuthConfigured && !form.emailAuthEnabled;

  const save = useMutation({
    mutationFn: saveAuthSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings-overview'] });
      notifications.show({ color: 'teal', message: 'Pengaturan autentikasi disimpan.' });
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Gagal menyimpan', message: e.message }),
  });

  const submit = () => {
    if (!form.emailAuthEnabled && initial.emailAuthEnabled) {
      modals.openConfirmModal({
        title: 'Matikan login email & password?',
        children: (
          <Text size="sm">
            User yang tidak punya akun Google tidak akan bisa masuk. Pastikan Google OAuth sudah
            berjalan sebelum melanjutkan.
          </Text>
        ),
        labels: { confirm: 'Matikan login email', cancel: 'Batal' },
        confirmProps: { color: 'red' },
        onConfirm: () => save.mutate(form),
      });
      return;
    }
    save.mutate(form);
  };

  return (
    <SettingsCard
      title="Autentikasi"
      description="Cara user masuk dan apakah pendaftaran publik dibuka."
      aside={
        <Badge variant="light" color={googleAuthConfigured ? 'teal' : 'gray'}>
          Google OAuth {googleAuthConfigured ? 'aktif' : 'belum dikonfigurasi'}
        </Badge>
      }
    >
      {lockoutRisk && (
        <Alert
          color="red"
          variant="light"
          icon={<FiAlertTriangle size={16} />}
          title="Risiko terkunci"
        >
          Google OAuth belum dikonfigurasi (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET kosong).
          Mematikan login email berarti tidak ada cara masuk sama sekali, jadi tombol simpan
          dinonaktifkan.
        </Alert>
      )}
      <SettingRow
        label="Login email & password"
        description="Izinkan user masuk dengan email dan password. Matikan untuk mode Google-only."
        control={
          <Switch
            size="md"
            checked={form.emailAuthEnabled}
            onChange={(e) => setForm({ ...form, emailAuthEnabled: e.currentTarget.checked })}
            aria-label="Login email dan password"
          />
        }
      />
      <SettingRow
        label="Pendaftaran publik"
        description="Izinkan user baru mendaftar sendiri lewat form email. Matikan untuk menutup app dari pendaftaran."
        badge={
          !form.emailAuthEnabled ? (
            <Badge size="xs" color="gray" variant="light">
              Tidak berlaku saat Google-only
            </Badge>
          ) : undefined
        }
        control={
          <Tooltip
            label="Pendaftaran email hanya relevan jika login email aktif"
            disabled={form.emailAuthEnabled}
            withArrow
          >
            <Switch
              size="md"
              checked={form.signupEnabled}
              disabled={!form.emailAuthEnabled}
              onChange={(e) => setForm({ ...form, signupEnabled: e.currentTarget.checked })}
              aria-label="Pendaftaran publik"
            />
          </Tooltip>
        }
      />
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => setForm(initial)}
            disabled={save.isPending}
          >
            Batalkan perubahan
          </Button>
        )}
        <Button
          size="sm"
          onClick={submit}
          loading={save.isPending}
          disabled={!dirty || lockoutRisk}
        >
          Simpan autentikasi
        </Button>
      </Group>
    </SettingsCard>
  );
}
