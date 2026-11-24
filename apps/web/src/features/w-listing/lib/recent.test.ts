import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECENT_LISTINGS_KEY,
  RECENT_LISTINGS_MAX,
  clearRecentListings,
  mergeRecent,
  pushRecentListing,
  readRecentListings,
  type RecentListing,
} from './recent';

const entry = (id: string, viewedAt = '2026-11-23T10:00:00+09:00'): RecentListing => ({
  id,
  title: `매물 ${id}`,
  priceLabel: '매매 4억 4,500',
  viewedAt,
});

describe('recent listings', () => {
  beforeEach(() => window.localStorage.clear());

  it('puts the newest view first and de-duplicates', () => {
    const list = mergeRecent([entry('a'), entry('b')], entry('b', '2026-11-23T11:00:00+09:00'));
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
    expect(list[0]?.viewedAt).toContain('11:00');
  });

  it('caps the list', () => {
    const many = Array.from({ length: RECENT_LISTINGS_MAX }, (_, i) => entry(`x${i}`));
    const list = mergeRecent(many, entry('new'));
    expect(list).toHaveLength(RECENT_LISTINGS_MAX);
    expect(list[0]?.id).toBe('new');
    expect(list.some((r) => r.id === `x${RECENT_LISTINGS_MAX - 1}`)).toBe(false);
  });

  it('persists to localStorage and reads back', () => {
    pushRecentListing({ id: 'a', title: 'A', priceLabel: '전세 2억' });
    pushRecentListing({ id: 'b', title: 'B', priceLabel: '월세 500/42', meta: '투룸' });
    const list = readRecentListings();
    expect(list.map((r) => r.id)).toEqual(['b', 'a']);
    expect(list[0]?.viewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    clearRecentListings();
    expect(readRecentListings()).toEqual([]);
  });

  it('ignores corrupt or foreign data', () => {
    window.localStorage.setItem(RECENT_LISTINGS_KEY, '{not json');
    expect(readRecentListings()).toEqual([]);
    window.localStorage.setItem(
      RECENT_LISTINGS_KEY,
      JSON.stringify([{ id: 1 }, entry('ok'), null]),
    );
    expect(readRecentListings().map((r) => r.id)).toEqual(['ok']);
  });

  it('never throws when storage is unavailable or full', () => {
    expect(readRecentListings(null)).toEqual([]);
    expect(pushRecentListing(entry('a'), null)).toEqual([]);
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => undefined,
    };
    expect(() => pushRecentListing(entry('a'), full)).not.toThrow();
  });
});
