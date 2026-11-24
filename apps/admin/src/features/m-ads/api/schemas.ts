import { BannerSlot, BannerStatus, BannerTargeting, PopupPage } from '@house/shared';
import { z } from 'zod';

/**
 * Response schemas of the ads admin API. The controllers do not exist yet (module README + shared
 * input schemas only), so these shapes are ASSUMPTIONS — see docs/frontend-integration/m-ads.md.
 * Reconcile the schema and the mock fixture together.
 */
const variantSchema = z.object({ url: z.string(), width: z.number(), height: z.number() });

/** MediaDto (packages/shared/src/schemas/media.ts). */
export const mediaSchema = z.object({
  id: z.string(),
  purpose: z.string().optional(),
  mimeType: z.string().optional(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  variants: z.object({
    thumb: variantSchema.optional(),
    medium: variantSchema.optional(),
    large: variantSchema.optional(),
  }),
});
export type Media = z.infer<typeof mediaSchema>;

/** Largest available variant URL of a media object. */
export function mediaUrl(media: Media | null | undefined): string | null {
  const v = media?.variants;
  return v?.large?.url ?? v?.medium?.url ?? v?.thumb?.url ?? null;
}

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });

export const adminBannerSchema = z.object({
  id: z.string(),
  /** Human-friendly id ("AD-03"); optional — the UI falls back to a short form of `id`. */
  code: z.string().nullish(),
  slot: z.enum(BannerSlot),
  title: z.string(),
  advertiserName: z.string().nullable(),
  agencyId: z.string().nullable(),
  agency: z
    .object({ id: z.string(), name: z.string(), representativeName: z.string().nullish() })
    .nullish(),
  pcMedia: mediaSchema.nullable(),
  mobileMedia: mediaSchema.nullable(),
  linkUrl: z.string().nullable(),
  newWindow: z.boolean(),
  startAt: z.string(),
  endAt: z.string(),
  paused: z.boolean(),
  priority: z.number().default(0),
  sortOrder: z.number(),
  targeting: z.enum(BannerTargeting),
  targetRegionCodes: z.array(z.string()).default([]),
  targetComplexIds: z.array(z.string()).default([]),
  targetRegions: z.array(z.object({ code: z.string(), name: z.string() })).default([]),
  targetComplexes: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  memo: z.string().nullish(),
  status: z.enum(BannerStatus),
  impressions: z.number().default(0),
  clicks: z.number().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type AdminBanner = z.infer<typeof adminBannerSchema>;
export const adminBannerPageSchema = paginated(adminBannerSchema);
export type AdminBannerPage = z.infer<typeof adminBannerPageSchema>;

const sizeSchema = z.object({ width: z.number(), height: z.number() });

export const bannerSlotSchema = z.object({
  slot: z.enum(BannerSlot),
  label: z.string(),
  maxActive: z.number(),
  defaultMaxActive: z.number().optional(),
  pc: sizeSchema,
  mobile: sizeSchema.nullable(),
  /** null when the counts are unknown (fallback to the shared defaults). */
  activeCount: z.number().nullable().default(null),
  scheduledCount: z.number().nullable().default(null),
  pausedCount: z.number().nullable().default(null),
  totalCount: z.number().nullable().default(null),
});
export type BannerSlotInfo = z.infer<typeof bannerSlotSchema>;
export const bannerSlotListSchema = z.object({ items: z.array(bannerSlotSchema) });

export const bannerStatsSchema = z.object({
  bannerId: z.string(),
  from: z.string().nullable(),
  to: z.string().nullable(),
  totals: z.object({ impressions: z.number(), clicks: z.number(), ctr: z.number() }),
  daily: z.array(z.object({ date: z.string(), impressions: z.number(), clicks: z.number() })),
});
export type BannerStats = z.infer<typeof bannerStatsSchema>;

export const adminPopupSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  title: z.string(),
  media: mediaSchema.nullable(),
  linkUrl: z.string().nullable(),
  newWindow: z.boolean(),
  targetPages: z.array(z.enum(PopupPage)),
  startAt: z.string(),
  endAt: z.string(),
  paused: z.boolean(),
  dismissDays: z.number(),
  sortOrder: z.number(),
  status: z.enum(BannerStatus),
  impressions: z.number().default(0),
  clicks: z.number().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
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
export const regionListSchema = z.object({ items: z.array(regionOptionSchema) });
