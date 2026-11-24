# Frontend integration notes — w-listing (매물 상세)

Scope: `/listing/[id]` in `apps/web` — route `src/app/(listing)/listing/[id]/**`, feature code
`src/features/w-listing/**`, mock resources listed below. Conventions: `docs/FRONTEND.md`.

None of the listings / complexes / ads / admin controllers exist yet (module READMEs + Prisma models
only), so every **payload shape** below is an assumption. Each one is parsed by exactly one zod schema
in `src/features/w-listing/api/schemas.ts` — when the backend lands, fix the schema and the mock
fixture together. Field names mirror the Prisma models; `Decimal` columns are accepted as number or
string.

## Endpoints used

| Method     | Path                                                                    | Used for                                                   | Backend status                                          |
| ---------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| GET        | `/api/v1/listings/:id`                                                  | page data (server, ISR 60s) + metadata + JSON-LD           | listed in listings README, shape assumed                |
| GET        | `/api/v1/listings/:id/similar`                                          | 비슷한 매물 tabs (server, ISR 300s)                        | **assumed endpoint**                                    |
| POST       | `/api/v1/listings/:id/view`                                             | view counter + recent view (client, once per page view)    | **assumed endpoint**                                    |
| GET        | `/api/v1/complexes/:id/stats?dealType&areaTypeId`                       | 시세 line + summary tiles (client)                         | listed in complexes README, shape shared with w-complex |
| GET        | `/api/v1/complexes/:id/trades?dealType&areaTypeId&fromYm&page&pageSize` | 실거래 dots + table (client)                               | listed in complexes README (`complexTradesQuerySchema`) |
| GET        | `/api/v1/banners?slot=LISTING_SIDE&complexId&regionCode`                | side ad (server, 60s)                                      | listed in ads README (`bannerServeQuerySchema`)         |
| POST       | `/api/v1/banners/:id/impression`                                        | impression beacon when the ad is ≥ 50% visible             | listed in ads README                                    |
| GET        | `/api/v1/banners/:id/click`                                             | ad link (302)                                              | listed in ads README                                    |
| GET        | `/api/v1/me/favorites/listings?page=1&pageSize=100`                     | "is this listing a favourite?" (client, signed-in only)    | listed in listings README                               |
| PUT/DELETE | `/api/v1/me/favorites/listings/:id`                                     | 관심 toggle (optimistic)                                   | listed in listings README                               |
| POST       | `/api/v1/reports`                                                       | 허위매물 신고 (`reportCreateSchema`, `targetType=LISTING`) | listed in admin README                                  |

## Assumed endpoints

1. **`GET /listings/:id/similar`** → `similarListingsSchema`

   ```jsonc
   {
     "criteria": "신대지구 · 매매 · 34평 · 4억~5억", // optional caption
     "regionName": "신대지구", "regionListingCount": 318, // optional, for the "지도에서 보기" button
     "groups": [
       { "key": "SAME_COMPLEX" | "SAME_AREA" | "SAME_PRICE", "label": "같은 단지", "total": 12, "items": [ListingSummary] }
     ]
   }
   ```

   `ListingSummary` = `{ id, dealType, assetType, name, dong?, salePrice?, deposit?, monthlyRent?,
presalePrice?, premium?, exclusiveArea?, supplyArea?, floor?, totalFloors?, floorClass?, direction?,
verifiedAt?, agencyCount, coverPhotoUrl? }`. The page shows the first 4 cards per tab on desktop (one
   row of 4, one row of 3 at 901–1180px, 2 × 2 at 721–900px; all of them in the mobile snap list) and
   `total` as the tab count — 4 to 8 items per group are enough. If the backend prefers not to add
   this endpoint, the same data can be assembled from three `GET /listings` calls
   (`complexId=…`, `emdCode=…&areaMin/areaMax`, `emdCode=…&priceMin/priceMax`) — only
   `page.tsx` needs to change.

2. **`POST /listings/:id/view`** → `204`. Public, deduplicated server-side (Redis counter →
   `counters-flush`), and for signed-in users it should upsert `RecentView(LISTING, id)`. The page is
   ISR-cached and fetched anonymously, so the detail GET itself can no longer record who viewed it —
   hence the separate beacon. It is sent with the CSRF header like every mutation; if it should be
   CSRF-exempt (like the banner impression beacon) nothing changes on the client. Signed-out visitors
   additionally get a `localStorage` list (`house:recent-listings:v1`, max 20,
   `features/w-listing/lib/recent.ts`) that other pages may read.

## Assumed payload shapes of existing endpoints

1. **`GET /listings/:id`** → `listingDetailSchema`. Public statuses only (ACTIVE, RESERVED); anything
   else → `404 LISTING_NOT_FOUND`. A malformed id may answer `400` — the page treats 400 and 404 as
   "not found".

   ```jsonc
   {
     "id", "listingNo"?,            // "26-0412" — human-friendly number; falls back to the id's first 8 chars
     "status", "dealType", "assetType", "title"?, "description"?,
     "highlights": ["호수공원 정면 조망"], // optional chips above the description (not in Prisma yet)
     "salePrice"?, "deposit"?, "monthlyRent"?, "presalePrice"?, "premium"?, // 만원; 분양권 total = presalePrice + premium
     "maintenanceFeeWon"?, "maintenanceFeeItems": [], "moveInType"?, "moveInDate"?,
     "floorDisplay", "floorClass"?, "options": ["AIR_CONDITIONER"],
     "publishedAt"?, "updatedAt"?, "verifiedAt"?, "viewCount", "favoriteCount",
     "property": {
       "roadAddress", "jibunAddress"?, "buildingName"?, "dong"?, "emdCode"?, "emdName"?, "lat", "lng",
       "floor"?,                    // MUST be null when floorDisplay = CLASS
       "totalFloors"?, "exclusiveArea"?, "supplyArea"?, "landArea"?, "totalFloorArea"?, "areaTypeId"?,
       "rooms"?, "baths"?, "direction"?, "directionBasis"?, "approvalDate"?, "parkingSpaces"?,
       "heatingType"?, "zoning"?, "landCategory"?, "buildingUse"?
       // never: ho (호수), owner contact, documents
     },
     "complex"?: { "id", "name", "emdName"?, "households"?, "builtYear"?, "approvalDate"?,
                   "parkingPerHousehold"?, "heatingType"?, "avgPricePerPyeong"?,   // 만원/평
                   "areaTypes": [{ "id", "exclusiveArea", "supplyArea"?, "pyeongLabel"? }],
                   "latestTrade"?: { "price", "dealDate", "floor"?, "pyeongLabel"? } },
     "photos": [{ "id", "url", "thumbUrl"?, "caption"?, "isCover" }],             // sorted by sortOrder
     "verifications": [{ "method", "verifiedAt", "note"? }],
     "agencies": [{ "agencyId", "isPrimary", "name", "representativeName", "registrationNumber",
                    "phone", "roadAddress", "addressDetail"?, "logoUrl"?, "specialtyTag"?,
                    "activeListingCount"?, "avgResponseMinutes"?, "contactName"?, "contactPhone"? }], // ACTIVE only, primary first
     "nearby": [{ "category": "SCHOOL|PARK|MART|LANDMARK|TRANSIT|HOSPITAL", "name", "distanceM", "note"?, "lat"?, "lng"? }]
   }
   ```

   - `agencies[]` carries the 공인중개사법 표시·광고 명시사항 of each office (명칭, 소재지, 연락처, 등록번호,
     대표 성명) — all five are rendered on every office card and in the 문의 dialog, so they are
     required fields.
   - `nearby[]`, `highlights[]`, `listingNo`, `complex.avgPricePerPyeong`, `complex.latestTrade`,
     `agencies[].specialtyTag|avgResponseMinutes` have no backend source yet. All are optional: the
     section / chip / figure simply disappears when absent.
   - The facts grid and the "중개대상물 표시·광고 명시사항" list show `확인 필요` for missing mandatory
     items instead of hiding them (the publish validator should make that impossible for ACTIVE listings).

2. **`GET /complexes/:id/stats`** → `{ dealType, areaTypeId, months: [{ yearMonth, tradeCount,
medianPrice, … }] }` (extra keys such as w-complex's `latest` are ignored). **`GET
/complexes/:id/trades`** → pagination envelope of `{ id, dealType, dealDate, exclusiveArea?, floor?,
price?, deposit?, monthlyRent?, cancelled }`. The chart asks for `pageSize=100` and the last 36
   months (`fromYm`); cancelled rows are dropped client-side. Same shapes as
   `features/w-complex/api/schemas.ts`.

3. **`GET /banners?slot=LISTING_SIDE`** → `{ items: [...] }` or a bare array of `{ id, title,
advertiserName?, imageUrl, mobileImageUrl?, linkUrl?, newWindow }` (w-home's shape). The first item
   is shown in the 300×250 side frame (desktop/tablet only — the slot has no mobile size).

4. **Favourites**: there is no "is favourite" flag on the cached detail payload, so signed-in clients
   read the first 100 rows of `GET /me/favorites/listings` and look for the id. A dedicated
   `GET /me/favorites/listings/ids` (or `isFavorite` on an authenticated detail call) would be cheaper;
   only `fetchFavoriteListingIds()` in `api/client.ts` would change. `PUT`/`DELETE` are expected to be
   idempotent and to answer `204` (a JSON body is ignored).

5. **`POST /reports`** → `201` (body ignored). Errors handled: `401` → login redirect that reopens the
   form (`?intent=report`), `400 VALIDATION_FAILED` with `details[].path` in `reason | detail |
reporterPhone` → inline field errors, anything else (e.g. a `429` daily cap) → message shown in the
   form. The client additionally requires ≥ 5 characters of detail for reason `OTHER`.

## Mock resources added by this group

- `mock-api/v1/listings/[id]/route.ts`, `…/[id]/similar/route.ts`, `…/[id]/view/route.ts`
- `mock-api/v1/listings/_detail-fixtures.ts` — detail seeds L01–L08 (+ L11–L20), R01–R06, H01, M01, T01
  from `mockdata.md`. Complex data (ids, coordinates, 평형) comes from w-complex's
  `complexes/_fixtures.ts`; apartment listings generated by `complexes/_listings.ts` are expanded into
  a detail on the fly, so every card on the complex page opens a working detail page.
- `mock-api/v1/listings/mock-photo/[name]/route.ts` — **mock-only** SVG stand-in photos
  (`/mock-api/v1/listings/mock-photo/<scene>-<0..5>`). Real payloads carry `/media/...` URLs.
  `mediaImage()` marks SVG/mock URLs `unoptimized` because the Next image optimizer rejects SVG.
- `mock-api/v1/reports/route.ts` — `POST /reports` (401 without a mock session, CSRF check, zod
  validation; a detail containing `__limit` answers `429 REPORT_DAILY_LIMIT`).

Mock ids: `mockUuid('L01')` is canonical for listings (same as the list/complex mocks);
`mockUuid('listing-L01')` (my-page mocks) and the bare code (`/listing/L01`) are accepted as aliases
and echoed back, so links from every group resolve.

## Behaviour notes for the integrator

- **Rendering**: `/listing/[id]` is ISR (`revalidate = 60`, `generateStaticParams() → []`). The server
  render never reads cookies; viewer-specific state (favourite, session) loads on the client. The route
  deliberately has **no `loading.tsx`**: with a route-level Suspense boundary Next streams a `200` before
  `notFound()` runs, so closed/removed listings would be soft-404s. Without it the on-demand render is
  blocking and a missing listing answers with a real **404** status (verified on a production build);
  cached listings are served in a few ms. Tags used: `listings`, `listing:<id>`, `banners` — call
  `revalidateTag` from a webhook if instant updates after a broker edit are needed.
- **Chrome**: own route group `(listing)` → `<SiteShell mobileHeader={false} tabBar={false}>`; on mobile
  the gallery carries back / share / 관심 and a sticky 문의 bar replaces the tab bar (MobileListing).
- **문의하기**: there is no inquiry/chat backend. "문의하기" opens the office's contact dialog (명시사항 +
  전화 걸기 `tel:` + 문자 보내기 `sms:` with a pre-filled message + 번호 복사). The design's "채팅 문의" label
  was therefore replaced with "문의하기".
- **Auth-gated actions** (관심, 신고): signed-out visitors go to `loginUrl('/listing/<id>?intent=favorite|report')`;
  after login the page resumes the action and strips the param with `history.replaceState`.
- **Kakao share** is a placeholder button (toast) until a Kakao JavaScript key + SDK allow-listing
  exist; link copy and the native share sheet work.
- **JSON-LD**: `RealEstateListing` (+ `BreadcrumbList`) built only from public fields — no 호수, no
  contact details.
- **명시사항 소재지**: the 세부기준 asks for the address down to the 지번 (동 for 공동주택, 호수 may be
  omitted). The row is `property.jibunAddress ?? property.roadAddress` (minus "전라남도") + complex /
  building name + 동, with repeated words dropped. Please send `jibunAddress` in the public detail
  payload when the broker allows it (단독주택 may omit the 지번 at the client's request — then send only
  `roadAddress`). The same `roadAddress` is already shown in the 위치 section header.
- **지도로 돌아가기** (desktop link + mobile back button): when the previous entry of the tab is a `/map/…`
  page, it calls `history.back()` so the map comes back with its URL state (position, zoom, filters);
  otherwise (direct visit, other browsers without the Navigation API) it links to the map centred on
  the listing (`/map/<asset>?c=lat,lng&z=16`).
- **Calculators** (`lib/calc.ts`, unit tested): 중개보수 상한요율 (2021.10 table; 월세 환산, 오피스텔 0.5/0.4%,
  상가·토지 0.9% 협의), 원리금균등 대출, 1주택 취득세. They are estimates and labelled as such; the full
  calculators live under `/tools` (another group).
- **Map**: the mini map uses the shared `MapView` (non-interactive, centred on the listing, zoom
  buttons). The pin is an overlay at the centre, so it is identical for the Naver and the static
  implementation; nearby-place chips are projected with Web-Mercator maths (Naver) or the static
  map's linear projection.

## Known mock-only mismatches (for the consistency pass)

- The my-page mock catalogue (`mock-api/v1/me/_fixtures.ts`) uses `mockUuid('listing-L01')` ids while the
  list / complex / detail mocks use `mockUuid('L01')`. The detail mock accepts both, but
  `PUT /me/favorites/listings/:id` answers `404 LISTING_NOT_FOUND` for the canonical ids and for the
  generated complex listings, so the 관심 toggle shows the error toast (and rolls back) when the page is
  opened from home / map / complex in mock mode. It works when opened from /me (alias ids). Nothing to
  change against the real API.
- `/support`, `/support/ads` and a few other header/footer targets 404 until their groups land (link
  prefetches show up as 404s in the network panel).
