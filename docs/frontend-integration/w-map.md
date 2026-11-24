# Frontend integration notes — w-map (map search, `/map/[assetType]`)

Scope: `apps/web/src/app/(map)/**`, `apps/web/src/features/w-map/**`, mock resources
`apps/web/src/app/mock-api/v1/{map,regions}/**`. See `docs/FRONTEND.md` for conventions.

Routes: `/map` → redirects to `/map/apt`; `/map/apt` (아파트·분양권), `/map/oneroom`, `/map/house`,
`/map/commercial`, `/map/land`. Unknown asset types 404 (`dynamicParams = false`).

## URL state (shareable, Back-button friendly)

Everything lives in the query string; filters use **the API parameter names**, so a URL reads like
the request it produces:

```
/map/apt?c=34.9197,127.5795&z=16&sel=<complexId>&dealTypes=SALE,PRESALE&priceMax=50000&areaMin=99.17
```

| Param                                                                                           | Meaning                                                                    |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `c`, `z`                                                                                        | map centre `lat,lng` and zoom (replaceState while panning)                 |
| `sel`                                                                                           | selected complex id (아파트) or listing id (other asset types) — pushState |
| `list=1`                                                                                        | 아파트: the selected complex's listings are open in the side panel         |
| `assetTypes`, `dealTypes`, `priceMin/Max`, `depositMin/Max`, `rentMin/Max`, `areaMin/Max`       | filters, 만원 / ㎡ (`listingFilterSchema`)                                 |
| `roomsMin`, `bathsMin`, `directions`, `floorClasses`, `builtYearMin/Max`, `options`             | 〃                                                                         |
| `verifiedOnly=1`                                                                                | 〃                                                                         |
| `roomTypes`, `landZones`, `landCategories`                                                      | **assumed** filters (see below)                                            |
| `sort`, `tab` (popular/recent/favorite), `unit` (pyeong/sqm), `view` (card/list), `layer=trade` | view options (never sent as filters)                                       |

Unknown enum values, negative numbers and filters an asset type does not use are dropped before the
request (`toApiFilters`), so a hand-edited URL cannot cause a 400.

## Endpoints used

| Method     | Path                                                       | Used for                                                                     | Backend status                                |
| ---------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| GET        | `/api/v1/map/search?bbox&zoom&…filters`                    | clusters / markers for the visible bounds                                    | listed in listings README (no controller yet) |
| GET        | `/api/v1/listings?bbox&…filters&sort&page&pageSize`        | side list (other asset types), listings at one point (selected building)     | listed in listings README                     |
| GET        | `/api/v1/listings?complexId&…filters&sort&page&pageSize`   | 아파트: listings of the selected complex (side panel / mobile sheet)         | listed in listings README                     |
| GET        | `/api/v1/complexes/popular?limit`                          | "자주 찾는 단지" tab                                                         | listed in complexes README                    |
| GET        | `/api/v1/complexes/:id`                                    | position of a complex when a list row is selected (only `id, lat, lng` read) | listed in complexes README                    |
| GET        | `/api/v1/me/favorites/complexes`, `/me/favorites/listings` | "관심 단지" tab, heart states (ids)                                          | listed in READMEs                             |
| PUT/DELETE | `/api/v1/me/favorites/{complexes\|listings}/:id`           | heart toggles (CSRF header)                                                  | listed in READMEs                             |
| GET        | `/api/v1/banners?slot=MAP_AD[&regionCode][&complexId]`     | map ad card (rotation, targeting)                                            | listed in ads README                          |
| POST       | `/api/v1/banners/:id/impression`                           | once per banner per page load, when the creative is drawn                    | listed in ads README                          |
| GET        | `/api/v1/banners/:id/click`                                | ad click-through (302)                                                       | listed in ads README                          |
| GET        | `/api/v1/agencies/:id`                                     | office behind an agency-type map ad (text card)                              | agencies module                               |
| GET        | `/api/v1/search/suggest?q&limit`                           | search field autocomplete (regions, complexes)                               | **assumed** by the search page group          |
| GET        | `/api/v1/regions?sggCode`                                  | breadcrumb + region picker                                                   | **assumed** (this group)                      |

Query conventions: `bbox=swLng,swLat,neLng,neLat` (rounded to 4 decimals, span clamped to
`MAP_MAX_BBOX_SPAN_DEG`), arrays as CSV, `zoom` may be fractional (static map uses 0.5 steps).

## Assumed endpoints

### `GET /api/v1/regions?sggCode=46150` (new)

읍면동 / 지구 of the city with a representative point. Used by the map breadcrumb (the "current"
region is the closest centre within 2.5 km when zoom ≥ 14) and its picker.

```jsonc
{
  "items": [
    {
      "code": "4615033028",
      "name": "신대지구",
      "parentName": "해룡면",
      "lat": 34.9215,
      "lng": 127.58,
    },
  ],
}
```

A bare array is accepted too. If the backend prefers reverse geocoding (`/regions/locate?lat&lng`),
only `useRegions` / `nearestRegion` in `features/w-map` change.

### Search suggestions on the map (`GET /api/v1/search/suggest`, assumed by the search group)

The map's search field accepts `REGION` suggestions (plus `COMPLEX` on the 아파트 map) and flies to
their `lat/lng`; its copy promises only that ("동네 이름 (예: 석현동, 조례동)"). Searching 학교 / 역 /
건물 (the OneRoom design's "순천대, 순천역") needs new suggestion types — e.g. `POI` and `BUILDING`
items carrying `lat, lng` — after which they only need adding to `types` in `MapSearchPage.tsx` and
the placeholder in `config/assets.ts`. The field empties once the map leaves the picked place
(panned away, selection closed, browser Back).

### Assumed filter parameters (not in `listingFilterSchema` yet)

| Param            | Values (CSV)                                                                                     | UI                     |
| ---------------- | ------------------------------------------------------------------------------------------------ | ---------------------- |
| `roomTypes`      | `ONE_ROOM`, `ONE_HALF_ROOM`, `TWO_ROOM`, `THREE_ROOM_PLUS`                                       | 원룸·투룸 "방" filter  |
| `landZones`      | `RESIDENTIAL`, `COMMERCIAL`, `INDUSTRIAL`, `GREEN`, `MANAGEMENT`, `AGRICULTURAL`, `CONSERVATION` | 토지 "용도지역" filter |
| `landCategories` | `DAE`, `JEON`, `DAP`, `GWASUWON`, `IMYA`, `JAPJONGJI`, `ETC`                                     | 토지 "지목" filter     |

The enums live in `features/w-map/api/schemas.ts` (`RoomType`, `LandZone`, `LandCategory`) until
they move to `@house/shared`. The listing payload carries the matching fields `roomType`,
`landZone`, `landCategory`.

### Filter semantics the UI relies on

- `priceMin/Max` constrain **매매·분양권** listings only (분양권 = 분양가 + 프리미엄);
  `depositMin/Max` constrain **전세·월세**; `rentMin/Max` constrain **월세**. Listings of other deal
  types pass (so "매매 3억 이하 + 전세 2억 이하" shows both). Same rule as the complex listings mock.
- `areaMin/Max` (㎡) apply to **공급면적** for complex assets (아파트·오피스텔 — people filter by 평형),
  전용면적 otherwise, 토지면적 for land. The UI edits the range in 평 or ㎡ and always sends ㎡.
- `options` = listing must have **all** listed options. "풀옵션" = `AIR_CONDITIONER,REFRIGERATOR,WASHER`.
- "단기" (short-term rent, drawn on the OneRoom design) has no `DealType` → not offered.

## Assumed response shapes

Schemas: `apps/web/src/features/w-map/api/schemas.ts` (zod, tolerant — unknown fields ignored,
`Decimal` strings coerced). Fix the schema and the mock fixture together.

Values this group **assumed** (`roomType`, `landZone`, `landCategory`, the whole `summary` object and
each of its fields) are parsed leniently: an unknown value (`'TWOROOM'`, a Korean label) becomes
`null` for that field instead of failing the page. Enums that come from `@house/shared`
(`assetType`, `dealType`, `options`, …) stay strict.

### `GET /map/search`

```jsonc
{
  "kind": "REGION_CLUSTERS | GRID_CLUSTERS | MARKERS", // mapResultKindForZoom(zoom)
  "clusters": [
    {
      "id": "4615012100",
      "name": "연향동",
      "regionCode": "4615012100",
      "lat": 34.947,
      "lng": 127.53,
      "count": 412,
    },
  ],
  // grid clusters: id = cell key, name/regionCode = null, lat/lng = centroid
  "markers": [
    {
      "type": "COMPLEX",
      "id": "<complexId>",
      "name": "신대 레이크파크 1단지",
      "lat": 34.9215,
      "lng": 127.58,
      "count": 38, // listings matching the filters
      "counts": { "presale": 0, "sale": 38, "jeonse": 12, "monthly": 6 }, // all active listings
      "representative": {
        "pyeongLabel": "34",
        "supplyArea": 112.4,
        "price": 44000,
        "dealType": "SALE",
      },
      // + the complex card fields used by the popover: emdName, districtName, households, builtYear,
      //   moveInYm, salePrice{min,max}, jeonsePrice, presalePrice, pricePerPyeong,
      //   latestTrade{price, pyeongLabel, dealYm, delta}
    },
    {
      "type": "LISTING",
      "id": "<representative listingId>",
      "lat": 34.9706,
      "lng": 127.4893,
      "dealType": "MONTHLY",
      "deposit": 500,
      "monthlyRent": 42,
      "salePrice": null,
      "count": 4, // matching listings at the same point (building) → "+3"
      "title": "해오름빌",
    },
  ],
  "total": 318, // listings matching the filters inside the bbox
  "truncated": false, // marker list cut at MAP_MAX_MARKERS
  "summary": {
    "listingCount": 318,
    "complexCount": 9,
    "avgPricePerPyeong": 1180,
    "avgDeposit": 500,
    "avgMonthlyRent": 38,
  },
}
```

- Complex assets (APT / OFFICETEL) come back as `COMPLEX` markers, everything else as `LISTING`
  markers grouped by coordinates. The popover of a complex is drawn from the marker payload alone
  (no extra request per click), hence the embedded card fields. All of them are optional.
- `summary` is optional as a whole and per field; the dark pill hides what is missing.
  `listingCount` = listings of the asset type in the bbox **before** the other filters ("매물 318 ·
  조건 일치 160").
- **Grid cells.** Requested for the backend: `GRID_MAX: 14` (the MapApt design shows complex markers
  around Naver zoom 15), and when a grid cell holds a single complex or a single building, return
  that `COMPLEX` / `LISTING` marker instead of an anonymous bubble. Until then the frontend sends
  `zoom=12` (named 동 clusters) for every city view up to zoom 13 (`CITY_VIEW_MAX_ZOOM`), and one
  click on any bubble jumps straight to marker zoom (`GRID_MAX + 1`), never bubble → bubble.
- **Price pills** are decluttered client-side: `LISTING` markers whose anchors fall within 72 × 28 px
  of each other at the current scale are drawn as one pill on the cheapest ("500/38 +4",
  `groupListingMarkers`). Selecting it lists the whole group through `GET /listings?bbox=<box around
the group members ±2 m>&…filters`.
- **Marker prices** print 억 with two decimals, truncated, never rounded up (2억 9,500 → "2.95억",
  4억 4,000 → "4.4억"): a pin must not show more than the asking price.

### `GET /listings` item (card)

Superset of the cards used by the my-page / complex groups: `id, assetType, dealType, status,
title (broker headline), complexId, complexName, buildingName, dong, kindLabel, pyeongLabel, emdName,
locationNote, lat, lng, salePrice, deposit, monthlyRent, presalePrice, premium, exclusiveArea,
supplyArea, landArea, floor (null when the broker shows 저/중/고 only), totalFloors, floorClass,
direction, rooms, baths, roomType, builtYear, landZone, landCategory, maintenanceFeeWon, options[],
verifiedAt, publishedAt, agencyCount, photoCount, coverPhotoUrl, sameBuildingCount, isFavorite?`
inside the standard pagination envelope. Never 호수 or owner contact.

- `lat/lng` on list items let a card find its marker; `sameBuildingCount` feeds "같은 건물 다른 방 +N".
- The selected-building preview asks `GET /listings?bbox=<±2 m around the marker>&…filters` — no
  dedicated endpoint needed.

### `GET /complexes/popular`, `GET /me/favorites/complexes` item

`id, name, emdName, lat?, lng?, households, builtYear, moveInYm?, counts{presale,sale,jeonse,monthly},
pricePerPyeong, salePrice{min,max}?, latestTrade?, coverPhotoUrl?`. The parser also accepts the names
other groups assumed (`dealCounts`, `salePriceMin/Max`, `latestTrade.areaLabel`) and both a bare
array and `{ items }`.

### `GET /banners?slot=MAP_AD`

Same shape as the home page group: `{ items: [{ id, title, advertiserName, agencyId, pcImageUrl,
mobileImageUrl, linkUrl, newWindow }] }` (`imageUrl` also accepted). With `agencyId` the card is the
design's text card built from `GET /agencies/:id` (`name, representativeName, roadAddress, phone,
tagline, activeListingCount, stats{deals30d, avgResponseMinutes}`); otherwise the image creative is
shown. Targeting parameters: `regionCode` (the 동 in view, REGIONS) and `complexId` (the selected
complex on the 아파트 map, COMPLEXES) — both listed in the ads README
(`GET /api/v1/banners?slot&regionCode&complexId`).

- **Rotation.** All live banners of the slot get shown: each page view starts on the next one
  (`sessionStorage` counter `house:map-ad-rotation:v1`, modulo the number of banners) and the card
  moves on every 9 s (`AD_ROTATE_MS`), paused while hovered / focused / expanded, in a background
  tab, and for `prefers-reduced-motion`. The next agency is prefetched so the card swaps in one piece.
- **Closing** closes the whole slot for the browser session (`house:map-ad-closed:v2`), not just the
  banner on screen.
- **Impressions**: `POST /banners/:id/impression` at most once per banner per page load, and only
  when the creative is actually drawn — the full card, or the pill once expanded. The collapsed pill
  (mobile, short or narrow maps: advertiser name only) is a teaser and is not counted; clicks are
  counted by `/banners/:id/click` as usual. The previous answer stays on screen while a new target
  loads (`keepPreviousData`), so moving to another 동 neither blinks the card nor re-counts it.

## Mock-only routes (no backend counterpart)

- `GET /mock-api/v1/map/listings` — **same query and response contract as `GET /listings`**, backed by
  the full map fixtures (all five asset types, ~560 listings). The `listings/` mock resource is owned
  by another page group and serves a 14-row sample, which cannot back a map list. The switch is one
  constant: `LISTING_LIST_PATH` in `features/w-map/api/queries.ts` (`/map/listings` in mock mode,
  `/listings` otherwise). When the mock data is consolidated, point `listings/route.ts` at
  `map/_fixtures.ts` (`LISTINGS`, `matchesFilter`, `sortListings`) and delete the route + constant.
- `?_fail=1` on `/map/search`, `/map/listings` answers 500 (error states); `?_delay=ms` as usual.

## Mock fixtures

`mock-api/v1/map/_fixtures.ts` (owned by w-map, importable by others):

- 아파트 = the w-complex inventory (`complexes/_fixtures.ts`, `complexes/_listings.ts`) → ids, counts
  and coordinates match `/complex/[id]` and `GET /complexes/:id/listings`.
- 원룸·투룸 = mockdata §3 (R01–R06, ids `mockUuid('R01')`…) + generated rooms per building;
  주택 / 상업·업무 / 토지 = seeded samples per 동. `REGIONS` = 13 동/지구 with centres.

Known mock inconsistencies between page groups (data only — the code paths are the real ones):

1. `complexes/popular` (home group) and `search/suggest` carry their own coordinates for C01–C08,
   different from the complex fixtures. The map therefore resolves a selected row through
   `GET /complexes/:id` first and only falls back to the row's coordinates.
2. `me/favorites/*` (my-page group) uses other ids (`mockUuid('complex-C01')`, `listing-L01`) and
   validates against its own 8 complexes / 14 listings → favouriting most map items answers 404 in
   mock mode (the UI rolls back and shows the error toast), and "관심 단지" rows cannot be located.
3. Listing detail mocks exist only for the pinned seeds (L01–L08, R01–R06…); generated listings 404
   on `/listing/[id]` in mock mode.
4. `me/recent-views` only tracks listings in the mock; "최근 본 단지" is kept in `localStorage`
   (`house:recent-complexes:v1`, written when a complex is selected on the map — works signed-out).
   The complex page may push to the same key (`pushRecentComplex` in `features/w-map/lib/storage.ts`).

## Behaviour notes for the integrator

- **Map implementations.** `MapView` picks Naver when `NEXT_PUBLIC_NAVER_MAP_KEY_ID` is set. The
  static fallback does not report programmatic moves, so in static mode the page derives the bounds
  from the URL view (`staticViewBounds`); with Naver it uses the bounds of `onViewChange`. Popovers
  are placed by projecting lat/lng through the visible bounds (works for both).
- **Zoom bands** follow `MAP_ZOOM` (≤ 12 region clusters, ≤ 15 grid clusters, ≥ 16 markers), except
  that city views up to zoom 13 ask for `zoom=12` (named 동 bubbles, as on the designs) — see "Grid
  cells" above for the requested backend change.
- **Layers.** 실거래가 is implemented client-side (markers print `latestTrade`). 지적편집도 / 학군 /
  통학 도보권 / 편의시설 / CCTV need SDK layers or data that `MapView` does not expose; the two apartment
  buttons announce "준비 중", the 원룸 layer panel is not rendered.
- **Desktop chrome degrades with the map size** (`MapSearchPage.tsx` constants): below 700 px of map
  height the ad card folds into a pill (expanding opens the card beside the tool column), below 480
  px the layer panel folds into one 레이어 button, below 720 px of map width the ad pill moves under
  the breadcrumb and the summary pill drops its title / trailing stats, and a side panel narrower
  than 480 px lists rows instead of photo cards. Zoom and my-location stay on screen at 1366×650,
  1280×720, 1536×730 (checked). The filter bar scrolls only its chip strip (edge fades + arrow
  buttons); 초기화 and the 평/㎡ switch never move.
- **Mobile map.** The map element always spans the whole page; the bottom sheet lies over it, so the
  map container never resizes when the sheet moves (map SDKs do not follow container resizes
  reliably). Selections, search picks and my-location are centred in the band between the floating
  search and the sheet (`centerForTarget`), queries cover only that band (`cropBottom`), and the city
  view without a `c` parameter is shifted into it once on landing. Sheet stops: peek 112 px, half
  `max(112px, min(56%, 100% - 340px))` (always leaves ~170 px of map), full `100% - 124px`; pages
  shorter than 620 px open at peek. A tapped price pill lists its rooms in a "선택한 위치의 매물" block
  at the top of the sheet (the list below leaves them out). The expanded MAP_AD lowers the sheet to
  peek and sits above the floating buttons.
- **My location** is honoured within 25 km of the city centre (`DEFAULT_MAP_CENTER`); outside it
  the page says "현재 위치가 순천 밖이에요" and does not move. Inside, the map flies there and draws a
  "내 위치" dot.
- **Keyboard.** The selection popover is a non-modal dialog: it takes focus when opened from a marker
  or list row, Escape (or its close button) closes it and returns focus to the opener.
- **Naver path — verify with a real key before launch** (`NEXT_PUBLIC_NAVER_MAP_KEY_ID`):
  `/map/apt` and `/map/oneroom` at 1440 and 390 — a marker click must not also deselect through
  `onMapClick` (the page waits 60 ms for that), popover placement, sheet stops, bbox refetch after
  pans, the mobile landing shift. `NaverMapView` (foundation) has no `ResizeObserver` →
  `map.autoResize()`; the w-map page no longer resizes the map on sheet moves, but desktop window
  resizes still depend on it.
- **SEO.** Each asset type has its own title / description / canonical (bare path — query variations
  canonicalise to it) and BreadcrumbList JSON-LD. The interactive screen is client-rendered inside
  Suspense (URL state); the fallback is a layout-matched skeleton with the page heading.
- **Auth.** Hearts and the 관심 단지 tab need a session; signed-out users go to
  `loginUrl(<current map URL>)` and return to the same view.
