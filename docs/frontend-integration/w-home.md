# Frontend integration notes — w-home (home page + notice popup layer)

Scope: `/` (Main.dc.html / MobileHome.dc.html) and the site-wide notice popup layer.
Code: `apps/web/src/features/w-home/**`, route `apps/web/src/app/(home)/`, mocks under
`apps/web/src/app/mock-api/v1/{banners,popups,home,videos}/**`, `listings/route.ts` (+
`_list-fixtures.ts`) and `complexes/popular/**`.

None of the backend controllers exist yet (module READMEs + Prisma models only), so **every payload
shape below is an assumption**. Each one is parsed by exactly one zod schema in
`features/w-home/api/schemas.ts`; fix the schema and the mock fixture together. The schemas are
lenient on purpose (optional extras, defaults, bare array _or_ `{ items }`), and every block of the
home page fails independently — a broken endpoint blanks one block, never the page.

## Endpoints used

| Method     | Path                                                                | Used by                                             | Backend status                            |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| GET        | `/banners?slot=MAIN_HERO\|MOBILE_MAIN\|MAIN_STRIP`                  | banner carousel / strip (server, revalidate 60 s)   | ads README                                |
| POST       | `/banners/:id/impression`                                           | impression beacon (client)                          | ads README                                |
| GET        | `/banners/:id/click` → 302                                          | banner link `href` (no JS needed)                   | ads README                                |
| GET        | `/popups?page=<PopupPage>`                                          | notice popup layer (client, every page)             | ads README                                |
| GET        | `/complexes/popular?limit=9&assetTypes=APT`                         | "사람들이 자주 찾는 단지" (server + client)         | complexes README (`assetTypes` is extra)  |
| GET        | `/listings?sort=VERIFIED&verifiedOnly=true&pageSize=8[&assetTypes]` | "방금 확인된 실매물" (server + client)              | listings README, `listingListQuerySchema` |
| GET        | `/agencies?pageSize=6`                                              | "함께하는 중개사무소" (server) — mock by w-agencies | agencies README                           |
| GET        | `/videos?pageSize=4`                                                | "동네 소식 · 영상" (server)                         | admin README                              |
| GET        | `/site-settings/public`                                             | app band flag + store links (foundation mock)       | admin README                              |
| GET        | `/search/suggest?q&limit`                                           | hero search autocomplete — mock by w-content        | **assumed** (w-content)                   |
| PUT/DELETE | `/me/favorites/listings/:id`, GET `/me/favorites/listings`          | 관심 매물 heart — mock by w-me                      | listings README                           |
| GET        | `/home/summary`                                                     | hero map, counters, category counts                 | **assumed (new)**                         |
| GET        | `/home/popular-regions?assetTypes&limit`                            | ranking by 지역 / non-apartment tabs                | **assumed (new)**                         |

## Assumed endpoints (do not exist in any backend README)

### `GET /api/v1/home/summary` — public, cacheable (5 min)

Site-wide counters for the hero and the category cards. Nothing here is home-specific business
logic; it can equally be assembled from existing aggregates (`/map/search` REGION_CLUSTERS for
`regions`, admin dashboard counters for the totals).

```jsonc
{
  "regionName": "순천시",
  "listingCount": 3201, // active listings (co-brokered listings count once)
  "agencyCount": 86, // approved offices
  "verifiedTodayCount": 128, // listings whose latest 실매물 확인 is today (KST)
  "assetTypeCounts": {
    "APT": 1284,
    "OFFICETEL": 212,
    "ONEROOM": 724,
    "HOUSE": 312,
    "COMMERCIAL": 248,
    "LAND": 421,
  },
  "regions": [
    // 읍면동 (or 지구) clusters for the hero map chips and the quick-search chips
    {
      "code": "1215033028",
      "name": "신대지구",
      "emdName": "해룡면 신대리",
      "lat": 34.9335,
      "lng": 127.556,
      "listingCount": 318,
      "avgPricePerPyeong": 1180,
    },
  ],
  "updatedAt": "2026-11-23T06:00:00+09:00",
}
```

Every field is optional for the UI: missing counters are simply not printed. Category cards add
`ONEROOM + OFFICETEL` for "원룸·투룸".

### `GET /api/v1/home/popular-regions?assetTypes=<csv>&limit=<1..50>` — public, cacheable

Ranking of 읍면동 by weekly views for one category, with active-listing counts per deal type. Used
by the 지역 toggle of the ranking and by the 원룸·투룸 / 주택 / 상업·업무 / 토지 tabs (only apartments
are grouped into 단지 — `COMPLEX_ASSET_TYPES`).

```jsonc
{
  "items": [
    {
      "rank": 1,
      "rankDelta": 1, // + moved up, − moved down, 0 flat, null = new entry
      "code": "1215011500",
      "name": "석현동",
      "emdName": "석현동",
      "lat": 34.969,
      "lng": 127.483,
      "listingCount": 92,
      "dealCounts": { "presale": 0, "sale": 9, "jeonse": 15, "monthly": 68 },
      "avgPricePerPyeong": 780, // 만원/평 OF THE REQUESTED CATEGORY, nullable (see below)
      "weeklyViewCount": 3406,
    },
  ],
  "updatedAt": "2026-11-23T06:00:00+09:00",
}
```

`avgPricePerPyeong` must be computed for the requested `assetTypes`, and only where Korean
listings are compared per 평: 아파트 (공급 평당 매매가), 토지 (평당가), 상가 (전용 평당). For 원룸·투룸
(보증금/월세) and 주택 send `null` — the UI then drops the "평균 평당가" column and shows the listing
count instead. Never reuse the apartment figure for another category. In 지역 mode the section
title reads "사람들이 자주 찾는 동네".

### `GET /api/v1/search/suggest?q&limit` (owned by w-content)

The hero search field reads `{ items: [{ type: 'REGION' | 'COMPLEX' | 'AGENCY', id, label, description?, lat?, lng? }] }`
and uses only `REGION` (→ map centred on `lat,lng`) and `COMPLEX` (→ `/complex/:id`).

## Assumed payload shapes of documented endpoints

1. **`GET /banners?slot=`** → `{ items: Banner[] }` (a bare array is accepted too), only banners that
   are live now, ordered by `sortOrder`:
   `{ id, slot, title, advertiserName?, agencyId?, agency?: { id, name, representativeName, phone, logoUrl, complexListingCount, avgResponseMinutes } | null, imageUrl, mobileImageUrl?, linkUrl?, newWindow, sortOrder, updatedAt }`.
   - `imageUrl` / `mobileImageUrl` are **public media URLs** of `pcMediaId` / `mobileMediaId`
     (the names match what w-listing and w-complex assume).
   - `linkUrl` only tells the UI whether the banner is clickable; the anchor always points at
     `GET /banners/:id/click`.
   - `advertiserName` is printed by the site as chrome next to the pager of the wide carousel
     (desktop / tablet, design `.ad-adv`) and is part of the link's accessible name
     ("광고: {advertiserName}: {title}") — it does not have to be baked into the image.
2. **`POST /banners/:id/impression`** → `204`. The client sends one call per banner per page view,
   when ≥ 50 % of the slide is on screen (IntersectionObserver), with an empty JSON body `{}` through
   the API client — i.e. **with the CSRF header**. If the tracking endpoints are CSRF-exempt the
   client can switch to `navigator.sendBeacon`; batching (`{ ids }`) is not used yet.
3. **`GET /banners/:id/click`** → `302` to the stored `linkUrl` (site-relative or http(s)). Linked
   with `rel="sponsored"` (+ `noopener noreferrer` and `target="_blank"` when `newWindow`).
   **Security note for the backend:** `isSafeLinkUrl` (packages/shared) accepts `/\evil.example`
   and `/<TAB>/evil.example` as "site-relative", but browsers resolve both to
   `https://evil.example` — the redirect (and `linkUrlSchema` on admin input) must also refuse
   backslashes and control characters. The home popup links and the mock redirect already do.
   3a. **Creatives:** `mobileImageUrl` is served as an art-directed `<source media="(max-width: 720px)">`
   of one `<img>` (a phone never downloads the PC file and vice versa). The first slide of the
   carousel that sits in the first mobile viewport loads eagerly (it is the MobileHome LCP image).
4. **`GET /popups?page=`** → `{ items: Popup[] }` (or bare array), live popups targeting the page or
   `ALL`, in back-office order: `{ id, title, imageUrl, linkUrl?, newWindow, dismissDays, sortOrder, updatedAt }`.
   - `updatedAt` is the popup **version**: "N일 동안 보지 않기" is stored in `localStorage` under
     `house:popup:<id>:<updatedAt>` (value = hide-until epoch ms), so editing a popup shows it again.
     If the backend prefers an explicit `version` integer, change `popupStorageKey()` only.
   - `dismissDays = 0` → only "닫기" is offered. Plain 닫기 hides the popup for the tab session
     (`sessionStorage`).
   - `title` is the accessible name and the image `alt` (the creative is an image).
5. **`GET /complexes/popular?limit`** → `{ items, updatedAt }`, item =
   `{ id, name, assetType, emdName, lat, lng, households, builtYear, rank, rankDelta (null = new), rankStreakWeeks?, weeklyViewCount, dealCounts: { presale, sale, jeonse, monthly }, activeListingCount, salePriceMin, salePriceMax, representativeAreaLabel ("34평"), pricePerPyeong, latestTrade: { price, areaLabel, note? } | null }`.
   - Extra query **`assetTypes`** (CSV) is sent (`APT`); `popularComplexesQuerySchema` only has
     `limit` today — either add it or ignore unknown params.
   - `rankDelta`, `rankStreakWeeks`, `weeklyViewCount` need a weekly ranking snapshot; without them
     the UI shows "–" / hides the "3주 연속 1위" line and the view counter.
   - `latestTrade.note` = `"분양권"` / `"분양가"` when the reference price is not a completed trade.
6. **`GET /listings`** (list item, public fields only — never `ho` or owner contact):
   `{ id, assetType, dealType, status, name, dong, complexId, emdCode, emdName, locationNote, roomType, salePrice, deposit, monthlyRent, presalePrice, premium, exclusiveArea, supplyArea, landArea, floor, totalFloors, floorClass, rooms, baths, direction, builtYear, verifiedAt, publishedAt, agencyCount, photoCount, coverPhotoUrl, lat, lng }`
   in the pagination envelope. Notes:
   - `name` = complex or building name, `dong` = 동 (aliases `title` / `subtitle` are accepted
     because w-me's list schema uses those names — pick one in the backend).
   - 분양권 headline price = `presalePrice + premium` (same as `listings.price_sort`).
   - 평형 on cards = `supplyArea` in 평 (falls back to `exclusiveArea`); decimals may be strings.
   - `floor: null` + `floorClass` when the broker shows 저/중/고 only (`floorDisplay = CLASS`).
   - `locationNote` ("순천대 정문 도보 6분") and `roomType` ("투룸") are not columns today — they
     could come from `Listing.title` / `Property.rooms`.
7. **`GET /agencies`** — the strip reads `{ id, name, representativeName, specialties, tagline?, activeListingCount, logoUrl?, stats?: { deals30d?, avgResponseMinutes? } }`.
   The design shows "매물 62 · 30일 거래 14 · 평균 응답 12분". The two activity stats are printed
   only when the list item carries them — as the same `stats` object the agency **detail** already
   assumes (w-agencies), or flat as `recentDealCount` / `avgResponseMinutes`
   (`agencyStats()` in `api/schemas.ts` reads both). They are not in the model yet, and the
   w-agencies **list** mock does not send them, so in mock mode the home strip shows "매물 N" only.
   The six offices are simply the first page of the default order (most active listings first);
   if the operator should curate them, add a flag/sort to the endpoint and tell us the param.
8. **`GET /videos`** — `local_videos` columns plus three optional display extras
   `durationSeconds`, `viewCount`, `channelName` (would need a YouTube Data API sync). Without them
   the duration chip and the view count are omitted. When `thumbnailUrl` is null the client falls back
   to `https://i.ytimg.com/vi/<youtubeVideoId>/hqdefault.jpg`.
9. **`GET /site-settings/public`** — the app band is rendered only when `FEATURES.appBand === true`
   **and** a new optional key `APP_LINKS: { iosUrl?, androidUrl? }` has at least one safe URL.
   `APP_LINKS` is not a `SiteSettingKey` yet.

## Banner slots vs. the design frames (needs a decision)

`BANNER_SLOT_SPECS` (packages/shared) says `MAIN_HERO` = 1920 × 520 (mobile 750 × 560), while the
approved design and `@house/ui` `AdFrame` use **1240 × 220** (upload 2480 × 440) on desktop and
**358 × 160** (1074 × 480) on mobile for the main banner. The home page follows the design frame
and renders the image with `object-fit: cover`, so a 1920 × 520 upload is cropped top and bottom.
`MAIN_STRIP` is rendered at 1200 × 120 (mobile 750 × 200), matching the shared spec. Align
`BANNER_SLOT_SPECS.MAIN_HERO` (and the admin upload validation) with the design ratio, or tell us to
switch the frame.

Slot usage on `/`: desktop carousel = `MAIN_HERO`; mobile carousel = `MOBILE_MAIN` when that slot has
live banners, otherwise the `MAIN_HERO` banners with their `mobileImageUrl`; `MAIN_STRIP` sits
between the 내놓기·구하기 band and the videos (the design has no strip — hidden when the slot is empty).

## Notice popup layer on other pages

`<NoticePopupHost />` is mounted once in `apps/web/src/app/layout.tsx` (one import + one element)
and maps the pathname to the popup target (`features/w-home/lib/popup.ts`, unit tested):

| Path                                                                    | `page`                  |
| ----------------------------------------------------------------------- | ----------------------- |
| `/`                                                                     | `MAIN`                  |
| `/map/**`                                                               | `MAP`                   |
| `/complex/**`                                                           | `COMPLEX_DETAIL`        |
| `/listing/**`                                                           | `LISTING_DETAIL`        |
| `/agencies`                                                             | `AGENCY_LIST`           |
| `/deal/**`                                                              | `DEAL_REQUEST`          |
| any other site page                                                     | `ALL` (ALL-page popups) |
| `/agent/**`, `/login`, `/signup`, `/auth/**`, `/maintenance`, `/dev/**` | none (no request)       |

Popups are shown one at a time (modal, focus-trapped, Esc / scrim = 닫기) in back-office order,
with a "2 / 3" queue counter (spoken as "공지 3개 중 2번째"). The creative link follows only
http(s) or site-relative URLs without backslashes / control characters.
`?popup=off` suppresses the layer outside production (and in mock mode) for clean screenshots.

## Dev-only route

`/dev/w-home` (404 in a production build) renders the home blocks that only appear when the
operator configured them — today the app download band, because the mock site settings keep
`FEATURES.appBand` off. Use it to check the band against Main.dc.html `.app`.

## Mock-only routes and fixtures

- `GET /mock-api/v1/banners/creative/<key>-(pc|mobile).svg`, `…/popups/creative/<key>.svg`,
  `…/videos/thumb/<key>.svg` — stand-in SVG images in the advertiser's palette (the real API returns
  media URLs of uploaded images). They are rendered `unoptimized` by `next/image`
  (`features/w-home/lib/media.ts`: only `/media/**` and `NEXT_PUBLIC_MEDIA_HOSTS` go through the
  optimizer).
- `videos/_fixtures.ts` stores each video's age in days; `publishedAt` is derived per request so
  the relative labels ("3일 전", "1주 전") match the design whenever the mock is opened.
- Banner creatives: `CreativeSpec.mobile` lets a banner use another palette for its mobile image
  (AD-01 is ink on mobile like MobileHome, burgundy on desktop like Main).
- `banners/_fixtures.ts` has one live sample for **every** slot (MAP_AD, COMPLEX_FEATURED_AGENCY,
  LISTING_SIDE, AGENCY_SEARCH_TOP too) plus a scheduled and a paused row that must never be served.
- `popups/_fixtures.ts`: `PP-01` (MAIN, 7 days) is live; `PP-02` (MAP / LISTING_DETAIL /
  DEAL_REQUEST) is **paused** so other groups' screens stay clean — flip `paused` to see the layer
  there; `PP-03` (ALL) is scheduled.
- Id conventions follow the owners of the detail pages: listings `mockUuid('L01')` (w-listing),
  complexes `mockUuid('C01')` (w-complex), agencies `mockUuid('B01')`. **Known mismatch**: w-me's
  favorites mock keys listings as `mockUuid('listing-L01')`, so the heart on home cards answers
  `404 LISTING_NOT_FOUND` for a signed-in mock user until the ids are unified.
- `complexes/popular` rank 9 "연향들 더 퍼스트" (`mockUuid('C09')`) has no detail fixture.

## Routing assumptions

- Map links: `/map/<slug>?c=<lat>,<lng>&z=<zoom>` (foundation URL state) plus `deal=<DealType>` for
  the hero deal pills and `complex=<id>` for "매물 N건 보기" (w-complex panel). Confirm the filter
  param names with w-map.
- Free-text search submits to `/search?q=…[&deal=…]` (w-content); video cards link to
  `/videos?v=<id>`; agency cards to `/agency/<id>`; 내놓기 / 구하기 to `/deal/sell` / `/deal/find`.
- The home route lives in its own route group `src/app/(home)/` (layout = default `<SiteShell>`,
  URL unchanged) and deliberately has **no `loading.tsx`**: with a route-level loading boundary
  React emits a page this size as "skeleton + `<div hidden>` segment + inline swap script" even in
  the static (ISR) HTML, so the hero would be hidden markup for non-JS crawlers and LCP would wait
  for the whole document. Without the boundary the HTML carries the content in document order.
  The same applies to every SEO page under `(site)/` because of `(site)/loading.tsx` — see the
  open issue reported to the lead.

## Responsive behaviour

Breakpoints follow the drafts: ≤ 720px = MobileHome, ≥ 1101px = Main. In between (tablets, small
laptops — no artboard) the page keeps Main's own rule of stacking the hero and the ranking, plus a
few refinements so no row ends with an orphan card: categories 3 + 2, three listing cards while
three columns fit (2 × 2 below 898px), videos side by side down to 901px and "featured + row of
three" below, the 내놓기 / 구하기 cards side by side from 908px, and no arrows on the banner (swipe or
the pager's "next" button, as on mobile).

## Caching

The page is ISR (`revalidate = 60`); blocks cache 60 s (banners, listings) or 300 s (summary,
ranking, videos, agencies, settings) with tags `banners`, `listings`, `complexes`, `videos`,
`agencies`, `home`, `site-settings`. If the back-office should publish instantly, call
`revalidateTag` from a webhook (not wired). Note: a production build made while the API is down
prerenders the home page with empty server blocks; the ranking and listings then load on the client
and everything refreshes on the first revalidation.
