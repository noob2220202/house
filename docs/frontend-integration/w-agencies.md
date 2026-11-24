# Frontend integration notes — w-agencies (중개사무소 찾기 · 중개사무소 공개 페이지)

Scope: `apps/web` routes `/agencies` and `/agency/[id]`, feature code in
`apps/web/src/features/w-agencies/**`, mock resources listed below. Design reference:
`design/drafts/project/Agents.dc.html` (search screen + profile drawer). The public agency page has
no artboard; it is extrapolated from the drawer and the Listing detail page.

## Routes

| Route          | File                                                    | Rendering                                                                                                                                    |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/agencies`    | `apps/web/src/app/(agencies)/agencies/page.tsx`         | Server-renders the first list page + 읍면동 facet for low-cardinality filters (SEO, `ItemList` JSON-LD), then TanStack Query. See "Caching". |
| `/agency/[id]` | `apps/web/src/app/(agency-detail)/agency/[id]/page.tsx` | Server component with `generateMetadata`, `RealEstateAgent` + `BreadcrumbList` JSON-LD, `notFound()` on 404/400.                             |

Both live in their own route groups because they need a different `SiteShell`: `/agencies` is a
full-height app screen (`fill`, no footer, GNB only and edge to edge like the map screens — trimmed
from outside in `(agencies)/layout.module.css` until `SiteHeader` has a compact variant),
`/agency/[id]` hides the mobile tab bar in favour of its sticky 문의하기 / 전화 bar.

URL state of `/agencies` (same format as `useMapUrlState`): `c` (lat,lng) · `z` · `sel` (agency id,
opens the profile) · `q` · `spec` (APT | ONEROOM | HOUSE | COMMERCIAL | LAND) · `emd` · `open=1` ·
`presale=1` · `sort` (LISTINGS default | RECENT | NAME) · `area` (bbox set by "이 지역에서 다시 검색").
URL state of `/agency/[id]`: `type` (AssetType) · `deal` (DealType) · `sort` (ListingSort) · `page`.

History model of `/agencies`: a search (검색어, 이 지역에서 다시 검색, 조건 초기화) and opening a
profile push one entry; chips, toggles, sort, 지역, map moves and switching offices replace it.
Closing a profile that this session opened steps back (`history.back()`), otherwise it replaces —
the browser's Back never re-opens a profile that was just closed.

Layout: desktop = 420px panel | map | profile drawer over the map's right edge. Tablet (721–1080px)
= 360px panel, the profile covers the panel (master → detail; the panel is `inert` meanwhile) so
the map keeps its full width. Mobile = one column whose DOM order is the visual order: head → map →
profile sheet → list.

## Endpoints used

| Method     | Path                                                                   | Used by                                       | Backend status                                                    |
| ---------- | ---------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| GET        | `/api/v1/agencies?q&emdCode&bbox&specialties&page&pageSize`            | office list (paged, 20) and map markers (100) | listed in agencies README — **response shape assumed** (1)        |
| GET        | `/api/v1/agencies/:id`                                                 | profile drawer, agency page                   | listed in agencies README — **response shape assumed** (2)        |
| GET        | `/api/v1/listings?agencyId&assetTypes&dealTypes&sort&page&pageSize=12` | agency page listing grid                      | listed in listings README (`listingListQuerySchema.agencyId`) (3) |
| GET        | `/api/v1/agencies/regions`                                             | 지역 filter (읍면동 + office counts)          | **assumed** (4) — the filter is hidden when it fails              |
| GET        | `/api/v1/me/favorites/agencies?page&pageSize`                          | 관심 button state                             | **assumed** (5)                                                   |
| PUT/DELETE | `/api/v1/me/favorites/agencies/:id`                                    | 관심 toggle (CSRF header)                     | **assumed** (5)                                                   |

All responses are parsed by the zod schemas in
`apps/web/src/features/w-agencies/api/schemas.ts` — fix the schema and the mock fixture together.

## Blocking integration items

1. **`GET /agencies` extra params** — resolved: `agencySearchQuerySchema` takes `openNow=true`
   (open at request time, Asia/Seoul) and `handlesPresale=true` (has a public 분양권 listing), and
   rows carry `businessHours` + `handlesPresale`. The 지금 영업 중 / 분양권 취급 toggles are always shown
   and sent (the former `AGENCY_API_EXTRAS` flag is gone). The expected behaviour is pinned by
   `apps/web/src/app/mock-api/v1/agencies/agencies.test.ts` and the API e2e
   `apps/api/test/e2e/agencies/search-cover.e2e-spec.ts`.
2. **`/agencies/regions` and `/me/favorites/agencies`** are not in the agencies README — add them
   to the backend plan (or drop 관심 for agencies: only `ProfileActions` depends on it).
3. **문의하기 → this office.** 문의하기 (drawer, agency page, mobile CTA) links to
   `/deal?agencyId=<id>`. **w-deal does not read the param yet**: it should validate it with
   `idSchema`, fetch `GET /agencies/:id` for the name, show a "○○공인중개사사무소에 보내는 요청"
   banner, default `visibility=SELECTED_AGENCIES` + `targetAgencyIds=[id]` (both already in the
   shared deal-request schema) and carry the param through `/deal/sell`, `/deal/find` and the login
   `returnTo`. Until then the agency page copy does not promise direct delivery (it tells the user to
   pick '선택한 중개사' in the request form).
4. **Office map markers.** The shared marker set (`lib/map/types.ts`, `components/map/markers.tsx`)
   has no office kind. The design draws `.mk--office` (30px store-icon badge + name + "매물 46";
   selected = ink with champagne badge), `.odot` (32px white circle with the brand store icon, 8px
   tail) and clusters labelled `+6`. Interim: labelled offices use the complex marker with the
   design's sub-label "매물 {count}", small offices use count pins, clusters show the plain count.
   Ask the map owner for `office` / `officeDot` kinds and a `+n` cluster label, then switch
   `features/w-agencies/lib/markers.ts`.

## Assumed endpoints / payload shapes

1. `GET /agencies` → pagination envelope `{ items, page, pageSize, total, totalPages }` of
   **AgencySummary**:
   `{ id, name, representativeName, registrationNumber, phone, roadAddress, addressDetail?, emdCode?, emdName?, lat, lng, specialties: AssetType[], activeListingCount, logoUrl?, tagline?, topComplexes: [{ id, name }], handlesPresale?, businessHours? }`.
   - Fields not in the `Agency` model yet (all optional, the UI degrades without them): `emdName`
     (join on `regions`), `logoUrl` (public URL of `logoMediaId`), `tagline` ("연향·조례 아파트 전문" —
     falls back to "{specialty} 전문"), `topComplexes` (complexes with the most active listings of the
     office, max 2 shown as "전문 단지"), `handlesPresale` (has an active 분양권 listing).
   - `businessHours` uses the model's JSON `{ mon: { open: "09:00", close: "19:00" }, …, sun: null }`.
   - Extra query params: see "Blocking integration items" (1). The list must only contain
     `APPROVED` offices.
   - The same endpoint feeds the map with `bbox` = viewport (rounded to 4 decimals, span clamped to
     `MAP_MAX_BBOX_SPAN_DEG`) and `pageSize=100`; clustering is done client-side
     (`lib/markers.ts`). If Suncheon ever has more than 100 offices in one viewport, add a dedicated
     `GET /agencies/map?bbox&zoom` returning clusters.
   - `specialties` is sent as CSV; the 원룸·투룸 chip sends `ONEROOM,OFFICETEL` (any-match expected).
2. `GET /agencies/:id` → **AgencyDetail** = AgencySummary +
   `{ mobile?, jibunAddress?, intro?, coverUrl?, approvedAt?, listingCounts: { presale, sale, jeonse, monthly }, listingCountsByAsset: Partial<Record<AssetType, number>>, stats?: { deals30d?, avgResponseMinutes? }, featuredListings: AgencyListing[] (≤ 4), members: [{ displayName, title?, isLicensed, role? }] }`.
   `404 AGENCY_NOT_FOUND` for unknown / non-approved offices (a malformed id `400` is also treated
   as not found). `coverUrl`, `stats` and `featuredListings` have no model yet: cover falls back to an
   illustration, KPI row and 대표 매물 are hidden when absent. `members` = ACTIVE `AgencyMember`s
   (display name, title, 공인중개사 여부 only). `listingCounts` / `listingCountsByAsset` also bound
   the agency page's `?page=` (see "Caching").
3. `GET /listings?agencyId=:id` → pagination envelope of **AgencyListing** = the shared listing
   list item that the map search parses (`features/w-map/api/schemas.ts#listingSummarySchema`), of
   which the agency page reads:
   `{ id, assetType, dealType, title?, complexId?, complexName?, buildingName?, kindLabel?, dong?, emdName?, salePrice?, deposit?, monthlyRent?, presalePrice?, premium?, supplyArea?, exclusiveArea?, landArea?, floor?, totalFloors?, floorClass?, direction?, rooms?, verifiedAt?, coverPhotoUrl?, agencyCount }`
   (amounts in 만원, areas in ㎡ — numbers or Decimal strings; 전세 uses `deposit`; 분양권 headline =
   `presalePrice + premium`; card title = `complexName ?? buildingName ?? title ?? kindLabel ?? emdName`).
   Query params are the ones of `listingListQuerySchema` (`agencyId`, `assetTypes`, `dealTypes` CSV,
   `sort`, `page`, `pageSize=12`). `featuredListings` of (2) use the same item shape.
4. `GET /agencies/regions` → `{ total, items: [{ emdCode, name, count, lat?, lng? }] }` — approved
   offices per 읍면동 (`total` = all approved offices, shown as "순천 등록 N곳"). Must be registered
   before `/:id` in the controller. `lat/lng` (region centroid) let the map jump to the 동.
5. Favourite agencies mirror `/me/favorites/listings`: `PUT`/`DELETE` → `204`, idempotent; `GET` →
   pagination envelope of AgencySummary.

## Caching (server fetches)

- `/agencies` server-renders (and caches, `revalidate 60`) the first list page only for
  low-cardinality filters: chips, toggles, sort and an `emd` that is in the regions facet. Free-text
  `q`, `area` bboxes and unknown `emd` values are fetched by the client only — those URLs are
  canonicalised to `/agencies`, so SSR adds no SEO value and would grow the fetch cache unboundedly.
- `/agency/[id]` redirects `?page=` beyond `ceil(count / 12)` (count from the office's own
  counters for the selected 종류 / 거래) to the first page before fetching, so `?page=9999` is never
  fetched or cached.

## Cross-group links

- 문의하기 → `/deal?agencyId=<id>` (see blocking item 3).
- Listing cards link to `ROUTES.listing(id)`, "전문 단지" chips to `ROUTES.complex(id)`.
- 길찾기 opens `https://map.naver.com/p/search/<road address>` in a new tab.
- Signed-out 관심 → `loginUrl(currentPath)`.

## Mock resources (apps/web/src/app/mock-api/v1)

- `agencies/route.ts` — owned by a-agency (`POST`); this group added the `GET` export, implemented
  in `agencies/_search.ts` (query validated with `agencySearchQuerySchema`, `?_fail=1` → 500).
- `agencies/[id]/route.ts`, `agencies/regions/route.ts`.
- `agencies/listings/route.ts` — **mock-only path** for `GET /listings?agencyId=` (the `listings/`
  mock belongs to another group and has no per-office data). The client switches paths with
  `AGENCY_LISTINGS_PATH` (`/agencies/listings` in mock mode, `/listings` otherwise), like w-map's
  `LISTING_LIST_PATH`. Same query and response contract.
- `agencies/_offices.ts` (41 fictional offices: B01–B08 from `mockdata.md` §4, the six small offices
  drawn on the design map, plus the 석현동 / 신대지구 clusters), `agencies/_catalog.ts`,
  `agencies/_fixtures.ts` (derived payloads; listings generated deterministically so counts add up).
- `agencies/agencies.test.ts` — contract test of the search extras and the office listings.
- `me/favorites/agencies/**` with its own in-memory store (`_store.ts`), auth via w-me's `meGuard`.
- Mock ids: canonical `mockUuid('agency-B02')` (same as the banner mocks). The detail/listings mocks
  also accept `mockUuid('B02')` (used by the listing-detail mock), the raw code `B02`, and the mock
  broker session's agency id `0b6f2c1e-…-b1` (= B01), so links between mock pages resolve.
- Most generated listing ids do not exist in the listing-detail mock (only L01, L03, L04 are
  reused), so those cards 404 in mock mode. Not an issue with the real API.

## Notes for the integrator

- Without `NEXT_PUBLIC_NAVER_MAP_KEY_ID` (or when the SDK fails at runtime) the stylized map is
  used; its initial view is the 조례·연향 area of the design instead of `DEFAULT_MAP_CENTER`. The
  shared `StaticMapView` does not emit `onViewChange` for prop-driven moves (zoom buttons, cluster
  click, 지역, 내 위치), so `/agencies` derives the static map's bounds from the URL view + map size
  (`lib/geo.ts#currentMapBounds`). The shared fix (emit after a prop change) would also help w-map.
- `openNow` and the "영업 중" pill are evaluated in Asia/Seoul. The pill is computed client-side from
  `businessHours`, so a cached page never shows a stale state.
- Shared `MapToolButton` (내 위치) loses its focus ring to its own `box-shadow`; `/agencies` patches
  it locally (`.locate:focus-visible`), the shared component should combine `--focus` with its
  shadow.
