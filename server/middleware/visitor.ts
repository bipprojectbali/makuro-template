/**
 * Visitor analytics middleware for Elysia.
 *
 * Records every incoming request to `visit_log`. Bot detection uses the
 * `isbot` package (UA heuristics — catches ~67% of bots including GPTBot,
 * ClaudeBot, Googlebot, etc.).
 *
 * Skipped paths: /api/auth/* (high-frequency auth polling) and static assets.
 */
import { isbot, isbotMatch } from 'isbot';
import { db } from '../db';
import { visitLog } from '../db/schema';

// Skip all API calls — visitor tracking should only cover page navigation,
// not same-origin fetch requests from the SPA. Without this, every analytics
// fetch creates new visit_log rows, causing counts to grow on every purge.
const SKIP_PREFIXES = ['/api/', '/_vite/', '/assets/', '/favicon', '/manifest'];

function shouldSkip(path: string): boolean {
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

function classifyBot(ua: string): string | null {
  const match = isbotMatch(ua);
  if (!match) return null;
  const lower = ua.toLowerCase();
  if (/gptbot|chatgpt|openai/.test(lower)) return 'ai:openai';
  if (/claude|anthropic/.test(lower)) return 'ai:anthropic';
  if (/bingbot|bingpreview/.test(lower)) return 'search:bing';
  if (/googlebot|google-extended|google-inspectiontool/.test(lower)) return 'search:google';
  if (/ccbot/.test(lower)) return 'ai:cc';
  if (/semrush|ahrefs|moz|dotbot/.test(lower)) return 'seo-crawler';
  if (/uptimerobot|pingdom|statuspage/.test(lower)) return 'monitor';
  return match;
}

export async function recordVisit(
  request: Request,
  userId: string | null | undefined,
): Promise<void> {
  try {
    const url = new URL(request.url);
    if (shouldSkip(url.pathname)) return;

    const ua = request.headers.get('user-agent') ?? '';
    const bot = isbot(ua);
    const botKind = bot ? classifyBot(ua) : null;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;

    await db
      .insert(visitLog)
      .values({
        ip,
        path: url.pathname,
        userAgent: ua || null,
        isBot: bot,
        botKind,
        userId: userId ?? null,
      })
      .catch(() => {
        // Silently drop — analytics must not crash the request pipeline.
      });
  } catch {
    // Never let analytics errors surface to the user.
  }
}
