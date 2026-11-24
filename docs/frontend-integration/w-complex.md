# Frontend integration notes — w-complex (단지 상세)

Scope: the complex panel of the map (`/map/apt?complex=<id>`, design `Complex.dc.html`) and the SEO
page `/complex/[id]`. Code: `apps/web/src/features/w-complex/**`, route
`apps/web/src/app/(site)/complex/[id]/**`, dev host `apps/web/src/app/dev/w-complex`, mocks
`apps/web/src/app/mock-api/v1/complexes/**`. See `docs/FRONTEND.md` for conventions.

None of the complexes / listings controllers exist yet (module READMEs + Prisma models only), so
every **payload shape** below is an assumption. Each one is parsed by exactly one zod schema in
`apps/web/src/features/w-complex/api/schemas.ts` — fix the schema and the mock fixture together.
Field names mirror the Prisma models; `Decimal` columns are accepted as numbers or strings.

## Routes

| Route                                | What                                                                                                                                                                             | Rendering                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/complex/[id]`                      | 단지 page: 개요, 평형 정보, 실거래가 (chart + list), 매물 요약, 위치, 주변 단지, 이 단지 중개사무소, COMPLEX_FEATURED_AGENCY ad, JSON-LD (`ApartmentComplex` + `BreadcrumbList`) | Server, ISR 300s (`generateStaticParams` → blocking on-demand render: unknown id → **404**, alias → **308**); listings / banners 60s; client islands |
| `/map/apt?complex=<id>`              | Complex panel in the map's left column                                                                                                                                           | Client — **hosted by w-map** (see "Map page integration")                                                                                            |
| `/dev/w-complex?complex=<id \| C01>` | Dev-only host of the panel + a map with the complex and its neighbours (404 in production)                                                                                       | Client                                                                                                                                               |

## Endpoints used

| Method       | Path                                                                  | Used by                                                           | Backend status                                             |
| ------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| GET          | `/complexes/:id`                                                      | panel, page (server) — 404 **and 400** (malformed id) = not found | in complexes README                                        |
| GET          | `/complexes/:id/stats?dealType&areaTypeId&fromYm&toYm`                | panel 실거래가 card, page chart + 평형 table                      | in README (`/:id/stats`), params + shape assumed           |
| GET          | `/complexes/:id/trades?dealType&areaTypeId&fromYm&toYm&page&pageSize` | page 최근 실거래 list                                             | in README, query = `complexTradesQuerySchema`              |
| GET          | `/complexes/:id/listings?…filters&dong&sort&page&pageSize`            | panel list (infinite), page 매물 section, nearby 분양권 strip     | in README as "summary per deal type" — **extended, see 1** |
| GET          | `/complexes/:id/nearby?limit&radius`                                  | panel 근처 분양권, page 주변 단지 + mini map markers              | **assumed endpoint**                                       |
| GET          | `/complexes/:id/agencies?limit`                                       | page 이 단지 중개사무소, text of the featured-agency card         | **assumed endpoint**                                       |
| GET          | `/banners?slot=COMPLEX_FEATURED_AGENCY&complexId=<id>`                | featured-agency card (panel + page)                               | in ads README (`bannerServeQuerySchema`)                   |
| POST         | `/banners/:id/impression`                                             | card scrolled into view (once per mount)                          | in ads README                                              |
| GET          | `/banners/:id/click` → 302                                            | 문의 button of the card (plain link, `rel="sponsored"`)           | in ads README                                              |
| GET          | `/me/favorites/complexes?pageSize=100`                                | 관심 단지 toggle state (signed-in only)                           | in README; mock owned by w-me                              |
| PUT / DELETE | `/me/favorites/complexes/:id`                                         | 관심 단지 toggle (optimistic, CSRF header)                        | in README; mock owned by w-me                              |

## Assumed endpoints / payload shapes (reconcile when the backend lands)

1. **`GET /complexes/:id/listings` returns the complex's listing list, not only a summary.**
   The README lists it as "(summary per deal type)". The panel needs the paginated list of the
   complex with co-brokering offices per row, so the mock answers
   `{ items, page, pageSize, total, totalPages, summary }`:
   - query: the filter / sort params of `listingListQuerySchema` (`dealTypes`, `priceMin/Max`,
     `depositMin/Max`, `areaMin/Max` in ㎡, `directions`, `floorClasses`, `roomsMin`, `bathsMin`,
     `sort`, `page`, `pageSize`) **plus `dong`** (동 name, not in the shared schema). Default sort =
     `VERIFIED`. `priceMin/Max` restrict 매매·분양권 only, `depositMin/Max` restrict 전세·월세 only (the
     client sends both pairs when no deal type is chosen).
   - `summary`: `{ total, byDealType: [{ dealType, count, priceMin, priceMax, rentMin, rentMax }], dongs: string[] }`
     for the whole complex (not affected by filters). `priceMin/Max` = headline amount (매매가 ·
     분양가+프리미엄 · 보증금), `rentMin/Max` only for 월세.
   - item (`complexListingItemSchema`): `id, dealType, status, assetType, title, salePrice, deposit,
monthlyRent, presalePrice, premium, complexId, complexName, dong, floor (null when
floorDisplay=CLASS), totalFloors, floorClass, floorDisplay, exclusiveArea, supplyArea,
pyeongLabel, rooms, baths, direction, moveInType, moveInDate, verifiedAt, publishedAt,
photoCount, coverPhotoUrl, agencyCount` and - `priceMin`, `priceMax` (optional): lowest / highest 호가 when co-brokering offices advertise
     different prices ("4억 2,000 ~ 4억 3,000 · 중개사무소마다 호가가 달라요" in the design). The
     data model has one price per listing, so this only appears if the backend groups several
     listings of the same property — otherwise the row shows the single price. The row explains a
     range itself ("중개사무소마다 호가가 달라요" is rendered by the client, not taken from `title`). - `agencies[]` (primary first): `agencyId, name, representativeName, phone, roadAddress,
registrationNumber, logoUrl, isPrimary, specialtyTag ("단지 전문"), complexListingCount,
avgResponseMinutes, price`. Public disclosure fields only (`roadAddress` / `registrationNumber` =
     표시·광고 명시사항 shown in the 문의 dialog; optional, rows are omitted when null). If the list cannot embed them, the "중개사무소 N곳" disclosure falls back to a
     link to the listing page; alternatively reuse `GET /listings/:id` → `agencies` (w-listing).
   - If the backend keeps this endpoint summary-only, point `fetchComplexListings` at
     `GET /listings?complexId=<id>&…` (same item fields needed) and read the summary from here.
2. **`GET /complexes/:id/stats`** → `{ dealType, areaTypeId, months: [{ yearMonth, tradeCount,
medianPrice, minPrice, maxPrice, avgPrice, medianMonthlyRent }], latest: TradeRecord[] }`.
   `months` = `ComplexTradeStat` rows of ONE series selected by `dealType` (default SALE) and
   `areaTypeId` (default: the 평형 with most households); this is the same shape w-listing reads.
   `latest` = the latest non-cancelled trade of every 평형 × deal type (the README's "latest trade
   per 평형") — used for the "25평 3억 1,000 26.08" rows and the 평형 table.
3. **`GET /complexes/:id/trades`** → pagination envelope of `{ id, areaTypeId, dealType, dealDate
(YYYY-MM-DD), dealYm, exclusiveArea, floor, price, deposit, monthlyRent, cancelled, contractType }`,
   newest first.
4. **`GET /complexes/:id`** → the `Complex` columns plus `districtName?` ("신대지구", display only),
   `avgPricePerPyeong?` (만원/평), `areaTypes: [{ id, exclusiveArea, supplyArea, typeName,
pyeongLabel, households, rooms, baths }]`, `photos: [{ id, url, caption }]`. 404 →
   `COMPLEX_NOT_FOUND`.
5. **`GET /complexes/:id/nearby`** → `{ items: [{ id, name, assetType, emdName, lat, lng, distanceM,
households, builtYear, activeListingCount, dealCounts: { presale, sale, jeonse, monthly },
representative: { pyeongLabel, price, dealType } | null }] }`, nearest first. Could be replaced
   by `GET /map/search` around the complex if that returns the same fields.
6. **`GET /complexes/:id/agencies`** → `{ items: [{ agencyId, name, representativeName, phone,
logoUrl, specialtyLabel, complexListingCount, avgResponseMinutes }] }`, most listings first.
   `avgResponseMinutes` has no column in the Prisma schema yet — every use is optional.
7. **Served banner** (`GET /banners`) is read as `{ id, slot?, title, advertiserName, agencyId,
pcImageUrl, mobileImageUrl, linkUrl, newWindow, agency? }` (bare array or `{ items }`), i.e. the
   payload w-home's mock serves. The card is text-only: office name / 대표 / "이 단지 매물 N건" /
   "평균 응답 N분" come from `agency` embedded in the banner and from `/complexes/:id/agencies`
   (matched by `agencyId`); missing pieces are simply not shown.
8. **Favorites**: the panel / page heart shares the map page's id cache and mutation
   (`useFavoriteIds('complexes')` / `useToggleFavorite('complexes')` of w-map, key
   `['favorites', 'complexes-ids']`), so hearts never disagree; after a toggle it also invalidates
   `['me-favorites']` (my page) and `['me', 'favorites']`. Items are read as `items[].id` = complex id
   (w-map's schema). `PUT/DELETE` answer 204.
9. **문의 (chat icon) in the co-broker list** opens a dialog with the same anatomy as the listing
   page's contact dialog: the office's 명시사항 (명칭, 소재지, 연락처, 등록번호, 대표), the listing
   number (first 8 id chars, like w-listing), "전화 걸기" (`tel:`) and "문자 보내기" (`sms:` pre-filled
   with the listing number). No backend needed. The office name links to `/agency/<agencyId>`.
10. **Price bands** of the 금액 filter are half-open `[min, max)` and built inside the deal type's
    price range (e.g. 4억 미만 · 4억~4억 5,000 · 4억 5,000 이상); the client sends `priceMax` /
    `depositMax` = upper − 1, so inclusive bounds on the server are correct.

## Mock resources (owned by this group)

- `complexes/_fixtures.ts` — 15 fictional complexes (C01–C08 from mockdata.md + 7 신대지구 neighbours
  drawn on the design map), 평형, deterministic 실거래가 history. Ids are `mockUuid('C01')` …; every
  `complexes/:id/**` handler also accepts the short code (`/complex/C01` redirects to the UUID URL).
  w-listing's detail fixtures import `COMPLEX_SPECS` from here.
- `complexes/_listings.ts` — the inventory of every complex (counts match mockdata.md, the rows of
  the design and L01–L08 are pinned with `mockUuid('L01')` …) and the 8 offices (`mockUuid('B01')` …).
- `complexes/[id]/{route,stats,trades,listings,nearby,agencies}`.
- Not owned here: `complexes/popular` (w-home), `listings/**` (w-home list, w-listing detail),
  `banners/**` (w-home), `me/favorites/**` (w-me).

Known mock inconsistencies between groups (same real-world entity, different fixture):
`GET /listings` (w-home) knows only L01–L08, so a generated row of the panel (`C01-G…`) opens a
listing page that 404s in mock mode; office ids differ between groups (`mockUuid('B01')` here and in
w-home banners, `mockUuid('agency-B01')` in w-listing).

## Map page integration (w-map)

The production host of the panel is `/map/[assetType]` (w-map), which this group must not edit.
w-map currently shows its own lighter `ComplexDetail` for `?sel=<id>&list=1` and ignores `?complex=`.
To show the designed panel there:

```tsx
// apps/web/src/features/w-map/components/MapSearchPage.tsx (left column, complex mode)
import { ComplexPanelSlot, useComplexParam } from '@/features/w-complex';

const { setComplex } = useComplexParam(); // open: setComplex(id) · close: setComplex(null)
// desktop left column (definite height; the panel scrolls inside):
<ComplexPanelSlot fallback={/* existing ComplexPanel / ComplexDetail */} />;
// mobile bottom sheet (fixed-height body): same, default scroll="self", no `sheet` (the host sheet
// already draws the rounded top + handle):
<MobileSheet …><ComplexPanelSlot fallback={complexDetail ?? complexPanel} /></MobileSheet>
```

- `ComplexPanelSlot` renders the panel when the URL has `?complex=<id>` and `fallback` otherwise.
  It needs a box with a definite height and scrolls inside (`scroll="self"`, default — also on
  phones). A host that scrolls itself on phones (map on top, panel below, like `/dev/w-complex`)
  passes `scroll="host"` so the panel grows instead; `sheet` adds the design's rounded top + grab
  handle for such a host.
- Open a complex with `useComplexParam().setComplex(id)` (instead of `sel` + `list=1`) and drop the
  lighter `ComplexDetail` so there is one complex panel. Smoke test to add with the integration:
  `/map/apt?complex=<id>` shows `aside[aria-label$="단지 상세"]`.
- Panel state lives in the query string next to the map state: `complex=<id>` and the `c-…` filter
  params of `PANEL_FILTERS` (`c-deal`, `c-area`, `c-price`, `c-dir`, `c-dong`, `c-floor`, `c-rooms`,
  `c-baths`, `c-sort`, `c-unit`) — no clash with the map's own params.
- Links into the map from this group use `complexMapHref()` →
  `/map/apt?c=<lat,lng>&z=16&sel=<id>&list=1&complex=<id>[&c-deal=…&dealTypes=…]`, i.e. they also set
  w-map's own "selected complex, list open" params and its deal filter, so they already land on the
  right place — with the promised 매매 / 전세 / 월세 filter — before the slot is mounted.
- `complexMarkers()` builds the selected-complex + neighbours markers (see `ComplexMapScreen`, the
  reference composition used by `/dev/w-complex`).
- Not built here (map-side parts of `Complex.dc.html`): the 동 site plan with per-동 buttons and the
  "선택 매물 · 103동" tag, the layer buttons (지적편집도 / 학군 / 실거래가), the MAP_AD pill, scale bar.
  The panel has a 동 filter (`c-dong`) the site plan can drive.

## Behaviour notes

- 관심 단지 while signed out → `loginUrl(currentUrl)`; signed in → optimistic `PUT/DELETE` + toast.
- 실거래가 windows ("최근 1년", 1/3/5년) end at the **current Asia/Seoul month**, not at the newest
  trade: a complex without trades in the last year shows "최근 1년 거래 없음 · 마지막 거래 YY.MM" and
  no delta. The chart uses a calendar axis with gaps for months without trades; windows longer than
  ~2 years are drawn per quarter / half year (median of the monthly medians weighted by trade count).
- 월세 ranges are shown as two ranges ("보증금 3,000 ~ 5,000 · 월 80~90"), never as a paired
  "3,000/90 ~ 5,000/80" that no listing has.
- Panel side content (AD card, 근처 분양권 strip) starts loading with the panel and holds
  same-height placeholders, so the rows never move once shown. Esc inside a row closes its office
  list and refocuses the toggle (panel and page alike).
- 공유 uses the native share sheet when available, otherwise copies the URL.
- The featured-agency card is always labelled "AD", reports its impression once when ≥ 50% visible,
  and renders nothing when no banner is live. On the page it is server-fetched (no layout shift).
- `/complex/[id]` survives partial API failures: only `GET /complexes/:id` is required (404 →
  not-found page, other errors → route error boundary); stats, trades, listings, nearby, agencies
  and banners degrade to their empty states and are refetched on the client where interactive.
- JSON-LD and metadata contain public data only (name, address, coordinates, 세대수, 준공년도).
- Mock mode has no media server, so complexes / listings show the branded placeholder; real photos
  go through `next/image` (`photos[].url`, `coverPhotoUrl`, `logoUrl`).

## Open items owned by other groups

- **w-map** — mount `ComplexPanelSlot` in `MapSearchPage` (see "Map page integration"). Until then the
  designed panel is only reachable at `/dev/w-complex` (404 in production) and `/map/apt?complex=`
  falls back to w-map's `ComplexDetail` via the `sel` / `list` / `dealTypes` params of the links.
- **packages/ui `SegmentedControl`** — the selected item's `box-shadow` overrides the global
  `:focus-visible` ring, so keyboard focus is invisible (WCAG 2.4.7). Fix in the component:
  `.item:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }`. This group draws
  that outline locally (`.cp`, `.host`, `.page` scopes) until then.
- **packages/ui `.sr-only` / chart `DataTable`** — `.sr-only` is `white-space: nowrap`, so the chart's
  visually-hidden data table is as wide as its caption and can widen a phone page (the layout
  viewport grew to 501px at 390). This group lets it wrap inside `.chartWrap`; the shared fix is
  `white-space: normal` for tables (or wrapping the table in an sr-only `div`).
