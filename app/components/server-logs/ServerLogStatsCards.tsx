import {
  FiAlertOctagon,
  FiAlertTriangle,
  FiClock,
  FiDatabase,
  FiInfo,
  FiLayers,
} from 'react-icons/fi';
import type { ServerLogStats } from '~/lib/server-logs-api';
import { formatRelative } from '~/lib/visits-format';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

export function ServerLogStatsCards({ stats }: { stats: ServerLogStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    {
      label: 'Error 1 jam',
      value: nf.format(stats.errorsLastHour),
      hint: stats.errorsLastHour > 0 ? 'perlu ditinjau' : 'tidak ada',
      icon: FiAlertOctagon,
      color: stats.errorsLastHour > 0 ? 'red' : 'teal',
    },
    {
      label: 'Warning 1 jam',
      value: nf.format(stats.warningsLastHour),
      hint: 'anomali non-fatal',
      icon: FiAlertTriangle,
      color: 'yellow',
    },
    {
      label: 'Info di buffer',
      value: nf.format(stats.byLevel.info ?? 0),
      hint: 'lifecycle & request',
      icon: FiInfo,
      color: 'blue',
    },
    {
      label: 'Total error',
      value: nf.format((stats.byLevel.error ?? 0) + (stats.byLevel.fatal ?? 0)),
      hint: 'sejak proses mulai / buffer terisi',
      icon: FiLayers,
      color: 'grape',
    },
    {
      label: 'Buffer',
      value: `${nf.format(stats.size)}/${nf.format(stats.capacity)}`,
      hint: 'entri tersimpan di memori',
      icon: FiDatabase,
      color: 'indigo',
    },
    {
      label: 'Entri tertua',
      value: stats.oldest ? formatRelative(new Date(stats.oldest).toISOString()) : '—',
      hint: 'jangkauan buffer',
      icon: FiClock,
      color: 'cyan',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
