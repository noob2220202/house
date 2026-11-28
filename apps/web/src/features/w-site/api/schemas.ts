import { z } from 'zod';
import { agencyDetailSchema } from '@/features/w-agencies/api/schemas';

/**
 * `GET /sites/:slug` (`PublicAgencySite` of the agencies module): a servable 사무소 홈페이지 and
 * exactly the public office profile `GET /agencies/:id` returns. The colour stays a plain string:
 * `agencySitePalette()` falls back to BLUE for a value the palette no longer has.
 */
export const officeSiteSchema = z.object({
  slug: z.string(),
  color: z.string().catch('BLUE'),
  tagline: z.string().nullish(),
  /** `https://<slug>.<root>` — the canonical origin of the office home. */
  url: z.string(),
  agency: agencyDetailSchema,
});
export type OfficeSite = z.infer<typeof officeSiteSchema>;
