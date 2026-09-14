import { Alert, Badge, Button, Divider, Drawer, Group, Stack, Tabs, Text } from '@mantine/core';
import { FiActivity, FiEdit2, FiInfo, FiRefreshCw, FiSlash, FiTrash2 } from 'react-icons/fi';
import { type ApiKeyRow, maskedKey, rateLimitLabel, STATUS_META } from '~/lib/api-keys-api';
import { countryFlag, formatDateTime, formatRelative } from '~/lib/visits-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { UserCell } from '../logs/LogCells';
import { ExpiryCell, KeyStatusBadge, ScopeChips } from './ApiKeyCells';
import type { ApiKeyHandlers } from './ApiKeyTable';
import { ApiKeyUsagePanel } from './ApiKeyUsagePanel';

type Props = {
  keyRow: ApiKeyRow | null;
  onClose: () => void;
  soonDays: number;
  h: Pick<ApiKeyHandlers, 'busyId' | 'onEdit' | 'onToggle' | 'onRotate' | 'onRevoke' | 'onDelete'>;
};

/** Full metadata + usage for one key, with the same actions as the table menu. */
export function ApiKeyDetailDrawer({ keyRow: k, onClose, soonDays, h }: Props) {
  const gone = k?.status === 'revoked';
  const busy = k ? h.busyId === k.id : false;
  return (
    <Drawer
      opened={k !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title="Detail API key"
      padding="md"
    >
      {k && (
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xs">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={600} size="lg" lh={1.2} style={{ wordBreak: 'break-word' }}>
                {k.name}
              </Text>
              <Text size="sm" c="dimmed" ff="monospace">
                {maskedKey(k)}
              </Text>
            </Stack>
            <KeyStatusBadge status={k.status} />
          </Group>
          {k.status === 'rotating' && (
            <Alert color="yellow" variant="light" icon={<FiRefreshCw size={16} />}>
              Kunci ini sudah dirotasi. Masih diterima sampai{' '}
              {k.expiresAt ? formatDateTime(k.expiresAt) : 'masa tenggang berakhir'}; pindahkan
              integrasi ke kunci penggantinya.
            </Alert>
          )}
          {k.status === 'revoked' && (
            <Alert color="red" variant="light" icon={<FiSlash size={16} />}>
              Dicabut {k.revokedAt ? formatRelative(k.revokedAt) : ''}. Disimpan hanya sebagai
              riwayat; tidak bisa diaktifkan lagi.
            </Alert>
          )}
          <Group gap="xs" wrap="wrap">
            <Button
              size="xs"
              variant="light"
              leftSection={<FiEdit2 size={13} />}
              disabled={gone}
              onClick={() => h.onEdit(k)}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="light"
              color={k.enabled ? 'orange' : 'teal'}
              disabled={gone}
              loading={busy}
              onClick={() => h.onToggle(k)}
            >
              {k.enabled ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<FiRefreshCw size={13} />}
              disabled={gone}
              loading={busy}
              onClick={() => h.onRotate(k)}
            >
              Rotasi
            </Button>
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<FiSlash size={13} />}
              disabled={gone}
              loading={busy}
              onClick={() => h.onRevoke(k)}
            >
              Cabut
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<FiTrash2 size={13} />}
              loading={busy}
              onClick={() => h.onDelete(k)}
            >
              Hapus
            </Button>
          </Group>
          <Tabs defaultValue="detail" keepMounted={false}>
            <Tabs.List>
              <Tabs.Tab value="detail" leftSection={<FiInfo size={14} />}>
                Detail
              </Tabs.Tab>
              <Tabs.Tab value="usage" leftSection={<FiActivity size={14} />}>
                Penggunaan
              </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="detail" pt="md">
              <Stack gap="lg">
                <Section title="Akses">
                  <Field label="Pemilik">
                    <Group justify="flex-end">
                      <UserCell
                        row={{ userId: k.ownerId, userName: k.ownerName, userImage: k.ownerImage }}
                        subtitle={k.ownerEmail}
                      />
                    </Group>
                  </Field>
                  <Field label="Role pemilik">
                    <Badge size="sm" variant="light">
                      {k.ownerRole ?? 'user'}
                    </Badge>
                  </Field>
                  <Field label="Scope">
                    <Group justify="flex-end">
                      <ScopeChips scopes={k.scopes} max={20} />
                    </Group>
                  </Field>
                  <Field label="IP diizinkan">
                    <Text size="sm" ff={k.allowedIps ? 'monospace' : undefined}>
                      {k.allowedIps ? k.allowedIps.split('\n').join(', ') : 'Semua IP'}
                    </Text>
                  </Field>
                  <Field label="Rate limit">
                    <Text size="sm">{rateLimitLabel(k)}</Text>
                  </Field>
                </Section>
                <Divider />
                <Section title="Masa berlaku">
                  <Field label="Status">
                    <Text size="sm">{STATUS_META[k.status].hint}</Text>
                  </Field>
                  <Field label="Kedaluwarsa">
                    <Group justify="flex-end">
                      <ExpiryCell k={k} soonDays={soonDays} />
                    </Group>
                  </Field>
                  <Field label="Dibuat">
                    <Text size="sm">{formatDateTime(k.createdAt)}</Text>
                  </Field>
                  <Field label="Diubah">
                    <Text size="sm">{formatRelative(k.updatedAt)}</Text>
                  </Field>
                  {k.rotatedFromId && (
                    <Field label="Rotasi dari">
                      <Copyable value={k.rotatedFromId} />
                    </Field>
                  )}
                </Section>
                <Divider />
                <Section title="Aktivitas terakhir">
                  <Field label="Request">
                    <Text size="sm">
                      {k.lastRequest ? formatDateTime(k.lastRequest) : 'Belum pernah'}
                    </Text>
                  </Field>
                  <Field label="Dari IP">
                    <Text size="sm" ff="monospace">
                      {k.lastIp ?? '—'}
                      {k.lastCountry ? ` ${countryFlag(k.lastCountry)}` : ''}
                    </Text>
                  </Field>
                  <Field label="ID kunci">
                    <Copyable value={k.id} />
                  </Field>
                </Section>
                {k.note && (
                  <>
                    <Divider />
                    <Section title="Catatan">
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {k.note}
                      </Text>
                    </Section>
                  </>
                )}
              </Stack>
            </Tabs.Panel>
            <Tabs.Panel value="usage" pt="md">
              <ApiKeyUsagePanel keyId={k.id} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </Drawer>
  );
}
