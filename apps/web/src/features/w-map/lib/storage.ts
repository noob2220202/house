import type { ComplexSummary } from '../api/schemas';

/**
 * Small browser-storage helpers. Everything is defensive: storage can be blocked (private mode),
 * full, or hold stale shapes — failures are ignored and never break the page.
 */
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function open(kind: 'local' | 'session'): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

// ---- map ad: closed for this browser session, rotation between page views ------------------------

/** Set when the visitor closes the MAP_AD slot: the whole slot stays closed for the session. */
export const AD_SLOT_CLOSED_KEY = 'house:map-ad-closed:v2';
/** Counts page views of the slot so each one starts on the next live banner. */
export const AD_ROTATION_KEY = 'house:map-ad-rotation:v1';

export function isAdSlotClosed(store: StorageLike | null = open('session')): boolean {
  try {
    return store?.getItem(AD_SLOT_CLOSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function closeAdSlot(store: StorageLike | null = open('session')): void {
  try {
    store?.setItem(AD_SLOT_CLOSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Start index of the banner rotation for this page view: 0, 1, 2 … across the page views of one
 * browser session (the caller takes it modulo the number of live banners), so every banner of the
 * slot gets its turn in first position.
 */
export function nextAdRotation(store: StorageLike | null = open('session')): number {
  try {
    const raw = Number(store?.getItem(AD_ROTATION_KEY));
    const current = Number.isInteger(raw) && raw >= 0 ? raw : 0;
    store?.setItem(AD_ROTATION_KEY, String(current + 1));
    return current;
  } catch {
    return 0;
  }
}

// ---- 최근 본 단지 (works signed-out) --------------------------------------------------------------

export const RECENT_COMPLEXES_KEY = 'house:recent-complexes:v1';
export const RECENT_COMPLEXES_MAX = 12;

export type RecentComplex = Pick<
  ComplexSummary,
  | 'id'
  | 'name'
  | 'emdName'
  | 'households'
  | 'builtYear'
  | 'moveInYm'
  | 'counts'
  | 'pricePerPyeong'
  | 'lat'
  | 'lng'
> & { viewedAt: string };

function isRecent(v: unknown): v is RecentComplex {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.name === 'string' && typeof r.viewedAt === 'string';
}

export function readRecentComplexes(store: StorageLike | null = open('local')): RecentComplex[] {
  try {
    const parsed: unknown = JSON.parse(store?.getItem(RECENT_COMPLEXES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, RECENT_COMPLEXES_MAX) : [];
  } catch {
    return [];
  }
}

/** Pure merge: newest first, deduplicated by id, capped. */
export function mergeRecentComplex(
  list: readonly RecentComplex[],
  entry: RecentComplex,
  max = RECENT_COMPLEXES_MAX,
): RecentComplex[] {
  return [entry, ...list.filter((r) => r.id !== entry.id)].slice(0, max);
}

export function pushRecentComplex(
  c: ComplexSummary,
  now: Date = new Date(),
  store: StorageLike | null = open('local'),
): RecentComplex[] {
  const entry: RecentComplex = {
    id: c.id,
    name: c.name,
    emdName: c.emdName,
    households: c.households,
    builtYear: c.builtYear,
    moveInYm: c.moveInYm,
    counts: c.counts,
    pricePerPyeong: c.pricePerPyeong,
    lat: c.lat,
    lng: c.lng,
    viewedAt: now.toISOString(),
  };
  const next = mergeRecentComplex(readRecentComplexes(store), entry);
  try {
    store?.setItem(RECENT_COMPLEXES_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
