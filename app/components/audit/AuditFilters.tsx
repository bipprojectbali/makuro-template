import { Badge, Button, CloseButton, Group, Paper, Select, Text, TextInput } from '@mantine/core';
import { FiSearch, FiX } from 'react-icons/fi';
import {
  type AuditStats,
  actionMeta,
  DEFAULT_AUDIT_FILTERS,
  type AuditFilters as Filters,
  hasActiveAuditFilters,
  TARGET_LABELS,
} from '~/lib/audit-api';

const nf = new Intl.NumberFormat('id-ID');
const PERIODS = [
  { value: '1', label: '24 jam terakhir' },
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: 'all', label: 'Semua waktu' },
];

type Props = {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  stats: AuditStats | undefined;
  matchCount: number | undefined;
};

export function AuditFilters({ filters, onChange, stats, matchCount }: Props) {
  const active = hasActiveAuditFilters(filters);
  const actions = (stats?.topActions ?? [])
    .filter((a): a is { key: string; count: number } => Boolean(a.key))
    .map((a) => ({ value: a.key, label: `${actionMeta(a.key).label} (${a.count})` }));
  if (filters.action && !actions.some((a) => a.value === filters.action))
    actions.push({ value: filters.action, label: actionMeta(filters.action).label });
  const targets = (stats?.targets ?? [])
    .filter((t): t is { key: string; count: number } => Boolean(t.key))
    .map((t) => ({ value: t.key, label: TARGET_LABELS[t.key] ?? t.key }));
  const actor = filters.actorId
    ? stats?.topActors.find((a) => a.actorId === filters.actorId)
    : null;
  return (
    <Paper withBorder radius="md" p="sm">
      <Group gap="xs" wrap="wrap" align="center">
        <TextInput
          placeholder="Cari ringkasan, aktor, target, IP…"
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
          style={{ flex: '1 1 240px', minWidth: 0 }}
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 170 }}
          value={filters.period}
          onChange={(v) => onChange({ period: (v as Filters['period']) ?? 'all' })}
          data={PERIODS}
          allowDeselect={false}
          aria-label="Periode"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 200 }}
          placeholder="Semua aksi"
          value={filters.action}
          onChange={(v) => onChange({ action: v })}
          data={actions}
          clearable
          aria-label="Aksi"
        />
        <Select
          size="sm"
          w={{ base: '100%', sm: 150 }}
          placeholder="Semua target"
          value={filters.targetType}
          onChange={(v) => onChange({ targetType: v })}
          data={targets}
          clearable
          aria-label="Jenis target"
        />
        {filters.actorId && (
          <Badge
            size="lg"
            variant="light"
            rightSection={
              <CloseButton
                size="xs"
                aria-label="Hapus filter aktor"
                onClick={() => onChange({ actorId: null })}
              />
            }
          >
            Aktor: {actor?.name ?? actor?.email ?? filters.actorId}
          </Badge>
        )}
        {active && (
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={<FiX size={14} />}
            onClick={() => onChange(DEFAULT_AUDIT_FILTERS)}
          >
            Reset filter
          </Button>
        )}
      </Group>
      {matchCount !== undefined && (
        <Text size="xs" c="dimmed" mt="xs">
          {nf.format(matchCount)} entri {active ? 'cocok dengan filter' : 'tercatat'}
        </Text>
      )}
    </Paper>
  );
}
