import {
  Button,
  CloseButton,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Text,
  TextInput,
} from '@mantine/core';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  type ContextHazard,
  DEFAULT_FILE_FILTERS,
  type FileHealthSummary,
  type FileKind,
  type FileHealthFilters as Filters,
  fmtNum,
  KIND_LABELS,
} from '~/lib/file-health-api';

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  summary: FileHealthSummary | undefined;
  matchCount: number | undefined;
};

const SORTS = [
  { value: 'ratio', label: 'Terparah dulu' },
  { value: 'lines', label: 'Baris terbanyak' },
  { value: 'tokens', label: 'Token terbanyak' },
  { value: 'path', label: 'Path A–Z' },
];

const HAZARDS = [
  { value: 'danger', label: 'Bahaya' },
  { value: 'caution', label: 'Hati-hati' },
  { value: 'none', label: 'Aman' },
];

/** Toolbar: search, status segment, kind/hazard/sort selects, and a reset button. */
export function FileHealthFilters({ filters, onChange, summary, matchCount }: Props) {
  const kinds = (summary?.byKind ?? []).map((k) => ({
    value: k.kind,
    label: `${KIND_LABELS[k.kind]} (${k.count})`,
  }));
  const active =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.kind !== null ||
    filters.hazard !== null;

  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari path file…"
          leftSection={<FiSearch size={14} />}
          rightSection={
            filters.search ? (
              <CloseButton
                size="sm"
                aria-label="Bersihkan"
                onClick={() => onChange({ search: '' })}
              />
            ) : null
          }
          value={filters.search}
          onChange={(e) => onChange({ search: e.currentTarget.value })}
          size="sm"
          style={{ flex: '1 1 220px', minWidth: 0 }}
        />
        <SegmentedControl
          size="sm"
          value={filters.status}
          onChange={(v) => onChange({ status: v as Filters['status'] })}
          data={[
            { value: 'all', label: 'Semua' },
            { value: 'over', label: 'Lewat' },
            { value: 'warn', label: 'Hampir' },
            { value: 'ok', label: 'Sehat' },
            { value: 'excluded', label: 'Dikecualikan' },
          ]}
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 210 }}
          placeholder="Semua jenis"
          value={filters.kind}
          onChange={(v) => onChange({ kind: v as FileKind | null })}
          data={kinds}
          clearable
          searchable
          aria-label="Jenis file"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 150 }}
          placeholder="Semua konteks"
          value={filters.hazard}
          onChange={(v) => onChange({ hazard: v as ContextHazard | null })}
          data={HAZARDS}
          clearable
          aria-label="Risiko konteks"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 170 }}
          value={filters.sort}
          onChange={(v) => onChange({ sort: (v as Filters['sort']) ?? 'ratio' })}
          data={SORTS}
          allowDeselect={false}
          aria-label="Urutkan"
        />
        {active && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<FiX size={14} />}
            onClick={() => onChange(DEFAULT_FILE_FILTERS)}
          >
            Reset
          </Button>
        )}
      </Group>
      {matchCount !== undefined && (
        <Text size="xs" c="dimmed" mt="xs">
          {fmtNum(matchCount)} file {active ? 'cocok dengan filter' : 'dipindai'}
        </Text>
      )}
    </Paper>
  );
}
