import { Group, Paper, Progress, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import type { Breakdown, VisitStats } from '~/lib/visits-api';
import { countryFlag, countryName, deviceLabel, percent, refererHost } from '~/lib/visits-format';

const nf = new Intl.NumberFormat('id-ID');

type RowProps = {
  label: string;
  count: number;
  pct: number;
  mono?: boolean;
  onClick?: () => void;
  ariaLabel: string;
};

function BreakdownRow({ label, count, pct, mono, onClick, ariaLabel }: RowProps) {
  const body = (
    <Stack gap={4} style={{ width: '100%' }}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" truncate ff={mono ? 'monospace' : undefined} style={{ minWidth: 0 }}>
          {label}
        </Text>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          {nf.format(count)} · {pct}%
        </Text>
      </Group>
      <Progress value={pct} size="xs" radius="xl" />
    </Stack>
  );
  if (!onClick) return <div>{body}</div>;
  return (
    <UnstyledButton
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ display: 'block', width: '100%' }}
    >
      {body}
    </UnstyledButton>
  );
}

type PanelProps = {
  title: string;
  items: Breakdown[];
  total: number;
  render: (key: string | null) => string;
  onSelect?: (key: string) => void;
  mono?: boolean;
  emptyText?: string;
};

function BreakdownPanel({ title, items, total, render, onSelect, mono, emptyText }: PanelProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.3} mb="sm">
        {title}
      </Text>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          {emptyText ?? 'Belum ada data.'}
        </Text>
      ) : (
        <Stack gap="xs">
          {items.map((it) => {
            const key = it.key;
            return (
              <BreakdownRow
                key={key ?? 'null'}
                label={render(key)}
                count={it.count}
                pct={percent(it.count, total)}
                mono={mono}
                onClick={onSelect && key ? () => onSelect(key) : undefined}
                ariaLabel={`Filter ${title}: ${render(key)}`}
              />
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

type Props = {
  stats: VisitStats;
  onCountry: (code: string) => void;
  onDevice: (type: string) => void;
};

/** Top-N breakdown panels. Country and device rows are clickable and apply the filter. */
export function VisitBreakdown({ stats, onCountry, onDevice }: Props) {
  const total = Math.max(1, stats.total);
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="sm">
      <BreakdownPanel
        title="Negara"
        items={stats.topCountries}
        total={total}
        render={(k) => `${countryFlag(k)} ${countryName(k)}`.trim()}
        onSelect={onCountry}
        emptyText="Belum ada data negara. Aktifkan header geo dari proxy (Cloudflare/Vercel/nginx)."
      />
      <BreakdownPanel
        title="Perangkat"
        items={stats.devices}
        total={total}
        render={(k) => deviceLabel(k)}
        onSelect={onDevice}
      />
      <BreakdownPanel
        title="Browser"
        items={stats.topBrowsers}
        total={total}
        render={(k) => k ?? 'Tidak dikenali'}
      />
      <BreakdownPanel
        title="Sistem operasi"
        items={stats.topOs}
        total={total}
        render={(k) => k ?? 'Tidak dikenali'}
      />
      <BreakdownPanel
        title="Halaman teratas"
        items={stats.topPaths}
        total={total}
        render={(k) => k ?? '—'}
        mono
      />
      <BreakdownPanel
        title="Sumber eksternal"
        items={stats.topReferers}
        total={total}
        render={(k) => refererHost(k) ?? '—'}
        emptyText="Belum ada kunjungan dari situs lain."
      />
    </SimpleGrid>
  );
}
