import { describe, expect, it } from 'bun:test';
import {
  brandFrom,
  findLeftovers,
  isBinary,
  isDirty,
  isValidName,
  ownerFromRepoUrl,
  type Pair,
  rebrandLines,
  rebrandText,
  replacements,
} from '../scripts/rebrand';

const OLD = { oldName: 'makuro-template', oldOwner: 'bipprojectbali', oldBrand: 'Makuro' };
const NEW = { newName: 'acme-app', newOwner: 'newowner', newBrand: 'Acme' };

const pairs = (over: Partial<typeof OLD & typeof NEW> = {}): Pair[] =>
  replacements({ ...OLD, ...NEW, ...over });

describe('replacement order', () => {
  it('rewrites the full repo slug, owner and name together', () => {
    const text = 'https://github.com/bipprojectbali/makuro-template.git';
    expect(rebrandText(text, pairs())).toBe('https://github.com/newowner/acme-app.git');
  });

  it('never leaves the old owner glued to the new name', () => {
    const out = rebrandText('bipprojectbali/makuro-template', pairs());
    expect(out).not.toContain('bipprojectbali/acme-app');
    expect(out).not.toContain('bipprojectbali');
  });

  it('keeps the owner untouched when --owner is omitted', () => {
    const out = rebrandText(
      'bipprojectbali/makuro-template',
      pairs({ newOwner: 'bipprojectbali' }),
    );
    expect(out).toBe('bipprojectbali/acme-app');
  });

  it('breaks the slug when the pairs are applied in reverse order', () => {
    const text = 'bipprojectbali/makuro-template';
    const reversed = [...pairs()].reverse();
    expect(rebrandText(text, reversed)).toBe('bipprojectbali/acme-app');
    expect(rebrandText(text, reversed)).not.toBe(rebrandText(text, pairs()));
  });

  it('emits the slug pair before the bare name pair', () => {
    const [slug, name, snake, brand] = pairs();
    expect(slug?.from).toBe('bipprojectbali/makuro-template');
    expect(name?.from).toBe('makuro-template');
    expect(snake?.from).toBe('makuro_template');
    expect(brand?.from).toBe('Makuro');
  });
});

describe('database / snake_case name', () => {
  it('rewrites the test database name', () => {
    expect(rebrandText('makuro_template_test', pairs())).toBe('acme_app_test');
  });

  it('rewrites a connection string database segment', () => {
    expect(
      rebrandText('postgres://postgres:postgres@localhost:5432/makuro_template_test', pairs()),
    ).toBe('postgres://postgres:postgres@localhost:5432/acme_app_test');
  });
});

describe('brand', () => {
  it('rewrites the TitleCase brand', () => {
    expect(rebrandText('<title>Dashboard — Makuro</title>', pairs())).toBe(
      '<title>Dashboard — Acme</title>',
    );
  });

  it('leaves bare lowercase identifiers alone', () => {
    const text = [
      'const g = globalThis as typeof globalThis & { __makuroLogger?: pino.Logger };',
      "export const CLIENT_IP_HEADER = 'x-makuro-client-ip';",
      "key: 'makuro:proxy-banner-dismissed',",
      "serverInfo: { name: 'makuro-debug', version: '1.0.0' },",
      'DATABASE_URL=postgres://makuro:makuro@localhost:5432/makuro',
      '      - makuro_pgdata:/var/lib/postgresql/data',
    ].join('\n');
    expect(rebrandText(text, pairs())).toBe(text);
  });

  it('rewrites the brand but not the lowercase token on the same line', () => {
    expect(rebrandText("logger.info('Makuro siap'); // __makuroLogger", pairs())).toBe(
      "logger.info('Acme siap'); // __makuroLogger",
    );
  });
});

describe('brandFrom', () => {
  it('derives the default brand from the first segment', () => {
    expect(brandFrom('acme-app')).toBe('Acme');
    expect(brandFrom('makuro-template')).toBe('Makuro');
  });

  it('handles a single-segment name', () => {
    expect(brandFrom('acme')).toBe('Acme');
  });

  it('keeps digits in the first segment', () => {
    expect(brandFrom('web3-shop')).toBe('Web3');
  });
});

describe('isValidName', () => {
  it('accepts kebab-case', () => {
    expect(isValidName('acme-app')).toBe(true);
    expect(isValidName('acme')).toBe(true);
    expect(isValidName('acme-app-2')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidName('Acme_App')).toBe(false);
    expect(isValidName('acme app')).toBe(false);
    expect(isValidName('')).toBe(false);
    expect(isValidName('Acme')).toBe(false);
    expect(isValidName('2acme')).toBe(false);
    expect(isValidName('acme_app')).toBe(false);
    expect(isValidName('acme.app')).toBe(false);
    expect(isValidName('@scope/acme')).toBe(false);
  });
});

describe('ownerFromRepoUrl', () => {
  it('parses an https remote', () => {
    expect(ownerFromRepoUrl('https://github.com/bipprojectbali/makuro-template.git')).toBe(
      'bipprojectbali',
    );
  });

  it('parses an ssh remote', () => {
    expect(ownerFromRepoUrl('git@github.com:someone/thing.git')).toBe('someone');
  });

  it('returns undefined for a non-GitHub url', () => {
    expect(ownerFromRepoUrl('https://gitlab.com/a/b.git')).toBeUndefined();
    expect(ownerFromRepoUrl('')).toBeUndefined();
  });
});

describe('findLeftovers', () => {
  it('reports lines still holding the old lowercase token', () => {
    const text = ['const ok = 1;', 'g.__makuroLogger ??= createLogger();'].join('\n');
    const found = findLeftovers(text, 'makuro');
    expect(found.length).toBe(1);
    expect(found[0]?.line).toBe(2);
    expect(found[0]?.before).toContain('__makuroLogger');
  });

  it('does not flag the new name', () => {
    expect(findLeftovers('name: acme-app\nbrand: Acme\n', 'makuro').length).toBe(0);
  });

  it('matches case-insensitively so a stray Makuro is caught too', () => {
    expect(findLeftovers('title: Makuro', 'makuro').length).toBe(1);
  });
});

describe('rebrandLines', () => {
  it('reports only the changed lines and returns the rewritten text', () => {
    const text = ['name: makuro-template', 'unchanged line', 'brand: Makuro'].join('\n');
    const { text: out, changed } = rebrandLines(text, pairs());
    expect(out).toBe(['name: acme-app', 'unchanged line', 'brand: Acme'].join('\n'));
    expect(changed.length).toBe(2);
    expect(changed[0]?.line).toBe(1);
    expect(changed[1]?.line).toBe(3);
    expect(changed[1]?.after).toBe('brand: Acme');
  });

  it('preserves a trailing newline', () => {
    expect(rebrandLines('Makuro\n', pairs()).text).toBe('Acme\n');
  });
});

describe('isDirty', () => {
  it('ignores untracked entries', () => {
    expect(isDirty('?? .claude/\n?? docs/spec.md\n')).toBe(false);
    expect(isDirty('')).toBe(false);
  });

  it('flags staged or modified entries', () => {
    expect(isDirty(' M package.json\n')).toBe(true);
    expect(isDirty('?? .claude/\nA  scripts/rebrand.ts\n')).toBe(true);
  });
});

describe('isBinary', () => {
  it('flags content with a NUL byte', () => {
    expect(isBinary(new Uint8Array([0x89, 0x50, 0x00, 0x4e]))).toBe(true);
  });

  it('accepts utf-8 text', () => {
    expect(isBinary(new TextEncoder().encode('Makuro — template'))).toBe(false);
  });
});
