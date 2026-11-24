import { describe, expect, it } from 'vitest';
import {
  clearDraft,
  draftKey,
  DRAFT_TTL_MS,
  formatSavedTime,
  readDraft,
  writeDraft,
} from './draft';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const DEFAULTS = { name: '', agree: false, photos: [] as string[], unit: 'pyeong' };
const KEY = draftKey('sell', 'user-1');
const NOW = new Date('2026-11-23T06:42:00Z');

describe('draft storage', () => {
  it('keys drafts per kind and user', () => {
    expect(KEY).toBe('house:deal-draft:sell:user-1');
    expect(draftKey('find', 'u2')).not.toBe(draftKey('sell', 'u2'));
  });

  it('round-trips values with the step and save time', () => {
    const store = memoryStorage();
    const values = { ...DEFAULTS, name: '김하늘', photos: ['a'] };
    const savedAt = writeDraft(KEY, 2, values, NOW, store);
    expect(savedAt).toBe(NOW.toISOString());
    expect(readDraft(KEY, DEFAULTS, NOW.getTime(), store)).toEqual({
      v: 1,
      step: 2,
      values,
      savedAt: NOW.toISOString(),
    });
  });

  it('merges over defaults: new fields get defaults, unknown or mistyped ones are dropped', () => {
    const store = memoryStorage({
      [KEY]: JSON.stringify({
        v: 1,
        step: 1,
        savedAt: NOW.toISOString(),
        values: { name: '김', agree: 'yes', photos: 'x', removedField: 1 },
      }),
    });
    expect(readDraft(KEY, DEFAULTS, NOW.getTime(), store)?.values).toEqual({
      name: '김',
      agree: false,
      photos: [],
      unit: 'pyeong',
    });
  });

  it('never restores the consent ticks (they are given against the text shown in the session)', () => {
    const defaults = { name: '', agreePrivacy: false, agreeProvide: false };
    const store = memoryStorage();
    writeDraft(KEY, 2, { name: '김하늘', agreePrivacy: true, agreeProvide: true }, NOW, store);
    expect(readDraft(KEY, defaults, NOW.getTime(), store)?.values).toEqual({
      name: '김하늘',
      agreePrivacy: false,
      agreeProvide: false,
    });
  });

  it('ignores missing, corrupt, outdated and expired drafts', () => {
    expect(readDraft(KEY, DEFAULTS, NOW.getTime(), memoryStorage())).toBeNull();
    expect(readDraft(KEY, DEFAULTS, NOW.getTime(), memoryStorage({ [KEY]: '{oops' }))).toBeNull();
    const old = memoryStorage({
      [KEY]: JSON.stringify({ v: 0, step: 0, savedAt: NOW.toISOString(), values: DEFAULTS }),
    });
    expect(readDraft(KEY, DEFAULTS, NOW.getTime(), old)).toBeNull();
    const expired = memoryStorage();
    writeDraft(KEY, 0, DEFAULTS, NOW, expired);
    expect(readDraft(KEY, DEFAULTS, NOW.getTime() + DRAFT_TTL_MS + 1, expired)).toBeNull();
    expect(expired.data.has(KEY)).toBe(false); // expired drafts are removed
  });

  it('survives unavailable or full storage', () => {
    expect(readDraft(KEY, DEFAULTS, NOW.getTime(), null)).toBeNull();
    expect(writeDraft(KEY, 0, DEFAULTS, NOW, null)).toBeNull();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(writeDraft(KEY, 0, DEFAULTS, NOW, full)).toBeNull();
    expect(() => clearDraft(KEY, null)).not.toThrow();
  });

  it('clears a draft', () => {
    const store = memoryStorage();
    writeDraft(KEY, 0, DEFAULTS, NOW, store);
    clearDraft(KEY, store);
    expect(store.data.size).toBe(0);
  });

  it('formats the save time in Korean, Asia/Seoul', () => {
    expect(formatSavedTime(NOW.toISOString())).toBe('오후 3:42');
    expect(formatSavedTime('nope')).toBe('');
  });
});
