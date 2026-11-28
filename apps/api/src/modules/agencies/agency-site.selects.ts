import type { Prisma } from '@prisma/client';

/** agency_sites columns behind AgencySiteView (domain/sites.ts `SiteRow`). */
export const agencySiteSelect = {
  id: true,
  agencyId: true,
  status: true,
  slug: true,
  requestedSlug: true,
  color: true,
  tagline: true,
  requestedAt: true,
  decidedAt: true,
  decisionReason: true,
  httpsReadyAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgencySiteSelect;
export type AgencySiteRow = Prisma.AgencySiteGetPayload<{ select: typeof agencySiteSelect }>;

/** agency_subscriptions columns behind AgencySubscriptionView. */
export const agencySubscriptionSelect = {
  id: true,
  agencyId: true,
  product: true,
  startsOn: true,
  endsOn: true,
  amountWon: true,
  memo: true,
  canceledAt: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.AgencySubscriptionSelect;
export type AgencySubscriptionRow = Prisma.AgencySubscriptionGetPayload<{
  select: typeof agencySubscriptionSelect;
}>;
