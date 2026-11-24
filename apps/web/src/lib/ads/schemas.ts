import { BannerSlot } from '@house/shared';
import { z } from 'zod';

/**
 * Serve shape of `GET /banners?slot&regionCode&complexId` (ads module) — ONE schema for every
 * banner slot on the site (MAIN_HERO, MAIN_STRIP, MOBILE_MAIN, MAP_AD, LISTING_SIDE,
 * COMPLEX_FEATURED_AGENCY). ASSUMED until the ads controller ships: the admin input has
 * `pcMediaId` / `mobileMediaId`, so the serve endpoint may name the PC creative `imageUrl` or
 * `pcImageUrl` — both are accepted. See docs/frontend-integration/consistency.md.
 */
const nullish = <T extends z.ZodType>(schema: T) => schema.nullish();

const bannerAgencySchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: nullish(z.string()),
  phone: nullish(z.string()),
  logoUrl: nullish(z.string()),
  complexListingCount: nullish(z.number().int()),
  avgResponseMinutes: nullish(z.number()),
});

export const servedBannerSchema = z
  .object({
    id: z.string(),
    slot: z.enum(BannerSlot).optional(),
    title: z.string(),
    advertiserName: nullish(z.string()),
    /** Advertiser office (Banner.agencyId) — agency-type creatives (map card, featured office). */
    agencyId: nullish(z.string()),
    /** PC creative (media URL). */
    imageUrl: nullish(z.string()),
    pcImageUrl: nullish(z.string()),
    /** Mobile creative; falls back to the PC one. */
    mobileImageUrl: nullish(z.string()),
    /** Present when the banner is clickable. The click itself goes through `/banners/:id/click`. */
    linkUrl: nullish(z.string()),
    newWindow: z.boolean().default(false),
    /** Advertiser office summary when the serve endpoint embeds it (optional). */
    agency: nullish(bannerAgencySchema),
  })
  .transform(({ pcImageUrl, imageUrl, ...rest }) => ({
    ...rest,
    imageUrl: imageUrl ?? pcImageUrl ?? null,
  }));
export type ServedBanner = z.infer<typeof servedBannerSchema>;

/** The serve endpoint may answer with a bare array or `{ items }` — accept both. */
export const servedBannerListSchema = z
  .union([z.array(servedBannerSchema), z.object({ items: z.array(servedBannerSchema) })])
  .transform((v) => (Array.isArray(v) ? v : v.items));
