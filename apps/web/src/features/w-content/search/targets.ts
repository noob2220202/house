import { ROUTES } from '@/config/nav';
import { buildMapHref } from '@/lib/map/url-state';
import type { SearchSuggestion, SearchSuggestionType } from '../api/schemas';

/** Zoom used when a search result opens the map on a 동/지구 (markers band, not clusters). */
export const REGION_MAP_ZOOM = 15;

export const SUGGESTION_TYPE_LABEL: Record<SearchSuggestionType, string> = {
  REGION: '지역',
  COMPLEX: '단지',
  AGENCY: '중개사무소',
};

/** Map link centred on a region; falls back to the default map view without coordinates. */
export function regionMapHref(region: { lat?: number | null; lng?: number | null }): string {
  const path = ROUTES.map('apt');
  if (typeof region.lat !== 'number' || typeof region.lng !== 'number') return path;
  return buildMapHref(path, {
    view: { center: { lat: region.lat, lng: region.lng }, zoom: REGION_MAP_ZOOM },
  });
}

/** Where an autocomplete suggestion leads. */
export function suggestionHref(s: Pick<SearchSuggestion, 'type' | 'id' | 'lat' | 'lng'>): string {
  switch (s.type) {
    case 'COMPLEX':
      return ROUTES.complex(s.id);
    case 'AGENCY':
      return ROUTES.agency(s.id);
    default:
      return regionMapHref(s);
  }
}

const squash = (s: string): string => s.replace(/\s+/g, '').toLowerCase();
/** "신대리" / "연향동" / "신대지구" → "신대" / "연향" / "신대" (admin-level suffixes dropped). */
const stem = (s: string): string => s.replace(/(지구|동|리|면|읍)$/, '');

/**
 * 지역 hits for a query among the city's 읍면동 / 지구 (`GET /regions`): name, parent 읍·면 or
 * "parent name" match, ignoring spaces and the 동 / 리 / 지구 suffix ("신대리" finds 신대지구).
 * Exact names first, then prefix matches, then the rest in list order.
 */
export function matchRegions<T extends { name: string; parentName?: string | null }>(
  regions: readonly T[],
  query: string,
): T[] {
  const q = squash(query);
  if (q === '') return [];
  const qStem = stem(q) || q;
  const scored: { region: T; score: number; index: number }[] = [];
  regions.forEach((region, index) => {
    const name = squash(region.name);
    const parent = squash(region.parentName ?? '');
    const haystacks = [name, parent, `${parent}${name}`].filter(Boolean);
    let score = -1;
    if (name === q) score = 3;
    else if (name.startsWith(q) || stem(name) === qStem) score = 2;
    else if (haystacks.some((h) => h.includes(q) || (qStem.length >= 2 && h.includes(qStem))))
      score = 1;
    if (score >= 0) scored.push({ region, score, index });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.region);
}

export const SEARCH_MAX_LENGTH = 50;

/** Normalises the `q` query param: string, trimmed, single spaces, max 50 chars. */
export function normalizeSearchQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_LENGTH);
}

export type SearchTab = 'all' | 'region' | 'complex' | 'agency';
export const SEARCH_TABS: readonly SearchTab[] = ['all', 'region', 'complex', 'agency'];

export function parseSearchTab(raw: string | string[] | undefined): SearchTab {
  return typeof raw === 'string' && (SEARCH_TABS as readonly string[]).includes(raw)
    ? (raw as SearchTab)
    : 'all';
}

/** /search?q=…&type=… (type omitted for the 전체 tab). */
export function searchHref(q: string, tab: SearchTab = 'all'): string {
  const base = ROUTES.search(q);
  return tab === 'all' ? base : `${base}&type=${tab}`;
}
