import { useSyncExternalStore } from 'react';
import { useRouteLoaderData } from 'react-router';
import { formatDateTime, formatRelative } from './visits-format';

/** Clock shared by the SSR render and its hydration so both print identical times. */
export type RenderClock = { now: number; timeZone: string };

const TZ_COOKIE = 'tz';
const TZ_COOKIE_RE = new RegExp(`(?:^|;\\s*)${TZ_COOKIE}=([^;]+)`);

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Request time + the browser's zone (remembered in a cookie), else the server's zone. */
export function requestClock(request: Request, now = Date.now()): RenderClock {
  const raw = request.headers.get('cookie')?.match(TZ_COOKIE_RE)?.[1];
  let tz: string | undefined;
  try {
    tz = raw ? decodeURIComponent(raw) : undefined;
  } catch {
    tz = undefined; // malformed cookie → treat as absent
  }
  return {
    now,
    timeZone: tz && isTimeZone(tz) ? tz : Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/** Lets the next SSR render in the browser's zone, so hydration needs no text swap. */
export function rememberTimeZone(): void {
  const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available in Firefox
  document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax`;
}

const subscribeNever = () => () => {};

/** false during SSR and the hydration render, true afterwards (and on client-only mounts). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * Time formatters that are deterministic across SSR and hydration: the first render
 * uses the root loader's clock, then React re-renders with the browser's zone and time.
 * Formatting with the runtime zone/`Date.now()` directly makes server text differ from
 * the client, and React then regenerates the whole tree (flicker, lost scroll).
 */
export function useTimeFormat() {
  const clock = useRouteLoaderData<{ clock?: RenderClock }>('root')?.clock;
  const fixed = !useHydrated() && clock ? clock : null;
  const timeZone = fixed?.timeZone;
  const now = () => fixed?.now ?? Date.now();
  return {
    now,
    dateTime: (iso: string) => formatDateTime(iso, timeZone),
    relative: (iso: string) => formatRelative(iso, now(), timeZone),
  };
}
