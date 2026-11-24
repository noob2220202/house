import { BannerSlot, BannerStatus, BannerTargeting, MediaStatus, PopupPage } from '@house/shared';
import { z } from 'zod';

/**
 * Response schemas of the ads admin API — the real views of `apps/api/src/modules/ads`
 * (shared `AdminBannerView`, `AdminPopupView`, `BannerSlotView`, `BannerStatsView`) and the media
 * module (`MediaView`). Banner / popup views are mapped onto the view model the screens use
 * (`pcMedia`, `agencyId`, …); fields the API does not return are filled in by the screens
 * (region names from GET /regions, per-banner totals from the stats endpoint).
 */
const variantSchema = z.object({ url: z.string(), width: z.number(), height: z.number() });

/** MediaView (packages/shared/src/media/types.ts): POST /admin/media, GET /admin/media/:id. */
export const mediaSchema = z.object({
  id: z.string(),
  purpose: z.string().optional(),
  status: z.enum(MediaStatus).optional(),
  mimeType: z.string().optional(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  /** Full-size (sanitized) image; null until READY. */
  url: z.string().nullish(),
  variants: z
    .object({
      thumb: variantSchema.optional(),
      medium: variantSchema.optional(),
      large: variantSchema.optional(),
    })
    .default({}),
});
export type Media = z.infer<typeof mediaSchema>;

/** Largest available image URL of a media object. */
export function mediaUrl(media: Media | null | undefined): string | null {
  const v = media?.variants;
  return v?.large?.url ?? media?.url ?? v?.medium?.url ?? v?.thumb?.url ?? null;
}

/** `AdMediaView` — the image of a banner / popup as the ads views embed it. */
export const adMediaViewSchema = z.object({
  id: z.string(),
  url: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
});
type AdMediaView = z.infer<typeof adMediaViewSchema>;

const fromAdMedia = (m: AdMediaView): Media => ({
  id: m.id,
  width: m.width,
  height: m.height,
  url: m.url,
  variants: {},
});

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });

/** GET /admin/banners(/:id), POST/PATCH responses: shared `AdminBannerView`. */
export const adminBannerViewSchema = z.object({
  id: z.string(),
  slot: z.enum(BannerSlot),
  title: z.string(),
  advertiserName: z.string().nullable(),
  agency: z.object({ id: z.string(), name: z.string() }).nullable(),
  pcImage: adMediaViewSchema,
  mobileImage: adMediaViewSchema.nullable(),
  linkUrl: z.string().nullable(),
  newWindow: z.boolean(),
  startAt: z.string(),
  endAt: z.string(),
  paused: z.boolean(),
  status: z.enum(BannerStatus),
  priority: z.number().default(0),
  sortOrder: z.number(),
  targeting: z.enum(BannerTargeting),
  targetRegionCodes: z.array(z.string()).default([]),
  targetComplexes: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  memo: z.string().nullable().default(null),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** Advertiser office as the screens read it (`representativeName` is not in the banner view). */
type BannerAgency = { id: string; name: string; representativeName?: string | null } | null;
const bannerAgency = (agency: { id: string; name: string } | null): BannerAgency => agency;

export const adminBannerSchema = adminBannerViewSchema.transform((b) => ({
  id: b.id,
  /** Human-friendly id; the API has none, so the UI shows a short form of `id`. */
  code: null as string | null,
  slot: b.slot,
  title: b.title,
  advertiserName: b.advertiserName,
  agencyId: b.agency?.id ?? null,
  agency: bannerAgency(b.agency),
  pcMedia: fromAdMedia(b.pcImage),
  mobileMedia: b.mobileImage ? fromAdMedia(b.mobileImage) : null,
  linkUrl: b.linkUrl,
  newWindow: b.newWindow,
  startAt: b.startAt,
  endAt: b.endAt,
  paused: b.paused,
  priority: b.priority,
  sortOrder: b.sortOrder,
  targeting: b.targeting,
  targetRegionCodes: b.targetRegionCodes,
  targetComplexIds: b.targetComplexes.map((c) => c.id),
  /** Names are not in the view: the screens resolve them with GET /regions (`withRegionNames`). */
  targetRegions: b.targetRegionCodes.map((code) => ({ code, name: code })),
  targetComplexes: b.targetComplexes,
  memo: b.memo,
  status: b.status,
  /** Totals come from GET /admin/banners/:id/stats; null until loaded. */
  impressions: null as number | null,
  clicks: null as number | null,
}));
export type AdminBanner = z.infer<typeof adminBannerSchema>;
export const adminBannerPageSchema = paginated(adminBannerSchema);
export type AdminBannerPage = z.infer<typeof adminBannerPageSchema>;

const sizeSchema = z.object({ width: z.number(), height: z.number() });

/**
 * GET /admin/banner-slots(/:slot), PATCH response: shared `BannerSlotView`. The API counts live
 * banners (`activeCount`) and live + scheduled ones (`upcomingCount`); the scheduled count is the
 * difference. Paused / total counts are not part of the view (null = unknown).
 */
export const bannerSlotSchema = z
  .object({
    slot: z.enum(BannerSlot),
    label: z.string(),
    maxActive: z.number(),
    defaultMaxActive: z.number().optional(),
    isEnabled: z.boolean().optional(),
    pc: sizeSchema,
    mobile: sizeSchema.nullable(),
    activeCount: z.number().nullable().default(null),
    upcomingCount: z.number().nullable().default(null),
    scheduledCount: z.number().nullable().optional(),
    pausedCount: z.number().nullable().default(null),
    totalCount: z.number().nullable().default(null),
  })
  .transform(({ upcomingCount, scheduledCount, ...s }) => ({
    ...s,
    scheduledCount:
      scheduledCount ??
      (upcomingCount !== null && s.activeCount !== null
        ? Math.max(0, upcomingCount - s.activeCount)
        : null),
  }));
export type BannerSlotInfo = z.infer<typeof bannerSlotSchema>;
export const bannerSlotListSchema = z.object({ items: z.array(bannerSlotSchema) });

/** GET /admin/banners/:id/stats?from&to (KST dates): shared `BannerStatsView`. */
export const bannerStatsSchema = z.object({
  bannerId: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  totals: z.object({ impressions: z.number(), clicks: z.number(), ctr: z.number() }),
  daily: z.array(z.object({ date: z.string(), impressions: z.number(), clicks: z.number() })),
});
export type BannerStats = z.infer<typeof bannerStatsSchema>;

/** GET /admin/popups(/:id), POST/PATCH responses: shared `AdminPopupView`. */
export const adminPopupViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  image: adMediaViewSchema,
  linkUrl: z.string().nullable(),
  newWindow: z.boolean(),
  targetPages: z.array(z.enum(PopupPage)),
  startAt: z.string(),
  endAt: z.string(),
  paused: z.boolean(),
  status: z.enum(BannerStatus),
  dismissDays: z.number(),
  sortOrder: z.number(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const adminPopupSchema = adminPopupViewSchema.transform(
  ({ image, createdAt: _c, updatedAt: _u, ...p }) => ({
    ...p,
    code: null as string | null,
    media: fromAdMedia(image),
    /** The API does not track popup impressions / clicks. */
    impressions: null as number | null,
    clicks: null as number | null,
  }),
);
export type AdminPopup = z.infer<typeof adminPopupSchema>;
export const adminPopupPageSchema = paginated(adminPopupSchema);
export type AdminPopupPage = z.infer<typeof adminPopupPageSchema>;

// ---- pickers (public endpoints; only the fields the pickers read) ---------------------------------

export const agencyOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: z.string().nullish(),
  roadAddress: z.string().nullish(),
});
export type AgencyOption = z.infer<typeof agencyOptionSchema>;
export const agencyOptionPageSchema = z.object({ items: z.array(agencyOptionSchema) });

export const complexOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  emdName: z.string().nullish(),
  households: z.number().nullish(),
});
export type ComplexOption = z.infer<typeof complexOptionSchema>;
export const complexOptionPageSchema = z.object({ items: z.array(complexOptionSchema) });

export const regionOptionSchema = z.object({
  code: z.string(),
  name: z.string(),
  parentName: z.string().nullish(),
});
export type RegionOption = z.infer<typeof regionOptionSchema>;

/**
 * GET /regions → shared `RegionView[]` (a bare array: the 읍면동 of the service 시군구). Normalized
 * to `{ items }` for the pickers; `fullName` ("전남광주통합특별시 순천시 조례동") is not shown.
 */
export const regionListSchema = z
  .array(
    z.object({
      code: z.string(),
      name: z.string(),
      isActive: z.boolean().default(true),
    }),
  )
  .transform((rows) => ({
    items: rows
      .filter((r) => r.isActive)
      .map((r): RegionOption => ({ code: r.code, name: r.name })),
  }));
