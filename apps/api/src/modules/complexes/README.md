# Complexes module (`apps/api/src/modules/complexes`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- 단지 (Complex) + 평형 (ComplexAreaType: 전용/공급 ㎡, 평 label via `pyeongLabel`) + photos; read APIs, admin CRUD.
- 실거래가 sync from 국토교통부 (data.go.kr) apartment sale + rent APIs for `REGION_SGG_CODE`, monthly, as a BullMQ repeatable job (`trade-sync`, `upsertJobScheduler`, only when `JOBS_ENABLED`). Idempotent upsert by `sourceKey` (deterministic hash of the source row identity: kind, sgg, aptSeq/name, jibun, date, area, floor, price/deposit/rent). Record each run in `TradeSyncRun`. Handle 해제(cancelled) rows.
- Region codes (2026-07-01: 전라남도 순천시 46150 → 전남광주통합특별시 순천시 12150): `LAWD_CD` is always the configured code; a month with 0 rows is fetched once more with the legacy code (`legacyRegionCode`, warn log). Response `sggCd` and the `aptSeq` prefix are canonicalized (`canonicalRegionCode` / `canonicalAptSeq`), so rows and `emdCode` always carry 12150. A contract stored under the legacy code keeps its old `sourceKey` until it is seen again: the normalizer also computes `legacySourceKey` (identity with 46150 / the legacy aptSeq), and the upsert finds the row by either key and rewrites it to the current key — no duplicates, no stats double-count. `ComplexMatcher` compares `externalCode` and aptSeq canonicalized, so `46150-1001` and `12150-1001` are the same 단지.
- 단지 bootstrap (`bootstrap/`): builds the 단지 list from the 실거래 data — see "단지 bootstrap" below.
- Regions: the bundled 법정동 list (`regions/suncheon-regions.data.ts`: 44 읍면동 with 8-digit codes + 163 리 with 10-digit codes, verified against Kakao Local 2026-11-25; used by the base seed and `POST /admin/regions/seed-default`) is keyed 12150. Codes are stored in one form, `normalizeRegionCode` (shared): legacy 46150… → 12150…, a 10-digit 읍면동 code (`1215013300`, Kakao b_code) → 8 digits (`12150133`); every input schema (`regionCodeSchema`, `emdCodeSchema`, property `emdCode`) and the geocoder apply it. Existing rows were moved by migrations `20261124063850_region_code_12150` and `20261125140000_regions_verified_list` (sample rows → verified codes by name, every stored code rewritten). Display code never shows a raw code as a name: a code without a regions row is named from the bundled list (`regions/bundled-region.ts`), else left unnamed and logged. Regions cache keys carry `REGIONS_DATA_REVISION` — bump it with a migration that rewrites the table.
- The data.go.kr client sits behind an interface (`TradeApiClient`) with a fixture-based fake in tests — **no network in tests**.
- Aggregated stats: latest trade per 평형, monthly median/min/max/avg (`ComplexTradeStat`), recomputed after sync.
- Popularity ("자주 찾는 단지"): view counters in Redis flushed to `view_count`; ranking endpoint cached.
- Favorites (FavoriteComplex). Name/address search uses the trigram GIN indexes (`similarity`, `%`/`ILIKE`).

## Endpoints (implemented)

All paths are under `/api/v1`. Admin routes need an admin session with TOTP verified.

| Method              | Path                                                                                       | Auth     |
| ------------------- | ------------------------------------------------------------------------------------------ | -------- |
| GET                 | `/complexes?q&emdCode&assetType&sort&page&pageSize` (trigram + 초성 search)                | Public   |
| GET                 | `/complexes/autocomplete?q&limit` (읍면동/리 + 단지)                                       | Public   |
| GET                 | `/complexes/popular?limit&emdCode` (30-day decayed views + listing counts)                 | Public   |
| GET                 | `/complexes/:id` (detail, 평형, photos, latest trades, listing summary, isFavorite)        | Public   |
| GET                 | `/complexes/:id/trades?dealType&areaTypeId&fromYm&toYm&includeCancelled&page`              | Public   |
| GET                 | `/complexes/:id/stats?dealType&areaTypeId&months`                                          | Public   |
| GET                 | `/complexes/:id/listings`                                                                  | Public   |
| GET                 | `/complexes/:id/nearby?limit&radius` (주변 단지, nearest first, `{ items }`)               | Public   |
| GET                 | `/complexes/:id/agencies?limit` (offices with public listings here, `{ items }`)           | Public   |
| GET                 | `/regions?parentCode&level&includeInactive` · `/regions/:code`                             | Public   |
| GET · PUT/DELETE    | `/me/favorites/complexes` · `/me/favorites/complexes/:id`                                  | User     |
| GET                 | `/admin/complexes?q&emdCode&includeDeleted&missingExternalCode` · `/admin/complexes/:id`   | OPERATOR |
| POST · PATCH        | `/admin/complexes` · `/admin/complexes/:id`                                                | OPERATOR |
| DELETE              | `/admin/complexes/:id` (soft delete)                                                       | ADMIN    |
| POST · PATCH/DELETE | `/admin/complexes/:id/area-types` · `/admin/complexes/:id/area-types/:areaTypeId`          | OPERATOR |
| PUT                 | `/admin/complexes/:id/photos`                                                              | OPERATOR |
| POST                | `/admin/complexes/trade-sync` `{ yearMonth, kinds? }` → 202 `{ jobId }` (queued job)       | ADMIN    |
| GET                 | `/admin/complexes/trade-sync/runs?kind&status&yearMonth&page`                              | OPERATOR |
| POST                | `/admin/complexes/trade-sync/rematch` `{ fromYm? }` → 202 `{ jobId }` (queued job)         | ADMIN    |
| GET                 | `/admin/complexes/trade-sync/jobs/:jobId` (state, result, failedReason)                    | OPERATOR |
| POST                | `/admin/complexes/bootstrap` `{ months?, dryRun? }` → 202 `ComplexBootstrapAccepted`       | ADMIN    |
| GET                 | `/admin/complexes/bootstrap` (`{ item }` latest run) · `/admin/complexes/bootstrap/:jobId` | OPERATOR |
| POST · PUT          | `/admin/regions/seed-default` · `/admin/regions/:code`                                     | ADMIN    |

`GET /admin/complexes?source=TRADE_BOOTSTRAP|ADMIN` filters by who created the 단지 (list and detail carry `source`).

Jobs (queue `trade-sync`, only when `JOBS_ENABLED`): `trade-sync:monthly` (cron `13 4 2,16 * *`
Asia/Seoul, current month + 3 lookback months), `trade-sync:month` and `trade-sync:rematch`
(enqueued by the admin endpoints; rematch also after 단지 create/delete/match-field edits; job ids
are derived from the parameters so repeated requests dedupe while pending), and
`complexes:flush-views` (every 5 min, Redis view totals → `complexes.view_count`).
Without `JOBS_ENABLED` the admin endpoints only enqueue — some process must run the worker.

## 단지 bootstrap (실거래가 → 단지)

`ComplexBootstrapService` (job `complexes:bootstrap` on the trade-sync queue, id `bootstrap.<epoch ms>`; enqueued by
`ComplexBootstrapJobs`, which keeps the latest id in Redis and answers 409 `COMPLEX_BOOTSTRAP_IN_PROGRESS` while it is
unfinished; the run itself holds a Redis lock, so only one runs per 시군구). Needs `DATA_GO_KR_SERVICE_KEY` and the
Kakao REST key (503 `COMPLEX_BOOTSTRAP_NOT_CONFIGURED`). The pure rules live in `complex-bootstrap.planner.ts`.

1. **Rows**: `months` (12–240, default 60) 계약월 ending last month (KST), both APIs per month through
   `TradeSyncService.fetchMonth` (LAWD_CD = `REGION_SGG_CODE`, legacy-code retry for empty months), 300 ms apart,
   retryable errors retried twice; a used-up daily quota (code 22, or HTTP 429 after the retries) fails the job at once
   (`UnrecoverableError`, Korean `failedReason` shown by the admin) instead of burning calls. Each month is reduced to a
   `MonthAggregate` (rows grouped by canonical aptSeq: name / umdCd+umdNm / 지번 / road / buildYear / 전용면적 counts)
   cached 7 days in Redis — a run stopped by the quota resumes the next day, and a dry run followed by the real run
   reads the API once. Rows the normalizer rejects are dropped. Budget: months × 2 calls (+1 page per 1,000 rows, +1
   legacy retry per empty month) — 60 months ≈ 120 calls, 240 months ≈ 480.
2. **Candidates** (`mergeMonths`, `buildCandidates`): one per aptSeq; rows without one (some 전월세) join the aptSeq
   group with the same 법정동 + 지번 (else same name) when exactly one fits, else they are their own candidate
   (ambiguous ones are skipped). Name / 지번 / road / buildYear = most frequent value. Region: `sggCd + umdCd` → 10-digit
   법정동 → `normalizeRegionCode`, which must be in the verified list (`SUNCHEON_REGIONS`; another 시군구 uses the
   regions table), else `umdNm` by name; a 리 is filed under its 읍면 (`emdCode` 8 digits, `emdName` = umdNm, label
   "해룡면 신대리"); unknown → skipped. `jibunAddress` "순천시 <동 | 읍면 리> <지번>", `roadAddress` "순천시 <roadNm 본번-부번>"
   when the rows carry it. 평형: distinct 전용면적, neighbours ≤ 0.1 ㎡ apart merged (most traded value), ≤ 30,
   `typeName` "84" / "84A"·"84B", `source` TRADE_BOOTSTRAP (no 공급면적 / 세대수).
3. **Plan** (`planCandidates`) against every 단지 of the 시군구: `externalCode` (canonical) first, else same 읍면동 +
   shared name variant when exactly one live 단지 fits and neither its code nor its 지번 contradicts. UPDATE fills only
   empty fields (re-checked inside the write transaction) and adds 평형 only to 단지 without admin-made 평형 (an admin
   edit of a 평형 marks it ADMIN; deleting one marks the rest ADMIN, so it is not added back); never
   overwrites, never deletes. A match with a deleted 단지 (admin removed it) → SKIP; several candidates for one 단지, or
   one candidate for several → SKIP.
4. **Coordinates** for CREATE: Kakao address search (`GEOCODER`, bound in this module too) by 지번 address, then road
   address, 120 ms apart, cached 7 days; a hit counts only when its 법정동 code is in the 시군구 and the candidate's
   읍면동 (code-less hits: the address must name the 시군구). No hit → NEEDS_LOCATION (not created; listed for manual
   registration). Three consecutive geocoder failures fail the job (it retries / resumes).
5. Dry run stops here (preview in the job result and in Redis). A real run writes (`source` TRADE_BOOTSTRAP), bumps the
   search caches, enqueues a rematch (links trades already stored) and `trade-sync:month` for the months of the period
   without a SUCCEEDED run for both APIs (first run on an empty DB ≈ another months × 2 calls), and records the audit row `complex.bootstrap.apply` (SYSTEM, created / updated ids). The POST is audited as
   `complex.bootstrap.preview` / `complex.bootstrap.run`.

Job view: `{ status, dryRun, months, fromYm, toYm, progress { phase queued|fetch|geocode|write|done, done, total, percent },
preview { rows, candidates, toCreate, toUpdate, unchanged, needsLocation, skipped, sample[≤50], needsLocationItems,
skippedItems }, result { created, updated, unchanged, needsLocation, skipped, areaTypesCreated, tradeSyncJobs } }`.

Matching rules (`ComplexMatcher`): aptSeq = external_code first; name/지번 fallbacks never pick a
단지 whose external_code or 지번 contradicts the trade. Sync and rematch keep an earlier match unless
it is contradicted or its 단지 was deleted. Stats rebuilds take a per-단지 advisory lock
(`TradeStatsService.lock`) and run DELETE + INSERT … SELECT in one transaction; admin 평형 edits
re-assign every trade of the 단지 to its nearest 평형 and rebuild stats in the same transaction.

Views: logged-in users dedupe per user; anonymous viewers per HMAC of their /24 (IPv4) or /64
(IPv6) network, capped at `ANON_VIEW_DAILY_CAP_PER_NETWORK` 단지 per KST day; bots (shared
`isBotUserAgent`, which also treats a missing UA as a bot) are not counted. The SSR frontend must
forward the browser's `X-Forwarded-For` and `User-Agent`.

## Web contracts (frontend integration)

Shapes follow the web mock handlers (DECISIONS "Source of truth" #2); `limit`/`radius` are clamped
like the mocks (nearby: limit 1–30, default 10; radius 100–10,000 m, default 3,000; agencies: limit
1–50, default 20). `ComplexNearbyService`:

- `nearby` items: `{ id, name, assetType, emdName, lat, lng, distanceM, households, builtYear,
activeListingCount, dealCounts{presale,sale,jeonse,monthly}, representative }`. PostGIS
  `ST_DWithin` on `complexes.location`, deleted 단지 excluded. `representative` = the 평형 with the
  most households: `pyeongLabel`, `dealType` (PRESALE when it has more 분양권 than 매매 listings, else
  SALE) and `price` = lowest public asking price of that 평형 and deal type, else (SALE) the latest
  매매 실거래가 of the 평형, else null; null without 평형.
- `agencies` items: `{ agencyId, name, representativeName, phone, logoUrl, specialtyLabel: null,
complexListingCount, avgResponseMinutes: null }` — approved offices with an ACTIVE
  (primary or co-broker) link to a public listing of the 단지, most listings first.
- `ComplexSearchService` and `ComplexPopularityService` are exported for `GET /search/suggest`
  (home module).

## Files you own

- `apps/api/src/modules/complexes/**`
- `apps/api/test/e2e/complexes/**` (+ your own factories there)
- Prisma: `complexes.prisma` (ComplexDataSource enum, Complex, ComplexAreaType, ComplexPhoto, TradeRecord, ComplexTradeStat, TradeSyncRun, FavoriteComplex) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/complexes.ts`, `packages/shared/src/enums/complex.ts`, `packages/shared/src/errors/complexes.ts`
- Queues: `trade-sync`, `counters-flush` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/complexes.env` → database `house_test_complexes`, Redis DB index 3.
- Run: `pnpm --filter @house/api test:e2e complexes` (migrates `house_test_complexes` first). Unit: `pnpm --filter @house/api test -- src/modules/complexes`.
