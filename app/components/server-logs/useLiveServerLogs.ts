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

export const LOG_PAGE_SIZE = 50;
/** Same as the server ring buffer; streamed rows beyond it are gone server-side anyway. */
const STREAM_CAP = 1000;
/** Past this scroll offset the list is frozen so new rows never push what is being read. */
const FREEZE_OFFSET_PX = 160;
const STATS_REFRESH_MS = 2_000;

type Paging = { key: string; page: number; anchor: number | null };

/**
 * Page 1 = snapshot from GET /api/logs plus live rows over SSE; frozen while scrolled
 * down, new rows only counted (`pending`). Leaving page 1 pins an anchor seq so later
 * pages stay put; live rows then only count toward `pending`. Filter change → page 1.
 */
export function useLiveServerLogs(filters: ServerLogFilters, live: boolean) {
  const queryClient = useQueryClient();
  const key = JSON.stringify(filters);
  const [paging, setPaging] = useState<Paging>({ key, page: 1, anchor: null });
  const { page, anchor } = paging.key === key ? paging : { page: 1, anchor: null };

  const logs = useQuery({
    queryKey: ['server-logs', filters, page, anchor],
    queryFn: () => fetchServerLogs(filters, { page, limit: LOG_PAGE_SIZE, before: anchor }),
    placeholderData: keepPreviousData,
  });
  const snapshot = logs.isPlaceholderData ? undefined : logs.data;
  const after = page === 1 ? snapshot && (snapshot.rows[0]?.seq ?? 0) : anchor;
  const url = after === undefined || after === null ? null : serverLogStreamUrl(filters, after);
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
  const snapRows = logs.data?.rows ?? [];
  const merged = page === 1 ? mergeLogRows(streamed, snapRows) : snapRows;

  const [{ y }, scrollTo] = useWindowScroll();
  const scrolled = y > FREEZE_OFFSET_PX;
  const topSeq = useRef(0);
  topSeq.current = merged[0]?.seq ?? 0;
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  useEffect(() => {
    setFrozenAt(scrolled ? topSeq.current : null);
  }, [scrolled]);

  const visible =
    page !== 1 || frozenAt === null ? merged : merged.filter((r) => (r.seq ?? 0) <= frozenAt);
  const rows = visible.slice(0, LOG_PAGE_SIZE);
  const pending = page === 1 ? merged.length - visible.length : streamed.length;
  // Page 1 grows with live rows the snapshot did not count.
  const total = (logs.data?.total ?? 0) + (page === 1 ? visible.length - snapRows.length : 0);

  const goTo = (next: number) => {
    setPaging({
      key,
      page: next,
      anchor: next === 1 ? null : (anchor ?? rows[0]?.seq ?? null),
    });
    scrollTo({ y: 0 });
  };

  return {
    logs,
    rows,
    page,
    total,
    pending,
    connected,
    goTo,
    showNewest: () => goTo(1),
  };
}
