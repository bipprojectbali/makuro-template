import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import path from 'node:path';

// Vite's default standalone HMR port; the dev server must never need it.
const VITE_DEFAULT_HMR_PORT = 24678;
const ROOT = path.join(import.meta.dir, '..');
let port = 0;
let dev: ReturnType<typeof Bun.spawn>;
let blocker: { stop(closeActiveConnections?: boolean): void } | null = null;
let log = '';

async function freePort() {
  const s = Bun.serve({ port: 0, fetch: () => new Response() });
  const p = s.port as number;
  await s.stop();
  return p;
}

beforeAll(async () => {
  // Reproduce "another project is already running": hold the default HMR port.
  try {
    blocker = Bun.listen({
      hostname: '0.0.0.0',
      port: VITE_DEFAULT_HMR_PORT,
      socket: { data() {} },
    });
  } catch {
    blocker = null; // already taken by another process, which is the same condition
  }
  port = await freePort();
  dev = Bun.spawn(['bun', 'run', 'server/dev.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const decoder = new TextDecoder();
  for (const stream of [dev.stdout, dev.stderr] as ReadableStream<Uint8Array>[])
    void (async () => {
      for await (const chunk of stream) log += decoder.decode(chunk);
    })();
  for (let i = 0; i < 120 && !log.includes('dev server on'); i++) await Bun.sleep(250);
}, 40_000);

afterAll(() => {
  dev?.kill();
  blocker?.stop(true);
});

describe('dev server HMR', () => {
  test('boots without opening a second WebSocket port', () => {
    expect(log).toContain(`http://localhost:${port}`);
    expect(log).not.toContain('WebSocket server error');
  });

  test('serves the HMR WebSocket on the app port', async () => {
    const first = await new Promise<string>((resolve) => {
      const ws = new WebSocket(`ws://localhost:${port}/`, 'vite-hmr');
      ws.onmessage = (e) => {
        resolve(String(e.data));
        ws.close();
      };
      ws.onerror = () => resolve('error');
      setTimeout(() => resolve('timeout'), 5_000);
    });
    expect(JSON.parse(first)).toEqual({ type: 'connected' });
  });

  test('the browser client connects to the page port, not a fixed one', async () => {
    const client = await (await fetch(`http://localhost:${port}/@vite/client`)).text();
    expect(client).toContain('const hmrPort = null;');
    expect(client).toContain(`const directSocketHost = "localhost:${port}/";`);
  });
});
