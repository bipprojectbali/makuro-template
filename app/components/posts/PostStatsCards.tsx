import { FiEdit3, FiFileText, FiRefreshCw, FiUsers } from 'react-icons/fi';
import type { PostStats } from '~/lib/posts-api';
import { StatTileGrid, type StatTileProps } from '../logs/StatTile';

const nf = new Intl.NumberFormat('id-ID');

export function PostStatsCards({ stats }: { stats: PostStats | undefined }) {
  const tiles: StatTileProps[] | undefined = stats && [
    {
      label: 'Total post',
      value: nf.format(stats.total),
      hint: `${nf.format(stats.authors)} penulis`,
      icon: FiFileText,
    },
    {
      label: '7 hari terakhir',
      value: nf.format(stats.last7d),
      hint: `${nf.format(stats.last30d)} dalam 30 hari`,
      icon: FiRefreshCw,
      color: 'cyan',
    },
    {
      label: 'Pernah diubah',
      value: nf.format(stats.edited),
      hint: 'diedit setelah terbit',
      icon: FiEdit3,
      color: 'grape',
    },
    {
      label: 'Penulis teratas',
      value: stats.topAuthors[0]?.name ?? '—',
      hint: stats.topAuthors[0] ? `${nf.format(stats.topAuthors[0].count)} post` : 'belum ada',
      icon: FiUsers,
      color: 'teal',
    },
  ];
  return <StatTileGrid tiles={tiles} />;
}
