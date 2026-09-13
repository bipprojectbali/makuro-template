import { Anchor, Button, Code, Divider, Drawer, Group, Stack, Text } from '@mantine/core';
import { FiExternalLink, FiTrash2 } from 'react-icons/fi';
import type { VisitRow } from '~/lib/visits-api';
import {
  botKindLabel,
  countryFlag,
  deviceLabel,
  formatDateTime,
  formatRelative,
  locationLabel,
} from '~/lib/visits-format';
import { Copyable, Field, Section } from '../logs/DetailParts';
import { DeviceIcon, TypeBadge, UserCell } from './VisitCells';

type Props = {
  row: VisitRow | null;
  onClose: () => void;
  onDelete: (row: VisitRow) => void;
  deleting: boolean;
};

const dash = (v: string | null | undefined) => v || '—';

/** Full record view for one visit — everything the middleware captured, plus a delete action. */
export function VisitDetailDrawer({ row, onClose, onDelete, deleting }: Props) {
  return (
    <Drawer
      opened={row !== null}
      onClose={onClose}
      position="right"
      size="md"
      title="Detail kunjungan"
      padding="md"
    >
      {row && (
        <Stack gap="lg">
          <Group justify="space-between" wrap="nowrap">
            <TypeBadge row={row} />
            <Text size="sm" c="dimmed">
              {formatRelative(row.createdAt)}
            </Text>
          </Group>

          <Section title="Waktu">
            <Field label="Tercatat">
              <Text size="sm">{formatDateTime(row.createdAt)}</Text>
            </Field>
          </Section>
          <Divider />

          <Section title="Pengunjung">
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
            <Field label="User">
              <Group justify="flex-end">
                <UserCell row={row} />
              </Group>
            </Field>
          </Section>
          <Divider />

          <Section title="Halaman">
            <Field label="Path">
              <Copyable value={row.path} />
            </Field>
            <Field label="Referer">
              {row.referer ? (
                <Anchor
                  href={row.referer}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  style={{ wordBreak: 'break-all' }}
                >
                  {row.referer} <FiExternalLink size={11} />
                </Anchor>
              ) : (
                <Text size="sm">Langsung / tidak ada</Text>
              )}
            </Field>
          </Section>
          <Divider />

          <Section title="Perangkat">
            <Field label="Jenis">
              <Group gap="xs" justify="flex-end" wrap="nowrap">
                <DeviceIcon type={row.deviceType} size={12} />
                <Text size="sm">
                  {row.isBot ? botKindLabel(row.botKind) : deviceLabel(row.deviceType)}
                </Text>
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

          <Field label="ID">
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
            Hapus kunjungan ini
          </Button>
        </Stack>
      )}
    </Drawer>
  );
}
