import {
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  ProposalStatus,
} from '@house/shared';
import { z } from 'zod';
import { mediaSchema, photoFromWire } from '@/features/w-deal/api/schemas';
import { regionName } from '@/features/w-deal/lib/regions';

/**
 * Response shapes of the broker inbox as the frontend expects them.
 *
 * Shapes of the `deal-requests` module of apps/api (see docs/frontend-integration/a-inbox.md).
 * There is no inquiry backend for launch (DECISIONS D5), so the inbox has no inquiry shapes. Each
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

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;

/**
 * Backend `AgencyDealRequestView` → view shape: `complex{id,name}` → `complexId`/`complexName`,
 * `emdName` from the region table, photo views → media DTOs, the granted `roadAddress` into
 * `contact`, `detailsShared` → `contactGranted`. Mock fixtures already have the view shape.
 */
export function agencyRequestFromWire(v: unknown): unknown {
  if (!isObject(v)) return v;
  const out: Raw = { ...v };
  if (isObject(v.complex) && v.complexId === undefined) {
    out.complexId = v.complex.id;
    out.complexName = v.complex.name;
  }
  if (out.emdName === undefined && typeof v.emdCode === 'string') {
    const name = regionName(v.emdCode);
    out.emdName = name === v.emdCode ? null : name;
  }
  if (Array.isArray(v.photos)) out.photos = v.photos.map(photoFromWire);
  if (isObject(v.contact) && v.contact.roadAddress === undefined) {
    out.contact = { ...v.contact, roadAddress: v.roadAddress ?? null };
  }
  if (out.contactGranted === undefined && typeof v.detailsShared === 'boolean') {
    out.contactGranted = v.detailsShared;
  }
  return out;
}

const agencyDealRequestObjectSchema = z.object({
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

  // 내놓기 — before the requester shares details with this agency (`contactGranted`): 읍면동 /
  // 단지, the area band and a ~200 m grid point only; 도로명·동·호·층·정확한 면적·사진·설명 come
  // with the grant (DEAL_REQUEST_PROVIDE 제공 항목).
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  complexId: nullish(z.string()),
  complexName: nullish(z.string()),
  exclusiveArea: nullish(z.number()),
  /** 전용면적 band (㎡, max exclusive / null = open-ended) — what agencies see before a grant. */
  areaRange: z.object({ min: z.number(), max: z.number().nullable() }).nullish(),
  floor: nullish(z.number()),
  desiredSalePrice: nullish(z.number()),
  desiredDeposit: nullish(z.number()),
  desiredMonthlyRent: nullish(z.number()),
  photos: z.array(mediaSchema).default([]),
  /** Photos attached (shown only after a grant; the count is known before). */
  photoCount: nullish(z.number()),

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
  /** The requester shared contact + full details with this agency (backend `detailsShared`). */
  contactGranted: z.boolean().default(false),
});
export const agencyDealRequestSchema = z.preprocess(
  agencyRequestFromWire,
  agencyDealRequestObjectSchema,
);
export type AgencyDealRequest = z.infer<typeof agencyDealRequestObjectSchema>;

const agencyDealRequestDetailObjectSchema = agencyDealRequestObjectSchema.extend({
  contact: requestContactSchema.nullable().default(null),
});
export const agencyDealRequestDetailSchema = z.preprocess(
  agencyRequestFromWire,
  agencyDealRequestDetailObjectSchema,
);
export type AgencyDealRequestDetail = z.infer<typeof agencyDealRequestDetailObjectSchema>;

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
