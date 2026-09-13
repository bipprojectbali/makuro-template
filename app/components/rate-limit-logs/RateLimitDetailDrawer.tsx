import { Button, Code, Divider, Drawer, Group, Stack, Text } from '@mantine/core';
import { FiFilter, FiTrash2 } from 'react-icons/fi';
import type { RateLimitRow } from '~/lib/rate-limit-logs-api';
import {
  countryFlag,
  deviceLabel,
  formatDateTime,
  formatRelative,
  locationLabel,
} from '~/lib/visits-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { DeviceIcon, UserCell } from '../logs/LogCells';
import { MethodBadge } from './RateLimitCells';

type Props = {
  row: RateLimitRow | null;
  onClose: () => void;
  onDelete: (row: RateLimitRow) => void;
  onFilterIp: (ip: string) => void;
  deleting: boolean;
};

const dash = (v: string | null | undefined) => v || '—';

/** Full record for one blocked request, with "show everything from this IP" and delete actions. */
export function RateLimitDetailDrawer({ row, onClose, onDelete, onFilterIp, deleting }: Props) {
  return (
    <Drawer
      opened={row !== null}
      onClose={onClose}
      position="right"
      size="md"
      title="Detail request diblokir"
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

          <Section title="Request">
            <Field label="Path">
              <Copyable value={row.path} />
            </Field>
            <Field label="Tercatat">
              <Text size="sm">{formatDateTime(row.createdAt)}</Text>
            </Field>
          </Section>
          <Divider />

          <Section title="Klien">
            <Field label="IP">
              {row.ip ? <Copyable value={row.ip} /> : <Text size="sm">Tidak diketahui</Text>}
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
            <Field label="User">
              <Group justify="flex-end">
                <UserCell row={row} />
              </Group>
            </Field>
            {row.ip && (
              <Button
                variant="light"
                size="xs"
                leftSection={<FiFilter size={12} />}
                onClick={() => onFilterIp(row.ip as string)}
                style={{ alignSelf: 'flex-end' }}
              >
                Lihat semua blokir dari IP ini
              </Button>
            )}
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
            Hapus catatan ini
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}
