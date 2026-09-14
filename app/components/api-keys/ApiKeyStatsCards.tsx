import { FiActivity, FiAlertTriangle, FiClock, FiKey, FiUsers, FiXCircle } from 'react-icons/fi';
import type { ApiKeyStats } from '~/lib/api-keys-api';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

export function ApiKeyStatsCards({ stats }: { stats: ApiKeyStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    {
      label: 'Kunci aktif',
      value: nf.format(stats.active),
      hint: `dari ${nf.format(stats.total)} kunci`,
      icon: FiKey,
    },
    {
      label: `Berakhir < ${stats.expiringSoonDays} hari`,
      value: nf.format(stats.expiringSoon),
      hint: 'rotasi sebelum putus',
      icon: FiClock,
      color: stats.expiringSoon > 0 ? 'yellow' : 'gray',
    },
    {
      label: 'Request 24 jam',
      value: nf.format(stats.usage24h),
      hint: 'lewat API key',
      icon: FiActivity,
      color: 'cyan',
    },
    {
      label: 'Error 24 jam',
      value: nf.format(stats.errors24h),
      hint: 'status ≥ 400',
      icon: FiAlertTriangle,
      color: stats.errors24h > 0 ? 'orange' : 'gray',
    },
    {
      label: 'Pemilik',
      value: nf.format(stats.owners),
      hint: 'user yang punya kunci',
      icon: FiUsers,
      color: 'grape',
    },
    {
      label: 'Dicabut',
      value: nf.format(stats.revoked),
      hint: 'disimpan sebagai riwayat',
      icon: FiXCircle,
      color: 'gray',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
