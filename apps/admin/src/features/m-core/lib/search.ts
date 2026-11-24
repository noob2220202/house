import { AgencyStatus, ListingStatus, UserStatus } from '@house/shared';
import type { StatusTone } from '@house/ui';

export const LISTING_STATUS_TONE: Record<ListingStatus, StatusTone> = {
  [ListingStatus.DRAFT]: 'review',
  [ListingStatus.ACTIVE]: 'live',
  [ListingStatus.RESERVED]: 'scheduled',
  [ListingStatus.CLOSED]: 'ended',
  [ListingStatus.HIDDEN]: 'rejected',
};

export const AGENCY_STATUS_TONE: Record<AgencyStatus, StatusTone> = {
  [AgencyStatus.PENDING]: 'review',
  [AgencyStatus.APPROVED]: 'live',
  [AgencyStatus.REJECTED]: 'rejected',
  [AgencyStatus.SUSPENDED]: 'ended',
};

export const USER_STATUS_TONE: Record<UserStatus, StatusTone> = {
  [UserStatus.ACTIVE]: 'live',
  [UserStatus.SUSPENDED]: 'rejected',
  [UserStatus.WITHDRAWN]: 'ended',
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  [UserStatus.ACTIVE]: '정상',
  [UserStatus.SUSPENDED]: '이용 정지',
  [UserStatus.WITHDRAWN]: '탈퇴',
};

/** Trims and collapses whitespace; the API needs at least two characters. */
export function normalizeQuery(input: string | null | undefined): string {
  return (input ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

export interface TextPart {
  text: string;
  match: boolean;
}

/** Splits `text` around case-insensitive occurrences of `query` for <mark> highlighting. */
export function highlightParts(text: string, query: string): TextPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: TextPart[] = [];
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at < 0) break;
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

// ---------- topbar suggestions ----------

export type SuggestionKind = 'listing' | 'agency' | 'user' | 'all';

export interface SearchSuggestion {
  /** Stable option id: "<kind>:<id>" ("all" for the "see every result" row). */
  value: string;
  kind: SuggestionKind;
  label: string;
  /** Short type tag shown on the right of the row. */
  description: string;
  /** Back-office path to open. */
  href: string;
}

/** Minimal shape of GET /admin/search needed for suggestions (see `adminSearchSchema`). */
export interface SuggestSource {
  listings: {
    total: number;
    items: readonly { id: string; listingNo?: string | null; title: string }[];
  };
  agencies: { total: number; items: readonly { id: string; name: string }[] };
  users: { total: number; items: readonly { id: string; nickname: string }[] };
}

export const searchPageHref = (q: string) => `/search?q=${encodeURIComponent(q)}`;

/**
 * Flattens grouped search results into the topbar suggestion list: up to `perGroup` rows of each
 * kind (listings → offices → members) and, when anything matched, a last row that opens the full
 * results page with the total.
 */
export function searchSuggestions(
  result: SuggestSource,
  q: string,
  routes: { listings: string; agencies: string; users: string },
  perGroup = 3,
): SearchSuggestion[] {
  const total = result.listings.total + result.agencies.total + result.users.total;
  if (total === 0) return [];
  return [
    ...result.listings.items.slice(0, perGroup).map((l) => ({
      value: `listing:${l.id}`,
      kind: 'listing' as const,
      label: l.title,
      description: l.listingNo ? `매물 ${l.listingNo}` : '매물',
      href: `${routes.listings}/${l.id}`,
    })),
    ...result.agencies.items.slice(0, perGroup).map((a) => ({
      value: `agency:${a.id}`,
      kind: 'agency' as const,
      label: a.name,
      description: '중개사',
      href: `${routes.agencies}/${a.id}`,
    })),
    ...result.users.items.slice(0, perGroup).map((u) => ({
      value: `user:${u.id}`,
      kind: 'user' as const,
      label: u.nickname,
      description: '회원',
      href: `${routes.users}/${u.id}`,
    })),
    {
      value: 'all',
      kind: 'all' as const,
      label: `‘${q}’ 전체 결과 보기`,
      description: `${total.toLocaleString('ko-KR')}건`,
      href: searchPageHref(q),
    },
  ];
}
