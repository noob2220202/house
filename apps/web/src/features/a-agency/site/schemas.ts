import { AgencySiteStatus } from '@house/shared';
import { z } from 'zod';

/**
 * Response shapes of 내 홈페이지 (`/agencies/mine/site`, agencies module — `AgencySiteView`,
 * `MyAgencySiteResponse`, `SiteSlugAvailability` of @house/shared). The colour stays a string
 * (`agencySitePalette()` falls back to BLUE for a colour the palette no longer has).
 */
export const agencySiteViewSchema = z.object({
  id: z.string(),
  agencyId: z.string(),
  status: z.enum(AgencySiteStatus),
  slug: z.string().nullable(),
  requestedSlug: z.string().nullable(),
  color: z.string().catch('BLUE'),
  tagline: z.string().nullable(),
  url: z.string().nullable(),
  httpsReady: z.boolean(),
  live: z.boolean(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  decisionReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgencySite = z.infer<typeof agencySiteViewSchema>;

export const myAgencySiteSchema = z.object({
  site: agencySiteViewSchema.nullable(),
  /** e.g. "suncheonmap.kr" (dev: "localhost"). */
  rootDomain: z.string(),
  subscription: z.object({
    required: z.boolean(),
    active: z.boolean(),
    endsOn: z.string().nullable(),
  }),
});
export type MyAgencySite = z.infer<typeof myAgencySiteSchema>;

export const siteSlugAvailabilitySchema = z.object({
  slug: z.string(),
  available: z.boolean(),
  reason: z.enum(['INVALID', 'RESERVED', 'TAKEN']).nullable(),
});
export type SiteSlugAvailability = z.infer<typeof siteSlugAvailabilitySchema>;
