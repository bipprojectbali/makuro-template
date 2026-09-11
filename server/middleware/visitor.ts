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
import { auth } from '../auth';
import { db } from '../db';
import { visitLog } from '../db/schema';

// Skip all API calls and internal browser requests — visitor tracking should only
// cover page navigations, not same-origin fetch requests from the SPA.
const SKIP_PREFIXES = ['/api/', '/_vite/', '/assets/', '/favicon', '/manifest', '/__manifest'];

function shouldSkip(path: string): boolean {
  // React Router loader fetches end with .data (e.g. /posts.data) — not page navigations.
  if (path.endsWith('.data')) return true;
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

// Normalize an IP into a human-readable, canonical form. Keeps visit_log IPs
// consistent with login_log (Better Auth stores 127.0.0.1 for localhost).
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6 → IPv4
  if (ip === '::1') ip = '127.0.0.1'; // IPv6 loopback → readable IPv4
  return ip || null;
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
  explicitIp?: string | null,
): Promise<void> {
  try {
    const url = new URL(request.url);
    if (shouldSkip(url.pathname)) return;

    const ua = request.headers.get('user-agent') ?? '';
    const bot = isbot(ua);
    const botKind = bot ? classifyBot(ua) : null;

    // Resolve the logged-in user (best-effort) so page views can be attributed.
    // getSession relies on the Better Auth cookie cache — no DB hit on the hot path.
    let userId: string | null = null;
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      userId = session?.user.id ?? null;
    } catch {
      userId = null;
    }

    // Derive the client IP the same way Better Auth does for login_log, so both
    // logs agree. Prefer proxy headers (real client behind a load balancer),
    // then the socket IP passed by the server. Normalize loopback/IPv4-mapped
    // forms so localhost reads 127.0.0.1 instead of ::1.
    const forwarded =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;
    const ip = normalizeIp(forwarded ?? explicitIp ?? null);

    await db
      .insert(visitLog)
      .values({
        ip,
        path: url.pathname,
        userAgent: ua || null,
        isBot: bot,
        botKind,
        userId,
      })
      .catch(() => {
        // Silently drop — analytics must not crash the request pipeline.
      });
  } catch {
    // Never let analytics errors surface to the user.
  }
}
