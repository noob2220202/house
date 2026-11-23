// Owned by the deal-requests module team.
import { z } from 'zod';
import { DealRequestType, DealRequestVisibility } from '../enums/deal-request';
import { AssetType, DealType } from '../enums/listing';
import {
  areaSqmSchema,
  dateOnlySchema,
  idSchema,
  latSchema,
  lngSchema,
  manwonSchema,
  phoneSchema,
  regionCodeSchema,
} from './common';

const baseRequest = z.object({
  assetType: z.enum(AssetType),
  dealTypes: z.array(z.enum(DealType)).min(1).max(4),
  visibility: z.enum(DealRequestVisibility),
  targetAgencyIds: z.array(idSchema).max(20).default([]),
  contactName: z.string().trim().min(1).max(30),
  /**
   * Contact phone typed by the requester (format-validated + normalized, never verified).
   * Revealed to an agency only after the requester grants contact (DealRequestContactGrant).
   */
  contactPhone: phoneSchema,
  description: z.string().trim().max(3000).optional(),
});

export const sellOrLeaseRequestSchema = baseRequest.extend({
  type: z.literal(DealRequestType.SELL_OR_LEASE),
  roadAddress: z.string().trim().min(1).max(200),
  addressDetail: z.string().trim().max(100).optional(),
  complexId: idSchema.optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
  exclusiveArea: areaSqmSchema.optional(),
  floor: z.int().min(-10).max(200).optional(),
  desiredSalePrice: manwonSchema.optional(),
  desiredDeposit: manwonSchema.optional(),
  desiredMonthlyRent: manwonSchema.optional(),
  moveInDate: dateOnlySchema.optional(),
});

export const wantedRequestSchema = baseRequest.extend({
  type: z.literal(DealRequestType.WANTED),
  regionCodes: z.array(regionCodeSchema).min(1).max(20),
  complexIds: z.array(idSchema).max(20).default([]),
  priceMin: manwonSchema.optional(),
  priceMax: manwonSchema.optional(),
  depositMin: manwonSchema.optional(),
  depositMax: manwonSchema.optional(),
  rentMin: manwonSchema.optional(),
  rentMax: manwonSchema.optional(),
  areaMin: areaSqmSchema.optional(),
  areaMax: areaSqmSchema.optional(),
  roomsMin: z.int().min(0).max(20).optional(),
  moveInDate: dateOnlySchema.optional(),
});

export const dealRequestCreateSchema = z
  .discriminatedUnion('type', [sellOrLeaseRequestSchema, wantedRequestSchema])
  .refine(
    (v) => v.visibility !== DealRequestVisibility.SELECTED_AGENCIES || v.targetAgencyIds.length > 0,
    { message: '요청을 받을 중개사무소를 선택해 주세요.', path: ['targetAgencyIds'] },
  );
export type DealRequestCreateInput = z.infer<typeof dealRequestCreateSchema>;

export const proposalCreateSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  listingIds: z.array(idSchema).max(10).default([]),
});

export const contactGrantSchema = z.object({
  agencyId: idSchema,
});
