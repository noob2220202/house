import { NotificationType, RecentViewTarget, UserRole, UserStatus } from '@house/shared';
import { z } from 'zod';
import {
  listingFromWire,
  listingSummaryObjectSchema,
  listingSummarySchema,
  listingWireToCard,
} from '@/lib/api/schemas/listing';

/**
 * Response schemas of the my-page endpoints. Favourites and recent views follow the real
 * listings / complexes controllers (`FavoriteListingItem`, `FavoriteComplexItem`,
 * `RecentViewItem` of `@house/shared`) and are mapped onto the flat card shapes the views read.
 */

const nullish = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

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

// ---------- listings ----------

/**
 * Listing card payload — the shared listing-summary contract (`@/lib/api/schemas/listing`).
 * Names render through `listingDisplayName()`; `title` is the broker's headline, not the name.
 */
export { listingSummarySchema, type ListingSummary } from '@/lib/api/schemas/listing';

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;

/** Wire `{ favoritedAt, listing }` (FavoriteListingItem) → one flat card with `favoritedAt`. */
export const favoriteListingSchema = z.preprocess(
  (v) =>
    isObject(v) && isObject(v.listing)
      ? { isFavorite: true, ...(listingWireToCard(v.listing) as Raw), favoritedAt: v.favoritedAt }
      : v,
  listingFromWire(
    listingSummaryObjectSchema.extend({
      /** FavoriteListing.createdAt */
      favoritedAt: z.string(),
    }),
  ),
);
export type FavoriteListing = z.output<typeof favoriteListingSchema>;
export const favoriteListingPageSchema = pageSchema(favoriteListingSchema);
export type FavoriteListingPage = z.infer<typeof favoriteListingPageSchema>;

// ---------- complexes ----------

const priceRangeSchema = z.object({ min: z.number(), max: z.number() });

/**
 * Wire `{ favoritedAt, complex: ComplexSummary }` (FavoriteComplexItem) → flat card. The backend
 * summary has no per-deal counts / price ranges / 평형 list, so those stay empty and the card
 * shows the total (`activeListingCount`) only.
 */
function favoriteComplexFromWire(v: unknown): unknown {
  if (!isObject(v) || !isObject(v.complex)) return v;
  const c = v.complex;
  return {
    id: c.id,
    name: c.name,
    emdName: c.emdName ?? null,
    households: c.households ?? null,
    builtYear: c.builtYear ?? null,
    activeListingCount: c.activeListingCount ?? 0,
    favoritedAt: v.favoritedAt,
  };
}

const favoriteComplexObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  emdName: nullish(z.string()),
  households: nullish(z.number()),
  builtYear: nullish(z.number()),
  /** "2027.03" for complexes that are not completed yet (분양 단지). */
  moveInYm: nullish(z.string()),
  /** ComplexAreaType.pyeongLabel values: ["25", "34", "41"]. */
  pyeongLabels: z.array(z.string()).default([]),
  /** Active listing price ranges per deal type (만원). */
  salePrice: nullish(priceRangeSchema),
  jeonsePrice: nullish(priceRangeSchema),
  presalePrice: nullish(priceRangeSchema),
  /** Active listing counts in the fixed order 분양 / 매매 / 전세 / 월세 (not in the backend summary). */
  counts: nullish(
    z.object({
      presale: z.number().int(),
      sale: z.number().int(),
      jeonse: z.number().int(),
      monthly: z.number().int(),
    }),
  ),
  /** ComplexSummary.activeListingCount — used when the per-deal counts are absent. */
  activeListingCount: nullish(z.number().int()),
  /** Average price per 평 (만원). */
  pricePerPyeong: nullish(z.number()),
  coverPhotoUrl: nullish(z.string()),
  /** FavoriteComplex.createdAt */
  favoritedAt: z.string(),
});
export const favoriteComplexSchema = z.preprocess(
  favoriteComplexFromWire,
  favoriteComplexObjectSchema,
);
export type FavoriteComplex = z.infer<typeof favoriteComplexObjectSchema>;
export const favoriteComplexPageSchema = pageSchema(favoriteComplexSchema);
export type FavoriteComplexPage = z.infer<typeof favoriteComplexPageSchema>;

// ---------- recent views ----------

export const recentViewSchema = z.object({
  targetType: z.enum(RecentViewTarget),
  targetId: z.string(),
  viewedAt: z.string(),
  /** Embedded card payload when targetType = LISTING (null when the listing was removed). */
  listing: nullish(listingSummarySchema),
});
export type RecentView = z.infer<typeof recentViewSchema>;
export const recentViewPageSchema = pageSchema(recentViewSchema);
export type RecentViewPage = z.infer<typeof recentViewPageSchema>;

// ---------- notifications ----------

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NotificationType).catch(NotificationType.SYSTEM),
  title: z.string(),
  body: nullish(z.string()),
  /** Deep-link payload, e.g. { dealRequestId }. */
  data: nullish(z.record(z.string(), z.unknown())),
  readAt: nullish(z.string()),
  createdAt: z.string(),
});
export type Notification = z.infer<typeof notificationSchema>;

/** Cursor page (`CursorPage<T>` in @house/shared) + the unread counter. */
export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().optional(),
});
export type NotificationPage = z.infer<typeof notificationPageSchema>;

/** POST /me/notifications/read → `NotificationReadResult` (`{ updated, unread }` of the scope). */
export const notificationReadResultSchema = z
  .object({ updated: z.number().int().optional(), unread: z.number().int().optional() })
  .optional();
export type NotificationReadResult = z.infer<typeof notificationReadResultSchema>;

/** GET /me/notifications/unread-count → `{ unread }`. */
export const notificationUnreadSchema = z.object({ unread: z.number().int() });

// ---------- profile ----------

/**
 * The member's own profile = `MeResponse` (GET /auth/me; the backend has no GET /me/profile, and
 * PATCH /me/profile answers the same shape). `nickname` is nullable in the backend (PII scrub or
 * an admin cleared it); `agencyId` mirrors `agency.agencyId`.
 */
export const profileSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'object' || value === null) return value;
    const raw = value as Record<string, unknown>;
    const agency = raw.agency as { agencyId?: unknown } | null | undefined;
    if (raw.agencyId === undefined && typeof agency?.agencyId === 'string')
      return { ...raw, agencyId: agency.agencyId };
    return raw;
  },
  z.object({
    id: z.string(),
    role: z.enum(UserRole),
    status: z.enum(UserStatus).default(UserStatus.ACTIVE),
    nickname: nullish(z.string()),
    name: nullish(z.string()),
    email: nullish(z.string()),
    /** Plain contact number, digits only. Never verified. */
    phone: nullish(z.string()),
    profileImageUrl: nullish(z.string()),
    agencyId: nullish(z.string()),
    marketingOptIn: z.boolean().default(false),
    /** Start of the current marketing opt-in (정보통신망법 제50조 수신동의 일자); null while opted out. */
    marketingOptInAt: nullish(z.string()),
    createdAt: nullish(z.string()),
  }),
);
export type Profile = z.infer<typeof profileSchema>;
