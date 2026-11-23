import type {
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  FloorDisplay,
  ListingDraftInput,
  ListingOption,
  ListingUpdateInput,
  MoveInType,
  PropertyInput,
  PropertyUpdateInput,
  PublishCheckInput,
} from '@house/shared';
import type { Listing, Property } from '@prisma/client';
import { decimalToNumber } from '../../../common/utils/decimal';
import { dateOnlyToDate } from './dates';
import {
  listingPriceSort,
  propertySearchColumns,
  type PropertySearchColumns,
} from './search-columns';

/**
 * Plain (number/Date) working copies of a property and a listing. The write path merges patches
 * into these, validates them, and derives the denormalized search columns from them.
 */
export interface PropertyState {
  assetType: AssetType;
  complexId: string | null;
  areaTypeId: string | null;
  roadAddress: string;
  jibunAddress: string | null;
  buildingName: string | null;
  dong: string | null;
  ho: string | null;
  sggCode: string;
  emdCode: string | null;
  lat: number;
  lng: number;
  floor: number | null;
  totalFloors: number | null;
  exclusiveArea: number | null;
  supplyArea: number | null;
  landArea: number | null;
  totalFloorArea: number | null;
  rooms: number | null;
  baths: number | null;
  direction: Direction | null;
  directionBasis: DirectionBasis | null;
  approvalDate: Date | null;
  parkingSpaces: number | null;
  heatingType: string | null;
  zoning: string | null;
  landCategory: string | null;
  buildingUse: string | null;
}

export interface ListingState {
  dealType: DealType;
  title: string | null;
  description: string | null;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  maintenanceFeeWon: number | null;
  maintenanceFeeItems: string[];
  moveInType: MoveInType | null;
  moveInDate: Date | null;
  floorDisplay: FloorDisplay;
  options: ListingOption[];
}

const orNull = <T>(v: T | undefined): T | null => (v === undefined ? null : v);
const dateOrNull = (v: string | null | undefined): Date | null =>
  v === undefined || v === null ? null : dateOnlyToDate(v);

export function propertyStateFromInput(p: PropertyInput, sggCode: string): PropertyState {
  return {
    assetType: p.assetType,
    complexId: orNull(p.complexId),
    areaTypeId: orNull(p.areaTypeId),
    roadAddress: p.roadAddress,
    jibunAddress: orNull(p.jibunAddress),
    buildingName: orNull(p.buildingName),
    dong: orNull(p.dong),
    ho: orNull(p.ho),
    sggCode,
    emdCode: orNull(p.emdCode),
    lat: p.lat,
    lng: p.lng,
    floor: orNull(p.floor),
    totalFloors: orNull(p.totalFloors),
    exclusiveArea: orNull(p.exclusiveArea),
    supplyArea: orNull(p.supplyArea),
    landArea: orNull(p.landArea),
    totalFloorArea: orNull(p.totalFloorArea),
    rooms: orNull(p.rooms),
    baths: orNull(p.baths),
    direction: orNull(p.direction),
    directionBasis: orNull(p.directionBasis),
    approvalDate: dateOrNull(p.approvalDate),
    parkingSpaces: orNull(p.parkingSpaces),
    heatingType: orNull(p.heatingType),
    zoning: orNull(p.zoning),
    landCategory: orNull(p.landCategory),
    buildingUse: orNull(p.buildingUse),
  };
}

export function propertyStateFromRow(p: Property): PropertyState {
  return {
    assetType: p.assetType,
    complexId: p.complexId,
    areaTypeId: p.areaTypeId,
    roadAddress: p.roadAddress,
    jibunAddress: p.jibunAddress,
    buildingName: p.buildingName,
    dong: p.dong,
    ho: p.ho,
    sggCode: p.sggCode,
    emdCode: p.emdCode,
    lat: p.lat,
    lng: p.lng,
    floor: p.floor,
    totalFloors: p.totalFloors,
    exclusiveArea: decimalToNumber(p.exclusiveArea),
    supplyArea: decimalToNumber(p.supplyArea),
    landArea: decimalToNumber(p.landArea),
    totalFloorArea: decimalToNumber(p.totalFloorArea),
    rooms: p.rooms,
    baths: p.baths,
    direction: p.direction,
    directionBasis: p.directionBasis,
    approvalDate: p.approvalDate,
    parkingSpaces: p.parkingSpaces,
    heatingType: p.heatingType,
    zoning: p.zoning,
    landCategory: p.landCategory,
    buildingUse: p.buildingUse,
  };
}

/** Applies a PATCH (undefined = keep, null = clear). `sggCode` is derived by the caller. */
export function applyPropertyPatch(s: PropertyState, patch: PropertyUpdateInput): PropertyState {
  const next: PropertyState = { ...s };
  for (const [key, value] of Object.entries(patch) as [keyof PropertyUpdateInput, unknown][]) {
    if (value === undefined) continue;
    if (key === 'approvalDate') next.approvalDate = dateOrNull(value as string | null);
    else (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

export function listingStateFromInput(d: ListingDraftInput): ListingState {
  return {
    dealType: d.dealType,
    title: orNull(d.title),
    description: orNull(d.description),
    salePrice: orNull(d.salePrice),
    deposit: orNull(d.deposit),
    monthlyRent: orNull(d.monthlyRent),
    presalePrice: orNull(d.presalePrice),
    premium: orNull(d.premium),
    maintenanceFeeWon: orNull(d.maintenanceFeeWon),
    maintenanceFeeItems: d.maintenanceFeeItems,
    moveInType: orNull(d.moveInType),
    moveInDate: dateOrNull(d.moveInDate),
    floorDisplay: d.floorDisplay,
    options: d.options,
  };
}

export function listingStateFromRow(l: Listing): ListingState {
  return {
    dealType: l.dealType,
    title: l.title,
    description: l.description,
    salePrice: l.salePrice,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    presalePrice: l.presalePrice,
    premium: l.premium,
    maintenanceFeeWon: l.maintenanceFeeWon,
    maintenanceFeeItems: l.maintenanceFeeItems,
    moveInType: l.moveInType,
    moveInDate: l.moveInDate,
    floorDisplay: l.floorDisplay,
    options: l.options,
  };
}

const LISTING_PATCH_KEYS = [
  'dealType',
  'title',
  'description',
  'salePrice',
  'deposit',
  'monthlyRent',
  'presalePrice',
  'premium',
  'maintenanceFeeWon',
  'maintenanceFeeItems',
  'moveInType',
  'moveInDate',
  'floorDisplay',
  'options',
] as const satisfies readonly (keyof ListingState & keyof ListingUpdateInput)[];

export function applyListingPatch(s: ListingState, patch: ListingUpdateInput): ListingState {
  const next: ListingState = { ...s };
  for (const key of LISTING_PATCH_KEYS) {
    const value = patch[key];
    if (value === undefined) continue;
    if (key === 'moveInDate') next.moveInDate = dateOrNull(value as string | null);
    else (next as unknown as Record<string, unknown>)[key] = value;
  }
  return next;
}

/** True when the patch touches anything that a listing row derives from its property. */
export function hasPropertyChanges(patch: PropertyUpdateInput | undefined): boolean {
  return !!patch && Object.values(patch).some((v) => v !== undefined);
}

export interface ListingWriteColumns extends PropertySearchColumns, ListingState {
  priceSort: number | null;
}

/** All listing columns derived from the two states (search columns + price sort key). */
export function listingWriteColumns(
  l: ListingState,
  p: PropertyState,
  complexBuiltYear: number | null,
): ListingWriteColumns {
  return {
    ...l,
    ...propertySearchColumns(p, complexBuiltYear),
    priceSort: listingPriceSort(l.dealType, l),
  };
}

export function publishCheckInput(
  l: ListingState,
  p: PropertyState,
  agency: PublishCheckInput['agency'],
): PublishCheckInput {
  return {
    dealType: l.dealType,
    salePrice: l.salePrice,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    presalePrice: l.presalePrice,
    premium: l.premium,
    maintenanceFeeWon: l.maintenanceFeeWon,
    moveInType: l.moveInType,
    moveInDate: l.moveInDate,
    property: p,
    agency,
  };
}
