/**
 * Human-readable catalog of the MCP tools this server exposes. Kept in sync
 * with the registrations by tests/mcp/tool-catalog.test.ts (names must match).
 */
export type ToolInfo = {
  name: string;
  description: string;
  group: 'status' | 'logs' | 'db' | 'code';
};

export const MCP_TOOL_CATALOG: ToolInfo[] = [
  { name: 'get_app_status', description: 'Environment, uptime, memori, port.', group: 'status' },
  {
    name: 'get_recent_errors',
    description: 'Entri warn/error/fatal terbaru dari buffer log.',
    group: 'logs',
  },
  {
    name: 'search_logs',
    description: 'Cari teks di buffer log (bisa dibatasi waktu).',
    group: 'logs',
  },
  { name: 'get_db_stats', description: 'Jumlah baris tabel utama.', group: 'db' },
  { name: 'list_users', description: 'Daftar user, filter nama/email.', group: 'db' },
  { name: 'get_active_sessions', description: 'Sesi yang masih berlaku.', group: 'db' },
  { name: 'get_recent_posts', description: 'Post terbaru.', group: 'db' },
  {
    name: 'check_file_health',
    description: 'Ukuran file vs limit + risiko konteks agent; panggil sebelum membaca file asing.',
    group: 'code',
  },
];
