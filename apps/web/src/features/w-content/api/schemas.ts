import { FaqCategory, TermsType } from '@house/shared';
import { z } from 'zod';
import { agencySummarySchema, type AgencySummary } from '@/features/w-agencies/api/schemas';
import { complexDetailSchema, type ComplexDetail } from '@/features/w-complex/api/schemas';

/**
 * Response schemas of the w-content page group. Paths mirror apps/api/src/modules/{admin,auth}/README.md;
 * the controllers do not exist yet, so the payload SHAPES are assumptions (see
 * docs/frontend-integration/w-content.md). Schemas are lenient on purpose: unknown keys are ignored
 * and display-only extras are optional, so a slimmer backend payload still renders.
 */

/** A list endpoint may answer with the pagination envelope, `{ items }`, or a bare array — normalise to the envelope. */
export function pageOf<T extends z.ZodType>(item: T) {
  const envelope = z.object({
    items: z.array(item),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    total: z.number().optional(),
    totalPages: z.number().optional(),
  });
  return z.union([z.array(item), envelope]).transform((v) => {
    const items: z.output<T>[] = Array.isArray(v) ? v : v.items;
    const rest: Partial<Record<'page' | 'pageSize' | 'total' | 'totalPages', number>> =
      Array.isArray(v) ? {} : v;
    const pageSize = rest.pageSize ?? Math.max(items.length, 1);
    const total = rest.total ?? items.length;
    return {
      items,
      page: rest.page ?? 1,
      pageSize,
      total,
      totalPages: rest.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}

// ---- notices ---------------------------------------------------------------------------------------

export const noticeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  isPinned: z.boolean().default(false),
  publishedAt: z.string().nullable().optional(),
  viewCount: z.number().nullable().optional(),
});
export type NoticeSummary = z.infer<typeof noticeSummarySchema>;
export const noticePageSchema = pageOf(noticeSummarySchema);
export type NoticePage = z.infer<typeof noticePageSchema>;

const noticeNeighbourSchema = z
  .object({ id: z.string(), title: z.string(), publishedAt: z.string().nullable().optional() })
  .nullable()
  .optional();

export const noticeDetailSchema = noticeSummarySchema.extend({
  /** Plain text with light markup — rendered by <RichText>, never as HTML. */
  content: z.string(),
  /** Neighbours in list order (ASSUMED extras): prev = older, next = newer. */
  prev: noticeNeighbourSchema,
  next: noticeNeighbourSchema,
});
export type NoticeDetail = z.infer<typeof noticeDetailSchema>;

// ---- FAQ -------------------------------------------------------------------------------------------

export const faqSchema = z.object({
  id: z.string(),
  category: z.enum(FaqCategory),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number().optional(),
});
export type Faq = z.infer<typeof faqSchema>;
export const faqListSchema = pageOf(faqSchema).transform((p) => p.items);

// ---- videos (동네TV) -------------------------------------------------------------------------------

export const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  youtubeUrl: z.string(),
  /** Stored by the backend; derived from `youtubeUrl` when missing. */
  youtubeVideoId: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  regionCode: z.string().nullable().optional(),
  complexId: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  /** Display extras that are not in the `local_videos` table yet (same names as the w-home mock). */
  durationSeconds: z.number().nullable().optional(),
  viewCount: z.number().nullable().optional(),
  channelName: z.string().nullable().optional(),
});
export type Video = z.infer<typeof videoSchema>;
export const videoPageSchema = pageOf(videoSchema);
export type VideoPage = z.infer<typeof videoPageSchema>;

// ---- terms -----------------------------------------------------------------------------------------

/**
 * THE terms contract (`GET /terms`, `GET /terms/:type`, `GET /terms/:type/versions[/:version]`),
 * shared with w-auth. A version row of a list carries no `content`; `isRequired` may be left
 * out on superseded versions.
 */
export const termsVersionSchema = z.object({
  id: z.string(),
  type: z.enum(TermsType),
  version: z.string(),
  title: z.string(),
  isRequired: z.boolean().optional(),
  effectiveAt: z.string(),
  isCurrent: z.boolean().optional(),
  /** Full text — absent on list endpoints. */
  content: z.string().optional(),
});
export type TermsVersion = z.infer<typeof termsVersionSchema>;
export const termsVersionListSchema = pageOf(termsVersionSchema).transform((p) => p.items);

export const termsDocumentSchema = termsVersionSchema.extend({
  /** Plain text (조/항 on their own lines) — rendered by <RichText>, never as HTML. */
  content: z.string(),
});
export type TermsDocument = z.infer<typeof termsDocumentSchema>;

// ---- operator policies (ASSUMED endpoint) ----------------------------------------------------------

/**
 * `GET /policies/:slug` — operating policies that are not consent documents (허위매물 신고 정책),
 * edited in the back-office like notices. `404` until the operator publishes one.
 */
export const policyDocumentSchema = z.object({
  slug: z.string(),
  title: z.string(),
  version: z.string().nullable().optional(),
  effectiveAt: z.string().nullable().optional(),
  /** Plain text with light markup — rendered by <RichText>, never as HTML. */
  content: z.string(),
});
export type PolicyDocument = z.infer<typeof policyDocumentSchema>;

/// ---- unified search ------------------------------------------------------------------------------
// `/search` fans out over the real public list endpoints (api/server.ts#getSearchResults) and parses
// them with the schemas of the page groups that own those entities — no third dialect:
//   단지 → `GET /complexes?q` · w-complex `complexDetailSchema`
//   중개사무소 → `GET /agencies?q` · w-agencies `agencySummarySchema`
//   지역 → `GET /regions` (matched by name on our server) · w-map `regionSchema`

export const searchComplexPageSchema = pageOf(complexDetailSchema);
export type SearchComplex = ComplexDetail;
export const searchAgencyPageSchema = pageOf(agencySummarySchema);
export type SearchAgency = AgencySummary;

/** A 지역 hit: one `GET /regions` entry whose name matches the query. */
export interface SearchRegion {
  code: string;
  name: string;
  /** Parent 읍·면 for 리-level entries ("해룡면"). */
  parentName?: string | null;
  lat: number;
  lng: number;
}

export interface SearchSection<T> {
  items: T[];
  total: number;
  /** The section's endpoint failed — the other sections still render. */
  failed?: boolean;
}

export interface SearchResult {
  regions: SearchSection<SearchRegion>;
  complexes: SearchSection<SearchComplex>;
  agencies: SearchSection<SearchAgency>;
}

// ---- autocomplete (ASSUMED endpoint) — the single definition of the suggest contract --------------
// w-home and w-map still carry their own copies (`suggestResponseSchema`); they should import these.

export const SEARCH_SUGGESTION_TYPES = ['REGION', 'COMPLEX', 'AGENCY'] as const;
export type SearchSuggestionType = (typeof SEARCH_SUGGESTION_TYPES)[number];

export const searchSuggestionSchema = z.object({
  type: z.enum(SEARCH_SUGGESTION_TYPES),
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;

export const searchSuggestSchema = z.object({
  items: z.array(searchSuggestionSchema),
  popular: z.array(z.string()).optional(),
});
export type SearchSuggestResult = z.infer<typeof searchSuggestSchema>;
