/**
 * Crawler files answered before SSR: /robots.txt and /sitemap.xml, both built
 * from APP_URL so they always point at the deployed origin.
 * Only the landing page is public; every other page is behind a role guard or
 * is an auth flow, so crawlers are kept out of them.
 */
import { env } from './env';

const PUBLIC_PATHS = ['/'];
const PRIVATE_PREFIXES = [
  '/api/',
  '/login',
  '/go',
  '/banned',
  '/app',
  '/profile',
  '/dashboard',
  '/dev',
];
const CACHE_SECONDS = 86_400;

const FILES = {
  '/robots.txt': { type: 'text/plain; charset=utf-8', body: robotsTxt },
  '/sitemap.xml': { type: 'application/xml; charset=utf-8', body: sitemapXml },
} as const;

export function isSeoFile(pathname: string): pathname is keyof typeof FILES {
  return pathname in FILES;
}

const origin = (appUrl: string) => appUrl.replace(/\/$/, '');

export function robotsTxt(appUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin(appUrl)}/sitemap.xml`,
    '',
  ].join('\n');
}

export function sitemapXml(appUrl: string): string {
  const urls = PUBLIC_PATHS.map((p) => `  <url><loc>${origin(appUrl)}${p}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function seoResponse(request: Request, pathname: keyof typeof FILES): Response {
  const file = FILES[pathname];
  return new Response(request.method === 'HEAD' ? null : file.body(env.APP_URL), {
    headers: {
      'content-type': file.type,
      'cache-control': `public, max-age=${CACHE_SECONDS}`,
      'x-content-type-options': 'nosniff',
    },
  });
}
