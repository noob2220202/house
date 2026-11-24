import {
  ASSET_TYPE_LABEL,
  AssetType,
  DealType,
  Direction,
  FloorClass,
  LandCategory,
  LandZone,
  ListingOption,
  ListingStatus,
  RoomType,
  effectiveRoomType,
} from '@house/shared';
import { z } from 'zod';

/**
 * THE listing-summary contract: one row of `GET /listings` (map side list, home strips, agency
 * page), the card of `GET /listings/:id/similar`, `GET /me/favorites/listings` and the embedded
 * card of `GET /me/recent-views`. Every page group parses the same object (or `.extend`s it with
 * endpoint extras), so one backend serializer feeds all of them.
 *
 * Field names mirror Prisma (`Listing`, `Property`, `Complex`): `title` is the broker's optional
 * one-line headline (Listing.title), NOT the display name — render names with
 * `listingDisplayName()`. Money is integer 만원, areas are ㎡.
 * The backend sends the shared `ListingSummary` (nested `complex`, `coverPhoto`, `floorLabel`);
 * `listingFromWire()` maps it onto the flat card keys below.
 */

const nullish = <T extends z.ZodType>(schema: T) => schema.nullish();
/**
 * For the search-group enums (방 구성 / 용도지역 / 지목): a value this build does not know yet (an
 * enum value added later in @house/shared) reads as "unknown" instead of failing the whole response.
 */
const lenient = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null);
/** Prisma `Decimal` columns may arrive as strings ("84.98") — accept both. */
const decimal = z.coerce.number();

/** Backend pagination envelope `{ items, page, pageSize, total, totalPages }`. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}

// ---- search-group enums ------------------------------------------------------------------------

/** 방 구성 · 용도지역 · 지목 search groups — the shared enums the backend sends (`ListingSummary`). */
export {
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  LandCategory,
  LandZone,
  ROOM_TYPE_LABEL,
  RoomType,
} from '@house/shared';

// ---- listing summary ----------------------------------------------------------------------------

/**
 * The parsed card shape the UI reads. The wire shape is the backend `ListingSummary`
 * (`@house/shared`, listings module) — `listingFromWire()` maps it onto these keys, so a card
 * parses the real response and the older flat shape (fixtures, tests) alike.
 */
export const listingSummaryObjectSchema = z.object({
  id: z.string(),
  assetType: z.enum(AssetType),
  dealType: z.enum(DealType),
  status: z.enum(ListingStatus).default(ListingStatus.ACTIVE),
  /** One-line headline written by the broker (Listing.title, ≤ 80 chars). Not the name. */
  title: nullish(z.string()),
  /** ← wire `complex.id`. */
  complexId: nullish(z.string()),
  /** Complex.name — 아파트·분양권 (← wire `complex.name`). */
  complexName: nullish(z.string()),
  /** Property.buildingName — 빌라·원룸·상가 건물명. */
  buildingName: nullish(z.string()),
  /** 동 (public). 호 is private and never sent. */
  dong: nullish(z.string()),
  /** Short kind word for non-complex assets: "단독주택", "1층 상가", "대지" (not sent by the backend). */
  kindLabel: nullish(z.string()),
  /**
   * "34" — 공급 평형 label of the complex area type (no "평"). Not part of the backend summary;
   * cards then derive the 평 from `supplyArea` / `exclusiveArea`.
   */
  pyeongLabel: nullish(z.string()),
  /** 전용 평 (backend `exclusiveAreaPyeong`). */
  exclusiveAreaPyeong: nullish(decimal),
  emdCode: nullish(z.string()),
  emdName: nullish(z.string()),
  roadAddress: nullish(z.string()),
  /** Free location hint ("순천대 정문 도보 6분") — not sent by the backend. */
  locationNote: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
  salePrice: nullish(z.number()),
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  presalePrice: nullish(z.number()),
  premium: nullish(z.number()),
  priceSort: nullish(z.number()),
  exclusiveArea: nullish(decimal),
  supplyArea: nullish(decimal),
  landArea: nullish(decimal),
  /** Exact floor — null when the broker shows only 저/중/고 (← parsed from wire `floorLabel`). */
  floor: nullish(z.number()),
  totalFloors: nullish(z.number()),
  /** Backend display text: "12/25", "고/25", "3층", "-/5층". */
  floorLabel: nullish(z.string()),
  floorClass: nullish(z.enum(FloorClass)),
  direction: nullish(z.enum(Direction)),
  rooms: nullish(z.number()),
  baths: nullish(z.number()),
  roomType: lenient(z.enum(RoomType)),
  builtYear: nullish(z.number()),
  landZone: lenient(z.enum(LandZone)),
  landCategory: lenient(z.enum(LandCategory)),
  maintenanceFeeWon: nullish(z.number()),
  options: z.array(z.enum(ListingOption)).default([]),
  /** Latest 실매물 확인 (ISO datetime or YYYY-MM-DD). */
  verifiedAt: nullish(z.string()),
  publishedAt: nullish(z.string()),
  /** Co-brokering offices (ACTIVE ListingAgency rows). */
  agencyCount: z.number().int().default(1),
  primaryAgency: nullish(z.object({ id: z.string(), name: z.string() })),
  photoCount: z.number().int().default(0),
  /** ← wire `coverPhoto.mediumUrl`. */
  coverPhotoUrl: nullish(z.string()),
  /** Other active listings in the same building ("같은 건물 다른 방 +2") — not sent by the backend. */
  sameBuildingCount: z.number().int().default(0),
  /** Present on authenticated responses. */
  isFavorite: z.boolean().optional(),
});

const FLOOR_CLASS_BY_SHORT: Record<string, FloorClass> = {
  저: FloorClass.LOW,
  중: FloorClass.MID,
  고: FloorClass.HIGH,
};

/** "B1" → -1, "12" → 12; anything else → null. */
function floorNumber(head: string): number | null {
  const m = /^(B)?(\d+)$/.exec(head);
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] ? -n : n;
}

/**
 * Backend `floorLabel` (shared `floorLabel()`: "12/25", "B1/5", "고/25", "-/25층", "3층") →
 * the separate floor / total / class fields the cards format themselves.
 */
export function parseFloorLabel(label: string): {
  floor: number | null;
  totalFloors: number | null;
  floorClass: FloorClass | null;
} {
  const text = label.trim();
  const single = /^(B?\d+)층$/.exec(text);
  if (single) return { floor: floorNumber(single[1]!), totalFloors: null, floorClass: null };
  const pair = /^([^/]+)\/(\d+)층?$/.exec(text);
  if (!pair) return { floor: null, totalFloors: null, floorClass: null };
  const head = pair[1]!;
  return {
    floor: floorNumber(head),
    totalFloors: Number(pair[2]),
    floorClass: FLOOR_CLASS_BY_SHORT[head] ?? null,
  };
}

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;

/**
 * Wire → card keys. Only fills a card key the payload does not carry itself, so the flat shape
 * passes through unchanged:
 * `complex{id,name}` → `complexId`/`complexName`, `coverPhoto.mediumUrl` → `coverPhotoUrl`,
 * `floorLabel` → `floor`/`totalFloors`/`floorClass`; `rooms` → `roomType` only for an older payload
 * without `roomType` (원룸·투룸).
 */
export function listingWireToCard(value: unknown): unknown {
  if (!isObject(value)) return value;
  const out: Raw = { ...value };
  const complex = value.complex;
  if (isObject(complex)) {
    if (out.complexId === undefined && typeof complex.id === 'string') out.complexId = complex.id;
    if (out.complexName === undefined && typeof complex.name === 'string') {
      out.complexName = complex.name;
    }
  }
  const cover = value.coverPhoto;
  if (out.coverPhotoUrl === undefined && isObject(cover)) {
    const url = cover.mediumUrl ?? cover.largeUrl ?? cover.thumbUrl;
    if (typeof url === 'string') out.coverPhotoUrl = url;
  }
  if (typeof value.floorLabel === 'string' && out.floor === undefined) {
    const f = parseFloorLabel(value.floorLabel);
    out.floor = f.floor;
    if (out.totalFloors === undefined) out.totalFloors = f.totalFloors;
    if (out.floorClass === undefined || out.floorClass === null) {
      out.floorClass = f.floorClass ?? out.floorClass ?? null;
    }
  }
  // The backend sends `roomType` (stated or derived, shared `effectiveRoomType`); only an older
  // payload without the key gets it derived here from the room count (원룸·투룸 only).
  if (value.roomType === undefined && value.assetType === AssetType.ONEROOM) {
    out.roomType = effectiveRoomType(
      AssetType.ONEROOM,
      null,
      typeof value.rooms === 'number' ? value.rooms : null,
    );
  }
  return out;
}

/** Wraps a card object schema (or an `.extend` of it) so it parses the backend wire shape. */
export function listingFromWire<T extends z.ZodType>(schema: T) {
  return z.preprocess(listingWireToCard, schema);
}

export const listingSummarySchema = listingFromWire(listingSummaryObjectSchema);
export type ListingSummary = z.infer<typeof listingSummaryObjectSchema>;
/** Flat card input (before defaults) — what a fixture / test may pass. */
export type ListingSummaryInput = z.input<typeof listingSummaryObjectSchema>;

export const listingPageSchema = pageSchema(listingSummarySchema);
export type ListingPage = z.infer<typeof listingPageSchema>;

type NameFields = Pick<
  ListingSummary,
  'complexName' | 'buildingName' | 'title' | 'kindLabel' | 'emdName' | 'assetType'
>;

/**
 * Display name of a listing card: complex → building → broker headline → kind word, and as a last
 * resort "<동> <종류>" so a card never renders an empty name.
 */
export function listingDisplayName(l: NameFields): string {
  const name = l.complexName ?? l.buildingName ?? l.title ?? l.kindLabel;
  if (name) return name;
  return `${l.emdName ?? ''} ${ASSET_TYPE_LABEL[l.assetType]}`.trim();
}
