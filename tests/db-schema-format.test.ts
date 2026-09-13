import { describe, expect, it } from 'bun:test';
import {
  columnSignature,
  defaultLabel,
  fmtBytes,
  onDeleteLabel,
} from '../app/lib/db-schema-format';

describe('db-schema-format', () => {
  it('fmtBytes scales units', () => {
    expect(fmtBytes(512)).toBe('512 B');
    expect(fmtBytes(2048)).toBe('2 KB');
    expect(fmtBytes(5 * 1024 * 1024)).toBe('5 MB');
  });
  it('labels defaults and onDelete', () => {
    expect(defaultLabel({ defaultKind: 'fn', defaultText: null })).toBe('dibuat aplikasi');
    expect(defaultLabel({ defaultKind: 'literal', defaultText: 'false' })).toBe('false');
    expect(defaultLabel({ defaultKind: null, defaultText: null })).toBe('—');
    expect(onDeleteLabel('set null')).toBe('Set null');
    expect(onDeleteLabel(undefined)).toBe('—');
  });
  it('columnSignature composes type, nullability and keys', () => {
    expect(
      columnSignature({
        key: 'a',
        dbName: 'a',
        type: 'text',
        pk: false,
        notNull: false,
        unique: true,
        defaultKind: null,
        defaultText: null,
        fkTable: 'user',
        fkColumn: 'id',
      }),
    ).toBe('text? · FK → user.id · unique');
  });
});
