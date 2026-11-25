/**
 * A few real 순천 지역 names: the `popular` list of the mock autocomplete, and the q values whose
 * search results are data-cached. NOT shown as "많이 찾는" — the search page renders the real
 * `popular` list of `GET /search/suggest` (most-viewed 지역 · 단지) instead (`getPopularSearches`).
 */
export const POPULAR_SEARCHES = ['신대지구', '오천지구', '연향동', '조례동', '왕지동'] as const;

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
