import { SimpleGrid } from '@mantine/core';
import type { VisitStats } from '~/lib/visits-api';
import { countryFlag, countryName, deviceLabel, refererHost } from '~/lib/visits-format';
import { BreakdownPanel } from '../logs/BreakdownPanel';

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
