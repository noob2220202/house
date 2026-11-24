# Frontend integration notes — cross-group consistency (apps/web)

Scope: shared contracts and modules that several page groups of `apps/web` now use instead of their
own copies. Read this before wiring the real backend: each item below is ONE place to change.

## Assumed endpoints / payload shapes

### Listing summary — ONE contract for every listing card

`apps/web/src/lib/api/schemas/listing.ts` → `listingSummarySchema`, `listingPageSchema`,
`listingDisplayName(l)`.

Served by (all must use one serializer on the backend):

| Endpoint                                           | Item                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/listings?…filters&sort&page&pageSize` | `listingSummarySchema` (home strips, map side list, `?agencyId=` agency page)                             |
| `GET /api/v1/listings/:id/similar`                 | `groups[].items[]` = `listingSummarySchema`                                                               |
| `GET /api/v1/me/favorites/listings`                | `listingSummarySchema` + `favoritedAt`                                                                    |
| `GET /api/v1/me/recent-views?targetType=LISTING`   | `items[].listing` = `listingSummarySchema` (null when removed)                                            |
| `GET /api/v1/complexes/:id/listings`               | `listingSummarySchema` + `priceMin`, `priceMax`, `floorDisplay`, `moveInType`, `moveInDate`, `agencies[]` |
| `GET /api/v1/agencies/:id` → `featuredListings[]`  | `listingSummarySchema`                                                                                    |

Fields (Prisma names; money = integer 만원, areas = ㎡, Decimal may arrive as string):

```
id, assetType, dealType, status (default ACTIVE),
title            -- Listing.title: the broker's optional one-line headline, NOT the name
complexId, complexName, buildingName, dong (호 never), kindLabel,
pyeongLabel      -- "34" (no 평)
emdName, locationNote, lat, lng,
salePrice, deposit, monthlyRent, presalePrice, premium,
exclusiveArea, supplyArea, landArea,
floor (null = 저/중/고 only), totalFloors, floorClass, direction, rooms, baths,
roomType (ONE_ROOM | ONE_HALF_ROOM | TWO_ROOM | THREE_ROOM_PLUS — assumed enum),
builtYear, landZone, landCategory (assumed enums), maintenanceFeeWon, options[],
verifiedAt, publishedAt, agencyCount (default 1), photoCount, coverPhotoUrl,
sameBuildingCount, isFavorite? (authenticated responses)
```

Display name everywhere: `listingDisplayName(l) = complexName ?? buildingName ?? title ?? kindLabel`
(last resort "<emdName> <asset label>"). Removed local copies: w-home `name/subtitle`, w-listing
`name`, w-me `title/subtitle` (title used to mean the complex name), w-complex and w-agencies item
schemas (now `.extend` / re-export the shared one).

Mocks: every listing-card mock emits through `app/mock-api/v1/listings/_summary.ts#toListingSummary`.

### One `GET /listings` in mock mode

`app/mock-api/v1/listings/route.ts` serves the whole contract: `bbox` → the map inventory
(`map/_fixtures.ts`), `agencyId` → that office's listings (`agencies/_fixtures.ts`), otherwise the
home sample. The mock-only paths `/map/listings` and `/agencies/listings` are gone; w-map and
w-agencies always call `/listings`. A malformed `agencyId` is a 400 (`idSchema`), an unknown one an
empty page.

### Canonical mock ids

`mockUuid(code)` everywhere (`L01`, `C01`, …); the `listing-`/`complex-` aliases of the my-page mocks
are gone. `GET /listings/:id` answers for any card id of any mock (seed lookup, then the closest seed
of the same asset type with the card's own id, name, prices, areas, floor, 동 and position).
`PUT /me/favorites/{listings|complexes}/:id` accepts any id the site shows.

### Agency dashboard feeds — `GET /api/v1/agencies/mine/dashboard`

`dealRequests.items[]` = `agencyDealRequestSchema` rows and `inquiries.items[]` = `inquirySchema`
rows — the first rows of `GET /agency/deal-requests` and `GET /agency/inquiries`, same shapes. The
previously assumed dashboard-only fields (`title`, `summary`, `listingTitle`, `preview`, `read`,
`proposed`) are **removed**; titles and summaries are rendered with `a-inbox/lib/request-text.ts`
and `a-inbox/lib/inquiry.ts`, exactly like the inbox.

### Served banners — `GET /api/v1/banners?slot&regionCode&complexId`

One schema for every slot: `lib/ads/schemas.ts#servedBannerSchema`
`{ id, slot?, title, advertiserName?, agencyId?, imageUrl, mobileImageUrl?, linkUrl?, newWindow,
agency? }`. The PC creative may be named `imageUrl` or `pcImageUrl` (the admin input has
`pcMediaId`) — both are read. Click: `GET /banners/:id/click` (302). Impression:
`POST /banners/:id/impression`, once per mount when ≥ 50 % of the creative is on screen.

### Terms — `GET /terms`, `GET /terms/:type`, `GET /terms/:type/versions/:version`

One schema in `features/w-content/api/schemas.ts`: `termsVersionSchema`
(`content` optional — absent on list endpoints, `isRequired` optional on superseded versions) and
`termsDocumentSchema` (`content` required). w-auth extends it with a required `isRequired` for the
current documents.

### Favourites

`lib/favorites/useFavorite.ts` is the only client of `GET /me/favorites/{kind}?pageSize=100` (id set,
query key `['favorites', kind, 'ids']`) and `PUT|DELETE /me/favorites/{kind}/:id`
(`kind` = `listings` | `complexes` | `agencies`). A heart clicked while signed out returns from
`/login` with `?intent=favorite&target=<kind>:<id>` and is added automatically.

### Default Open Graph image

`apps/web/public/og-default.png` (1200×630, from `apps/web/tools/og-default.html`) is used whenever a
page has no image of its own; `twitter:card` is always `summary_large_image`.
