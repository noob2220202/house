// Owned by the deal-requests module team. Request schemas (API validation + frontend forms).
import { z } from 'zod';
import {
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  ProposalStatus,
} from '../enums/deal-request';
import { AssetType, DealType } from '../enums/listing';
import {
  areaSqmSchema,
  csvArray,
  cursorQuerySchema,
  dateOnlySchema,
  idSchema,
  latSchema,
  lngSchema,
  manwonSchema,
  paginationQuerySchema,
  phoneSchema,
  queryBoolean,
  regionCodeSchema,
} from '../schemas/common';
import { AgencyInboxScope, DEAL_REQUEST_LIMITS as L } from './constants';
import { dealRequestRuleIssues } from './rules';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const baseRequest = z.object({
  assetType: z.enum(AssetType),
  dealTypes: z.array(z.enum(DealType)).min(1).max(4),
  visibility: z.enum(DealRequestVisibility),
  targetAgencyIds: z.array(idSchema).max(L.MAX_TARGET_AGENCIES).default([]),
  contactName: text(L.CONTACT_NAME_MAX),
  /**
   * Contact phone typed by the requester (format-validated + normalized, never verified — the
   * platform sends no SMS). Revealed to an agency only after the requester grants contact.
   */
  contactPhone: phoneSchema,
  description: optionalText(L.DESCRIPTION_MAX),
  moveInDate: dateOnlySchema.optional(),
});

/** 내놓기: the owner's property and desired terms. */
export const sellOrLeaseRequestSchema = baseRequest.extend({
  type: z.literal(DealRequestType.SELL_OR_LEASE),
  roadAddress: text(200),
  /** 동·호 등 — PRIVATE, shown to an agency only with the requester's consent. */
  addressDetail: optionalText(100),
  /** 법정동 code of the property, when the address search returned one. */
  emdCode: regionCodeSchema.optional(),
  complexId: idSchema.optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  exclusiveArea: areaSqmSchema.optional(),
  floor: z.int().min(-10).max(200).optional(),
  desiredSalePrice: manwonSchema.optional(),
  desiredDeposit: manwonSchema.optional(),
  desiredMonthlyRent: manwonSchema.optional(),
  photoMediaIds: z.array(idSchema).max(L.MAX_PHOTOS).default([]),
});

/** 구하기: the seeker's wanted conditions. */
export const wantedRequestSchema = baseRequest.extend({
  type: z.literal(DealRequestType.WANTED),
  regionCodes: z.array(regionCodeSchema).min(1).max(L.MAX_REGION_CODES),
  complexIds: z.array(idSchema).max(L.MAX_COMPLEX_IDS).default([]),
  priceMin: manwonSchema.optional(),
  priceMax: manwonSchema.optional(),
  depositMin: manwonSchema.optional(),
  depositMax: manwonSchema.optional(),
  rentMin: manwonSchema.optional(),
  rentMax: manwonSchema.optional(),
  areaMin: areaSqmSchema.optional(),
  areaMax: areaSqmSchema.optional(),
  roomsMin: z.int().min(0).max(20).optional(),
});

export const dealRequestCreateSchema = z
  .discriminatedUnion('type', [sellOrLeaseRequestSchema, wantedRequestSchema])
  .superRefine((v, ctx) => {
    for (const issue of dealRequestRuleIssues(v)) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type DealRequestCreateInput = z.infer<typeof dealRequestCreateSchema>;
export type SellOrLeaseRequestInput = z.infer<typeof sellOrLeaseRequestSchema>;
export type WantedRequestInput = z.infer<typeof wantedRequestSchema>;

export const myDealRequestListQuerySchema = paginationQuerySchema.extend({
  status: csvArray(z.enum(DealRequestStatus)),
  type: z.enum(DealRequestType).optional(),
});
export type MyDealRequestListQuery = z.infer<typeof myDealRequestListQuerySchema>;

/** Owner closing a request (거래 완료) — optional note. */
export const dealRequestCloseSchema = z
  .object({ reason: optionalText(L.CLOSE_REASON_MAX) })
  .optional()
  .transform((v) => v ?? {});
export type DealRequestCloseInput = z.infer<typeof dealRequestCloseSchema>;

export const contactGrantSchema = z.object({ agencyId: idSchema });
export type ContactGrantInput = z.infer<typeof contactGrantSchema>;

export const contactGrantParamSchema = z.object({ id: idSchema, agencyId: idSchema });
export type ContactGrantParam = z.infer<typeof contactGrantParamSchema>;

export const proposalCreateSchema = z.object({
  message: text(L.PROPOSAL_MESSAGE_MAX),
  listingIds: z
    .array(idSchema)
    .max(L.MAX_PROPOSAL_LISTINGS)
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, '매물이 중복되었습니다.'),
  suggestedPrice: manwonSchema.optional(),
  suggestedDeposit: manwonSchema.optional(),
  suggestedMonthlyRent: manwonSchema.optional(),
});
export type ProposalCreateInput = z.infer<typeof proposalCreateSchema>;

/**
 * Accepting a proposal. `shareContact` is required: revealing name, phone and 동·호 to the agency is
 * a third-party provision of personal data (개인정보보호법 제17조), so it needs an explicit opt-in.
 */
export const proposalAcceptSchema = z.object({
  shareContact: z.boolean({ error: '연락처 공개 여부를 선택해 주세요.' }),
});
export type ProposalAcceptInput = z.infer<typeof proposalAcceptSchema>;

export const agencyDealRequestListQuerySchema = paginationQuerySchema.extend({
  scope: z.enum(AgencyInboxScope).default(AgencyInboxScope.ALL),
  type: z.enum(DealRequestType).optional(),
  assetType: csvArray(z.enum(AssetType)),
  dealType: csvArray(z.enum(DealType)),
});
export type AgencyDealRequestListQuery = z.infer<typeof agencyDealRequestListQuerySchema>;

export const agencyProposalListQuerySchema = paginationQuerySchema.extend({
  status: csvArray(z.enum(ProposalStatus)),
});
export type AgencyProposalListQuery = z.infer<typeof agencyProposalListQuerySchema>;

export const notificationListQuerySchema = cursorQuerySchema.extend({
  unreadOnly: queryBoolean,
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

/** Mark some (`ids`) or all (`all: true`) notifications read. */
export const notificationReadSchema = z
  .object({
    ids: z.array(idSchema).min(1).max(100).optional(),
    all: z.literal(true).optional(),
  })
  .refine((v) => (v.all === true) !== (v.ids !== undefined), {
    message: 'ids 또는 all 중 하나만 지정해 주세요.',
    path: ['ids'],
  });
export type NotificationReadInput = z.infer<typeof notificationReadSchema>;

export const adminDealRequestListQuerySchema = paginationQuerySchema.extend({
  status: csvArray(z.enum(DealRequestStatus)),
  type: z.enum(DealRequestType).optional(),
  assetType: csvArray(z.enum(AssetType)),
  userId: idSchema.optional(),
  agencyId: idSchema.optional(),
});
export type AdminDealRequestListQuery = z.infer<typeof adminDealRequestListQuerySchema>;

/** Admin moderation: close a request (spam, abuse, duplicate …) with a recorded reason. */
export const adminDealRequestCloseSchema = z.object({ reason: text(L.CLOSE_REASON_MAX) });
export type AdminDealRequestCloseInput = z.infer<typeof adminDealRequestCloseSchema>;
