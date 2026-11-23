# Complexes module (`apps/api/src/modules/complexes`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- 단지 (Complex) + 평형 (ComplexAreaType: 전용/공급 ㎡, 평 label via `pyeongLabel`) + photos; read APIs, admin CRUD.
- 실거래가 sync from 국토교통부 (data.go.kr) apartment sale + rent APIs for `REGION_SGG_CODE`, monthly, as a BullMQ repeatable job (`trade-sync`, `upsertJobScheduler`, only when `JOBS_ENABLED`). Idempotent upsert by `sourceKey` (deterministic hash of the source row identity: kind, sgg, aptSeq/name, jibun, date, area, floor, price/deposit/rent). Record each run in `TradeSyncRun`. Handle 해제(cancelled) rows.
- The data.go.kr client sits behind an interface (`TradeApiClient`) with a fixture-based fake in tests — **no network in tests**.
- Aggregated stats: latest trade per 평형, monthly median/min/max/avg (`ComplexTradeStat`), recomputed after sync.
- Popularity ("자주 찾는 단지"): view counters in Redis flushed to `view_count`; ranking endpoint cached.
- Favorites (FavoriteComplex). Name/address search uses the trigram GIN indexes (`similarity`, `%`/`ILIKE`).

## Endpoints (implemented)

All paths are under `/api/v1`. Admin routes need an admin session with TOTP verified.

| Method              | Path                                                                                     | Auth     |
| ------------------- | ---------------------------------------------------------------------------------------- | -------- |
| GET                 | `/complexes?q&emdCode&assetType&sort&page&pageSize` (trigram + 초성 search)              | Public   |
| GET                 | `/complexes/autocomplete?q&limit` (읍면동/리 + 단지)                                     | Public   |
| GET                 | `/complexes/popular?limit&emdCode` (30-day decayed views + listing counts)               | Public   |
| GET                 | `/complexes/:id` (detail, 평형, photos, latest trades, listing summary, isFavorite)      | Public   |
| GET                 | `/complexes/:id/trades?dealType&areaTypeId&fromYm&toYm&includeCancelled&page`            | Public   |
| GET                 | `/complexes/:id/stats?dealType&areaTypeId&months`                                        | Public   |
| GET                 | `/complexes/:id/listings`                                                                | Public   |
| GET                 | `/regions?parentCode&level&includeInactive` · `/regions/:code`                           | Public   |
| GET · PUT/DELETE    | `/me/favorites/complexes` · `/me/favorites/complexes/:id`                                | User     |
| GET                 | `/admin/complexes?q&emdCode&includeDeleted&missingExternalCode` · `/admin/complexes/:id` | OPERATOR |
| POST · PATCH        | `/admin/complexes` · `/admin/complexes/:id`                                              | OPERATOR |
| DELETE              | `/admin/complexes/:id` (soft delete)                                                     | ADMIN    |
| POST · PATCH/DELETE | `/admin/complexes/:id/area-types` · `/admin/complexes/:id/area-types/:areaTypeId`        | OPERATOR |
| PUT                 | `/admin/complexes/:id/photos`                                                            | OPERATOR |
| POST                | `/admin/complexes/trade-sync` `{ yearMonth, kinds? }` → 202 `{ jobId }` (queued job)     | ADMIN    |
| GET                 | `/admin/complexes/trade-sync/runs?kind&status&yearMonth&page`                            | OPERATOR |
| POST                | `/admin/complexes/trade-sync/rematch` `{ fromYm? }` → 202 `{ jobId }` (queued job)       | ADMIN    |
| GET                 | `/admin/complexes/trade-sync/jobs/:jobId` (state, result, failedReason)                  | OPERATOR |
| POST · PUT          | `/admin/regions/seed-default` · `/admin/regions/:code`                                   | ADMIN    |

Jobs (queue `trade-sync`, only when `JOBS_ENABLED`): `trade-sync:monthly` (cron `13 4 2,16 * *`
Asia/Seoul, current month + 3 lookback months), `trade-sync:month` and `trade-sync:rematch`
(enqueued by the admin endpoints; rematch also after 단지 create/delete/match-field edits; job ids
are derived from the parameters so repeated requests dedupe while pending), and
`complexes:flush-views` (every 5 min, Redis view totals → `complexes.view_count`).
Without `JOBS_ENABLED` the admin endpoints only enqueue — some process must run the worker.

Matching rules (`ComplexMatcher`): aptSeq = external_code first; name/지번 fallbacks never pick a
단지 whose external_code or 지번 contradicts the trade. Sync and rematch keep an earlier match unless
it is contradicted or its 단지 was deleted. Stats rebuilds take a per-단지 advisory lock
(`TradeStatsService.lock`) and run DELETE + INSERT … SELECT in one transaction; admin 평형 edits
re-assign every trade of the 단지 to its nearest 평형 and rebuild stats in the same transaction.

Views: logged-in users dedupe per user; anonymous viewers per HMAC of their /24 (IPv4) or /64
(IPv6) network, capped at `ANON_VIEW_DAILY_CAP_PER_NETWORK` 단지 per KST day; bots (shared
`isBotUserAgent`, which also treats a missing UA as a bot) are not counted. The SSR frontend must
forward the browser's `X-Forwarded-For` and `User-Agent`.

## Files you own

- `apps/api/src/modules/complexes/**`
- `apps/api/test/e2e/complexes/**` (+ your own factories there)
- Prisma: `complexes.prisma` (Complex, ComplexAreaType, ComplexPhoto, TradeRecord, ComplexTradeStat, TradeSyncRun, FavoriteComplex) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/complexes.ts`, `packages/shared/src/enums/complex.ts`, `packages/shared/src/errors/complexes.ts`
- Queues: `trade-sync`, `counters-flush` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/complexes.env` → database `house_test_complexes`, Redis DB index 3.
- Run: `pnpm --filter @house/api test:e2e complexes` (migrates `house_test_complexes` first). Unit: `pnpm --filter @house/api test -- src/modules/complexes`.
