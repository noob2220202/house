# Listings module (`apps/api/src/modules/listings`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- Property (physical unit; `ho` is PRIVATE — never serialize it publicly, use explicit `select`s) and Listing (deal offer) CRUD for agency members; ownership via `ListingAgency` membership (no IDOR).
- Co-brokerage: many agencies per listing (`ListingAgency`), exactly one `isPrimary` (DB partial unique index `listing_agencies_one_primary_idx`), join/withdraw, per-agency contact.
- Publish validator (공인중개사법 제18조의2 + 표시·광고 명시사항 세부기준): 소재지, 면적, 가격, 중개대상물 종류, 거래형태, 총층수, 해당층(저/중/고 허용), 사용승인일, 방향+기준, 방·욕실 수, 입주가능일, 주차대수, 관리비 + responsible agency's 명칭/소재지/연락처/등록번호/대표 성명. Fail with `LISTING_PUBLISH_REQUIREMENTS` and `details: [{ field, label }]`.
- Status lifecycle DRAFT → ACTIVE ↔ RESERVED → CLOSED, HIDDEN (admin/report). Keep denormalized search columns on `listings` in sync on every write (same transaction).
- 실매물 확인 records (method + date) → `listings.verified_at`.
- Map search: bbox + zoom + filters → region clusters (읍면동 aggregation, zoom ≤ `MAP_ZOOM.REGION_MAX`), grid clusters (half-open `floor(coord / size)` cells aligned to tile edges, ≤ `GRID_MAX`), or complex/listing markers with counts per deal type + min/max price. `$queryRaw` + `common/geo` helpers only; LIMIT `MAP_MAX_MARKERS`; cache hot tiles in Redis (`CacheService`, short TTL).
- Paginated list with sorts (최신순, 실매물확인순, 가격순, 면적순, 준공년순, 사진순) — every sort has an index.
- Photos (order, cover; `MAX_LISTING_PHOTOS`), favorites, recent views, view counters (Redis → `counters-flush` job).

## Endpoints

All paths are under the global prefix `/api/v1`. Default is authenticated; public routes are `@Public()`.

| Method | Path                                                      | Auth                                      |
| ------ | --------------------------------------------------------- | ----------------------------------------- |
| GET    | `/map/search?bbox&zoom&…filters`                          | Public (Redis tile cache, 30 s + version) |
| GET    | `/listings?…filters&bbox&sort&page&pageSize`              | Public                                    |
| GET    | `/listings/:id` (counts a deduped view + recent view)     | Public                                    |
| GET    | `/listings/:id/similar` (같은 단지 / 평형 / 가격대)       | Public (Redis 2 min + search version)     |
| POST   | `/listings/:id/view` → 204 (view beacon, same dedupe)     | Public                                    |
| GET    | `/agency/listings/summary` (status tabs + reminders)      | AGENT / AGENCY_OWNER (own agency)         |
| GET    | `/agency/listings/co-broker-candidates?complexId&dong&q`  | AGENT / AGENCY_OWNER (own agency)         |
| GET    | `/agency/listings?statuses&dealTypes&assetTypes&q&…&sort` | AGENT / AGENCY_OWNER (own agency)         |
| POST   | `/agency/listings` (DRAFT)                                | AGENT / AGENCY_OWNER                      |
| GET    | `/agency/listings/:id` (호/hidden reason: primary only)   | member of a participating agency          |
| PATCH  | `/agency/listings/:id` (co-brokers: `contact` only)       | member of a participating agency          |
| DELETE | `/agency/listings/:id` (soft delete)                      | primary agency member                     |
| POST   | `/agency/listings/:id/publish` (명시사항 check)           | primary agency member                     |
| POST   | `/agency/listings/:id/status`                             | primary agency member                     |
| POST   | `/agency/listings/:id/verifications` (실매물 확인)        | primary agency member                     |
| PUT    | `/agency/listings/:id/photos` (order + cover)             | primary agency member                     |
| POST   | `/agency/listings/:id/co-brokers` (request → PENDING)     | AGENCY_OWNER                              |
| POST   | `/agency/listings/:id/co-brokers/:agencyId/accept`        | AGENCY_OWNER of the primary agency        |
| POST   | `/agency/listings/:id/co-brokers/:agencyId/reject`        | AGENCY_OWNER of the primary agency        |
| DELETE | `/agency/listings/:id/co-brokers` (leave)                 | AGENCY_OWNER (co-broker)                  |
| DELETE | `/agency/listings/:id/co-brokers/:agencyId` (remove)      | AGENCY_OWNER of the primary agency        |
| GET    | `/me/favorites/listings` · PUT/DELETE `…/:id`             | User                                      |
| GET    | `/me/recent-views?targetType` · DELETE `/me/recent-views` | User                                      |

Listings of agencies the caller doesn't participate in answer 404; co-brokers calling primary-only
actions get 403 `LISTING_PRIMARY_AGENCY_ONLY`.

## Design notes

- Web contracts added for the frontend integration (shapes = the web mock handlers, DECISIONS
  "Source of truth" #2; types live in the services until they move to `@house/shared`):
  - `GET /listings/:id/similar` → `{ criteria, regionName, regionListingCount, groups[{ key, label,
total, items: ListingSummary[] }] }` (`SimilarListingsService`). 같은 단지 = same 단지, any deal
    type; 같은 평형 = same deal type, 전용 ±16㎡ (토지: 대지 ±20 %), same 지역, other 단지; 같은 가격대 =
    same deal type, `priceSort` ±20 % (≥ ±500만원), other 단지. First 8 cards each; empty groups are
    dropped; same asset type and public visibility rules as search.
  - `POST /listings/:id/view` (204, `Cache-Control: no-store`): same viewer key as the detail read
    (user id, else hash of IP + UA — the SSR frontend forwards `X-Forwarded-For` / `User-Agent`), so
    SSR read + beacon count once; records the recent view of a signed-in user. CSRF applies as usual
    to cookie sessions.
  - Every counted view (detail or beacon) also adds 1 to `listings:views:region-daily:<KST day>`
    (member `ASSET_TYPE|regionKey`, `domain/region-key.ts`: 8-digit 읍면동 / 10-digit 리) for the home
    "많이 찾는 지역" ranking (`ListingViewsService.regionViews`). Admins and bot UAs (anonymous) are
    not counted there.
  - `GET /agency/listings/summary` → `{ total, byStatus{DRAFT…HIDDEN}, verificationDue,
expiringSoon, coBrokered }` over the listings the agency actively (co-)brokers. `verificationDue`
    = 광고중/계약중 never verified or whose 실매물 확인 (valid `LISTING_AD_TTL_DAYS`) ends within 7 KST
    days; `expiringSoon` = 광고중 with `expiresAt` within 7 days.
  - `GET /agency/listings/co-broker-candidates?complexId&dong&q&page&pageSize` → `Paginated<{ id,
listingNo, status, dealType, assetType, name, dong, prices…, floor (null when 저/중/고),
    floorClass, coverPhotoUrl, agencyCount, primaryAgencyName, joined }>`: public listings of other
    offices in the 단지 (never 호), `joined` = this agency already co-brokers it. `q` matches 동 / 제목,
    or the 매물번호 exactly.
  - `GET /agency/listings` (`agencyListingListQuerySchema`) → `Paginated<AgencyListingRow>` (shared):
    the agency's private console view of every listing it actively (co-)brokers — `ListingSummary`
    - `ho` (primary only), `landArea`, `verificationDueAt`, `expiresAt`, `updatedAt`, `hiddenReason`
      (primary only) and `missingCount` (DRAFT only: `checkPublishRequirements(...).length`, the same
      count publish reports). Never served publicly. Query: `statuses`, `dealTypes`, `assetTypes`
      (csv), `q` (단지·건물명, 도로명·지번 주소, 동, 제목, 매물번호; spaces ignored on both sides; 호 only on
      the agency's own listings — `ListingSearchRepository.agencyTextMatchIds`), `verificationDue=true`
      (same rule as the summary chip), `coBrokered=true` (another agency is primary), `primaryOnly`,
      `sort` = `UPDATED` (default) | `LATEST` | `VERIFY_DUE` (oldest 확인 first, never verified last) |
      `PRICE_DESC` | `PRICE_ASC` (`priceSort`, nulls last) | `VIEWS`.
- 매물번호 (`listings.listing_no`, unique sequence from 100001; existing rows were numbered in
  creation order): `ListingSummary.listingNo` (string, public) on every summary / detail, the
  console rows, co-broker candidates and the admin topbar search (`parseListingNo` accepts "100412",
  "매물번호 100412", "#100412").
- `verificationDueAt` (console rows + agency detail) = KST date of the latest 실매물 확인 +
  `LISTING_AD_TTL_DAYS` (YYYY-MM-DD; null when never verified) — the same deadline as the dashboard.
- Search groups (denormalized on `listings`, derived on every write by `propertySearchColumns`):
  `room_type` = shared `effectiveRoomType` (the stated `properties.room_type` — needed for 1.5룸 —
  else 1/2/3+ rooms for 원룸·투룸), `land_zone` = `landZoneOf(properties.zoning)` (용도지역 대분류),
  `land_category` = `landCategoryOf(properties.land_category)` (대·전·답·과수원·임야·잡종지, other
  지목 → ETC). Filters `roomTypes`, `landZones`, `landCategories` (csv) on `/map/search` and
  `/listings`; `ListingSummary.roomType/landZone/landCategory` carry the groups.
- Exported for the home module: `ListingRegionStatsService` (public listing counts / 평당가 per 지역,
  city totals), `ListingRegionNamesService`, `ListingSummariesService`.

- 공동중개 needs consent: a request is `PENDING` (no access, not public) until the primary accepts.
  Leaving → `WITHDRAWN` (may request again); removal/rejection by the primary → `REMOVED` (403
  `LISTING_CO_BROKER_REMOVED` on a new request; only the primary can accept it back). Co-brokers
  never see 호, the hidden reason or other agencies' member ids, and may only change their own contact.
- Ad contact (제18조의2①): only the 개업공인중개사 (OWNER) or a 소속공인중개사 (`isLicensed`) may be
  shown. A 중개보조원's listings fall back to the agency's OWNER; explicit unlicensed contacts → 400.
- Public visibility also requires an APPROVED, non-deleted primary agency (SQL `NOT IN` hashed filter /
  `PUBLIC_PRIMARY_AGENCY_WHERE`). The agencies module should call
  `ListingsModerationService.onAgencyStatusChanged(agencyId)` after a status change (counters + cache).
- Concurrency: `listings.version` is bumped by every content/status write; writes are
  `updateMany … where version = loaded version` → 409 `LISTING_CONCURRENT_MODIFICATION`. Clients may
  send `version` on PATCH.
- 광고기간: publish sets `expiresAt = now + LISTING_AD_TTL_DAYS`; a 실매물 확인 extends it. The
  `listings.expire-ads` job (queue `cleanup`, hourly) moves overdue ACTIVE/RESERVED ads to DRAFT and
  notifies the primary agency's owner. Republishing keeps the first `publishedAt` (no free 끌어올리기).
- `ListingSummary.emdName` (also on the details): display name of `emdCode` from `regions`, looked up
  once per page (`ListingRegionNamesService`, `domain/emd-name.ts`): the 읍면동 name ("조례동") whether
  the row uses the 8- or 10-digit code, or "읍면 리" for a 리 code ("해룡면 신대리"); null when the code
  is not in `regions`.
- Region guard: `emdCode` must be in REGION_SGG_CODE (12150; a legacy `46150…` code is canonicalized to `12150…` by the shared schema before the check) and is required to publish; the point must lie
  within `SERVICE_REGION_RADIUS_M` of the 시군구 centroid and `EMD_MAX_DISTANCE_M` of the 법정동 centroid
  (when the regions table has them).

- Status: DRAFT →(publish) ACTIVE ↔ RESERVED → CLOSED → DRAFT; ACTIVE/RESERVED → DRAFT (내리기).
  HIDDEN is admin-only via the exported `ListingsModerationService.hide/unhide` (unhide → DRAFT).
  Edits of an ACTIVE/RESERVED listing re-run the publish validator.
- Publish validator lives in `@house/shared` (`checkPublishRequirements`) so the frontend can show
  missing items before submitting. Error: `400 LISTING_PUBLISH_REQUIREMENTS`, `details: [{ field, label }]`.
- Search columns on `listings` are recomputed from the property on every write (`domain/listing-state.ts`).
- The public list merges one index-ordered branch per (public status × null segment), so every sort
  uses its `(status, key)` index. `test/e2e/listings/performance.e2e-spec.ts` seeds 20k rows and
  checks the plans with EXPLAIN ANALYZE.
- View counts: Redis dedupe per viewer (6 h) + absolute totals hash, flushed by the `counters-flush`
  job with `GREATEST` (idempotent). Worker + schedule only when `JOBS_ENABLED`.
- Cross-module reads go through ports (`ports/*.port.ts`) bound to Prisma implementations until the
  agencies/media modules export equivalent services.

## Files you own

- `apps/api/src/modules/listings/**`
- `apps/api/test/e2e/listings/**` (+ your own factories there)
- Prisma: `listings.prisma` (Property, Listing, ListingAgency, ListingPhoto, ListingVerification, FavoriteListing, RecentView) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/listings.ts`, `packages/shared/src/enums/listing.ts`, `packages/shared/src/errors/listings.ts`
- Queues: `counters-flush` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/listings.env` → database `house_test_listings`, Redis DB index 2.
- Run: `pnpm --filter @house/api test:e2e listings` (migrates `house_test_listings` first). Unit: `pnpm --filter @house/api test -- src/modules/listings`.
