/** /README.md, /llms-full.txt and /llms.txt: single source, plain text, cacheable, secret-free. */
import { describe, expect, test } from 'bun:test';
import { shouldSkip } from '../server/middleware/visitor';
import { agentDocResponse, isAgentDoc, llmsIndex, readmeText } from '../server/readme';
import { isMaintenanceExempt } from '../server/settings-maintenance';

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);

describe('agent docs', () => {
  test('serves the README verbatim as markdown and as plain text', async () => {
    const file = await Bun.file(`${import.meta.dir}/../README.md`).text();
    expect(await readmeText()).toBe(file);
    const md = await agentDocResponse(req('/README.md'), '/README.md');
    expect(md.status).toBe(200);
    expect(md.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    expect(await md.text()).toBe(file);
    const txt = await agentDocResponse(req('/llms-full.txt'), '/llms-full.txt');
    expect(txt.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await txt.text()).toBe(file);
  });
  test('llms.txt is an index derived from the README headings', async () => {
    const readme = await readmeText();
    const idx = llmsIndex(readme, 'https://example.test/', '9.9.9');
    expect(idx.startsWith('# Makuro')).toBe(true);
    expect(idx).toContain('https://example.test/README.md');
    expect(idx).toContain('- API keys');
    expect(idx).toContain('- Untuk AI agent');
    expect(idx).toContain('9.9.9');
    const res = await agentDocResponse(req('/llms.txt'), '/llms.txt');
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });
  test('ETag → 304 on revalidation; HEAD has no body', async () => {
    const first = await agentDocResponse(req('/README.md'), '/README.md');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    expect(first.headers.get('cache-control')).toContain('max-age=');
    const again = await agentDocResponse(
      req('/README.md', { headers: { 'if-none-match': etag as string } }),
      '/README.md',
    );
    expect(again.status).toBe(304);
    const head = await agentDocResponse(req('/README.md', { method: 'HEAD' }), '/README.md');
    expect(await head.text()).toBe('');
  });
  test('routes are recognized, exempt from maintenance and not counted as visits', () => {
    for (const p of ['/README.md', '/readme.md', '/llms.txt', '/llms-full.txt']) {
      expect(isAgentDoc(p)).toBe(true);
      expect(isMaintenanceExempt(p)).toBe(true);
      expect(shouldSkip(p)).toBe(true);
    }
    expect(isAgentDoc('/README')).toBe(false);
    expect(isAgentDoc('/')).toBe(false);
  });
  test('the README never carries secrets (it is served publicly)', async () => {
    const readme = await readmeText();
    expect(readme).not.toMatch(/mk_live_[A-Za-z0-9]{16,}/);
    expect(readme).not.toMatch(/(SECRET|PASSWORD|TOKEN)\s*=\s*['"]?[A-Za-z0-9+/]{16,}/);
    expect(readme).not.toMatch(/postgres(ql)?:\/\/[^:\s]+:[^@\s]+@/);
  });
});
