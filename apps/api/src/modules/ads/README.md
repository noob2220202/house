# Ads (banners & popups) module (`apps/api/src/modules/ads`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- **Banners** per `BannerSlot`: title, advertiser (agency optional; must be `APPROVED`), pc + mobile image (media ids, `purpose=BANNER`, READY, PUBLIC — checked with `MediaService.assertUsable(…, tx)` inside the write transaction, replaced/removed images are `released()`), link (`adLinkUrlSchema`: `https://` or site-relative `/path` only), newWindow, start/end, paused, priority, reorderable sortOrder, targeting ALL / REGIONS (법정동 code prefix match) / COMPLEXES.
- **Status** ACTIVE/PAUSED/SCHEDULED/ENDED is computed (`computeScheduleStatus`), never stored; admin filters use `domain/schedule.ts`. Expiry needs no job: serve caches expire at the next start/end boundary.
- **Slot rules**: `BANNER_SLOT_SPECS.requiresAgency` / `requiredTargeting` (COMPLEX_FEATURED_AGENCY: agency mandatory, COMPLEXES targeting only), checked on create and on the merged row of a PATCH.
- **Slot limits**: `BANNER_SLOT_SPECS` defaults, overridable in `banner_slot_configs` (`maxActive`, `isEnabled`). `maxActive` is **per page context**, like serving: per complex page, per 법정동 page, ALL banners compete everywhere (`domain/slot-capacity.ts`: candidate contexts × sweep line, slot advisory lock) → `409 BANNER_SLOT_FULL` with `details.context` (`{ complexId }`, `{ regionCode }` or `{}`). A PATCH re-checks only when the banner becomes live somewhere/somewhen it was not (un-pause, earlier start, later end, wider targeting); shortening, pausing or narrowing always works. Serving also caps to `maxActive` (highest priority wins, displayed in sortOrder).
- **Popups**: title, image (`purpose=POPUP`), link, target pages (`ALL` = every page), start/end, paused, "N일 동안 보지 않기" (`dismissDays`), order.
- **Serving**: only servable banners — live, agency (if any) `APPROVED` and not deleted, pc image READY and not deleted (a removed mobile image is dropped). Cached in Redis (`CacheService`, version bumped by every admin write; TTL ≤ 60 s and ≤ next boundary).
- **Tracking**: per (banner, KST day) Redis **HyperLogLog** of HMAC'd visitor ids (session id, else the IP — IPv6 grouped by /64; the UA is not part of the identity, so rotating it mints no visitors) → one count per visitor per day, ≈0.8% error, ≤ ~12KB per key whatever clients send. Bots (UA filter) are never counted; only servable banners count. `banner-stats` repeatable job (every 5 min, only with `JOBS_ENABLED`) writes PFCOUNT totals into `banner_stat_daily` (idempotent; `GREATEST` keeps DB totals if Redis lost data).
- **Click redirect** re-validates the stored URL on every click (open-redirect safe); relative links resolve against `PUBLIC_BASE_URL`. Clicks count only for top-level navigations (`Sec-Fetch-Dest: document` / `Sec-Fetch-Mode: navigate` when sent), so an `<img src=".../click">` on another site redirects but is not counted.
- **Audit**: every admin mutation (`@Audit` or `AuditService.record` inside the reorder transaction).

## Endpoints

All under `/api/v1`.

| Method   | Path                                                                     | Auth                     |
| -------- | ------------------------------------------------------------------------ | ------------------------ |
| GET      | `/banners?slot&regionCode&complexId`                                     | Public                   |
| POST     | `/banners/:id/impression` → 204                                          | Public (CSRF if session) |
| POST     | `/banners/impressions` `{ ids: [≤20] }` → 204                            | Public (CSRF if session) |
| GET      | `/banners/:id/click` → 302                                               | Public                   |
| GET      | `/popups?page`                                                           | Public                   |
| GET      | `/admin/banners?slot&status&agencyId&q&page&pageSize`                    | OPERATOR+                |
| POST     | `/admin/banners`                                                         | OPERATOR+                |
| GET      | `/admin/banners/:id`                                                     | OPERATOR+                |
| PATCH    | `/admin/banners/:id` (slot immutable)                                    | OPERATOR+                |
| DELETE   | `/admin/banners/:id` (soft) → 204                                        | OPERATOR+                |
| PUT      | `/admin/banners/reorder` `{ slot, ids }`                                 | OPERATOR+                |
| GET      | `/admin/banners/:id/stats?from&to` (KST dates, default 30 days, max 366) | OPERATOR+                |
| GET      | `/admin/banner-slots`, `/admin/banner-slots/:slot`                       | OPERATOR+                |
| PATCH    | `/admin/banner-slots/:slot`                                              | ADMIN+                   |
| GET/POST | `/admin/popups`, GET/PATCH/DELETE `/admin/popups/:id`                    | OPERATOR+                |
| PUT      | `/admin/popups/reorder` `{ ids }`                                        | OPERATOR+                |

Beacons: the frontend should use `fetch(url, { method: 'POST', keepalive: true, credentials: 'include' })`
with the `x-csrf-token` header when logged in (`navigator.sendBeacon` cannot set headers).

## Layout

- `controllers/` public + admin controllers · `services/` one service per concern · `ads.mapper.ts` row → view
- `ports/` media (delegates to `MediaService` from `MediaModule`) + agency/complex/region lookups (Prisma-backed)
- `domain/` pure helpers (schedule where/TTL, per-context slot capacity, region prefixes, visitor identity, Fetch Metadata check) with unit tests
- `jobs/banner-stats.processor.ts` BullMQ worker on `QUEUES.BANNER_STATS`
- Shared: `packages/shared/src/schemas/ads.ts`, `errors/ads.ts`, `enums/ads.ts`, `constants/ads.ts`, `ads/` (link/bot/stats helpers + view types)

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/ads`, `pnpm --filter @house/shared test -- src/ads`.
- e2e: `pnpm --filter @house/api test:e2e ads` (database `house_test_ads`, Redis DB 6).
