import { AssetType, DealType, ListingStatus } from '@house/shared';
import { z } from 'zod';

/*
 * Zod schemas of the seo module of apps/api (`apps/api/src/modules/seo/seo.types.ts`):
 * GET /seo/regions, /seo/regions/:code/landing, /seo/reports/apartment-trades, /seo/sitemap/:kind,
 * /seo/listings/:id/status. Prices are 만원. The mock handlers in
 * src/app/mock-api/v1/seo/** answer the same shapes.
 */

const nullableNumber = z.number().nullable();

export const seoRegionSchema = z.object({
  code: z.string(),
  name: z.string(),
  emdName: z.string(),
  parentName: z.string().nullable(),
  lat: nullableNumber,
  lng: nullableNumber,
  listingCounts: z.record(z.enum(AssetType), z.number().int()),
  complexCount: z.number().int(),
  saleTradeCount: z.number().int(),
  lastModified: z.string().nullable(),
});
export type SeoRegion = z.infer<typeof seoRegionSchema>;

const periodSchema = z.object({ fromYm: z.number().int(), toYm: z.number().int() });

export const seoRegionIndexSchema = z.object({
  sggCode: z.string(),
  regionName: z.string(),
  tradePeriod: periodSchema,
  regions: z.array(seoRegionSchema),
  updatedAt: z.string(),
});
export type SeoRegionIndex = z.infer<typeof seoRegionIndexSchema>;

export const seoSaleSummarySchema = z.object({
  count: z.number().int(),
  avgPrice: nullableNumber,
  medianPrice: nullableNumber,
  minPrice: nullableNumber,
  maxPrice: nullableNumber,
  avgPricePerPyeong: nullableNumber,
});
export type SeoSaleSummary = z.infer<typeof seoSaleSummarySchema>;

export const seoJeonseSummarySchema = z.object({
  count: z.number().int(),
  avgDeposit: nullableNumber,
  medianDeposit: nullableNumber,
});

export const seoDealSummarySchema = z.object({
  dealType: z.enum(DealType),
  count: z.number().int(),
  minPrice: nullableNumber,
  maxPrice: nullableNumber,
  avgPrice: nullableNumber,
  minRent: nullableNumber,
  maxRent: nullableNumber,
});
export type SeoDealSummary = z.infer<typeof seoDealSummarySchema>;

export const seoTradeItemSchema = z.object({
  dealDate: z.string(),
  complexId: z.string().nullable(),
  aptName: z.string(),
  exclusiveArea: z.number(),
  floor: z.number().int().nullable(),
  price: z.number(),
});
export type SeoTradeItem = z.infer<typeof seoTradeItemSchema>;

export const seoComplexItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  assetType: z.enum(AssetType),
  households: z.number().int().nullable(),
  builtYear: z.number().int().nullable(),
  approvalDate: z.string().nullable(),
  activeListingCount: z.number().int(),
  latestSale: z
    .object({
      price: z.number(),
      dealDate: z.string(),
      exclusiveArea: z.number(),
      floor: z.number().int().nullable(),
    })
    .nullable(),
});
export type SeoComplexItem = z.infer<typeof seoComplexItemSchema>;

export const seoRegionLandingSchema = z.object({
  region: seoRegionSchema,
  assetTypes: z.array(z.enum(AssetType)),
  listings: z.object({
    total: z.number().int(),
    byDealType: z.array(seoDealSummarySchema),
    lastPublishedAt: z.string().nullable(),
  }),
  complexes: z.array(seoComplexItemSchema),
  complexTotal: z.number().int(),
  trades: periodSchema
    .extend({
      sale: seoSaleSummarySchema,
      jeonse: seoJeonseSummarySchema,
      recent: z.array(seoTradeItemSchema),
    })
    .nullable(),
  updatedAt: z.string(),
});
export type SeoRegionLanding = z.infer<typeof seoRegionLandingSchema>;

export const seoTradeReportSchema = z.object({
  sggCode: z.string(),
  regionName: z.string(),
  yearMonth: z.number().int(),
  latestYearMonth: z.number().int(),
  availableMonths: z.array(z.number().int()),
  sale: seoSaleSummarySchema.extend({ cancelledCount: z.number().int() }),
  jeonse: seoJeonseSummarySchema,
  previous: z.object({ yearMonth: z.number().int(), sale: seoSaleSummarySchema }).nullable(),
  yearAgo: z.object({ yearMonth: z.number().int(), sale: seoSaleSummarySchema }).nullable(),
  byRegion: z.array(
    z.object({
      regionCode: z.string().nullable(),
      name: z.string(),
      sale: seoSaleSummarySchema,
    }),
  ),
  topComplexes: z.array(
    z.object({
      complexId: z.string().nullable(),
      name: z.string(),
      emdName: z.string().nullable(),
      count: z.number().int(),
      medianPrice: nullableNumber,
    }),
  ),
  syncedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type SeoTradeReport = z.infer<typeof seoTradeReportSchema>;

export const SEO_SITEMAP_KINDS = ['complexes', 'listings', 'agencies'] as const;
export type SeoSitemapKind = (typeof SEO_SITEMAP_KINDS)[number];

export const seoSitemapSchema = z.object({
  kind: z.enum(SEO_SITEMAP_KINDS),
  items: z.array(z.object({ id: z.string(), lastModified: z.string() })),
  truncated: z.boolean(),
});
export type SeoSitemap = z.infer<typeof seoSitemapSchema>;

export const seoListingStatusSchema = z.object({
  id: z.string(),
  state: z.enum(['PUBLIC', 'GONE']),
  status: z.enum(ListingStatus),
  assetType: z.enum(AssetType),
  complexId: z.string().nullable(),
  regionCode: z.string().nullable(),
  endedAt: z.string().nullable(),
});
export type SeoListingStatus = z.infer<typeof seoListingStatusSchema>;
