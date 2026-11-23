// Owned by the listings module team.
import { z } from 'zod';
import {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  FloorClass,
  FloorDisplay,
  ListingOption,
  ListingSort,
  ListingStatus,
  MoveInType,
  VerificationMethod,
} from '../enums/listing';
import {
  areaSqmSchema,
  bboxSchema,
  csvArray,
  dateOnlySchema,
  idSchema,
  latSchema,
  lngSchema,
  manwonSchema,
  paginationQuerySchema,
  queryBoolean,
  queryInt,
  queryNumber,
  regionCodeSchema,
  zoomSchema,
} from './common';

/** Filters shared by the map and list search endpoints. Prices in 만원, areas in ㎡. */
export const listingFilterSchema = z.object({
  assetTypes: csvArray(z.enum(AssetType)),
  dealTypes: csvArray(z.enum(DealType)),
  priceMin: queryInt(), // 매매가 / 분양가+프리미엄
  priceMax: queryInt(),
  depositMin: queryInt(),
  depositMax: queryInt(),
  rentMin: queryInt(),
  rentMax: queryInt(),
  areaMin: queryNumber(),
  areaMax: queryNumber(),
  roomsMin: queryInt(0, 20),
  bathsMin: queryInt(0, 20),
  directions: csvArray(z.enum(Direction)),
  floorClasses: csvArray(z.enum(FloorClass)),
  builtYearMin: queryInt(1900, 2100),
  builtYearMax: queryInt(1900, 2100),
  options: csvArray(z.enum(ListingOption)),
  verifiedOnly: queryBoolean,
  complexId: idSchema.optional(),
  agencyId: idSchema.optional(),
  emdCode: regionCodeSchema.optional(),
});
export type ListingFilter = z.infer<typeof listingFilterSchema>;

export const mapSearchQuerySchema = listingFilterSchema.extend({
  bbox: bboxSchema,
  zoom: zoomSchema,
});
export type MapSearchQuery = z.infer<typeof mapSearchQuerySchema>;

export const listingListQuerySchema = listingFilterSchema.extend({
  ...paginationQuerySchema.shape,
  bbox: bboxSchema.optional(),
  sort: z.enum(ListingSort).default(ListingSort.LATEST),
});
export type ListingListQuery = z.infer<typeof listingListQuerySchema>;

export const propertyInputSchema = z.object({
  assetType: z.enum(AssetType),
  complexId: idSchema.optional(),
  areaTypeId: idSchema.optional(),
  roadAddress: z.string().trim().min(1).max(200),
  jibunAddress: z.string().trim().max(200).optional(),
  buildingName: z.string().trim().max(100).optional(),
  /** 동 — shown publicly. */
  dong: z.string().trim().max(20).optional(),
  /** 호 — PRIVATE, never returned by public endpoints. */
  ho: z.string().trim().max(20).optional(),
  lat: latSchema,
  lng: lngSchema,
  floor: z.int().min(-10).max(200).optional(),
  totalFloors: z.int().min(1).max(200).optional(),
  exclusiveArea: areaSqmSchema.optional(),
  supplyArea: areaSqmSchema.optional(),
  landArea: areaSqmSchema.optional(),
  rooms: z.int().min(0).max(50).optional(),
  baths: z.int().min(0).max(50).optional(),
  direction: z.enum(Direction).optional(),
  directionBasis: z.enum(DirectionBasis).optional(),
  approvalDate: dateOnlySchema.optional(),
  parkingSpaces: z.int().min(0).max(100_000).optional(),
});
export type PropertyInput = z.infer<typeof propertyInputSchema>;

/** Draft input is permissive; the publish validator enforces 표시·광고 명시사항. */
export const listingDraftSchema = z.object({
  dealType: z.enum(DealType),
  title: z.string().trim().max(80).optional(),
  description: z.string().trim().max(5000).optional(),
  salePrice: manwonSchema.optional(),
  deposit: manwonSchema.optional(),
  monthlyRent: manwonSchema.optional(),
  presalePrice: manwonSchema.optional(),
  premium: z.int().min(-10_000_000).max(10_000_000).optional(),
  maintenanceFeeWon: z.int().min(0).max(100_000_000).optional(),
  maintenanceFeeItems: z.array(z.string().max(30)).max(20).optional(),
  moveInType: z.enum(MoveInType).optional(),
  moveInDate: dateOnlySchema.optional(),
  floorDisplay: z.enum(FloorDisplay).default(FloorDisplay.EXACT),
  options: z.array(z.enum(ListingOption)).max(50).default([]),
  property: propertyInputSchema,
});
export type ListingDraftInput = z.infer<typeof listingDraftSchema>;

export const listingStatusChangeSchema = z.object({
  status: z.enum(ListingStatus),
});

export const listingVerificationSchema = z.object({
  method: z.enum(VerificationMethod),
  verifiedAt: dateOnlySchema,
  note: z.string().trim().max(500).optional(),
});
