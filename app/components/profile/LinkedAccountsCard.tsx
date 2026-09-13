import { Badge, Button, Group, Text, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useMutation } from '@tanstack/react-query';
import { FcGoogle } from 'react-icons/fc';
import { FiKey, FiLink, FiLink2 } from 'react-icons/fi';
import { authClient } from '~/lib/auth-client';
import { type LinkedAccount, providerLabel } from '~/lib/profile-api';
import { formatRelative } from '~/lib/visits-format';
import { SettingRow, SettingsCard } from '../settings/SettingsParts';

type Props = {
  accounts: LinkedAccount[];
  googleEnabled: boolean;
  loading: boolean;
  onChanged: () => void;
};

/** Providers linked to this account; link Google, unlink when another way in remains. */
export function LinkedAccountsCard({ accounts, googleEnabled, loading, onChanged }: Props) {
  const hasGoogle = accounts.some((a) => a.providerId === 'google');
  const fail = (title: string) => (e: Error) =>
    notifications.show({ color: 'red', title, message: e.message });

  const unlink = useMutation({
    mutationFn: async (account: LinkedAccount) => {
      // This Better Auth version keys unlinking by the provider's account id.
      const { error } = await authClient.unlinkAccount({
        accountId: account.accountId ?? account.id,
      });
      if (error) throw new Error(error.message ?? 'Server menolak');
    },
    onSuccess: () => {
      notifications.show({ color: 'teal', message: 'Akun dilepas.' });
      onChanged();
    },
    onError: fail('Gagal melepas akun'),
  });
  const link = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.linkSocial({
        provider: 'google',
        callbackURL: '/profile',
      });
      if (error) throw new Error(error.message ?? 'Server menolak');
    },
    onError: fail('Gagal menautkan Google'),
  });

  const confirmUnlink = (a: LinkedAccount) =>
    modals.openConfirmModal({
      title: `Lepas ${providerLabel(a.providerId)}?`,
      children: (
        <Text size="sm">
          Anda tidak bisa lagi masuk lewat {providerLabel(a.providerId)}. Cara masuk lainnya tetap
          berlaku.
        </Text>
      ),
      labels: { confirm: 'Lepas akun', cancel: 'Batal' },
      confirmProps: { color: 'red' },
      onConfirm: () => unlink.mutate(a),
    });

  return (
    <SettingsCard
      title="Cara masuk"
      description="Provider yang tertaut ke akun ini. Sisakan minimal satu cara masuk."
    >
      {loading && (
        <Text size="sm" c="dimmed">
          Memuat…
        </Text>
      )}
      {accounts.map((a) => (
        <SettingRow
          key={a.id}
          label={providerLabel(a.providerId)}
          description={a.createdAt ? `Tertaut ${formatRelative(String(a.createdAt))}` : 'Tertaut'}
          badge={
            <Badge
              size="xs"
              variant="light"
              leftSection={a.providerId === 'google' ? <FcGoogle size={11} /> : <FiKey size={11} />}
            >
              {a.providerId}
            </Badge>
          }
          control={
            <Tooltip
              label="Tidak bisa dilepas: ini satu-satunya cara masuk"
              disabled={accounts.length > 1}
              withArrow
            >
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<FiLink2 size={12} />}
                disabled={accounts.length <= 1}
                loading={unlink.isPending}
                onClick={() => confirmUnlink(a)}
              >
                Lepas
              </Button>
            </Tooltip>
          }
        />
      ))}
      {googleEnabled && !hasGoogle && (
        <Group justify="flex-end">
          <Button
            size="sm"
            variant="default"
            leftSection={<FiLink size={14} />}
            loading={link.isPending}
            onClick={() => link.mutate()}
          >
            Tautkan Google
          </Button>
        </Group>
      )}
    </SettingsCard>
  );
}
