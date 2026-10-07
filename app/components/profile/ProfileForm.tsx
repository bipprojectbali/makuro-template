import { Button, Group, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { AppUser } from '~/lib/app-context';
import { authClient } from '~/lib/auth-client';
import { SettingsCard } from '../settings/SettingsParts';
import { AvatarField } from './AvatarField';

const NAME_MAX = 80;

/** Profile photo (object storage) + display name (Better Auth updateUser). */
export function ProfileForm({ user, onSaved }: { user: AppUser; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  useEffect(() => setName(user.name), [user.name]);

  const trimmed = name.trim();
  const nameError =
    trimmed.length === 0
      ? 'Nama tidak boleh kosong'
      : trimmed.length > NAME_MAX
        ? `Maksimal ${NAME_MAX} karakter`
        : null;
  const dirty = trimmed !== user.name;

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.updateUser({ name: trimmed });
      if (error) throw new Error(error.message ?? 'Server menolak perubahan');
    },
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Profil disimpan.' });
      onSaved();
    },
    onError: (e: Error) =>
      notifications.show({ color: 'red', title: 'Gagal menyimpan profil', message: e.message }),
  });

  return (
    <SettingsCard title="Profil" description="Nama dan foto yang tampil di aplikasi.">
      <Stack gap="sm">
        <AvatarField image={user.image ?? null} name={trimmed || user.name} onChanged={onSaved} />
        <TextInput
          label="Nama"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={NAME_MAX}
          error={nameError}
          required
        />
      </Stack>
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button variant="subtle" color="gray" size="sm" onClick={() => setName(user.name)}>
            Batalkan
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!dirty || Boolean(nameError)}
        >
          Simpan profil
        </Button>
      </Group>
    </SettingsCard>
  );
}
