import {
  DEFAULT_REGION_NAME,
  FloorDisplay,
  floorLabel,
  ListingStatus,
  sqmToPyeong,
  type ListingSummary as WireListingSummary,
} from '@house/shared';
import {
  ROOM_TYPE_LABEL,
  RoomType,
  type ListingSummary,
  type ListingSummaryInput,
} from '@/lib/api/schemas/listing';

/**
 * The ONE serializer of the mock listing-summary contract (`@/lib/api/schemas/listing`). Every
 * mock that answers with listing cards — `GET /listings` (home sample, map, agency page),
 * `GET /listings/:id/similar`, `GET /complexes/:id/listings`, `GET /me/favorites/listings`,
 * `GET /me/recent-views` — emits through `toListingSummary()`, so all of them send the same keys
 * with the same meaning (`title` = broker headline, names in `complexName` / `buildingName`).
 */

/** What a fixture row may carry: the contract fields (plus fixture-only extras, which are dropped). */
export type MockSummarySource = Omit<ListingSummaryInput, 'roomType' | 'pyeongLabel'> & {
  /** Enum value, or the Korean label ("투룸") some fixtures use. */
  roomType?: string | null;
  /** "34" or "34평". */
  pyeongLabel?: string | null;
};

const ROOM_TYPE_BY_LABEL = new Map<string, RoomType>(
  Object.entries(ROOM_TYPE_LABEL).map(([value, label]) => [label, value as RoomType]),
);

export function roomTypeOf(value: string | null | undefined): RoomType | null {
  if (!value) return null;
  if (value in RoomType) return value as RoomType;
  return ROOM_TYPE_BY_LABEL.get(value) ?? null;
}

const orNull = <T>(v: T | null | undefined): T | null => (v === undefined ? null : v);
const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === '' ? null : Number(v);

/** Fixture row → public listing card (every contract key present, fixture-only fields removed). */
export function toListingSummary(l: MockSummarySource): ListingSummary {
  const out: ListingSummary = {
    id: l.id,
    assetType: l.assetType,
    dealType: l.dealType,
    status: l.status ?? ListingStatus.ACTIVE,
    title: orNull(l.title),
    complexId: orNull(l.complexId),
    complexName: orNull(l.complexName),
    buildingName: orNull(l.buildingName),
    dong: orNull(l.dong),
    kindLabel: orNull(l.kindLabel),
    pyeongLabel: l.pyeongLabel ? l.pyeongLabel.replace(/평$/, '') : null,
    emdCode: orNull(l.emdCode),
    emdName: orNull(l.emdName),
    roadAddress: orNull(l.roadAddress),
    locationNote: orNull(l.locationNote),
    lat: orNull(l.lat),
    lng: orNull(l.lng),
    salePrice: orNull(l.salePrice),
    deposit: orNull(l.deposit),
    monthlyRent: orNull(l.monthlyRent),
    presalePrice: orNull(l.presalePrice),
    premium: orNull(l.premium),
    priceSort: orNull(l.priceSort),
    exclusiveArea: num(l.exclusiveArea as number | string | null | undefined),
    supplyArea: num(l.supplyArea as number | string | null | undefined),
    landArea: num(l.landArea as number | string | null | undefined),
    floor: orNull(l.floor),
    totalFloors: orNull(l.totalFloors),
    floorClass: orNull(l.floorClass),
    direction: orNull(l.direction),
    rooms: orNull(l.rooms),
    baths: orNull(l.baths),
    roomType: roomTypeOf(l.roomType),
    builtYear: orNull(l.builtYear),
    landZone: orNull(l.landZone),
    landCategory: orNull(l.landCategory),
    maintenanceFeeWon: orNull(l.maintenanceFeeWon),
    options: [...(l.options ?? [])],
    verifiedAt: orNull(l.verifiedAt),
    publishedAt: orNull(l.publishedAt),
    agencyCount: l.agencyCount ?? 1,
    primaryAgency: orNull(l.primaryAgency),
    photoCount: l.photoCount ?? 0,
    coverPhotoUrl: orNull(l.coverPhotoUrl),
    sameBuildingCount: l.sameBuildingCount ?? 0,
  };
  if (l.isFavorite !== undefined) out.isFavorite = l.isFavorite;
  return out;
}

// ---- wire --------------------------------------------------------------------------------------

const FLOOR_SHORT: Record<string, string> = { LOW: '저', MID: '중', HIGH: '고' };
const DEFAULT_PRIMARY_AGENCY = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: '순천중앙공인중개사사무소',
};

function wireFloorLabel(l: ListingSummary): string | null {
  if (l.floor !== null && l.floor !== undefined) {
    return floorLabel(l.floor, l.totalFloors ?? null, FloorDisplay.EXACT);
  }
  const total = l.totalFloors ? `${l.totalFloors}층` : null;
  const cls = l.floorClass ? FLOOR_SHORT[l.floorClass] : null;
  if (cls) return l.totalFloors ? `${cls}/${l.totalFloors}` : `${cls}층`;
  return total ? `-/${total}` : null;
}

function wirePrice(l: ListingSummary): number | null {
  switch (l.dealType) {
    case 'SALE':
      return l.salePrice ?? null;
    case 'PRESALE':
      return l.presalePrice === null || l.presalePrice === undefined
        ? null
        : l.presalePrice + (l.premium ?? 0);
    default:
      return l.deposit ?? null;
  }
}

/**
 * Card → the backend wire shape (`ListingSummary` of `@house/shared`, listings mapper): nested
 * `complex` / `coverPhoto`, `floorLabel`, `exclusiveAreaPyeong`. Fields the real API does not
 * serve (kindLabel, locationNote, sameBuildingCount, …) are left out, so mock
 * mode shows what production shows. Every route answering with listing cards sends this.
 */
export function toListingWire(
  l: ListingSummary,
  extra: {
    emdCode?: string | null;
    primaryAgency?: { id: string; name: string };
    listingNo?: string | null;
  } = {},
): WireListingSummary & { isFavorite?: boolean } {
  const cover = l.coverPhotoUrl;
  const out: WireListingSummary & { isFavorite?: boolean } = {
    id: l.id,
    listingNo: extra.listingNo ?? null,
    dealType: l.dealType,
    assetType: l.assetType,
    status: l.status,
    title: l.title ?? null,
    salePrice: l.salePrice ?? null,
    deposit: l.deposit ?? null,
    monthlyRent: l.monthlyRent ?? null,
    presalePrice: l.presalePrice ?? null,
    premium: l.premium ?? null,
    priceSort: l.priceSort ?? wirePrice(l),
    maintenanceFeeWon: l.maintenanceFeeWon ?? null,
    exclusiveArea: l.exclusiveArea ?? null,
    exclusiveAreaPyeong: l.exclusiveArea ? sqmToPyeong(l.exclusiveArea) : null,
    supplyArea: l.supplyArea ?? null,
    floorLabel: wireFloorLabel(l),
    floorClass: l.floorClass ?? null,
    rooms: l.rooms ?? null,
    baths: l.baths ?? null,
    roomType: l.roomType ?? null,
    landZone: l.landZone ?? null,
    landCategory: l.landCategory ?? null,
    direction: l.direction ?? null,
    builtYear: l.builtYear ?? null,
    roadAddress: l.roadAddress ?? `${DEFAULT_REGION_NAME} ${l.emdName ?? ''}`.trim(),
    buildingName: l.buildingName ?? null,
    dong: l.dong ?? null,
    emdCode: extra.emdCode ?? l.emdCode ?? null,
    emdName: l.emdName ?? null,
    lat: l.lat ?? 0,
    lng: l.lng ?? 0,
    complex: l.complexId ? { id: l.complexId, name: l.complexName ?? '' } : null,
    coverPhoto: cover
      ? {
          mediaId: `${l.id}-cover`,
          thumbUrl: cover,
          mediumUrl: cover,
          largeUrl: cover,
          caption: null,
          isCover: true,
        }
      : null,
    photoCount: l.photoCount,
    options: [...l.options],
    verifiedAt: l.verifiedAt ?? null,
    publishedAt: l.publishedAt ?? null,
    primaryAgency: extra.primaryAgency ?? l.primaryAgency ?? DEFAULT_PRIMARY_AGENCY,
    agencyCount: l.agencyCount,
    viewCount: 0,
    favoriteCount: 0,
  };
  if (l.isFavorite !== undefined) out.isFavorite = l.isFavorite;
  return out;
}
