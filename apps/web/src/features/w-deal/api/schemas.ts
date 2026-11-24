import {
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  MediaPurpose,
  ProposalStatus,
} from '@house/shared';
import { z } from 'zod';

/**
 * Response shapes of the deal-requests module as the views read them. `GET /me/deal-requests`,
 * `GET /me/deal-requests/:id` and the proposal answers send the shared `MyDealRequestView` /
 * `MyDealRequestDetail` / `ProposalView`; `requestFromWire()` / `proposalFromWire()` map them
 * (photo views, nested complex, disclosure → agency brief). target-agencies / address-match are
 * the frontend's contract (docs/frontend-integration/w-deal.md).
 */

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;

const nullish = <T extends z.ZodType>(s: T) => s.nullable().optional();
/**
 * Prisma Decimal columns (areas) serialize as strings unless the DTO converts them — accept both.
 */
const decimal = z.coerce.number();

/** MediaDto (packages/shared/src/schemas/media.ts). */
const mediaVariantSchema = z.object({ url: z.string(), width: z.number(), height: z.number() });
export const mediaSchema = z.object({
  id: z.string(),
  purpose: z.enum(MediaPurpose),
  mimeType: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  variants: z.object({
    thumb: mediaVariantSchema.optional(),
    medium: mediaVariantSchema.optional(),
    large: mediaVariantSchema.optional(),
  }),
});
export type Media = z.infer<typeof mediaSchema>;

/** Agency summary embedded in proposals / target lists (public fields only). */
export const agencyBriefSchema = z.object({
  id: z.string(),
  name: z.string(),
  representativeName: nullish(z.string()),
  /** 대표번호 — public office number. */
  phone: nullish(z.string()),
  roadAddress: nullish(z.string()),
  /** Display tag, e.g. "신대 레이크파크 단지 전문". */
  specialty: nullish(z.string()),
  activeListingCount: nullish(z.number()),
  /** Average first-response time in minutes. */
  avgResponseMinutes: nullish(z.number()),
  logoUrl: nullish(z.string()),
});
export type AgencyBrief = z.infer<typeof agencyBriefSchema>;

/** Listing attached to a proposal (ProposalListing → public listing summary). */
export const proposalListingSchema = z.object({
  id: z.string(),
  title: z.string(),
  assetType: z.enum(AssetType),
  dealType: z.enum(DealType),
  price: nullish(z.number()),
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  exclusiveArea: nullish(decimal),
  /** "고/25층", "3/4층". */
  floorLabel: nullish(z.string()),
  thumbUrl: nullish(z.string()),
});
export type ProposalListing = z.infer<typeof proposalListingSchema>;

/** `ProposalListingView` → the card fields (headline price, title). */
function proposalListingFromWire(l: unknown): unknown {
  if (!isObject(l) || l.price !== undefined || !('salePrice' in l)) return l;
  const presale =
    typeof l.presalePrice === 'number'
      ? l.presalePrice + (typeof l.premium === 'number' ? l.premium : 0)
      : null;
  return {
    ...l,
    title: typeof l.title === 'string' ? l.title : '',
    price: typeof l.salePrice === 'number' ? l.salePrice : presale,
  };
}

/**
 * Backend `ProposalView` → card shape: `agency` (표시·광고 disclosure, null for a deleted office)
 * → brief, `agent.displayName` → `memberName`, `contactShared` → `contactGranted`.
 */
export function proposalFromWire(v: unknown): unknown {
  if (!isObject(v) || !('contactShared' in v || 'agent' in v)) return v;
  const a = isObject(v.agency) ? v.agency : null;
  const agent = isObject(v.agent) ? v.agent : null;
  return {
    ...v,
    agency: a
      ? {
          id: a.agencyId ?? v.agencyId,
          name: a.name,
          representativeName: a.representativeName ?? null,
          phone: a.phone ?? null,
          roadAddress: a.roadAddress ?? null,
        }
      : { id: v.agencyId, name: '탈퇴한 중개사무소' },
    memberName: v.memberName ?? agent?.displayName ?? null,
    contactGranted: v.contactGranted ?? v.contactShared === true,
    listings: Array.isArray(v.listings) ? v.listings.map(proposalListingFromWire) : [],
  };
}

const proposalObjectSchema = z.object({
  id: z.string(),
  dealRequestId: z.string(),
  agencyId: z.string(),
  agency: agencyBriefSchema,
  /** Name of the agent who wrote the proposal. */
  memberName: nullish(z.string()),
  message: z.string(),
  status: z.enum(ProposalStatus),
  listings: z.array(proposalListingSchema).default([]),
  /** True while the requester's contact is revealed to this agency (DealRequestContactGrant). */
  contactGranted: z.boolean().default(false),
  createdAt: z.string(),
  viewedAt: nullish(z.string()),
  respondedAt: nullish(z.string()),
});
export const proposalSchema = z.preprocess(proposalFromWire, proposalObjectSchema);
export type Proposal = z.infer<typeof proposalObjectSchema>;

/** `DealRequestPhotoView` { mediaId, url, thumbUrl } → the media DTO shape the views read. */
function photoFromWire(p: unknown): unknown {
  if (!isObject(p) || typeof p.mediaId !== 'string' || p.variants !== undefined) return p;
  const url = typeof p.url === 'string' ? p.url : '';
  const thumb = typeof p.thumbUrl === 'string' ? p.thumbUrl : url;
  return {
    id: p.mediaId,
    purpose: MediaPurpose.DEAL_REQUEST_PHOTO,
    mimeType: 'image/jpeg',
    width: null,
    height: null,
    variants: { thumb: { url: thumb, width: 0, height: 0 }, medium: { url, width: 0, height: 0 } },
  };
}

/**
 * Backend `MyDealRequestView` / `MyDealRequestDetail` → view shape: `complex{id,name}` →
 * `complexId`/`complexName`, photo views → media DTOs, `targetAgencyIds` → `targetAgencyCount`,
 * the unanswered proposals (detail only) → `pendingProposalCount`, `updatedAt` ← `createdAt`.
 */
export function requestFromWire(v: unknown): unknown {
  if (!isObject(v)) return v;
  const out: Raw = { ...v };
  if (isObject(v.complex) && v.complexId === undefined) {
    out.complexId = v.complex.id;
    out.complexName = v.complex.name;
  }
  if (Array.isArray(v.photos)) out.photos = v.photos.map(photoFromWire);
  if (out.targetAgencyCount === undefined && Array.isArray(v.targetAgencyIds)) {
    out.targetAgencyCount = v.targetAgencyIds.length;
  }
  if (out.pendingProposalCount === undefined && Array.isArray(v.proposals)) {
    out.pendingProposalCount = v.proposals.filter(
      (p) => isObject(p) && (p.status === ProposalStatus.SENT || p.status === ProposalStatus.VIEWED),
    ).length;
  }
  if (out.updatedAt === undefined) out.updatedAt = v.createdAt;
  return out;
}

const dealRequestObjectSchema = z.object({
  id: z.string(),
  type: z.enum(DealRequestType),
  status: z.enum(DealRequestStatus),
  assetType: z.enum(AssetType),
  dealTypes: z.array(z.enum(DealType)),
  visibility: z.enum(DealRequestVisibility),
  contactName: z.string(),
  contactPhone: z.string(),
  description: nullish(z.string()),

  // SELL_OR_LEASE
  roadAddress: nullish(z.string()),
  /** PRIVATE 동/호 — only the owner (and granted agencies) ever receive it. */
  addressDetail: nullish(z.string()),
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  complexId: nullish(z.string()),
  complexName: nullish(z.string()),
  exclusiveArea: nullish(decimal),
  floor: nullish(z.number()),
  desiredSalePrice: nullish(z.number()),
  desiredDeposit: nullish(z.number()),
  desiredMonthlyRent: nullish(z.number()),
  photos: z.array(mediaSchema).default([]),

  // WANTED
  regionCodes: z.array(z.string()).default([]),
  complexIds: z.array(z.string()).default([]),
  priceMin: nullish(z.number()),
  priceMax: nullish(z.number()),
  depositMin: nullish(z.number()),
  depositMax: nullish(z.number()),
  rentMin: nullish(z.number()),
  rentMax: nullish(z.number()),
  areaMin: nullish(decimal),
  areaMax: nullish(decimal),
  roomsMin: nullish(z.number()),

  moveInDate: nullish(z.string()),
  expiresAt: nullish(z.string()),
  closedAt: nullish(z.string()),
  proposalCount: z.number().default(0),
  /** Proposals the requester has not answered yet (status SENT / VIEWED). */
  pendingProposalCount: z.number().default(0),
  /** Agencies the request was delivered to. */
  targetAgencyCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const dealRequestSchema = z.preprocess(requestFromWire, dealRequestObjectSchema);
export type DealRequest = z.infer<typeof dealRequestObjectSchema>;

const dealRequestDetailObjectSchema = dealRequestObjectSchema.extend({
  proposals: z.array(proposalSchema).default([]),
  /** SELECTED_AGENCIES targets by name (the backend sends ids only, so this stays empty there). */
  targetAgencies: z.array(agencyBriefSchema).default([]),
});
export const dealRequestDetailSchema = z.preprocess(requestFromWire, dealRequestDetailObjectSchema);
export type DealRequestDetail = z.infer<typeof dealRequestDetailObjectSchema>;

export const dealRequestPageSchema = z.object({
  items: z.array(dealRequestSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
});
export type DealRequestPage = z.infer<typeof dealRequestPageSchema>;

/** `ContactGrantView`. */
export const contactGrantResultSchema = z.object({
  agencyId: z.string(),
  agencyName: nullish(z.string()),
  grantedAt: z.string(),
});

/** GET /deal-requests/target-agencies — agencies that would receive a request (assumed endpoint). */
export const targetAgencyPageSchema = z.object({
  items: z.array(agencyBriefSchema),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
  /** Human readable coverage, e.g. "신대·선월". */
  areaLabel: nullish(z.string()),
});
export type TargetAgencyPage = z.infer<typeof targetAgencyPageSchema>;

/** GET /deal-requests/address-match — complex + market hints for a road address (assumed endpoint). */
export const complexAreaTypeSchema = z.object({
  id: z.string(),
  pyeongLabel: nullish(z.string()),
  exclusiveArea: decimal,
  supplyArea: nullish(decimal),
});
export type ComplexAreaType = z.infer<typeof complexAreaTypeSchema>;

export const addressMatchSchema = z.object({
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
  complex: z
    .object({
      id: z.string(),
      name: z.string(),
      emdName: nullish(z.string()),
      households: nullish(z.number()),
      builtYear: nullish(z.number()),
      floorsMax: nullish(z.number()),
      areaTypes: z.array(complexAreaTypeSchema).default([]),
      market: z
        .object({
          /** Latest 실거래 (만원) and its contract month "2026-10". */
          recentTradePrice: nullish(z.number()),
          recentTradeYm: nullish(z.string()),
          recentTradePyeong: nullish(z.string()),
          askingMin: nullish(z.number()),
          askingMax: nullish(z.number()),
          /** 만원 / 평 */
          perPyeong: nullish(z.number()),
        })
        .nullable()
        .optional(),
    })
    .nullable(),
});
export type AddressMatch = z.infer<typeof addressMatchSchema>;

/** GET /regions — 읍면동 / 지구 of the service region (ASSUMED endpoint, same shape as w-map's). */
export const regionItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  parentName: nullish(z.string()),
});
export type RegionItem = z.infer<typeof regionItemSchema>;
export const regionListSchema = z
  .union([z.array(regionItemSchema), z.object({ items: z.array(regionItemSchema) })])
  .transform((v) => (Array.isArray(v) ? v : v.items));
