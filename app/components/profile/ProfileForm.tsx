import { Avatar, Button, Group, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { AppUser } from '~/lib/app-context';
import { authClient } from '~/lib/auth-client';
import { SettingsCard } from '../settings/SettingsParts';

const NAME_MAX = 80;
const URL_RE = /^https?:\/\/\S+$/i;

/** Name + avatar URL, saved through Better Auth updateUser. */
export function ProfileForm({ user, onSaved }: { user: AppUser; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? '');
  useEffect(() => {
    setName(user.name);
    setImage(user.image ?? '');
  }, [user.name, user.image]);

  const trimmed = name.trim();
  const nameError =
    trimmed.length === 0
      ? 'Nama tidak boleh kosong'
      : trimmed.length > NAME_MAX
        ? `Maksimal ${NAME_MAX} karakter`
        : null;
  const imageError = image.trim() && !URL_RE.test(image.trim()) ? 'Harus berupa URL http(s)' : null;
  const dirty = trimmed !== user.name || (image.trim() || null) !== (user.image ?? null);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.updateUser({ name: trimmed, image: image.trim() || null });
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
      <Group align="flex-start" wrap="nowrap" gap="md">
        <Avatar
          src={image.trim() || null}
          radius="xl"
          size={56}
          name={trimmed || user.name}
          color="initials"
          imageProps={{ referrerPolicy: 'no-referrer' }}
        />
        <Stack gap="sm" style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            label="Nama"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={NAME_MAX}
            error={nameError}
            required
          />
          <TextInput
            label="URL foto"
            description="Kosongkan untuk memakai inisial. Foto dari login Google tidak ikut berubah otomatis."
            placeholder="https://…"
            value={image}
            onChange={(e) => setImage(e.currentTarget.value)}
            inputMode="url"
            error={imageError}
          />
        </Stack>
      </Group>
      <Group justify="flex-end" gap="xs">
        {dirty && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => {
              setName(user.name);
              setImage(user.image ?? '');
            }}
          >
            Batalkan
          </Button>
        )}
        <Button
          size="sm"
          onClick={() => save.mutate()}
          loading={save.isPending}
          disabled={!dirty || Boolean(nameError) || Boolean(imageError)}
        >
          Simpan profil
        </Button>
      </Group>
    </SettingsCard>
  );
}
