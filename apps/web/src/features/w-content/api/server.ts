import 'server-only';
import { DEFAULT_SGG_CODE, type TermsType } from '@house/shared';
import { regionListSchema } from '@/features/w-map/api/schemas';
import { ApiError } from '@/lib/api/errors';
import { serverGet } from '@/lib/api/server';
import { matchRegions } from '../search/targets';
import {
  faqListSchema,
  noticeDetailSchema,
  noticePageSchema,
  policyDocumentSchema,
  searchAgencyPageSchema,
  searchComplexPageSchema,
  termsDocumentSchema,
  termsVersionListSchema,
  videoPageSchema,
  type SearchResult,
  type SearchSection,
} from './schemas';

/** Server-side reads of the w-content pages (public, cached with `revalidate`). All throw ApiError. */

export const NOTICE_PAGE_SIZE = 10;

/** GET /notices?page&pageSize — pinned first, then newest. */
export const getNotices = (page: number, extra?: Record<string, string | undefined>) =>
  serverGet('/notices', {
    query: { page, pageSize: NOTICE_PAGE_SIZE, ...extra },
    schema: noticePageSchema,
    revalidate: 120,
    tags: ['notices'],
  });

/** GET /notices/:id */
export const getNotice = (id: string) =>
  serverGet(`/notices/${encodeURIComponent(id)}`, {
    schema: noticeDetailSchema,
    revalidate: 120,
    tags: ['notices'],
  });

/** GET /faqs — every published FAQ (filtered by category / text on the client). */
export const getFaqs = (extra?: Record<string, string | undefined>) =>
  serverGet('/faqs', { query: extra, schema: faqListSchema, revalidate: 300, tags: ['faqs'] });

/** GET /videos?page&pageSize */
export const getVideos = (page = 1, pageSize = 24, extra?: Record<string, string | undefined>) =>
  serverGet('/videos', {
    query: { page, pageSize, ...extra },
    schema: videoPageSchema,
    revalidate: 300,
    tags: ['videos'],
  });

/** GET /terms/:type — the version in force. */
export const getCurrentTerms = (type: TermsType) =>
  serverGet(`/terms/${type}`, { schema: termsDocumentSchema, revalidate: 600, tags: ['terms'] });

/** GET /terms/:type/versions — ASSUMED: all published versions, newest first. */
export const getTermsVersions = (type: TermsType) =>
  serverGet(`/terms/${type}/versions`, {
    schema: termsVersionListSchema,
    revalidate: 600,
    tags: ['terms'],
  });

/** GET /terms/:type/versions/:version — ASSUMED: one specific version. */
export const getTermsVersion = (type: TermsType, version: string) =>
  serverGet(`/terms/${type}/versions/${encodeURIComponent(version)}`, {
    schema: termsDocumentSchema,
    revalidate: 600,
    tags: ['terms'],
  });

/** GET /policies/:slug — ASSUMED: operator-maintained policy page (허위매물 신고 정책). */
export const getPolicyDocument = (slug: string, extra?: Record<string, string | undefined>) =>
  serverGet(`/policies/${encodeURIComponent(slug)}`, {
    query: extra,
    schema: policyDocumentSchema,
    revalidate: 600,
    tags: ['policies'],
  });

export const SEARCH_SECTION_LIMIT = 6;
/** Items per section on a single-section tab (`/search?q&type=complex`). */
export const SEARCH_TAB_LIMIT = 50;
export type SearchSectionType = 'region' | 'complex' | 'agency';

async function section<T>(
  run: () => Promise<{ items: T[]; total: number }>,
): Promise<SearchSection<T>> {
  try {
    const { items, total } = await run();
    return { items, total };
  } catch (error) {
    if (error instanceof ApiError) return { items: [], total: 0, failed: true };
    throw error;
  }
}

/** GET /regions — the city's 읍면동 / 지구 (small, changes rarely). */
const getRegions = () =>
  serverGet('/regions', {
    query: { sggCode: DEFAULT_SGG_CODE },
    schema: regionListSchema,
    revalidate: 3600,
    tags: ['regions'],
  });

/**
 * Unified search = fan-out over the public list endpoints the backend READMEs define:
 * `GET /complexes?q` (complexes module), `GET /agencies?q` (agencies module) and `GET /regions`
 * matched by name here. Each section fails on its own; totals come from the pagination envelope.
 * With `type`, the other sections are asked for one row only — just enough for their tab counts.
 */
export async function getSearchResults(q: string, type?: SearchSectionType): Promise<SearchResult> {
  const sizeOf = (s: SearchSectionType) =>
    type === undefined ? SEARCH_SECTION_LIMIT : type === s ? SEARCH_TAB_LIMIT : 1;
  const [regions, complexes, agencies] = await Promise.all([
    section(async () => {
      const all = matchRegions(await getRegions(), q);
      return { items: all.slice(0, sizeOf('region')), total: all.length };
    }),
    section(() =>
      serverGet('/complexes', {
        query: { q, page: 1, pageSize: sizeOf('complex') },
        schema: searchComplexPageSchema,
        revalidate: 60,
        tags: ['search', 'complexes'],
      }),
    ),
    section(() =>
      serverGet('/agencies', {
        query: { q, page: 1, pageSize: sizeOf('agency') },
        schema: searchAgencyPageSchema,
        revalidate: 60,
        tags: ['search', 'agencies'],
      }),
    ),
  ]);
  return { regions, complexes, agencies };
}
