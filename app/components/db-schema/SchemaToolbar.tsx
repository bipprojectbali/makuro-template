import {
  Button,
  Group,
  Paper,
  Popover,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import type { TableMeta } from '@server/db/schema-introspect';
import { FiHelpCircle, FiMaximize } from 'react-icons/fi';
import { ACCENT, type Direction, PK_COL } from './erd.layout';

type Props = {
  tables: TableMeta[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  direction: Direction;
  onDirection: (d: Direction) => void;
  compact: boolean;
  onCompact: (v: boolean) => void;
  onFit: () => void;
};

function Legend() {
  return (
    <Stack gap={6}>
      <Group gap="xs">
        <span style={{ width: 22, fontSize: 10, fontWeight: 700, color: PK_COL }}>PK</span>
        <Text size="xs">Primary key</Text>
      </Group>
      <Group gap="xs">
        <span style={{ width: 22, fontSize: 10, fontWeight: 700, color: ACCENT }}>FK</span>
        <Text size="xs">Foreign key, garis mengarah ke tabel yang dirujuk</Text>
      </Group>
      <Group gap="xs">
        <span
          style={{ width: 22, fontSize: 10, fontWeight: 700, color: 'var(--mantine-color-dimmed)' }}
        >
          UQ
        </span>
        <Text size="xs">Nilai unik</Text>
      </Group>
      <Group gap="xs">
        <span style={{ width: 22, fontSize: 11, color: ACCENT }}>?</span>
        <Text size="xs">Kolom boleh NULL</Text>
      </Group>
      <Group gap="xs">
        <span style={{ width: 22, fontFamily: 'monospace', fontSize: 11 }}>{'>|'}</span>
        <Text size="xs">Ujung bercabang = banyak, ujung garis = satu</Text>
      </Group>
      <Text size="xs" c="dimmed">
        Klik tabel untuk menyorot relasinya dan membuka detail. Klik area kosong untuk melepas.
      </Text>
    </Stack>
  );
}

/** Table picker, layout direction, compact mode, fit-to-screen, and legend. */
export function SchemaToolbar({
  tables,
  selectedId,
  onSelect,
  direction,
  onDirection,
  compact,
  onCompact,
  onFit,
}: Props) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <Select
          size="sm"
          w={{ base: '100%', sm: 240 }}
          placeholder="Cari / lompat ke tabel…"
          searchable
          clearable
          value={selectedId}
          onChange={onSelect}
          data={tables.map((t) => ({ value: t.id, label: `${t.name} (${t.columns.length})` }))}
          nothingFoundMessage="Tabel tidak ditemukan"
          aria-label="Pilih tabel"
        />
        <SegmentedControl
          size="sm"
          value={direction}
          onChange={(v) => onDirection(v as Direction)}
          data={[
            { value: 'LR', label: 'Kiri → kanan' },
            { value: 'TB', label: 'Atas → bawah' },
          ]}
        />
        <Switch
          size="sm"
          label="Hanya kolom kunci"
          checked={compact}
          onChange={(e) => onCompact(e.currentTarget.checked)}
        />
        <Button size="sm" variant="default" leftSection={<FiMaximize size={14} />} onClick={onFit}>
          Pas ke layar
        </Button>
        <Popover width={320} position="bottom-end" withArrow shadow="md">
          <Popover.Target>
            <Button
              size="sm"
              variant="subtle"
              color="gray"
              leftSection={<FiHelpCircle size={14} />}
            >
              Legenda
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Legend />
          </Popover.Dropdown>
        </Popover>
      </Group>
    </Paper>
  );
}
