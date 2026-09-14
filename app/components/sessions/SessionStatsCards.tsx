import { FiClock, FiMonitor, FiUserCheck, FiUsers, FiZap } from 'react-icons/fi';
import type { SessionStats } from '~/lib/sessions-api';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

export function SessionStatsCards({ stats }: { stats: SessionStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    {
      label: 'Sesi aktif',
      value: nf.format(stats.active),
      hint: `${nf.format(stats.users)} user`,
      icon: FiMonitor,
    },
    {
      label: 'Aktif 1 jam',
      value: nf.format(stats.activeLastHour),
      hint: 'ada aktivitas baru',
      icon: FiZap,
      color: 'cyan',
    },
    {
      label: `Berakhir < ${stats.soonHours} jam`,
      value: nf.format(stats.expiringSoon),
      hint: 'akan minta masuk ulang',
      icon: FiClock,
      color: 'yellow',
    },
    {
      label: 'Impersonasi',
      value: nf.format(stats.impersonated),
      hint: 'sesi admin sebagai user',
      icon: FiUserCheck,
      color: stats.impersonated > 0 ? 'orange' : 'gray',
    },
    {
      label: 'Kedaluwarsa',
      value: nf.format(stats.expired),
      hint: 'baris lama, dibersihkan Better Auth',
      icon: FiUsers,
      color: 'gray',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
