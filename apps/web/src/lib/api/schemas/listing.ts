import {
  ASSET_TYPE_LABEL,
  AssetType,
  DealType,
  Direction,
  FloorClass,
  ListingOption,
  ListingStatus,
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
 * ASSUMED until the listings controller ships — see docs/frontend-integration/consistency.md.
 */

const nullish = <T extends z.ZodType>(schema: T) => schema.nullish();
/**
 * For fields whose values are ASSUMED (enums that are not in @house/shared yet): an unexpected
 * value reads as "unknown" instead of failing the whole response.
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

// ---- assumed enums (not in @house/shared yet) ---------------------------------------------------

/** 원룸·투룸 방 종류 — the backend filter schema has no such field yet (see integration doc). */
export const RoomType = {
  ONE_ROOM: 'ONE_ROOM',
  ONE_HALF_ROOM: 'ONE_HALF_ROOM',
  TWO_ROOM: 'TWO_ROOM',
  THREE_ROOM_PLUS: 'THREE_ROOM_PLUS',
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];
export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  ONE_ROOM: '원룸',
  ONE_HALF_ROOM: '1.5룸',
  TWO_ROOM: '투룸',
  THREE_ROOM_PLUS: '쓰리룸+',
};

/** 용도지역 (국토계획법 대분류). */
export const LandZone = {
  RESIDENTIAL: 'RESIDENTIAL',
  COMMERCIAL: 'COMMERCIAL',
  INDUSTRIAL: 'INDUSTRIAL',
  GREEN: 'GREEN',
  MANAGEMENT: 'MANAGEMENT',
  AGRICULTURAL: 'AGRICULTURAL',
  CONSERVATION: 'CONSERVATION',
} as const;
export type LandZone = (typeof LandZone)[keyof typeof LandZone];
export const LAND_ZONE_LABEL: Record<LandZone, string> = {
  RESIDENTIAL: '주거지역',
  COMMERCIAL: '상업지역',
  INDUSTRIAL: '공업지역',
  GREEN: '녹지지역',
  MANAGEMENT: '관리지역',
  AGRICULTURAL: '농림지역',
  CONSERVATION: '자연환경보전지역',
};

/** 지목 (most traded categories). */
export const LandCategory = {
  DAE: 'DAE',
  JEON: 'JEON',
  DAP: 'DAP',
  GWASUWON: 'GWASUWON',
  IMYA: 'IMYA',
  JAPJONGJI: 'JAPJONGJI',
  ETC: 'ETC',
} as const;
export type LandCategory = (typeof LandCategory)[keyof typeof LandCategory];
export const LAND_CATEGORY_LABEL: Record<LandCategory, string> = {
  DAE: '대',
  JEON: '전',
  DAP: '답',
  GWASUWON: '과수원',
  IMYA: '임야',
  JAPJONGJI: '잡종지',
  ETC: '기타',
};

// ---- listing summary ----------------------------------------------------------------------------

export const listingSummarySchema = z.object({
  id: z.string(),
  assetType: z.enum(AssetType),
  dealType: z.enum(DealType),
  status: z.enum(ListingStatus).default(ListingStatus.ACTIVE),
  /** One-line headline written by the broker (Listing.title, ≤ 80 chars). Not the name. */
  title: nullish(z.string()),
  complexId: nullish(z.string()),
  /** Complex.name — 아파트·분양권. */
  complexName: nullish(z.string()),
  /** Property.buildingName — 빌라·원룸·상가 건물명. */
  buildingName: nullish(z.string()),
  /** 동 (public). 호 is private and never sent. */
  dong: nullish(z.string()),
  /** Short kind word for non-complex assets: "단독주택", "1층 상가", "대지" (optional helper). */
  kindLabel: nullish(z.string()),
  /** "34" — 공급 평형 label of the complex area type (no "평"). */
  pyeongLabel: nullish(z.string()),
  emdName: nullish(z.string()),
  /** Free location hint ("순천대 정문 도보 6분"). */
  locationNote: nullish(z.string()),
  lat: nullish(z.number()),
  lng: nullish(z.number()),
  salePrice: nullish(z.number()),
  deposit: nullish(z.number()),
  monthlyRent: nullish(z.number()),
  presalePrice: nullish(z.number()),
  premium: nullish(z.number()),
  exclusiveArea: nullish(decimal),
  supplyArea: nullish(decimal),
  landArea: nullish(decimal),
  /** Exact floor — null when the broker shows only 저/중/고. */
  floor: nullish(z.number()),
  totalFloors: nullish(z.number()),
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
  photoCount: z.number().int().default(0),
  coverPhotoUrl: nullish(z.string()),
  /** Other active listings in the same building ("같은 건물 다른 방 +2"). */
  sameBuildingCount: z.number().int().default(0),
  /** Present on authenticated responses. */
  isFavorite: z.boolean().optional(),
});
export type ListingSummary = z.infer<typeof listingSummarySchema>;
/** Wire shape (before defaults) — what a serializer / mock must send. */
export type ListingSummaryInput = z.input<typeof listingSummarySchema>;

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
