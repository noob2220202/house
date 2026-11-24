# Home module (`apps/api/src/modules/home`)

Public discovery endpoints the site calls outside one listing / 단지 / office, plus two small pieces
of per-user data. Added for the frontend integration (INTEGRATION_PLAN WI-8): every path, query, body
and response follows the web mock handlers (`apps/web/src/app/mock-api/v1/{home,search,geo,policies,me}/**`)
and the zod schemas that parse them (DECISIONS "Source of truth" #2). Contract schemas live in
`dto.ts` / the services until they move to `@house/shared`.

Registered in `AppModule` (`HomeModule`). Reads listing / 단지 data only through services exported by
the listings (`ListingRegionStatsService`, `ListingViewsService`, `ListingRegionNamesService`) and
complexes (`RegionsService`, `ComplexSearchService`, `ComplexPopularityService`) modules.

## Endpoints

All paths are under `/api/v1`.

| Method             | Path                                                                  | Auth                 | Notes                                                                             |
| ------------------ | --------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| GET                | `/home/summary`                                                       | Public               | counters + 지역 현황; Redis 2 min                                                 |
| GET                | `/home/popular-regions?assetTypes&limit`                              | Public               | 지역 ranking by this week's listing views; Redis 2 min                            |
| GET                | `/search/suggest?q&limit`                                             | Public               | 지역 → 단지 → 중개사무소; `popular` keywords; Redis 1 min                         |
| GET                | `/geo/geocode?query`                                                  | User (30/min)        | Naver geocoding proxy, service region only; 503 without keys; Redis 24 h          |
| GET                | `/policies/:slug`                                                     | Public               | version in force; 404 `NOT_FOUND` "정책 문서를 찾을 수 없습니다." until published |
| GET · POST         | `/admin/policies?slug&page` · `/admin/policies`                       | Admin `TERMS_MANAGE` | versions (drafts editable, published immutable); audited                          |
| GET · PATCH/DELETE | `/admin/policies/:id`                                                 | Admin `TERMS_MANAGE` | PATCH / DELETE drafts only (409 once published)                                   |
| POST               | `/admin/policies/:id/publish`                                         | Admin `TERMS_MANAGE` | idempotent; bumps the public cache                                                |
| GET · PUT/DELETE   | `/me/favorites/agencies?page&pageSize` · `/me/favorites/agencies/:id` | User                 | PUT/DELETE idempotent → 204; 404 `AGENCY_NOT_FOUND` for non-approved offices      |
| GET · PUT          | `/me/interest-regions`                                                | User                 | `{ regionKeys, notify }`                                                          |

### Shapes

- `GET /home/summary` → `{ regionName, listingCount, agencyCount, verifiedTodayCount,
assetTypeCounts{APT…LAND}, regions[{ code, name, emdName, lat, lng, listingCount,
avgPricePerPyeong }], updatedAt }`. Counts = public listings (광고중/계약중, approved primary office)
  in `REGION_SGG_CODE`; `agencyCount` = approved offices; `verifiedTodayCount` = 실매물 확인 since KST
  midnight. `regions` = every 지역 with public listings, most listings first.
- `GET /home/popular-regions` → `{ items[{ rank, code, name, emdName, lat, lng, listingCount,
dealCounts{presale,sale,jeonse,monthly}, avgPricePerPyeong, weeklyViewCount, rankDelta }], updatedAt }`.
  `assetTypes` = csv of `AssetType` (unknown → 400), `limit` clamped 1–50 (default 10). Ranked by
  counted listing views of the selected categories over the last 7 KST days (listings
  `region-daily` ZSETs), ties by listing count; `rankDelta` = last week's rank − this rank (null when
  unranked last week). Only 지역 with listings of the selection appear.
- 지역 (`code`): 8-digit 읍면동 code, or the 10-digit 리 code (`listings/domain/region-key.ts`); a
  listing stored with the 10-digit `…00` spelling of a 동 counts for the 8-digit key. `name` /
  `emdName` come from `regions` ("신대리" / "해룡면 신대리"); lat/lng = region centroid, else the mean
  of its listings. The design's 지구 names (신대지구 …) are not in the data model.
- `avgPricePerPyeong` (만원/평, rounded): mean of 매매 `priceSort` ÷ 평 over public listings — 아파트
  (공급면적, else 전용) whenever all categories or 아파트 are selected, else 토지 (대지면적), else 상가
  (전용); null for other selections or without 매매 listings.
- `GET /search/suggest` → `{ items[{ type: REGION|COMPLEX|AGENCY, id, label, description, lat, lng }],
popular: string[] }`. `q` is whitespace-collapsed and cut to 50 characters, `limit` clamped 1–20
  (default 8); empty `q` → no items. 지역 (≤ 5) and 단지 reuse `ComplexSearchService.autocomplete`
  (trigram + 초성); offices = approved, name or address `ILIKE`. REGION `description` = "순천시
  [읍면]", COMPLEX = "읍면동 · N세대", AGENCY = road address without the 시도. `popular` = names of the
  top 3 지역 this week and top 2 단지 (cached 5 min).
- `GET /geo/geocode?query` → `{ items[{ roadAddress, jibunAddress, zipCode, buildingName, lat, lng,
emdCode }] }` (≤ 10). `query`: control characters stripped, whitespace collapsed, 2–100 characters
  (400 `VALIDATION_FAILED` "검색어를 2자 이상 입력해 주세요."). A query without "순천" is sent as
  "순천시 …" and biased to the city centre. Each hit's 법정동 code (reverse geocoding, `legalcode`)
  goes through `canonicalRegionCode` (46150… → 12150…); hits outside `REGION_SGG_CODE` are dropped
  (without a code: kept only when the address says 순천시). `emdCode` is an extra field the web schema
  ignores today — the agency application can send it as `emdCode`. Without
  `NAVER_MAP_CLIENT_ID`/`NAVER_MAP_CLIENT_SECRET`, or when Naver fails, 503 `SERVICE_UNAVAILABLE`
  "지금은 주소 검색을 사용할 수 없습니다. …".
- `GET /policies/:slug` → `{ slug, title, version, effectiveAt, content }` — the latest published
  version whose `effectiveAt` has passed (`policy_documents`). Content is plain text with light
  markup (the site renders it with `<RichText>`). The site asks for `false-listing` (허위매물 신고
  정책); 중개보수 안내 is rendered by the site from the statutory table.
- `GET /me/favorites/agencies` → `Paginated<AgencySummary & { emdName, favoritedAt }>` newest first
  (pageSize default 20); offices that stop being approved are hidden, not deleted.
- `PUT /me/interest-regions` body `{ regionKeys: string[] (≤ 5, each 1–40 of [A-Za-z0-9_-]), notify:
boolean }` → the stored `{ regionKeys, notify }`. Keys are the site's stable keys ("sindae") or
  법정동 codes (canonicalized); duplicates are dropped. GET answers `{ regionKeys: [], notify: false }`
  before the first save. `notify` is stored only — no notification is sent yet.

## Data (`prisma/schema/home.prisma`)

- `FavoriteAgency (userId, agencyId)` PK, `favorite_agencies`.
- `UserInterestRegion (userId)` PK, `regionKeys text[]`, `notify`.
- `PolicyDocument (slug, version)` unique, `effectiveAt`, `publishedAt`.

`FavoriteAgency` / `UserInterestRegion` deliberately have no Prisma relation (User / Agency belong to
other modules' schema files), so nothing cascades: reads always go through live agencies, and
`HomeUserDataService.purge(userIds, tx)` (exported) must be called by the withdrawal PII scrub.

## Tests

- e2e env: `test/env/home.env` → database `house_test_home`, Redis DB index 12. Run:
  `pnpm --filter @house/api test:e2e home`. The geocoder is behind `GEOCODER` (`NaverGeocoder`);
  e2e uses `FakeGeocoder` (`test/e2e/home/helpers.ts`) — no network in tests.
- Unit: `pnpm --filter @house/api test -- src/modules/home`.
