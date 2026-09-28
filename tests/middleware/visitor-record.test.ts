import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { auth } from '../../server/auth';
import { db } from '../../server/db';
import { user, visitLog } from '../../server/db/schema';
import { recordVisit } from '../../server/middleware/visitor';

const TAG = `vr-${crypto.randomUUID().slice(0, 8)}`;
const member = `${TAG}-user`;
const ctx: { userId: string | null; fail: boolean } = { userId: null, fail: false };
const spy = spyOn(auth.api, 'getSession').mockImplementation((async () => {
  if (ctx.fail) throw new Error('session store down');
  return ctx.userId ? { user: { id: ctx.userId } } : null;
}) as unknown as typeof auth.api.getSession);

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

async function visit(path: string, headers: Record<string, string> = {}, ip?: string) {
  await recordVisit(new Request(`http://localhost/${TAG}${path}`, { headers }), ip);
  const [row] = await db
    .select()
    .from(visitLog)
    .where(eq(visitLog.path, `/${TAG}${path}`));
  return row;
}

beforeAll(async () => {
  await db.insert(user).values({
    id: member,
    name: member,
    email: `${member}@test.local`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterAll(async () => {
  spy.mockRestore();
  await db.delete(visitLog).where(like(visitLog.path, `/${TAG}%`));
  await db.delete(user).where(eq(user.id, member));
});

describe('recordVisit', () => {
  test('stores an enriched human page view', async () => {
    ctx.userId = member;
    const row = await visit('/human', {
      'user-agent': CHROME,
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'cf-ipcountry': 'ID',
      'accept-language': 'id-ID,id;q=0.9,en;q=0.8',
      referer: 'https://ref.example/page?token=secret',
    });
    ctx.userId = null;
    expect(row).toMatchObject({
      ip: '203.0.113.7',
      isBot: false,
      botKind: null,
      userId: member,
      country: 'ID',
      language: 'id-ID',
      browser: 'Chrome',
      deviceType: 'desktop',
    });
    expect(row.referer).not.toContain('secret');
  });

  test('falls back to the explicit socket IP and survives a failing session lookup', async () => {
    ctx.fail = true;
    const row = await visit('/socket', { 'user-agent': CHROME }, '198.51.100.4');
    ctx.fail = false;
    expect(row.ip).toBe('198.51.100.4');
    expect(row.userId).toBeNull();
  });

  test('caps the stored user agent at 512 chars and keeps a missing one null', async () => {
    const long = await visit('/long-ua', { 'user-agent': `${CHROME} ${'x'.repeat(2000)}` });
    expect(long.userAgent?.length).toBe(512);
    expect((await visit('/no-ua')).userAgent).toBeNull();
  });

  test.each([
    [
      'gptbot',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)',
      'ai:openai',
    ],
    [
      'claudebot',
      'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
      'ai:anthropic',
    ],
    [
      'bingbot',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'search:bing',
    ],
    [
      'googlebot',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'search:google',
    ],
    ['ccbot', 'CCBot/2.0 (https://commoncrawl.org/faq/)', 'ai:cc'],
    ['ahrefs', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'seo-crawler'],
    ['rogerbot', 'rogerbot/1.0 (http://moz.com/help/pro/what-is-rogerbot-)', 'seo-crawler'],
    [
      'pingdom',
      'Mozilla/5.0 (compatible; Pingdom.com_bot_version_1.4_(http://www.pingdom.com/))',
      'monitor',
    ],
    ['uptime', 'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)', 'monitor'],
  ])('classifies %s', async (slug, ua, kind) => {
    const row = await visit(`/bot-${slug}`, { 'user-agent': ua });
    expect(row.isBot).toBe(true);
    expect(row.botKind).toBe(kind);
  });

  test('keeps the raw isbot match for unknown bots', async () => {
    const row = await visit('/bot-other', { 'user-agent': 'curl/8.4.0' });
    expect(row.isBot).toBe(true);
    expect(row.botKind?.toLowerCase()).toContain('curl');
  });

  test('ignores API calls, loader fetches and assets', async () => {
    for (const path of ['/api/posts', `/${TAG}/page.data`, '/assets/app.js']) {
      await recordVisit(new Request(`http://localhost${path}`, { headers: { 'user-agent': TAG } }));
    }
    const rows = await db.select().from(visitLog).where(eq(visitLog.userAgent, TAG));
    expect(rows).toEqual([]);
  });
});
