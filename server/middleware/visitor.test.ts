import { describe, expect, it } from 'bun:test';
import { normalizeIp } from './visitor';

// Test the bot classification logic in isolation by importing just the helpers.
// We can't import recordVisit directly (it hits the DB), so we test the
// classification branch via isbot which visitor.ts delegates to.

// Minimal UA strings for known bot types.
const BOT_UAS = [
  'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
  'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://www.anthropic.com/anthropic.txt)',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'CCBot/2.0 (https://commoncrawl.org/faq/)',
  'UptimeRobot/2.0',
];

const HUMAN_UAS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
];

describe('bot detection (isbot)', () => {
  it('detects known bot user agents', async () => {
    const { isbot } = await import('isbot');
    for (const ua of BOT_UAS) {
      expect(isbot(ua)).toBe(true);
    }
  });

  it('passes human user agents', async () => {
    const { isbot } = await import('isbot');
    for (const ua of HUMAN_UAS) {
      expect(isbot(ua)).toBe(false);
    }
  });

  it('handles empty user agent gracefully', async () => {
    const { isbot } = await import('isbot');
    expect(() => isbot('')).not.toThrow();
  });
});

describe('normalizeIp', () => {
  it('rewrites IPv6 loopback ::1 to 127.0.0.1 (matches login_log)', () => {
    expect(normalizeIp('::1')).toBe('127.0.0.1');
  });

  it('strips IPv4-mapped IPv6 prefix ::ffff:', () => {
    expect(normalizeIp('::ffff:203.0.113.5')).toBe('203.0.113.5');
  });

  it('leaves a plain IPv4 address unchanged', () => {
    expect(normalizeIp('198.51.100.7')).toBe('198.51.100.7');
  });

  it('returns null for null, undefined, or blank input', () => {
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
    expect(normalizeIp('   ')).toBeNull();
  });
});
