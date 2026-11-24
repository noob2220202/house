import { ListingStatus } from '@house/shared';
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

function roomTypeOf(value: string | null | undefined): RoomType | null {
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
    emdName: orNull(l.emdName),
    locationNote: orNull(l.locationNote),
    lat: orNull(l.lat),
    lng: orNull(l.lng),
    salePrice: orNull(l.salePrice),
    deposit: orNull(l.deposit),
    monthlyRent: orNull(l.monthlyRent),
    presalePrice: orNull(l.presalePrice),
    premium: orNull(l.premium),
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
    photoCount: l.photoCount ?? 0,
    coverPhotoUrl: orNull(l.coverPhotoUrl),
    sameBuildingCount: l.sameBuildingCount ?? 0,
  };
  if (l.isFavorite !== undefined) out.isFavorite = l.isFavorite;
  return out;
}
