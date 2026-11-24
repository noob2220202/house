import {
  AdminRole,
  AdminStatus,
  AssetType,
  AuditActorType,
  AuthProvider,
  DealType,
  FaqCategory,
  TermsType,
  TradeSyncKind,
  TradeSyncStatus,
} from '@house/shared';
import { z } from 'zod';

/**
 * Response schemas of the m-content page group (콘텐츠 · 단지 · 사이트 설정 · 약관 · 관리자 계정 ·
 * 작업 기록 · 통계). The admin/complexes controllers do not exist yet (module READMEs + Prisma models
 * only), so every shape is an ASSUMPTION documented in docs/frontend-integration/m-content.md.
 * Fix the schema and the mock fixture (features/m-content/mock) together.
 */

const count = z.number().int().min(0);
const iso = z.string();
const nullableIso = z.string().nullable().default(null);

/** Backend pagination envelope `{ items, page, pageSize, total, totalPages }`. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: count,
    totalPages: z.number().int().min(1),
  });
}
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ---------- 공지사항 ----------

export const noticeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  isPinned: z.boolean(),
  isPublished: z.boolean(),
  publishedAt: nullableIso,
  viewCount: count.default(0),
  createdByAdminName: z.string().nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type NoticeSummary = z.infer<typeof noticeSummarySchema>;

export const noticeSchema = noticeSummarySchema.extend({ content: z.string() });
export type Notice = z.infer<typeof noticeSchema>;
export const noticePageSchema = pageSchema(noticeSummarySchema);

// ---------- FAQ ----------

export const faqSchema = z.object({
  id: z.string(),
  category: z.enum(FaqCategory),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean(),
  updatedAt: iso,
});
export type Faq = z.infer<typeof faqSchema>;
export const faqPageSchema = pageSchema(faqSchema);

// ---------- 동네TV ----------

export const videoSchema = z.object({
  id: z.string(),
  title: z.string(),
  youtubeUrl: z.string(),
  youtubeVideoId: z.string(),
  thumbnailUrl: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  regionCode: z.string().nullable().default(null),
  complexId: z.string().nullable().default(null),
  /** Display extra (joined) — optional. */
  complexName: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
  isPublished: z.boolean(),
  publishedAt: nullableIso,
  updatedAt: iso,
});
export type Video = z.infer<typeof videoSchema>;
export const videoPageSchema = pageSchema(videoSchema);

// ---------- 메인 화면 편집 ----------

export const HOME_SECTION_KEYS = [
  'HERO_SEARCH',
  'CATEGORY_TILES',
  'MAIN_BANNER',
  'POPULAR_COMPLEXES',
  'NEW_LISTINGS',
  'DEAL_REQUEST_CTA',
  'FEATURED_AGENCIES',
  'LOCAL_VIDEOS',
  'NOTICES',
  'APP_BAND',
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const homeLayoutSchema = z.object({
  sections: z.array(z.object({ key: z.enum(HOME_SECTION_KEYS), visible: z.boolean() })),
});
export type HomeLayout = z.infer<typeof homeLayoutSchema>;

// ---------- 사이트 설정 ----------

/** GET/PUT /admin/site-settings/:key → the stored value plus who changed it last. */
export function siteSettingSchema<T extends z.ZodType>(value: T) {
  return z.object({
    key: z.string(),
    /** null until the operator saves the key for the first time. */
    value: value.nullable(),
    updatedAt: nullableIso,
    updatedByAdminName: z.string().nullable().default(null),
  });
}
export interface SiteSetting<T> {
  key: string;
  value: T | null;
  updatedAt: string | null;
  updatedByAdminName: string | null;
}

/** Lenient read shapes (stored values may predate a field) — the forms validate strictly on save. */
export const businessInfoValueSchema = z
  .object({
    companyName: z.string().default(''),
    ceoName: z.string().default(''),
    businessNumber: z.string().default(''),
    mailOrderNumber: z.string().optional(),
    address: z.string().default(''),
    privacyOfficer: z.string().default(''),
    phone: z.string().default(''),
    email: z.string().default(''),
  })
  .loose();
export type BusinessInfoValue = z.infer<typeof businessInfoValueSchema>;

export const contactValueSchema = z
  .object({
    phone: z.string().default(''),
    email: z.string().default(''),
    hours: z.string().optional(),
    kakaoChannelUrl: z.string().optional(),
  })
  .loose();
export type ContactValue = z.infer<typeof contactValueSchema>;

export const seoValueSchema = z
  .object({
    title: z.string().default(''),
    description: z.string().default(''),
    ogImageMediaId: z.string().optional(),
  })
  .loose();
export type SeoValue = z.infer<typeof seoValueSchema>;

export const featuresValueSchema = z.record(z.string(), z.boolean());
export type FeaturesValue = z.infer<typeof featuresValueSchema>;

// ---------- 약관 ----------

export const termsSummarySchema = z.object({
  id: z.string(),
  type: z.enum(TermsType),
  version: z.string(),
  title: z.string(),
  isRequired: z.boolean(),
  effectiveAt: iso,
  /** null = draft (not visible to users yet). */
  publishedAt: nullableIso,
  /** True for the published version users currently agree to (latest effective one). */
  isCurrent: z.boolean().default(false),
  /** Members who agreed to this version (display extra). */
  consentCount: count.nullable().default(null),
  createdAt: iso,
  updatedAt: iso,
});
export type TermsSummary = z.infer<typeof termsSummarySchema>;
export const termsSchema = termsSummarySchema.extend({ content: z.string() });
export type TermsDocument = z.infer<typeof termsSchema>;
export const termsPageSchema = pageSchema(termsSummarySchema);

export const termsPublishResultSchema = termsSchema.extend({
  /** Members who must agree again at their next visit (required documents only). */
  reconsentUserCount: count.nullable().default(null),
});

// ---------- 단지 ----------

export const complexSummarySchema = z.object({
  id: z.string(),
  assetType: z.enum(AssetType).default(AssetType.APT),
  name: z.string(),
  roadAddress: z.string().nullable().default(null),
  jibunAddress: z.string().nullable().default(null),
  emdName: z.string().nullable().default(null),
  households: count.nullable().default(null),
  builtYear: z.number().int().nullable().default(null),
  areaTypeCount: count.default(0),
  photoCount: count.default(0),
  activeListingCount: count.default(0),
  viewCount: count.default(0),
  externalCode: z.string().nullable().default(null),
  /** Latest matched 실거래 date (YYYY-MM-DD). */
  lastTradeDate: z.string().nullable().default(null),
  updatedAt: iso,
});
export type ComplexSummary = z.infer<typeof complexSummarySchema>;
export const complexPageSchema = pageSchema(complexSummarySchema);

export const areaTypeSchema = z.object({
  id: z.string(),
  exclusiveArea: z.number(),
  supplyArea: z.number().nullable().default(null),
  typeName: z.string().default(''),
  pyeongLabel: z.string().nullable().default(null),
  households: count.nullable().default(null),
  rooms: count.nullable().default(null),
  baths: count.nullable().default(null),
  /** Display extras: matched trades for this 평형 and the latest 매매 price (만원). */
  tradeCount: count.default(0),
  lastSalePrice: count.nullable().default(null),
});
export type AreaType = z.infer<typeof areaTypeSchema>;

export const complexPhotoSchema = z.object({
  id: z.string(),
  mediaId: z.string(),
  url: z.string(),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
  caption: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});
export type ComplexPhoto = z.infer<typeof complexPhotoSchema>;

export const complexDetailSchema = complexSummarySchema.extend({
  sggCode: z.string(),
  emdCode: z.string().nullable().default(null),
  jibun: z.string().nullable().default(null),
  lat: z.number(),
  lng: z.number(),
  buildings: count.nullable().default(null),
  floorsMin: z.number().int().nullable().default(null),
  floorsMax: z.number().int().nullable().default(null),
  approvalDate: z.string().nullable().default(null),
  parkingTotal: count.nullable().default(null),
  parkingPerHousehold: z.number().nullable().default(null),
  floorAreaRatio: z.number().nullable().default(null),
  buildingCoverageRatio: z.number().nullable().default(null),
  heatingType: z.string().nullable().default(null),
  builder: z.string().nullable().default(null),
  favoriteCount: count.default(0),
  createdAt: iso,
  areaTypes: z.array(areaTypeSchema).default([]),
  photos: z.array(complexPhotoSchema).default([]),
  trades: z
    .object({
      total: count,
      /** Source rows in this 시군구 with the same name/지번 that could not be matched to a 평형. */
      unmatched: count.default(0),
      lastDealDate: z.string().nullable().default(null),
    })
    .default({ total: 0, unmatched: 0, lastDealDate: null }),
});
export type ComplexDetail = z.infer<typeof complexDetailSchema>;

export const tradeSyncRunSchema = z.object({
  id: z.string(),
  kind: z.enum(TradeSyncKind),
  sggCode: z.string(),
  yearMonth: z.number().int(),
  status: z.enum(TradeSyncStatus),
  fetchedCount: count.default(0),
  upsertedCount: count.default(0),
  matchedCount: count.default(0),
  error: z.string().nullable().default(null),
  startedAt: iso,
  finishedAt: nullableIso,
  /** Display extra: who started a manual run (null = scheduled job). */
  triggeredByAdminName: z.string().nullable().default(null),
});
export type TradeSyncRun = z.infer<typeof tradeSyncRunSchema>;
export const tradeSyncRunPageSchema = pageSchema(tradeSyncRunSchema);
export const tradeSyncTriggerSchema = z.object({ runs: z.array(tradeSyncRunSchema) });

/** MediaDto (packages/shared/src/schemas/media.ts) — only what the photo uploader reads. */
const variant = z.object({ url: z.string(), width: z.number(), height: z.number() });
export const mediaSchema = z.object({
  id: z.string(),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
  variants: z
    .object({ thumb: variant.optional(), medium: variant.optional(), large: variant.optional() })
    .default({}),
});

// ---------- 관리자 계정 ----------

export const adminAccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(AdminRole),
  status: z.enum(AdminStatus),
  totpEnabled: z.boolean().default(false),
  ipAllowlist: z.array(z.string()).default([]),
  lockedUntil: nullableIso,
  lastLoginAt: nullableIso,
  lastLoginIp: z.string().nullable().default(null),
  createdAt: iso,
});
export type AdminAccount = z.infer<typeof adminAccountSchema>;
export const adminAccountPageSchema = pageSchema(adminAccountSchema);

// ---------- 작업 기록 ----------

export const auditLogSchema = z.object({
  id: z.string(),
  actorType: z.enum(AuditActorType),
  adminUserId: z.string().nullable().default(null),
  adminName: z.string().nullable().default(null),
  adminEmail: z.string().nullable().default(null),
  userId: z.string().nullable().default(null),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().nullable().default(null),
  /** Display extra: human label of the resource (title, name). */
  resourceLabel: z.string().nullable().default(null),
  before: z.unknown().nullable().default(null),
  after: z.unknown().nullable().default(null),
  ip: z.string().nullable().default(null),
  userAgent: z.string().nullable().default(null),
  requestId: z.string().nullable().default(null),
  createdAt: iso,
});
export type AuditLog = z.infer<typeof auditLogSchema>;
export const auditLogPageSchema = pageSchema(auditLogSchema);

// ---------- 간편로그인 연동 ----------

export const socialLoginSchema = z.object({
  items: z.array(
    z.object({
      provider: z.enum(AuthProvider),
      enabled: z.boolean(),
      healthy: z.boolean(),
      /** Masked client id ("a1b2••••••9f"). Secrets are never sent to the browser. */
      clientIdMasked: z.string().nullable().default(null),
      callbackUrl: z.string(),
      lastSuccessAt: nullableIso,
      last24h: z.object({ success: count, failure: count }).default({ success: 0, failure: 0 }),
      /** Share of all member accounts linked to this provider (0–1). */
      userShare: z.number().min(0).max(1).nullable().default(null),
      message: z.string().nullable().default(null),
    }),
  ),
});
export type SocialLoginStatus = z.infer<typeof socialLoginSchema>;

// ---------- 통계 ----------

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const trafficStatsSchema = z.object({
  days: z.number().int(),
  points: z.array(z.object({ date: dateKey, visitors: count, pageViews: count, signups: count })),
  /** Totals of the period right before `points` (same length). */
  previous: z.object({ visitors: count, pageViews: count, signups: count }),
  devices: z.object({ mobile: count, desktop: count }).default({ mobile: 0, desktop: 0 }),
  signupsByProvider: z.array(z.object({ provider: z.enum(AuthProvider), count })).default([]),
  topPages: z
    .array(z.object({ path: z.string(), label: z.string(), pageViews: count }))
    .default([]),
});
export type TrafficStats = z.infer<typeof trafficStatsSchema>;

export const listingStatsSchema = z.object({
  days: z.number().int(),
  points: z.array(z.object({ date: dateKey, created: count, closed: count })),
  previous: z.object({ created: count, closed: count }),
  activeTotal: count,
  byAssetType: z.array(z.object({ assetType: z.enum(AssetType), count })).default([]),
  byDealType: z.array(z.object({ dealType: z.enum(DealType), count })).default([]),
  topComplexes: z
    .array(z.object({ id: z.string(), name: z.string(), views: count, listings: count }))
    .default([]),
});
export type ListingStats = z.infer<typeof listingStatsSchema>;

export const dealRequestStatsSchema = z.object({
  days: z.number().int(),
  points: z.array(z.object({ date: dateKey, sell: count, find: count, proposals: count })),
  previous: z.object({ sell: count, find: count, proposals: count }),
  /** Share of requests that received at least one proposal (0–1). */
  responseRate: z.number().min(0).max(1).nullable().default(null),
  avgFirstResponseMinutes: z.number().nullable().default(null),
  byRegion: z.array(z.object({ name: z.string(), count })).default([]),
});
export type DealRequestStats = z.infer<typeof dealRequestStatsSchema>;

export const adStatsSchema = z.object({
  days: z.number().int(),
  points: z.array(z.object({ date: dateKey, impressions: count, clicks: count })),
  previous: z.object({ impressions: count, clicks: count }),
  activeBanners: count.default(0),
  bySlot: z
    .array(z.object({ slot: z.string(), label: z.string(), impressions: count, clicks: count }))
    .default([]),
});
export type AdStats = z.infer<typeof adStatsSchema>;
