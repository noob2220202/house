import { PopupPage, isSafeLinkUrl } from '@house/shared';
import type { Popup } from '../api/schemas';

// ---- which popups belong to a path ---------------------------------------------------------------

/** Areas that never show notice popups (broker console, auth flows, maintenance, dev tools, API). */
const EXCLUDED_PREFIXES = [
  '/agent',
  '/login',
  '/signup',
  '/auth',
  '/maintenance',
  '/dev',
  '/mock-api',
  '/api',
];

const within = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Maps a pathname to the `page` value of `GET /popups?page=`. Pages without their own target ask
 * for `ALL` (popups targeting every page); excluded areas return null (no request at all).
 */
export function popupPageForPath(pathname: string): PopupPage | null {
  if (EXCLUDED_PREFIXES.some((p) => within(pathname, p))) return null;
  if (pathname === '/') return PopupPage.MAIN;
  if (within(pathname, '/map')) return PopupPage.MAP;
  if (within(pathname, '/complex')) return PopupPage.COMPLEX_DETAIL;
  if (within(pathname, '/listing')) return PopupPage.LISTING_DETAIL;
  if (pathname === '/agencies') return PopupPage.AGENCY_LIST;
  if (within(pathname, '/deal')) return PopupPage.DEAL_REQUEST;
  return PopupPage.ALL;
}

// ---- "N일 동안 보지 않기" ------------------------------------------------------------------------

const KEY_PREFIX = 'house:popup:';
const DAY_MS = 86_400_000;

/** Minimal Storage surface so the logic is testable and SSR-safe. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Storage key per popup id + version: editing the popup in the back-office shows it again. */
export function popupStorageKey(popup: Pick<Popup, 'id' | 'updatedAt'>): string {
  return `${KEY_PREFIX}${popup.id}:${popup.updatedAt ?? '0'}`;
}

/** Button label for the popup's `dismissDays`; null when the option is off (0). */
export function dismissLabel(days: number): string | null {
  if (days <= 0) return null;
  if (days === 1) return '오늘 하루 보지 않기';
  if (days === 7) return '일주일 동안 보지 않기';
  return `${days}일 동안 보지 않기`;
}

function read(storage: StorageLike | null | undefined, key: string): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const until = Number(raw);
    return Number.isFinite(until) ? until : null;
  } catch {
    return null;
  }
}

/** True while a stored "보지 않기" (or this session's 닫기) is still in effect. */
export function isPopupHidden(
  popup: Pick<Popup, 'id' | 'updatedAt'>,
  stores: { local?: StorageLike | null; session?: StorageLike | null },
  now = Date.now(),
): boolean {
  const key = popupStorageKey(popup);
  const until = read(stores.local, key);
  if (until !== null) {
    if (until > now) return true;
    try {
      stores.local?.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
  return read(stores.session, key) !== null;
}

/** Hides the popup for `days` days on this device (localStorage). */
export function hidePopupForDays(
  popup: Pick<Popup, 'id' | 'updatedAt'>,
  days: number,
  storage: StorageLike | null | undefined,
  now = Date.now(),
): void {
  if (!storage || days <= 0) return;
  try {
    storage.setItem(popupStorageKey(popup), String(now + days * DAY_MS));
  } catch {
    /* private mode / quota: the popup simply shows again next time */
  }
}

/** Plain 닫기: hidden until the tab session ends (sessionStorage). */
export function hidePopupForSession(
  popup: Pick<Popup, 'id' | 'updatedAt'>,
  storage: StorageLike | null | undefined,
  now = Date.now(),
): void {
  if (!storage) return;
  try {
    storage.setItem(popupStorageKey(popup), String(now));
  } catch {
    /* ignore */
  }
}

/** Drops expired / superseded entries so the store does not grow with every popup version. */
export function prunePopupStore(
  storage: StorageLike | null | undefined,
  live: readonly Pick<Popup, 'id' | 'updatedAt'>[],
  now = Date.now(),
): void {
  if (!storage) return;
  try {
    const liveKeys = new Set(live.map(popupStorageKey));
    const liveIds = new Set(live.map((p) => p.id));
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const id = key.slice(KEY_PREFIX.length).split(':')[0] ?? '';
      const until = Number(storage.getItem(key));
      const expired = !Number.isFinite(until) || until <= now;
      const superseded = liveIds.has(id) && !liveKeys.has(key);
      if (expired || superseded) stale.push(key);
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    /* ignore */
  }
}

// ---- link handling -------------------------------------------------------------------------------

export type PopupLink =
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string }
  | null;

/**
 * Only admin-entered http(s) or site-relative links are followed (same rule as `linkUrlSchema`).
 * Backslashes and control characters are refused on top of that: browsers read `/\evil.example`
 * as the protocol-relative `//evil.example`, which `isSafeLinkUrl` lets through as "relative".
 */
export function popupLink(linkUrl: string | null | undefined): PopupLink {
  // eslint-disable-next-line no-control-regex
  if (!linkUrl || /[\\\u0000-\u001f\u007f]/.test(linkUrl) || !isSafeLinkUrl(linkUrl)) return null;
  return linkUrl.startsWith('/')
    ? { kind: 'internal', href: linkUrl }
    : { kind: 'external', href: linkUrl };
}
