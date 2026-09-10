import { describe, expect, test } from 'bun:test';
import type { ServerResponse } from 'node:http';
import { nodeToWebRequest, writeWebResponse } from './http-bridge';

function mockServerResponse() {
  const headers: Record<string, string | string[]> = {};
  let statusCode = 200;
  const chunks: Buffer[] = [];

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(v: number) {
      statusCode = v;
    },
    setHeader(key: string, value: string | string[]) {
      headers[key.toLowerCase()] = value;
    },
    write(chunk: Buffer) {
      chunks.push(chunk);
    },
    end() {},
    get headers() {
      return headers;
    },
    get body() {
      return Buffer.concat(chunks).toString();
    },
  };
  return res as unknown as ServerResponse & { headers: typeof headers; body: string };
}

// ─── writeWebResponse ─────────────────────────────────────────────────────────

describe('writeWebResponse — Set-Cookie handling', () => {
  test('single Set-Cookie header is forwarded', async () => {
    const webRes = new Response('ok', {
      status: 200,
      headers: [['set-cookie', 'token=abc; Path=/; HttpOnly']],
    });
    const res = mockServerResponse();
    await writeWebResponse(res, webRes);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const arr = Array.isArray(cookies) ? cookies : [cookies];
    expect(arr.some((c) => c.includes('token=abc'))).toBe(true);
  });

  test('multiple Set-Cookie headers are all preserved (not overwritten)', async () => {
    // This is the critical bug test: Node's setHeader overwrites on repeated calls,
    // so without special handling only the last cookie survives.
    const webRes = new Response('ok', {
      status: 200,
      headers: [
        ['set-cookie', 'session=sess123; Path=/; HttpOnly; SameSite=Lax'],
        ['set-cookie', 'csrf=csrf456; Path=/; SameSite=Strict'],
      ],
    });
    const res = mockServerResponse();
    await writeWebResponse(res, webRes);

    const cookies = res.headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);
    expect((cookies as string[]).length).toBe(2);
    expect((cookies as string[]).some((c) => c.includes('session=sess123'))).toBe(true);
    expect((cookies as string[]).some((c) => c.includes('csrf=csrf456'))).toBe(true);
  });

  test('status code is forwarded correctly', async () => {
    const webRes = new Response(null, { status: 302, headers: { Location: '/dev' } });
    const res = mockServerResponse();
    await writeWebResponse(res, webRes);
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe('/dev');
  });

  test('response body is streamed', async () => {
    const webRes = new Response('hello world');
    const res = mockServerResponse();
    await writeWebResponse(res, webRes);
    expect(res.body).toBe('hello world');
  });
});

// ─── nodeToWebRequest ─────────────────────────────────────────────────────────

describe('nodeToWebRequest', () => {
  function makeIncomingMessage(opts: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
  }) {
    const { EventEmitter } = require('node:events') as typeof import('node:events');
    const em = new EventEmitter() as NodeJS.EventEmitter & {
      method: string;
      url: string;
      headers: Record<string, string>;
      socket: { encrypted?: boolean };
    };
    em.method = opts.method ?? 'GET';
    em.url = opts.url ?? '/';
    em.headers = opts.headers ?? {};
    em.socket = {};
    // Emit body asynchronously so callers can await
    if (opts.body) {
      setTimeout(() => {
        em.emit('data', Buffer.from(opts.body!));
        em.emit('end');
      }, 0);
    } else {
      setTimeout(() => em.emit('end'), 0);
    }
    return em;
  }

  test('copies URL and method', async () => {
    const msg = makeIncomingMessage({ method: 'POST', url: '/api/test?foo=bar' });
    // @ts-ignore — duck-typed IncomingMessage
    const req = await nodeToWebRequest(msg);
    expect(req.method).toBe('POST');
    expect(new URL(req.url).pathname).toBe('/api/test');
    expect(new URL(req.url).searchParams.get('foo')).toBe('bar');
  });

  test('copies headers including Cookie', async () => {
    const msg = makeIncomingMessage({
      headers: {
        cookie: 'session=abc; csrf=def',
        'content-type': 'application/json',
      },
    });
    // @ts-ignore
    const req = await nodeToWebRequest(msg);
    expect(req.headers.get('cookie')).toBe('session=abc; csrf=def');
    expect(req.headers.get('content-type')).toBe('application/json');
  });

  test('GET request has no body', async () => {
    const msg = makeIncomingMessage({ method: 'GET' });
    // @ts-ignore
    const req = await nodeToWebRequest(msg);
    expect(req.body).toBeNull();
  });

  test('POST request body is readable', async () => {
    const msg = makeIncomingMessage({ method: 'POST', body: '{"x":1}' });
    // @ts-ignore
    const req = await nodeToWebRequest(msg);
    const text = await req.text();
    expect(text).toBe('{"x":1}');
  });
});
