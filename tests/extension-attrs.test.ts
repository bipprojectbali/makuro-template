import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripExtensionAttributes } from '../app/lib/extension-attrs';

describe('entry.client', () => {
  it('strips and hydrates in one synchronous flush, not a yielding transition', () => {
    const src = readFileSync(path.join(import.meta.dir, '../app/entry.client.tsx'), 'utf8');
    expect(src).not.toContain('startTransition');
    expect(src).toMatch(
      /flushSync\(\(\) => \{\s*stripExtensionAttributes\(document\);\s*hydrateRoot\(/,
    );
  });
});

function el(...names: string[]) {
  const attrs = names.map((name) => ({ name }));
  return {
    attributes: attrs,
    removeAttribute(name: string) {
      attrs.splice(
        attrs.findIndex((a) => a.name === name),
        1,
      );
    },
    names: () => attrs.map((a) => a.name),
  };
}

describe('stripExtensionAttributes', () => {
  it('removes extension markers and keeps app attributes', () => {
    const body = el('bis_register', '__processed_f1a8742c-c5c6-442d-962f-8a3446490a89__', 'class');
    const div = el('class', 'bis_skin_checked', 'data-bis', '__processed__');
    const removed = stripExtensionAttributes({ querySelectorAll: () => [body, div] });
    expect(removed).toBe(3);
    expect(body.names()).toEqual(['class']);
    expect(div.names()).toEqual(['class', 'data-bis', '__processed__']);
  });
});
