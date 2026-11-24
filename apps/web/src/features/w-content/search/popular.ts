/**
 * Keywords offered before the visitor types (mockdata.md §7 "많이 찾는", limited to what unified
 * search can answer: 지역 · 단지 · 중개사무소 names). The autocomplete endpoint returns its own
 * `popular` list; this is the server-rendered fallback for the search page.
 */
export const POPULAR_SEARCHES = ['신대지구', '오천지구', '연향동', '조례동', '레이크파크'] as const;

const POPULAR = new Set<string>(POPULAR_SEARCHES);

/**
 * Data-cache window of the unified-search API reads for `q`. Only the fixed popular keywords are
 * cached (a bounded set); any other `q` is free text, and caching every distinct value would grow
 * Next's on-disk fetch cache without bound — it is read per request instead (the API caches the
 * expensive parts in Redis, and the page is noindex).
 */
export function searchCacheSeconds(q: string): number {
  return POPULAR.has(q) ? 60 : 0;
}
