import { useWindowScroll } from '@mantine/hooks';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  fetchServerLogs,
  mergeLogRows,
  type ServerLogFilters,
  type ServerLogRow,
  serverLogStreamUrl,
} from '~/lib/server-logs-api';

const MAX_ROWS = 300;
/** Same as the server ring buffer; streamed rows beyond it are gone server-side anyway. */
const STREAM_CAP = 1000;
/** Past this scroll offset the list is frozen so new rows never push what is being read. */
const FREEZE_OFFSET_PX = 160;
const STATS_REFRESH_MS = 2_000;

/**
 * Snapshot from GET /api/logs plus live rows over SSE. While the page is scrolled
 * down the visible list is frozen and new rows are only counted (`pending`).
 */
export function useLiveServerLogs(filters: ServerLogFilters, live: boolean) {
  const queryClient = useQueryClient();
  const logs = useQuery({
    queryKey: ['server-logs', filters],
    queryFn: () => fetchServerLogs(filters, MAX_ROWS),
    placeholderData: keepPreviousData,
  });
  const snapshot = logs.isPlaceholderData ? undefined : logs.data;
  const url = snapshot ? serverLogStreamUrl(filters, snapshot.rows[0]?.seq ?? 0) : null;
  // Keyed by stream URL: a new snapshot or filter starts from an empty list without a reset effect.
  const [stream, setStream] = useState<{ url: string | null; rows: ServerLogRow[] }>({
    url: null,
    rows: [],
  });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!live || !url) return;
    const es = new EventSource(url);
    let statsTimer: ReturnType<typeof setTimeout> | undefined;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      const row = JSON.parse(ev.data) as ServerLogRow;
      setStream((prev) => {
        const rows = prev.url === url ? prev.rows : [];
        // Events arrive in seq order; a replay after reconnect repeats rows we already have.
        if ((row.seq ?? 0) <= (rows[0]?.seq ?? 0)) return prev;
        return { url, rows: [row, ...rows].slice(0, STREAM_CAP) };
      });
      statsTimer ??= setTimeout(() => {
        statsTimer = undefined;
        void queryClient.invalidateQueries({ queryKey: ['server-logs-stats'] });
      }, STATS_REFRESH_MS);
    };
    return () => {
      es.close();
      clearTimeout(statsTimer);
      setConnected(false);
    };
  }, [live, url, queryClient]);

  const streamed = stream.url === url ? stream.rows : [];
  const merged = mergeLogRows(streamed, logs.data?.rows ?? []);

  const [{ y }, scrollTo] = useWindowScroll();
  const scrolled = y > FREEZE_OFFSET_PX;
  const topSeq = useRef(0);
  topSeq.current = merged[0]?.seq ?? 0;
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  useEffect(() => {
    setFrozenAt(scrolled ? topSeq.current : null);
  }, [scrolled]);

  const visible = frozenAt === null ? merged : merged.filter((r) => (r.seq ?? 0) <= frozenAt);
  return {
    logs,
    rows: visible.slice(0, MAX_ROWS),
    pending: merged.length - visible.length,
    connected,
    showNewest: () => scrollTo({ y: 0 }),
  };
}
