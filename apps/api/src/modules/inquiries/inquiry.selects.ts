import { InquiryAuthor } from '@house/shared';
import type { Prisma } from '@prisma/client';

/**
 * Explicit Prisma selects. Customer contact (customerName / customerPhone) is selected only for
 * the office the inquiry was sent to and for the member who sent it; never `visitorHash`, the
 * consent ids or the delete reason.
 */

const mediaRef = { select: { storageKey: true, variants: true } } as const;
const logoRef = { select: { storageKey: true, variants: true, deletedAt: true } } as const;

/** The listing card of an inquiry (InquiryListingRef). */
export const inquiryListingSelect = {
  id: true,
  title: true,
  assetType: true,
  dealType: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  presalePrice: true,
  deletedAt: true,
  complex: { select: { name: true } },
  property: { select: { buildingName: true, roadAddress: true } },
  photos: { where: { isCover: true }, take: 1, select: { media: mediaRef } },
} as const satisfies Prisma.ListingSelect;
export type InquiryListingRow = Prisma.ListingGetPayload<{ select: typeof inquiryListingSelect }>;

export const inquiryMessageSelect = {
  id: true,
  author: true,
  body: true,
  authorName: true,
  createdAt: true,
} as const satisfies Prisma.InquiryMessageSelect;
export type InquiryMessageRow = Prisma.InquiryMessageGetPayload<{
  select: typeof inquiryMessageSelect;
}>;

const threadOrder: Prisma.InquiryMessageOrderByWithRelationInput[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];

/**
 * Row of the console inbox. `agencyId` scopes the handler's display name to the office (a user
 * may be a member of several offices over time).
 */
export function agencyInquirySelect(agencyId: string) {
  return {
    id: true,
    channel: true,
    status: true,
    source: true,
    userId: true,
    customerName: true,
    customerPhone: true,
    message: true,
    memo: true,
    readAt: true,
    lastMessageAt: true,
    piiScrubbedAt: true,
    createdAt: true,
    updatedAt: true,
    user: { select: { status: true } },
    handledBy: {
      select: {
        name: true,
        agencyMemberships: { where: { agencyId }, take: 1, select: { displayName: true } },
      },
    },
    listing: { select: inquiryListingSelect },
  } as const satisfies Prisma.InquirySelect;
}
export type AgencyInquiryRow = Prisma.InquiryGetPayload<{
  select: ReturnType<typeof agencyInquirySelect>;
}>;

export function agencyInquiryDetailSelect(agencyId: string) {
  return {
    ...agencyInquirySelect(agencyId),
    messages: { select: inquiryMessageSelect, orderBy: threadOrder },
  } as const satisfies Prisma.InquirySelect;
}
export type AgencyInquiryDetailRow = Prisma.InquiryGetPayload<{
  select: ReturnType<typeof agencyInquiryDetailSelect>;
}>;

/** Row of MY > 문의 내역. */
export const myInquiryListSelect = {
  id: true,
  status: true,
  message: true,
  customerReadAt: true,
  lastMessageAt: true,
  createdAt: true,
  agency: { select: { id: true, name: true, logo: logoRef } },
  listing: { select: inquiryListingSelect },
  /** The latest message (preview). */
  messages: {
    select: { body: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
  _count: { select: { messages: { where: { author: InquiryAuthor.AGENCY } } } },
} as const satisfies Prisma.InquirySelect;
export type MyInquiryListRow = Prisma.InquiryGetPayload<{ select: typeof myInquiryListSelect }>;

export const myInquiryDetailSelect = {
  id: true,
  status: true,
  customerName: true,
  customerPhone: true,
  message: true,
  createdAt: true,
  agency: { select: { id: true, name: true, phone: true, logo: logoRef } },
  listing: { select: inquiryListingSelect },
  messages: { select: inquiryMessageSelect, orderBy: threadOrder },
} as const satisfies Prisma.InquirySelect;
export type MyInquiryDetailRow = Prisma.InquiryGetPayload<{ select: typeof myInquiryDetailSelect }>;
