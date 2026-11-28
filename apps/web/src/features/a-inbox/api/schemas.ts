import {
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  InquiryChannel,
  InquirySource,
  InquiryStatus,
  ProposalStatus,
  type AgencyInquiryView,
} from '@house/shared';
import { z } from 'zod';
import { mediaSchema, photoFromWire } from '@/features/w-deal/api/schemas';
import { inquiryListingRefSchema, inquiryMessageSchema } from '@/features/w-inquiry/schemas';
import { regionName } from '@/features/w-deal/lib/regions';

/**
 * Response shapes of the broker inbox as the frontend expects them.
 *
 * Shapes of the `deal-requests` and `inquiries` modules of apps/api (see
 * docs/frontend-integration/a-inbox.md). Each response is parsed by exactly one schema below — fix
 * the schema and its mock fixture together.
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
  // No requester name before consent: the API sends the name only in `contact` (detail, grant).
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
  /** Wanted 단지 (ids only — the API sends no names; the UI shows the count). */
  complexIds: z.array(z.string()).default([]),
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

/** The list carries no stage counters (the API has none); the tabs show no counts. */
export const agencyDealRequestPageSchema = pageOf(agencyDealRequestSchema);
export type AgencyDealRequestPage = z.infer<typeof agencyDealRequestPageSchema>;

// ---------- inbox counters (/agent/notifications tiles) ----------

/** GET /agencies/mine/dashboard — only the 새 요청 and 안 읽은 문의 counters are read here. */
export const inboxNewCountSchema = z.object({
  dealRequests: z.object({ newCount: z.number() }),
  inquiries: z.object({ unreadCount: z.number() }).nullish(),
});

/** GET /agency/proposals — only the total is read (with `WAITING_PROPOSALS_QUERY`). */
export const proposalTotalSchema = z.object({ total: z.number() });

/** Our proposals the requester has not answered yet (응답 대기). One row: only `total` is used. */
export const WAITING_PROPOSALS_QUERY = { status: 'SENT,VIEWED', page: 1, pageSize: 1 } as const;

export const listingCandidatePageSchema = pageOf(inboxListingSchema);
export type ListingCandidatePage = z.infer<typeof listingCandidatePageSchema>;

// ---------- 문의함 (inquiries: written inquiries + logged contact events) ----------

/**
 * `AgencyInquiryView` — row (and, with `messages`, detail) of GET /agency/inquiries[/:id].
 * MESSAGE = a text the customer left (name + phone as submitted); CALL / SMS / COPY = a logged
 * 전화 / 문자 / 번호 복사 press (no text, no phone; a member shows as a masked name).
 */
export const agencyInquirySchema = z.object({
  id: z.string(),
  channel: z.enum(InquiryChannel).catch(InquiryChannel.MESSAGE),
  status: z.enum(InquiryStatus).catch(InquiryStatus.NEW),
  source: z.enum(InquirySource).catch(InquirySource.MAIN),
  /** null = sent from the office page / the office's 홈페이지 home. */
  listing: inquiryListingRefSchema.nullable().default(null),
  customerName: z.string().nullable().default(null),
  /** MESSAGE only. */
  customerPhone: z.string().nullable().default(null),
  isMember: z.boolean().default(false),
  /** A written answer reaches the customer (MESSAGE of a member who has not withdrawn). */
  canReply: z.boolean().default(false),
  message: z.string().nullable().default(null),
  /** Internal note of the office (never shown to the customer). */
  memo: z.string().nullable().default(null),
  handledByName: z.string().nullable().default(null),
  readAt: z.string().nullable().default(null),
  lastMessageAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
  /** Detail only: follow-ups and replies, oldest first. */
  messages: z.array(inquiryMessageSchema).default([]),
}) satisfies z.ZodType<Omit<AgencyInquiryView, 'updatedAt'>, unknown>;
export type AgencyInquiry = z.infer<typeof agencyInquirySchema>;

export const inquiryStatusCountsSchema = z.object({
  NEW: z.number().default(0),
  IN_PROGRESS: z.number().default(0),
  DONE: z.number().default(0),
});
export type InquiryStatusCounts = z.infer<typeof inquiryStatusCountsSchema>;

/** GET /agency/inquiries (`AgencyInquiryPage`). */
export const agencyInquiryPageSchema = pageOf(agencyInquirySchema).extend({
  unreadCount: z.number().default(0),
  statusCounts: inquiryStatusCountsSchema.optional(),
});
export type AgencyInquiryPage = z.infer<typeof agencyInquiryPageSchema>;

/** POST /agency/inquiries/read → `{ updated, unreadCount }` (read leniently: only a hint). */
export const inquiryReadResultSchema = z
  .object({ updated: z.number().optional(), unreadCount: z.number().optional() })
  .nullish();
