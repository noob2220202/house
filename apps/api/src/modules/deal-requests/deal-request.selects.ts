import { Prisma } from '@prisma/client';

/**
 * Prisma selects per audience. The base select never loads contact, 동·호 or the requester id, so
 * an agency/public code path cannot leak them by accident; those are added only by the owner and
 * admin selects, or loaded separately for agencies holding an active contact grant.
 */
export const dealRequestBaseSelect = {
  id: true,
  type: true,
  status: true,
  assetType: true,
  dealTypes: true,
  visibility: true,
  sggCode: true,
  emdCode: true,
  roadAddress: true,
  complex: { select: { id: true, name: true } },
  lat: true,
  lng: true,
  exclusiveArea: true,
  floor: true,
  desiredSalePrice: true,
  desiredDeposit: true,
  desiredMonthlyRent: true,
  regionCodes: true,
  complexIds: true,
  priceMin: true,
  priceMax: true,
  depositMin: true,
  depositMax: true,
  rentMin: true,
  rentMax: true,
  areaMin: true,
  areaMax: true,
  roomsMin: true,
  moveInDate: true,
  description: true,
  photos: {
    select: { media: { select: { id: true, storageKey: true, variants: true } } },
    orderBy: { sortOrder: 'asc' },
  },
  proposalCount: true,
  expiresAt: true,
  closedAt: true,
  createdAt: true,
} satisfies Prisma.DealRequestSelect;
export type DealRequestBaseRow = Prisma.DealRequestGetPayload<{
  select: typeof dealRequestBaseSelect;
}>;

export const dealRequestOwnerSelect = {
  ...dealRequestBaseSelect,
  contactName: true,
  contactPhone: true,
  addressDetail: true,
  closeReason: true,
  extensionCount: true,
  targets: { select: { agencyId: true }, orderBy: { createdAt: 'asc' } },
  contactGrants: {
    where: { revokedAt: null },
    select: { agencyId: true, grantedAt: true, agency: { select: { name: true } } },
    orderBy: { grantedAt: 'asc' },
  },
} satisfies Prisma.DealRequestSelect;
export type DealRequestOwnerRow = Prisma.DealRequestGetPayload<{
  select: typeof dealRequestOwnerSelect;
}>;

/** Agency audience: base + this agency's own relation rows (no contact). */
export function dealRequestAgencySelect(agencyId: string) {
  return {
    ...dealRequestBaseSelect,
    contactScrubbedAt: true,
    targets: { where: { agencyId }, select: { agencyId: true } },
    proposals: { where: { agencyId }, select: { id: true, status: true, createdAt: true } },
    contactGrants: { where: { agencyId, revokedAt: null }, select: { agencyId: true } },
  } satisfies Prisma.DealRequestSelect;
}
export type DealRequestAgencyRow = Prisma.DealRequestGetPayload<{
  select: ReturnType<typeof dealRequestAgencySelect>;
}>;

export const dealRequestContactSelect = {
  id: true,
  contactName: true,
  contactPhone: true,
  addressDetail: true,
} satisfies Prisma.DealRequestSelect;
export type DealRequestContactRow = Prisma.DealRequestGetPayload<{
  select: typeof dealRequestContactSelect;
}>;

export const dealRequestAdminSelect = {
  ...dealRequestBaseSelect,
  userId: true,
  contactName: true,
  contactPhone: true,
  closeReason: true,
  contactScrubbedAt: true,
  spamFlaggedAt: true,
  spamReason: true,
  deletedAt: true,
  targets: { select: { agencyId: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.DealRequestSelect;
export type DealRequestAdminRow = Prisma.DealRequestGetPayload<{
  select: typeof dealRequestAdminSelect;
}>;

/** A proposal as the requester sees it (agency disclosure is joined via AgenciesService). */
export const proposalOwnerSelect = {
  id: true,
  dealRequestId: true,
  agencyId: true,
  status: true,
  message: true,
  suggestedPrice: true,
  suggestedDeposit: true,
  suggestedMonthlyRent: true,
  viewedAt: true,
  respondedAt: true,
  createdAt: true,
  member: {
    select: { displayName: true, phone: true, status: true, role: true, isLicensed: true },
  },
  listings: {
    select: {
      listing: {
        select: {
          id: true,
          title: true,
          assetType: true,
          dealType: true,
          status: true,
          salePrice: true,
          deposit: true,
          monthlyRent: true,
          presalePrice: true,
          premium: true,
          exclusiveArea: true,
          deletedAt: true,
        },
      },
    },
  },
} satisfies Prisma.ProposalSelect;
export type ProposalOwnerRow = Prisma.ProposalGetPayload<{ select: typeof proposalOwnerSelect }>;

export const proposalAgencySelect = {
  id: true,
  dealRequestId: true,
  memberId: true,
  status: true,
  message: true,
  suggestedPrice: true,
  suggestedDeposit: true,
  suggestedMonthlyRent: true,
  viewedAt: true,
  respondedAt: true,
  createdAt: true,
  listings: { select: { listingId: true } },
  dealRequest: { select: { type: true, status: true, assetType: true, dealTypes: true } },
} satisfies Prisma.ProposalSelect;
export type ProposalAgencyRow = Prisma.ProposalGetPayload<{ select: typeof proposalAgencySelect }>;

export const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;
export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;
