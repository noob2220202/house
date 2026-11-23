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

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method            | Path                                                                      | Auth                 |
| ----------------- | ------------------------------------------------------------------------- | -------------------- |
| GET               | `/api/v1/map/search?bbox&zoom&…filters`                                   | Public               |
| GET               | `/api/v1/listings?…filters&sort&page` · `/api/v1/listings/:id`            | Public               |
| POST/PATCH/DELETE | `/api/v1/agency/listings[/:id]`                                           | AGENT / AGENCY_OWNER |
| POST              | `/api/v1/agency/listings/:id/publish` · `/status` · `/verifications`      | AGENT / AGENCY_OWNER |
| POST/DELETE       | `/api/v1/agency/listings/:id/co-brokers`                                  | AGENCY_OWNER         |
| PUT               | `/api/v1/agency/listings/:id/photos` (order/cover)                        | AGENT / AGENCY_OWNER |
| PUT/DELETE        | `/api/v1/me/favorites/listings/:id` · GET `/api/v1/me/favorites/listings` | User                 |
| GET               | `/api/v1/me/recent-views`                                                 | User                 |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/listings/**`
- `apps/api/test/e2e/listings/**` (+ your own factories there)
- Prisma: `listings.prisma` (Property, Listing, ListingAgency, ListingPhoto, ListingVerification, FavoriteListing, RecentView) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/listings.ts`, `packages/shared/src/enums/listing.ts`, `packages/shared/src/errors/listings.ts`
- Queues: `counters-flush` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/listings.env` → database `house_test_listings`, Redis DB index 2.
- Run: `pnpm --filter @house/api test:e2e listings` (migrates `house_test_listings` first). Unit: `pnpm --filter @house/api test -- src/modules/listings`.
