import { Avatar, Button, FileButton, Group, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { AVATAR_ACCEPT, AVATAR_MAX_MB, removeAvatar, uploadAvatar } from '~/lib/avatar-api';

const MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;

/** Profile photo: upload to object storage or remove (with confirmation). */
export function AvatarField({
  image,
  name,
  onChanged,
}: {
  image: string | null;
  name: string;
  onChanged: () => void;
}) {
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });
  const upload = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Foto profil diperbarui.' });
      onChanged();
    },
    onError: fail('Gagal mengunggah foto'),
  });
  const remove = useMutation({
    mutationFn: removeAvatar,
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Foto profil dihapus.' });
      onChanged();
    },
    onError: fail('Gagal menghapus foto'),
  });

  const pick = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      notifications.show({
        color: 'red',
        title: 'Foto terlalu besar',
        message: `Ukuran maksimal ${AVATAR_MAX_MB} MB. Pilih gambar yang lebih kecil.`,
      });
      return;
    }
    upload.mutate(file);
  };

  const confirmRemove = () =>
    modals.openConfirmModal({
      title: 'Hapus foto profil?',
      children: <Text size="sm">Foto profil akan dihapus permanen dan diganti inisial nama.</Text>,
      labels: { confirm: 'Hapus foto', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(),
    });

  const busy = upload.isPending || remove.isPending;
  return (
    <Group gap="md" wrap="wrap" align="center">
      <Avatar
        src={image}
        radius="xl"
        size={64}
        name={name}
        color="initials"
        imageProps={{ referrerPolicy: 'no-referrer' }}
      />
      <Stack gap={6} style={{ minWidth: 0 }}>
        <Group gap="xs" wrap="wrap">
          <FileButton onChange={pick} accept={AVATAR_ACCEPT} disabled={busy}>
            {(props) => (
              <Button {...props} size="sm" variant="light" loading={upload.isPending}>
                Unggah foto
              </Button>
            )}
          </FileButton>
          {image && (
            <Button
              size="sm"
              variant="subtle"
              color="red"
              onClick={confirmRemove}
              loading={remove.isPending}
              disabled={upload.isPending}
            >
              Hapus foto
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          PNG, JPEG, WEBP, atau GIF, maksimal {AVATAR_MAX_MB} MB.
        </Text>
      </Stack>
    </Group>
  );
}
