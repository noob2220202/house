/**
 * "최근 본 매물" kept in localStorage so it also works signed-out (signed-in users additionally get
 * server-side recent views through POST /listings/:id/view). Newest first, deduplicated, capped.
 */
export const RECENT_LISTINGS_KEY = 'house:recent-listings:v1';
export const RECENT_LISTINGS_MAX = 20;

export interface RecentListing {
  id: string;
  /** "신대 레이크파크 1단지 103동" */
  title: string;
  /** "매매 4억 4,500" */
  priceLabel: string;
  /** "34평 · 고/25층 · 남향" */
  meta?: string;
  thumbUrl?: string | null;
  /** ISO timestamp of the last view. */
  viewedAt: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // blocked (private mode / disabled cookies)
  }
}

function isRecent(v: unknown): v is RecentListing {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.title === 'string' &&
    typeof r.priceLabel === 'string' &&
    typeof r.viewedAt === 'string'
  );
}

export function readRecentListings(store: StorageLike | null = storage()): RecentListing[] {
  if (!store) return [];
  try {
    const raw = store.getItem(RECENT_LISTINGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, RECENT_LISTINGS_MAX) : [];
  } catch {
    return [];
  }
}

/** Pure merge: puts `entry` first, drops its older copy, caps the list. */
export function mergeRecent(
  list: readonly RecentListing[],
  entry: RecentListing,
  max = RECENT_LISTINGS_MAX,
): RecentListing[] {
  return [entry, ...list.filter((r) => r.id !== entry.id)].slice(0, max);
}

/** Records a view. Never throws (quota / blocked storage are ignored). */
export function pushRecentListing(
  entry: Omit<RecentListing, 'viewedAt'> & { viewedAt?: string },
  store: StorageLike | null = storage(),
): RecentListing[] {
  if (!store) return [];
  const next = mergeRecent(readRecentListings(store), {
    ...entry,
    viewedAt: entry.viewedAt ?? new Date().toISOString(),
  });
  try {
    store.setItem(RECENT_LISTINGS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function clearRecentListings(store: StorageLike | null = storage()): void {
  try {
    store?.removeItem(RECENT_LISTINGS_KEY);
  } catch {
    // ignore
  }
}
