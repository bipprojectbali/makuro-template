import { Badge, Button, Code, Divider, Drawer, Group, Stack, Text } from '@mantine/core';
import { FiFilter, FiTrash2 } from 'react-icons/fi';
import type { LoginRow } from '~/lib/login-logs-api';
import {
  countryFlag,
  deviceLabel,
  formatDateTime,
  formatRelative,
  locationLabel,
} from '~/lib/visits-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { DeviceIcon, UserCell } from '../logs/LogCells';
import { MethodBadge } from './LoginCells';

type Props = {
  row: LoginRow | null;
  onClose: () => void;
  onDelete: (row: LoginRow) => void;
  onFilterUser: (userId: string) => void;
  deleting: boolean;
};

const dash = (v: string | null | undefined) => v || '—';

/** Full record for one login, with "show this user's logins" and delete actions. */
export function LoginDetailDrawer({ row, onClose, onDelete, onFilterUser, deleting }: Props) {
  return (
    <Drawer
      opened={row !== null}
      onClose={onClose}
      position="right"
      size="md"
      title="Detail login"
      padding="md"
    >
      {row && (
        <Stack gap="lg">
          <Group justify="space-between" wrap="nowrap">
            <MethodBadge method={row.method} />
            <Text size="sm" c="dimmed">
              {formatRelative(row.createdAt)}
            </Text>
          </Group>

          <Section title="User">
            <Group justify="space-between" wrap="nowrap">
              <UserCell row={row} subtitle={row.userEmail} />
              {row.userRole && (
                <Badge
                  variant="light"
                  color={
                    row.userRole === 'super-admin'
                      ? 'grape'
                      : row.userRole === 'admin'
                        ? 'blue'
                        : 'gray'
                  }
                >
                  {row.userRole}
                </Badge>
              )}
            </Group>
            <Field label="User ID">
              <Copyable value={row.userId} />
            </Field>
            <Button
              variant="light"
              size="xs"
              leftSection={<FiFilter size={12} />}
              onClick={() => onFilterUser(row.userId)}
              style={{ alignSelf: 'flex-end' }}
            >
              Lihat semua login user ini
            </Button>
          </Section>
          <Divider />

          <Section title="Waktu">
            <Field label="Tercatat">
              <Text size="sm">{formatDateTime(row.createdAt)}</Text>
            </Field>
          </Section>
          <Divider />

          <Section title="Asal">
            <Field label="IP">
              {row.ip ? <Copyable value={row.ip} /> : <Text size="sm">—</Text>}
            </Field>
            <Field label="Lokasi">
              <Text size="sm">
                {countryFlag(row.country)} {locationLabel(row)}
              </Text>
            </Field>
            {row.region && (
              <Field label="Wilayah">
                <Text size="sm">{row.region}</Text>
              </Field>
            )}
            <Field label="Bahasa">
              <Text size="sm">{dash(row.language)}</Text>
            </Field>
          </Section>
          <Divider />

          <Section title="Perangkat">
            <Field label="Jenis">
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <DeviceIcon type={row.deviceType} size={12} />
                <Text size="sm">{deviceLabel(row.deviceType)}</Text>
              </Group>
            </Field>
            <Field label="Browser">
              <Text size="sm">
                {row.browser
                  ? `${row.browser} ${row.browserVersion ?? ''}`.trim()
                  : 'Tidak dikenali'}
              </Text>
            </Field>
            <Field label="Sistem operasi">
              <Text size="sm">
                {row.os ? `${row.os} ${row.osVersion ?? ''}`.trim() : 'Tidak dikenali'}
              </Text>
            </Field>
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                User agent
              </Text>
              <Code block style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 12 }}>
                {dash(row.userAgent)}
              </Code>
            </Stack>
          </Section>
          <Divider />

          <Field label="Log ID">
            <Copyable value={row.id} />
          </Field>

          <Button
            color="red"
            variant="light"
            leftSection={<FiTrash2 size={14} />}
            loading={deleting}
            onClick={() => onDelete(row)}
            fullWidth
          >
            Hapus login log ini
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}
