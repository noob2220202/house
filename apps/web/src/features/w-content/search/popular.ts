/**
 * Keywords offered before the visitor types (mockdata.md §7 "많이 찾는", limited to what unified
 * search can answer: 지역 · 단지 · 중개사무소 names). The autocomplete endpoint returns its own
 * `popular` list; this is the server-rendered fallback for the search page.
 */
export const POPULAR_SEARCHES = ['신대지구', '오천지구', '연향동', '조례동', '레이크파크'] as const;
