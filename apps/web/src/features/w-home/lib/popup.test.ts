import { PopupPage } from '@house/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  dismissLabel,
  hidePopupForDays,
  hidePopupForSession,
  isPopupHidden,
  popupLink,
  popupPageForPath,
  popupStorageKey,
  prunePopupStore,
} from './popup';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-23T10:00:00+09:00');
const popup = { id: 'p1', updatedAt: '2026-11-10T09:00:00+09:00' };

describe('popupPageForPath', () => {
  it('maps site paths to popup target pages', () => {
    expect(popupPageForPath('/')).toBe(PopupPage.MAIN);
    expect(popupPageForPath('/map/apt')).toBe(PopupPage.MAP);
    expect(popupPageForPath('/complex/abc')).toBe(PopupPage.COMPLEX_DETAIL);
    expect(popupPageForPath('/listing/abc')).toBe(PopupPage.LISTING_DETAIL);
    expect(popupPageForPath('/agencies')).toBe(PopupPage.AGENCY_LIST);
    expect(popupPageForPath('/deal')).toBe(PopupPage.DEAL_REQUEST);
    expect(popupPageForPath('/deal/sell')).toBe(PopupPage.DEAL_REQUEST);
  });

  it('asks only for ALL-page popups elsewhere', () => {
    expect(popupPageForPath('/notices')).toBe(PopupPage.ALL);
    expect(popupPageForPath('/agency/abc')).toBe(PopupPage.ALL);
    expect(popupPageForPath('/me/favorites')).toBe(PopupPage.ALL);
    expect(popupPageForPath('/mapping')).toBe(PopupPage.ALL);
  });

  it('never shows popups in the broker console, auth flows, maintenance and dev tools', () => {
    for (const path of [
      '/agent',
      '/agent/listings',
      '/login',
      '/signup',
      '/auth/callback',
      '/maintenance',
      '/dev/ui',
    ]) {
      expect(popupPageForPath(path)).toBeNull();
    }
  });
});

describe('dismissLabel', () => {
  it('words the option by the number of days', () => {
    expect(dismissLabel(0)).toBeNull();
    expect(dismissLabel(1)).toBe('오늘 하루 보지 않기');
    expect(dismissLabel(7)).toBe('일주일 동안 보지 않기');
    expect(dismissLabel(3)).toBe('3일 동안 보지 않기');
  });
});

describe('"N일 동안 보지 않기" storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  const stores = () => ({ local: window.localStorage, session: window.sessionStorage });

  it('hides the popup for N days and then shows it again', () => {
    expect(isPopupHidden(popup, stores(), NOW)).toBe(false);
    hidePopupForDays(popup, 7, window.localStorage, NOW);
    expect(isPopupHidden(popup, stores(), NOW + 6 * DAY)).toBe(true);
    expect(isPopupHidden(popup, stores(), NOW + 7 * DAY + 1)).toBe(false);
    // the expired entry is removed on read
    expect(window.localStorage.getItem(popupStorageKey(popup))).toBeNull();
  });

  it('keys by id + version: an edited popup shows again', () => {
    hidePopupForDays(popup, 7, window.localStorage, NOW);
    const edited = { ...popup, updatedAt: '2026-11-20T09:00:00+09:00' };
    expect(popupStorageKey(edited)).not.toBe(popupStorageKey(popup));
    expect(isPopupHidden(edited, stores(), NOW)).toBe(false);
    expect(isPopupHidden({ id: 'p2', updatedAt: popup.updatedAt }, stores(), NOW)).toBe(false);
  });

  it('plain close lasts for the tab session only', () => {
    hidePopupForSession(popup, window.sessionStorage, NOW);
    expect(isPopupHidden(popup, stores(), NOW + 30 * DAY)).toBe(true);
    expect(window.localStorage.length).toBe(0);
    expect(isPopupHidden(popup, { local: window.localStorage, session: null }, NOW)).toBe(false);
  });

  it('ignores a zero-day dismissal and missing / broken storage', () => {
    hidePopupForDays(popup, 0, window.localStorage, NOW);
    expect(window.localStorage.length).toBe(0);
    expect(() => hidePopupForDays(popup, 7, null, NOW)).not.toThrow();
    expect(isPopupHidden(popup, {}, NOW)).toBe(false);
    const broken = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
    };
    expect(() => hidePopupForDays(popup, 7, broken, NOW)).not.toThrow();
    expect(isPopupHidden(popup, { local: broken }, NOW)).toBe(false);
  });

  it('prunes expired and superseded entries but keeps live ones', () => {
    const old = { id: 'p1', updatedAt: 'v1' };
    const current = { id: 'p1', updatedAt: 'v2' };
    const other = { id: 'p3', updatedAt: 'v1' };
    hidePopupForDays(old, 7, window.localStorage, NOW); // superseded by v2
    hidePopupForDays(current, 7, window.localStorage, NOW);
    hidePopupForDays(other, 1, window.localStorage, NOW - 3 * DAY); // expired
    window.localStorage.setItem('unrelated', '1');
    prunePopupStore(window.localStorage, [current], NOW);
    expect(window.localStorage.getItem(popupStorageKey(old))).toBeNull();
    expect(window.localStorage.getItem(popupStorageKey(other))).toBeNull();
    expect(window.localStorage.getItem(popupStorageKey(current))).not.toBeNull();
    expect(window.localStorage.getItem('unrelated')).toBe('1');
  });
});

describe('popupLink', () => {
  it('accepts site-relative and http(s) links only', () => {
    expect(popupLink('/support/report')).toEqual({ kind: 'internal', href: '/support/report' });
    expect(popupLink('https://example.com/a')).toEqual({
      kind: 'external',
      href: 'https://example.com/a',
    });
    expect(popupLink('//evil.example')).toBeNull();
    // browsers normalise "/\host" and "/\t/host" to a protocol-relative URL
    expect(popupLink('/\\evil.example')).toBeNull();
    expect(popupLink('/\t/evil.example')).toBeNull();
    expect(popupLink('javascript:alert(1)')).toBeNull();
    expect(popupLink(null)).toBeNull();
    expect(popupLink('')).toBeNull();
  });
});
