import { describe, expect, it } from 'bun:test';
import { useQuery } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryProvider } from '../app/lib/query';

function Probe({ data, updatedAt }: { data: string; updatedAt: number }) {
  const q = useQuery({
    queryKey: ['probe'],
    queryFn: async () => data,
    initialData: data,
    initialDataUpdatedAt: updatedAt,
  });
  return createElement('p', null, `${q.data}|${q.isFetching ? 'fetching' : 'idle'}`);
}

const ssr = (data: string, updatedAt: number) =>
  renderToString(createElement(QueryProvider, null, createElement(Probe, { data, updatedAt })));

describe('QueryProvider SSR', () => {
  it('uses fresh loader data per request instead of a previous request cache', () => {
    // An earlier request (another user, a minute ago) leaves stale data behind.
    ssr('user-a', Date.now() - 60_000);
    // The client hydrates this with a fresh cache: data "user-b", not fetching.
    expect(ssr('user-b', Date.now())).toBe('<p>user-b|idle</p>');
  });
});
