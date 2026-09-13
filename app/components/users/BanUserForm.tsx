import { Button, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { type AdminUser, BAN_DURATIONS } from '~/lib/admin-users-api';

type Props = {
  user: AdminUser;
  onSubmit: (reason: string, expiresIn: number | undefined) => void;
  onCancel: () => void;
};

/** Ban dialog body: reason (shown to admins later) + duration preset. */
export function BanUserForm({ user, onSubmit, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('permanent');
  const preset = BAN_DURATIONS.find((d) => d.value === duration) ?? BAN_DURATIONS[0];
  return (
    <Stack gap="sm">
      <Text size="sm">
        <strong>{user.name}</strong> ({user.email}) tidak akan bisa masuk dan semua sesinya dicabut.
        Ban bisa dibuka kapan saja.
      </Text>
      <Textarea
        label="Alasan"
        description="Dicatat di profil user, tidak dikirim ke user."
        placeholder="Misal: spam, pelanggaran ketentuan…"
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        maxLength={200}
        autosize
        minRows={2}
        data-autofocus
      />
      <Select
        label="Durasi"
        value={duration}
        onChange={(v) => setDuration(v ?? 'permanent')}
        data={BAN_DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
        allowDeselect={false}
      />
      <Group justify="flex-end" gap="xs" mt="xs">
        <Button variant="default" onClick={onCancel}>
          Batal
        </Button>
        <Button color="red" onClick={() => onSubmit(reason.trim(), preset.seconds ?? undefined)}>
          Ban user
        </Button>
      </Group>
    </Stack>
  );
}
