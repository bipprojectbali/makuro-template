import type { DevOverview } from '@server/dev-overview';
import { FiActivity, FiFileText, FiLogIn, FiShield, FiSlash, FiUsers } from 'react-icons/fi';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

/** Six headline numbers: users, activity, security, code health. */
export function OverviewStats({ data }: { data: DevOverview }) {
  const tiles: StatTileProps[] = [
    {
      label: 'User',
      value: nf.format(data.users.total),
      hint: `${nf.format(data.users.new7d)} baru 7 hari · ${nf.format(data.users.banned)} banned`,
      icon: FiUsers,
    },
    {
      label: 'Login 24 jam',
      value: nf.format(data.logins.last24h),
      hint: `${nf.format(data.users.active24h)} user aktif hari ini`,
      icon: FiLogIn,
      color: 'teal',
    },
    {
      label: 'Kunjungan 24 jam',
      value: nf.format(data.visits.last24h),
      hint: `${nf.format(data.visits.last7d)} dalam 7 hari`,
      icon: FiActivity,
      color: 'cyan',
    },
    {
      label: 'Diblokir 1 jam',
      value: nf.format(data.rateLimits.last1h),
      hint: data.rateLimits.config.enabled
        ? `batas ${nf.format(data.rateLimits.config.limit)} / ${Math.round(data.rateLimits.config.windowMs / 1000)} dtk`
        : 'rate limiting NONAKTIF',
      icon: FiShield,
      color: data.rateLimits.config.enabled
        ? data.rateLimits.last1h > 0
          ? 'orange'
          : 'indigo'
        : 'red',
    },
    {
      label: 'Bot 24 jam',
      value: nf.format(data.visits.bots),
      hint: 'kunjungan terdeteksi bot (semua waktu)',
      icon: FiSlash,
      color: 'gray',
    },
    {
      label: 'File health',
      value: data.fileHealth ? nf.format(data.fileHealth.over) : '—',
      hint: data.fileHealth
        ? `lewat limit · ${nf.format(data.fileHealth.warn)} hampir · ${nf.format(data.fileHealth.danger)} bahaya konteks`
        : 'tidak tersedia di binary',
      icon: FiFileText,
      color: data.fileHealth && data.fileHealth.over > 0 ? 'yellow' : 'teal',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
