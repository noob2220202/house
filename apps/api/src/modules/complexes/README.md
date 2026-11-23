# Complexes module (`apps/api/src/modules/complexes`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- 단지 (Complex) + 평형 (ComplexAreaType: 전용/공급 ㎡, 평 label via `pyeongLabel`) + photos; read APIs, admin CRUD.
- 실거래가 sync from 국토교통부 (data.go.kr) apartment sale + rent APIs for `REGION_SGG_CODE`, monthly, as a BullMQ repeatable job (`trade-sync`, `upsertJobScheduler`, only when `JOBS_ENABLED`). Idempotent upsert by `sourceKey` (deterministic hash of the source row identity: kind, sgg, aptSeq/name, jibun, date, area, floor, price/deposit/rent). Record each run in `TradeSyncRun`. Handle 해제(cancelled) rows.
- The data.go.kr client sits behind an interface (`TradeApiClient`) with a fixture-based fake in tests — **no network in tests**.
- Aggregated stats: latest trade per 평형, monthly median/min/max/avg (`ComplexTradeStat`), recomputed after sync.
- Popularity ("자주 찾는 단지"): view counters in Redis flushed to `view_count`; ranking endpoint cached.
- Favorites (FavoriteComplex). Name/address search uses the trigram GIN indexes (`similarity`, `%`/`ILIKE`).

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method            | Path                                                                                  | Auth   |
| ----------------- | ------------------------------------------------------------------------------------- | ------ |
| GET               | `/api/v1/complexes?q&emdCode&page` · `/api/v1/complexes/:id`                          | Public |
| GET               | `/api/v1/complexes/popular?limit`                                                     | Public |
| GET               | `/api/v1/complexes/:id/trades?dealType&areaTypeId&fromYm&toYm` · `/:id/stats`         | Public |
| GET               | `/api/v1/complexes/:id/listings` (summary per deal type)                              | Public |
| PUT/DELETE        | `/api/v1/me/favorites/complexes/:id` · GET `/api/v1/me/favorites/complexes`           | User   |
| POST/PATCH/DELETE | `/api/v1/admin/complexes[/:id]` (+ area types, photos)                                | Admin  |
| POST              | `/api/v1/admin/complexes/trade-sync` (manual run, yearMonth) · GET `/trade-sync/runs` | Admin  |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/complexes/**`
- `apps/api/test/e2e/complexes/**` (+ your own factories there)
- Prisma: `complexes.prisma` (Complex, ComplexAreaType, ComplexPhoto, TradeRecord, ComplexTradeStat, TradeSyncRun, FavoriteComplex) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/complexes.ts`, `packages/shared/src/enums/complex.ts`, `packages/shared/src/errors/complexes.ts`
- Queues: `trade-sync`, `counters-flush` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/complexes.env` → database `house_test_complexes`, Redis DB index 3.
- Run: `pnpm --filter @house/api test:e2e complexes` (migrates `house_test_complexes` first). Unit: `pnpm --filter @house/api test -- src/modules/complexes`.
