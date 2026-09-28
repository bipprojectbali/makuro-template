import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Glob } from 'bun';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from 'react-router';
import { type RenderClock, requestClock, useTimeFormat } from '../app/lib/time-format';
import { formatDateTime } from '../app/lib/visits-format';

const ROOT = path.join(import.meta.dir, '..');
const withCookie = (cookie: string) => new Request('http://x/', { headers: { cookie } });

describe('requestClock', () => {
  it('uses the browser zone from the tz cookie', () => {
    const c = requestClock(withCookie('a=1; tz=Asia%2FMakassar; b=2'), 123);
    expect(c).toEqual({ now: 123, timeZone: 'Asia/Makassar' });
  });

  it('falls back to the server zone for missing, unknown or malformed cookies', () => {
    const server = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(requestClock(new Request('http://x/')).timeZone).toBe(server);
    expect(requestClock(withCookie('tz=Mars%2FOlympus')).timeZone).toBe(server);
    expect(requestClock(withCookie('tz=%E0%A4%A')).timeZone).toBe(server);
  });
});

describe('formatDateTime', () => {
  it('renders the instant in the requested zone', () => {
    const iso = '2026-09-28T00:30:00.000Z';
    expect(formatDateTime(iso, 'UTC')).toContain('00.30.00');
    expect(formatDateTime(iso, 'Asia/Jayapura')).toContain('09.30.00');
  });
});

function Probe() {
  const t = useTimeFormat();
  return createElement(
    'p',
    null,
    `${t.relative('2026-01-01T00:00:00.000Z')}|${t.dateTime('2026-01-01T00:00:00.000Z')}`,
  );
}

async function ssr(clock: RenderClock) {
  const handler = createStaticHandler([
    { id: 'root', path: '/', loader: () => ({ clock }), Component: Probe },
  ]);
  const context = await handler.query(new Request('http://x/'));
  if (context instanceof Response) throw new Error(`Unexpected redirect ${context.status}`);
  const router = createStaticRouter(handler.dataRoutes, context);
  return renderToString(createElement(StaticRouterProvider, { router, context, hydrate: false }));
}

describe('useTimeFormat SSR', () => {
  it('prints times from the root clock, not the server zone or current time', async () => {
    const now = Date.parse('2026-01-01T03:00:00.000Z');
    const html = await ssr({ now, timeZone: 'Asia/Jayapura' });
    expect(html).toContain('3 jam yang lalu|01 Jan 2026, 09.00.00');
  });
});

describe('time formatting call sites', () => {
  it('components and routes render times through useTimeFormat', () => {
    // Direct use formats with the runtime zone/clock, which differ between server and browser.
    const direct =
      /import \{[^}]*\bformat(DateTime|Relative)\b[^}]*\} from '~\/lib\/visits-format'/;
    const offenders = [...new Glob('app/{components,routes}/**/*.tsx').scanSync(ROOT)].filter(
      (rel) => direct.test(readFileSync(path.join(ROOT, rel), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
