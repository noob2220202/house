# Listings module (`apps/api/src/modules/listings`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- Property (physical unit; `ho` is PRIVATE — never serialize it publicly, use explicit `select`s) and Listing (deal offer) CRUD for agency members; ownership via `ListingAgency` membership (no IDOR).
- Co-brokerage: many agencies per listing (`ListingAgency`), exactly one `isPrimary` (DB partial unique index `listing_agencies_one_primary_idx`), join/withdraw, per-agency contact.
- Publish validator (공인중개사법 제18조의2 + 표시·광고 명시사항 세부기준): 소재지, 면적, 가격, 중개대상물 종류, 거래형태, 총층수, 해당층(저/중/고 허용), 사용승인일, 방향+기준, 방·욕실 수, 입주가능일, 주차대수, 관리비 + responsible agency's 명칭/소재지/연락처/등록번호/대표 성명. Fail with `LISTING_PUBLISH_REQUIREMENTS` and `details: [{ field, label }]`.
- Status lifecycle DRAFT → ACTIVE ↔ RESERVED → CLOSED, HIDDEN (admin/report). Keep denormalized search columns on `listings` in sync on every write (same transaction).
- 실매물 확인 records (method + date) → `listings.verified_at`.
- Map search: bbox + zoom + filters → region clusters (읍면동 aggregation, zoom ≤ `MAP_ZOOM.REGION_MAX`), grid clusters (`ST_SnapToGrid`, ≤ `GRID_MAX`), or complex/listing markers with counts per deal type + min/max price. `$queryRaw` + `common/geo` helpers only; LIMIT `MAP_MAX_MARKERS`; cache hot tiles in Redis (`CacheService`, short TTL).
- Paginated list with sorts (최신순, 실매물확인순, 가격순, 면적순, 준공년순, 사진순) — every sort has an index.
- Photos (order, cover; `MAX_LISTING_PHOTOS`), favorites, recent views, view counters (Redis → `counters-flush` job).

## Endpoints

All paths are under the global prefix `/api/v1`. Default is authenticated; public routes are `@Public()`.

| Method | Path                                                      | Auth                                      |
| ------ | --------------------------------------------------------- | ----------------------------------------- |
| GET    | `/map/search?bbox&zoom&…filters`                          | Public (Redis tile cache, 30 s + version) |
| GET    | `/listings?…filters&bbox&sort&page&pageSize`              | Public                                    |
| GET    | `/listings/:id` (counts a deduped view + recent view)     | Public                                    |
| GET    | `/agency/listings?statuses&dealTypes&primaryOnly&page`    | AGENT / AGENCY_OWNER (own agency)         |
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
- Region guard: `emdCode` must be in REGION_SGG_CODE and is required to publish; the point must lie
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
