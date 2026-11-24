import {
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  ProposalStatus,
} from '@house/shared';
import { z } from 'zod';
import { mediaSchema } from '@/features/w-deal/api/schemas';

/**
 * Response shapes of the broker inbox as the frontend expects them.
 *
 * The deal-requests module only has a README + Prisma models and there is no inquiry backend at
 * all, so every shape here is an ASSUMPTION (see docs/frontend-integration/a-inbox.md). Each
 * response is parsed by exactly one schema below — fix the schema and its mock fixture together.
 */

const nullish = <T extends z.ZodType>(s: T) => s.nullable().optional();

function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  });
}

// ---------- 내놓기 / 구하기 requests (agency view) ----------

/** A listing of the caller's agency: proposal attachment and picker row. Money in 만원, area in ㎡. */
export const inboxListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  assetType: z.enum(AssetType),
  dealType: z.enum(DealType),
  /** 매매가 / 전세 보증금 / 분양권 매매가. */
  price: nullish(z.number()),
  /** 월세 보증금. */
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  exclusiveArea: nullish(z.number()),
  /** "고/25층", "3/4층". */
  floorLabel: nullish(z.string()),
  rooms: nullish(z.number()),
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  complexId: nullish(z.string()),
  thumbUrl: nullish(z.string()),
  /** Last 실매물 확인. */
  verifiedAt: nullish(z.string()),
});
export type InboxListing = z.infer<typeof inboxListingSchema>;

/** The caller's agency's proposal on a request (one per agency per request). */
export const myProposalSchema = z.object({
  id: z.string(),
  status: z.enum(ProposalStatus),
  /** Present on the detail response; the list may omit it. */
  message: z.string().default(''),
  listings: z.array(inboxListingSchema).default([]),
  /** Agent who wrote it. */
  memberName: nullish(z.string()),
  createdAt: z.string(),
  viewedAt: nullish(z.string()),
  respondedAt: nullish(z.string()),
});
export type MyProposal = z.infer<typeof myProposalSchema>;

/** Requester contact — only ever present while a DealRequestContactGrant for this agency is active. */
export const requestContactSchema = z.object({
  name: z.string(),
  phone: z.string(),
  /** PRIVATE address parts of a 내놓기 request (도로명 + 동/호). */
  roadAddress: nullish(z.string()),
  addressDetail: nullish(z.string()),
  grantedAt: nullish(z.string()),
});
export type RequestContact = z.infer<typeof requestContactSchema>;

export const agencyDealRequestSchema = z.object({
  id: z.string(),
  type: z.enum(DealRequestType),
  status: z.enum(DealRequestStatus),
  assetType: z.enum(AssetType),
  dealTypes: z.array(z.enum(DealType)),
  visibility: z.enum(DealRequestVisibility),
  /** True when the requester picked this agency (SELECTED_AGENCIES). */
  targeted: z.boolean().default(false),
  /** Masked by the API ("김*늘") — never the full name before consent. */
  requesterName: nullish(z.string()),
  description: nullish(z.string()),

  // 내놓기 — location down to 읍면동 / 단지 only; 도로명·동·호 come with `contact`.
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  complexId: nullish(z.string()),
  complexName: nullish(z.string()),
  exclusiveArea: nullish(z.number()),
  floor: nullish(z.number()),
  desiredSalePrice: nullish(z.number()),
  desiredDeposit: nullish(z.number()),
  desiredMonthlyRent: nullish(z.number()),
  photos: z.array(mediaSchema).default([]),

  // 구하기
  regionCodes: z.array(z.string()).default([]),
  complexIds: z.array(z.string()).default([]),
  /** Display names matching `complexIds`. */
  complexNames: z.array(z.string()).default([]),
  priceMin: nullish(z.number()),
  priceMax: nullish(z.number()),
  depositMin: nullish(z.number()),
  depositMax: nullish(z.number()),
  rentMin: nullish(z.number()),
  rentMax: nullish(z.number()),
  areaMin: nullish(z.number()),
  areaMax: nullish(z.number()),
  roomsMin: nullish(z.number()),

  moveInDate: nullish(z.string()),
  expiresAt: nullish(z.string()),
  closedAt: nullish(z.string()),
  createdAt: z.string(),
  updatedAt: nullish(z.string()),
  /** Proposals from all agencies so far. */
  proposalCount: z.number().default(0),
  myProposal: myProposalSchema.nullable().default(null),
  contactGranted: z.boolean().default(false),
});
export type AgencyDealRequest = z.infer<typeof agencyDealRequestSchema>;

export const agencyDealRequestDetailSchema = agencyDealRequestSchema.extend({
  contact: requestContactSchema.nullable().default(null),
});
export type AgencyDealRequestDetail = z.infer<typeof agencyDealRequestDetailSchema>;

/** Inbox stage of a request from the agency's point of view (derived, see lib/stage.ts). */
export const INBOX_STAGES = ['NEW', 'PROPOSED', 'ACCEPTED', 'ENDED'] as const;
export type InboxStage = (typeof INBOX_STAGES)[number];

export const stageCountsSchema = z.object({
  NEW: z.number().default(0),
  PROPOSED: z.number().default(0),
  ACCEPTED: z.number().default(0),
  ENDED: z.number().default(0),
});
export type StageCounts = z.infer<typeof stageCountsSchema>;

export const agencyDealRequestPageSchema = pageOf(agencyDealRequestSchema).extend({
  /** Facet counts for the stage tabs (same type / region / asset filters, any stage). */
  stageCounts: stageCountsSchema.optional(),
});
export type AgencyDealRequestPage = z.infer<typeof agencyDealRequestPageSchema>;

export const listingCandidatePageSchema = pageOf(inboxListingSchema);
export type ListingCandidatePage = z.infer<typeof listingCandidatePageSchema>;

// ---------- inquiries (문의 · 연락 기록) ----------

/** How the customer reached out: a message left on the site, or a contact action on a listing. */
export const INQUIRY_CHANNELS = ['MESSAGE', 'CALL', 'SMS', 'COPY'] as const;
export type InquiryChannel = (typeof INQUIRY_CHANNELS)[number];

export const INQUIRY_STATUSES = ['NEW', 'IN_PROGRESS', 'DONE'] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const inquiryReplySchema = z.object({
  id: z.string(),
  message: z.string(),
  memberName: nullish(z.string()),
  createdAt: z.string(),
});
export type InquiryReply = z.infer<typeof inquiryReplySchema>;

export const inquirySchema = z.object({
  id: z.string(),
  channel: z.enum(INQUIRY_CHANNELS).catch('MESSAGE'),
  /** The listing the customer was looking at; null = the office page. */
  listing: inboxListingSchema.nullable().default(null),
  /** Masked nickname / name ("박*연"); null for visitors who are not signed in. */
  customerName: nullish(z.string()),
  /** Text the customer left (MESSAGE only). */
  message: nullish(z.string()),
  status: z.enum(INQUIRY_STATUSES).catch('NEW'),
  /** Private note of the office (never shown to the customer). */
  memo: nullish(z.string()),
  /** Member who last handled it. */
  handledByName: nullish(z.string()),
  readAt: nullish(z.string()),
  createdAt: z.string(),
  /** True when the backend can deliver a written answer to the customer. */
  canReply: z.boolean().default(false),
  replies: z.array(inquiryReplySchema).default([]),
});
export type Inquiry = z.infer<typeof inquirySchema>;

export const inquiryStatusCountsSchema = z.object({
  NEW: z.number().default(0),
  IN_PROGRESS: z.number().default(0),
  DONE: z.number().default(0),
});
export type InquiryStatusCounts = z.infer<typeof inquiryStatusCountsSchema>;

export const inquiryPageSchema = pageOf(inquirySchema).extend({
  unreadCount: z.number().optional(),
  statusCounts: inquiryStatusCountsSchema.optional(),
});
export type InquiryPage = z.infer<typeof inquiryPageSchema>;

export const inquiryReadResultSchema = z
  .object({ updated: z.number().optional(), unreadCount: z.number().optional() })
  .optional();
