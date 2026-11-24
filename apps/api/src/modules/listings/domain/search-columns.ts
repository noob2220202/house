import {
  effectiveRoomType,
  floorClassOf,
  landCategoryOf,
  landZoneOf,
  priceSortOf,
  searchAreaOf,
  type AssetType,
  type DealType,
  type Direction,
  type FloorClass,
  type LandCategory,
  type LandZone,
  type ListingPriceFields,
  type RoomType,
} from '@house/shared';

/** Property values (numbers, not Decimals) that feed the denormalized listing search columns. */
export interface PropertySearchSource {
  assetType: AssetType;
  complexId: string | null;
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
  roomType: RoomType | null;
  baths: number | null;
  direction: Direction | null;
  approvalDate: Date | null;
  /** 용도지역 / 지목 as entered (free text). */
  zoning: string | null;
  landCategory: string | null;
}

export interface PropertySearchColumns {
  assetType: AssetType;
  complexId: string | null;
  sggCode: string;
  emdCode: string | null;
  lat: number;
  lng: number;
  exclusiveArea: number | null;
  rooms: number | null;
  roomType: RoomType | null;
  landZone: LandZone | null;
  landCategory: LandCategory | null;
  baths: number | null;
  direction: Direction | null;
  floorClass: FloorClass | null;
  builtYear: number | null;
}

/** Columns copied from the property onto every listing of it (kept in sync on every write). */
export function propertySearchColumns(
  p: PropertySearchSource,
  complexBuiltYear: number | null,
): PropertySearchColumns {
  return {
    assetType: p.assetType,
    complexId: p.complexId,
    sggCode: p.sggCode,
    emdCode: p.emdCode,
    lat: p.lat,
    lng: p.lng,
    exclusiveArea: searchAreaOf(p),
    rooms: p.rooms,
    roomType: effectiveRoomType(p.assetType, p.roomType, p.rooms),
    landZone: landZoneOf(p.zoning),
    landCategory: landCategoryOf(p.landCategory),
    baths: p.baths,
    direction: p.direction,
    floorClass: floorClassOf(p.floor, p.totalFloors),
    builtYear: p.approvalDate ? p.approvalDate.getUTCFullYear() : complexBuiltYear,
  };
}

export function listingPriceSort(dealType: DealType, prices: ListingPriceFields): number | null {
  return priceSortOf(dealType, prices);
}
