# Ads (banners & popups) module (`apps/api/src/modules/ads`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- Banners per `BannerSlot` with per-slot limits (`BANNER_SLOT_SPECS` defaults, overridable in `BannerSlotConfig`): title, advertiser (agency optional), pc + mobile image (media ids), link URL (`linkUrlSchema`) + newWindow, start/end, paused, priority + reorderable sortOrder, targeting (ALL / REGIONS / COMPLEXES). Status ACTIVE/PAUSED/SCHEDULED/ENDED is computed (`computeScheduleStatus`), never stored.
- Popups: title, image, link, target pages, start/end, "N일 동안 보지 않기" (`dismissDays`), order.
- Public serve endpoints return only currently-live items, cached (`CacheService` + version bump on admin writes).
- Tracking: impressions + clicks as Redis counters, deduped per session/visitor per day; `banner-stats` repeatable job flushes to `BannerStatDaily` idempotently (SET totals, not INCR). Click redirect endpoint validates the stored URL (open-redirect safe) and 302s.
- Admin CRUD + reorder + stats; every mutation `@Audit(...)`.

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method                | Path                                                                                   | Auth           |
| --------------------- | -------------------------------------------------------------------------------------- | -------------- |
| GET                   | `/api/v1/banners?slot&regionCode&complexId`                                            | Public         |
| POST                  | `/api/v1/banners/:id/impression` (batched ids allowed)                                 | Public         |
| GET                   | `/api/v1/banners/:id/click` → 302                                                      | Public         |
| GET                   | `/api/v1/popups?page`                                                                  | Public         |
| GET/POST/PATCH/DELETE | `/api/v1/admin/banners[/:id]` · PUT `/api/v1/admin/banners/reorder` · GET `/:id/stats` | Admin          |
| GET/PATCH             | `/api/v1/admin/banner-slots[/:slot]`                                                   | Admin (ADMIN+) |
| GET/POST/PATCH/DELETE | `/api/v1/admin/popups[/:id]` · PUT `/api/v1/admin/popups/reorder`                      | Admin          |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/ads/**`
- `apps/api/test/e2e/ads/**` (+ your own factories there)
- Prisma: `ads.prisma` (BannerSlotConfig, Banner, BannerTargetRegion, BannerTargetComplex, BannerStatDaily, Popup) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/ads.ts`, `packages/shared/src/enums/ads.ts`, `packages/shared/src/constants/ads.ts`, `packages/shared/src/errors/ads.ts`
- Queues: `banner-stats` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/ads.env` → database `house_test_ads`, Redis DB index 6.
- Run: `pnpm --filter @house/api test:e2e ads` (migrates `house_test_ads` first). Unit: `pnpm --filter @house/api test -- src/modules/ads`.
