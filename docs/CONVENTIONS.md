# Conventions (module teams read this first)

The scaffold wires every cross-cutting concern. Eight module teams (auth, listings, complexes,
agencies, deal-requests, ads, media, admin) work **in parallel in the same tree**, so the rules below
are about staying inside your own files and keeping the pipeline uniform.

Hard product rules: social login is **카카오 / 네이버 / Google only** (no Apple). The platform
sends **no SMS** and has **no phone verification** — phone numbers are plain, format-validated
contact fields. Do not add an SMS driver, OTP-by-SMS, Apple sign-in, or a verification model.

## 1. Ownership map

| What                                                                                                                                                                | Owner       | Path                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| Your module code                                                                                                                                                    | module team | `apps/api/src/modules/<module>/**`                                                          |
| Your e2e specs + extra factories                                                                                                                                    | module team | `apps/api/test/e2e/<module>/**`                                                             |
| Your e2e env (DB + Redis index)                                                                                                                                     | module team | `apps/api/test/env/<module>.env`                                                            |
| Your Prisma models                                                                                                                                                  | module team | `apps/api/prisma/schema/<module>.prisma`                                                    |
| Your shared zod schemas / enums / error codes                                                                                                                       | module team | `packages/shared/src/{schemas,errors}/<module>.ts`, `packages/shared/src/enums/<domain>.ts` |
| `app.module.ts`, `common/**`, `config/**`, `prisma/**` (service), `redis/**`, `queue/**`, `health/**`, `bootstrap/**`, `core.prisma`, `test/utils/**`, root configs | lead        | ask in the lead channel; do not edit                                                        |

Shared enum files per module: auth → `enums/user.ts`, listings → `enums/listing.ts`,
complexes → `enums/complex.ts`, agencies → `enums/agency.ts`, deal-requests → `enums/deal-request.ts`,
ads → `enums/ads.ts` + `constants/ads.ts`, media → `enums/media.ts` + `constants/media.ts`,
admin → `enums/admin.ts`. `packages/shared/src/*/index.ts` barrels already export every file.

All feature modules are **already registered** in `AppModule`. Never edit `app.module.ts`.
`AuthModule` is `@Global()` and exports `SessionService` + `SESSION_RESOLVER`.

## 2. Module folder layout

```
apps/api/src/modules/<module>/
  <module>.module.ts          # already exists — add controllers/providers/imports here
  README.md                   # responsibilities + endpoints to build
  <thing>.controller.ts       # public/user routes
  admin-<thing>.controller.ts # routes under /admin/... (same module)
  <thing>.service.ts          # business logic, one cohesive service per aggregate
  <thing>.repository.ts       # optional: raw SQL ($queryRaw) / complex Prisma queries
  dto.ts                      # `class XDto extends createZodDto(xSchema) {}` (schemas live in @house/shared)
  <thing>.mapper.ts           # DB row → response DTO (explicit field picking; hides PRIVATE fields)
  jobs/<job>.processor.ts     # BullMQ @Processor(QUEUES.X)
  clients/<api>.client.ts     # external API behind an interface + DI token (fake in tests)
  *.spec.ts                   # unit tests (no DB/Redis), next to the code
```

Export from your module only what other modules need (e.g. `AgenciesService.assertActiveMember`,
`MediaService.assertUsable`). Import the other module (`imports: [AgenciesModule]`) — never
import its internals or query its tables directly when it exposes a service for that.
Avoid circular module imports; if two modules need each other, use `forwardRef` sparingly or
move the shared read into the owning module's exported service.

## 3. Controllers, routes and auth

- Global prefix is `/api/v1` (`API_PREFIX`). Controller paths omit it: `@Controller('listings')`.
- **Default is authenticated.** `AuthGuard` (global) resolves the session cookie; unauthenticated
  requests get `401 UNAUTHENTICATED`. Mark anonymous routes with `@Public()` (session is still
  resolved when present, so `@CurrentPrincipal()` works for personalization).
- `@CurrentUser()` → `UserPrincipal { userId, role, agencyId, sessionId }` (401 if not a user).
  `@CurrentAdmin()` → `AdminPrincipal { adminId, role, mfaVerified }`.
- `@Roles(UserRole.AGENT, UserRole.AGENCY_OWNER)` restricts by role (403).
  `@AdminOnly(AdminRole.ADMIN)` = that admin rank or higher.
- Admin API lives under `/api/v1/admin/**` (`@Controller('admin/banners')`). The guard requires
  an **admin** session (separate `house_admin_sid` cookie) with TOTP verified for every non-public
  admin route; user cookies are ignored there.
- **Ownership (no IDOR):** guards check _who_ you are, services check _what_ you may touch. Load the
  row scoped by the principal (`where: { id, userId: user.userId }`) or call `assertOwnedBy` /
  `assertActsForAgency` from `common/auth`. Not-owned resources answer **404**, not 403.
- CSRF: state-changing requests with a session need header `x-csrf-token` = the `house_csrf` cookie
  and an allowed `Origin`/`Referer` (CsrfGuard, global). Nothing to do in controllers.
  `@SkipCsrf()` is reserved for non-browser webhooks and needs review.
- Rate limits: global per-IP default; tighten per route with `@Throttle(THROTTLE.AUTH)` etc.
  (`common/throttle/throttle.constants.ts`). Per-user daily caps:
  `await this.dailyCaps.consume('DEAL_REQUEST_CREATE', user.userId)` (`DailyCapService`, global).
- Swagger is on only when `SWAGGER_ENABLED=true` (`/api/v1/docs`). Decorate with
  `@ApiTags('<module>')`.

## 4. DTOs and validation (zod, in @house/shared)

1. Write the schema in `packages/shared/src/schemas/<module>.ts` (frontends reuse it).
2. In the API: `export class CreateBannerDto extends createZodDto(bannerInputSchema) {}`.
3. Use it as the parameter type: `create(@Body() dto: CreateBannerDto)`, `@Query() q: ListQueryDto`,
   `@Param() p: IdParamDto` (`createZodDto(idParamSchema)`).

The global `ZodValidationPipe` validates and **replaces** the value with the parsed output
(defaults, transforms, coercion). Failures → `400 VALIDATION_FAILED` with
`details: [{ path, code, message }]`. For ad-hoc parsing use `parseOrThrow(schema, value)`.
Query strings arrive as strings: use `csvArray`, `queryInt`, `queryNumber`, `queryBoolean`,
`paginationQuerySchema`, `bboxSchema`, `zoomSchema` from `schemas/common.ts`.

Units: money is integer **만원** (`manwonSchema`; 관리비 is 원 `maintenanceFeeWon`), areas are ㎡
(`areaSqmSchema`; 평 only for display: `sqmToPyeong`, `pyeongToSqm`, `pyeongLabel`; 1평 = 3.305785㎡).
Phones: `phoneSchema` (mobile) / `contactPhoneSchema` (landline/대표번호 too) normalize to digits
`01012345678`; `toE164Kr()` gives `+821012345678`. Never verify a phone.
Links: `linkUrlSchema` (http/https or site-relative only). Dates: `dateOnlySchema`, `dateTimeSchema`.

## 5. Responses, errors, pagination

- Return plain JSON-safe objects built by a mapper; never return Prisma rows that contain PRIVATE
  fields (`Property.ho`, deal-request contact before grant, `passwordHash`, document paths …).
  Convert `Decimal` with `decimalToNumber`, dates to ISO strings.
- Errors: `throw new AppException(ErrorCode.LISTING_NOT_FOUND)` or the helpers
  `AppException.notFound(code)`, `.forbidden(code)`, `.badRequest(code, details)`, `.conflict(code)`.
  Response shape is always `{ code, message, details?, requestId }`; `message` is the Korean default
  from `ERROR_MESSAGES` (override only with user-safe text). Status defaults: explicit table, then
  `*_NOT_FOUND` → 404, `*_DUPLICATE` → 409, else 400.
- Add codes to **your** file `packages/shared/src/errors/<module>.ts`, prefixed by your domain
  (`BANNER_…`, `AGENCY_…`), with a Korean message. Prisma `P2002` → 409, `P2025` → 404 automatically.
- **Pagination everywhere** for lists: `paginationQuerySchema` (`page`, `pageSize` ≤ 100) +
  `paginate(q, (args) => prisma.x.findMany({ where, orderBy, ...args }), () => prisma.x.count({ where }))`
  → `{ items, page, pageSize, total, totalPages }`. Feeds use cursors: `cursorQuerySchema`,
  `toCursorPage(rows, limit, cursorOf)`, `decodeCursor`.

## 6. Data access

- Inject `PrismaService`. Use `prisma.$transaction(async (tx) => …)` for multi-row invariants
  (co-brokerage primary agency, status + history, counters). Pass `tx` down (`PrismaTx` type).
- No N+1: `include`/`select` relations or batch with `where: { id: { in: ids } }`.
- Every query path needs an index (declare `@@index` in your `.prisma`).
- **Geo:** lat/lng are the source of truth; the `location geography(Point,4326)` column is filled by
  a DB trigger — never write it. Geo queries only with `$queryRaw` tagged templates and the helpers in
  `common/geo/geo.ts` (`withinBbox(Prisma.raw('l.location'), bbox)`, `withinRadius`, `gridSizeForZoom`).
  Never build SQL by string concatenation; `$queryRawUnsafe`/`$executeRawUnsafe` are banned outside
  test utilities.
- Korean text search: trigram GIN indexes exist on agency name/address, complex name/address,
  property address, region name. Use `ILIKE '%…%'` or `similarity()` on those columns.
- Redis: inject with `@InjectRedis() redis: Redis` (keys auto-prefixed with `REDIS_KEY_PREFIX`; name
  them `<module>:<what>:…`). JSON cache: `CacheService.getOrSet(key, ttlSeconds, compute)` and
  `version`/`bump` for invalidation.
- Config: inject `AppConfig` and call `config.get('KEY')`; never read `process.env` in app code. New
  env vars: ask the lead (they go into `config/env.schema.ts` + `apps/api/.env.example`).

## 7. Queues and jobs (BullMQ)

Queue names are in `src/queue/queue.constants.ts` (`QUEUES.TRADE_SYNC`, `BANNER_STATS`,
`MEDIA_PROCESSING`, `COUNTERS_FLUSH`, `NOTIFICATIONS`, `CLEANUP`). In your module:
`BullModule.registerQueue({ name: QUEUES.X })`, a `@Processor(QUEUES.X)` class extending
`WorkerHost` declared with **`@Processor(QUEUES.X, { autorun: false })`**, and in
`onApplicationBootstrap`: `if (!this.config.get('JOBS_ENABLED')) return;` then the repeatable jobs via
`queue.upsertJobScheduler(id, { pattern }, …)` (idempotent) and `this.worker.run()`.
`src/processors.spec.ts` fails the build otherwise. Only `dist/worker.js` runs processors (its entry sets
`JOBS_ENABLED=true`); the HTTP API (`dist/main.js`) forces `false` and only enqueues. Several
processors on one queue each receive every job name, so give each module its own queue (or one
dispatcher per queue).
Jobs must be idempotent (upserts keyed by natural/source keys, SET totals rather than INCR). In e2e,
call the processor/service method directly instead of waiting on workers.

## 8. Audit log (admin mutations)

Every admin mutation is audited. Simple case: `@Audit({ action: 'banner.update', resourceType: 'Banner' })`
on the handler, and in the service call `RequestContext.setAuditBefore(existingRow)` before mutating;
the interceptor writes `before`/`after` (sanitized: secrets/PII redacted), actor, IP, request id.
Multi-step mutations: `await this.audit.record({ action, resourceType, resourceId, before, after }, tx)`
inside the transaction.

## 9. External APIs

OAuth providers, data.go.kr, Naver geocoding, the broker registry lookup: define an interface + DI
token in your module (`export const TRADE_API = Symbol('TRADE_API')`), a real HTTP implementation,
and a fake with fixtures (`test/e2e/<module>/fixtures/`). Tests never touch the network: override with
`createTestApp({ override: (b) => b.overrideProvider(TRADE_API).useValue(fake) })`.

## 10. Tests

- **Unit:** `*.spec.ts` next to the code (no DB/Redis). `pnpm --filter @house/api test`
  (or `… test -- src/modules/<module>`).
- **e2e:** `apps/api/test/e2e/<module>/*.e2e-spec.ts`, real Postgres + Redis, **your own** DB
  `house_test_<module>` and Redis index (from `test/env/<module>.env` layered on `test/env/common.env`):

  | module          | database                 | Redis DB |
  | --------------- | ------------------------ | -------- |
  | auth            | house_test_auth          | 1        |
  | listings        | house_test_listings      | 2        |
  | complexes       | house_test_complexes     | 3        |
  | agencies        | house_test_agencies      | 4        |
  | deal-requests   | house_test_deal_requests | 5        |
  | ads             | house_test_ads           | 6        |
  | media           | house_test_media         | 7        |
  | admin           | house_test_admin         | 8        |
  | core (scaffold) | house_test_core          | 9        |

  Run: `pnpm --filter @house/api test:e2e <module>` (several names allowed; none = all; `--parallel`;
  jest args after `--`, e.g. `-- -t "publish"`). The runner applies migrations to your DB first
  (creating it and the PostGIS/pg_trgm extensions if missing). `pnpm db:test:prepare` migrates all.

- Skeleton:

  ```ts
  import { createAgency, createTestApp, createUser, loginUser, resetAll, withSession, type TestApp } from '../../utils';

  describe('listings (e2e)', () => {
    let t: TestApp;
    beforeAll(async () => { t = await createTestApp(); });
    beforeEach(() => resetAll(t));          // TRUNCATE all tables + FLUSHDB of your Redis index
    afterAll(() => t?.close());

    it('POST /api/v1/agency/listings → 201', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const s = await loginUser(t.app, { id: owner.id, role: 'AGENCY_OWNER' }, { agencyId: agency.id });
      await withSession(t.http().post('/api/v1/agency/listings'), s).send({ … }).expect(201);
    });
  });
  ```

  Helpers (`test/utils`): `createTestApp`, `resetDatabase`/`resetRedis`/`resetAll`, `loginUser`,
  `loginAdmin` (TOTP verified by default; `{ mfaVerified: false }` to test the gate), `withSession`,
  factories `createUser`, `createAdmin`, `createAgency` (approved + owner member), `createComplex`,
  `createListing` (property + listing + primary ListingAgency), `createMedia`. Add module-specific
  factories in your own e2e folder.

- Coverage rule: **every endpoint** has at least happy path + authz failure + validation failure.
- Deterministic: no network, no sleeps, no reliance on wall-clock beyond explicit `now` params.

## 11. Schema changes (Prisma multi-file schema)

The schema is split per module in `apps/api/prisma/schema/*.prisma` (one `schema.prisma` holds
the generator/datasource). Conventions: UUIDv7 ids `@id @default(uuid(7)) @db.Uuid`, snake_case
`@map`/`@@map`, `@db.Timestamptz(3)`, money `Int` (만원), areas `Decimal(10,2)` ㎡, soft delete
`deletedAt`, enums mirrored in `@house/shared` (a unit test enforces Prisma ↔ shared enum parity).

Only **additive** edits in your own file (new models, nullable/defaulted columns, indexes, enum
values). Renames/drops need the lead.

Rollback safety (deploy/rollback.sh only reverts code, never migrations):

- **Enum values ship in two releases.** Release N adds the value (migration + Prisma enum + shared
  twin) but no code writes it; release N+1 starts writing it. An older Prisma client throws
  (`Value 'X' not found in enum`) on any row holding a value it does not know, so writing a value
  in the same release that adds it makes a rollback by one release return 500s on those rows.
  rollback.sh refuses (without `--force`) any target that lacks an applied migration.
- Migrations run against the live DB with `lock_timeout=5s` and `statement_timeout=15min` (deploy.sh
  passes them in the connection URL). A statement that cannot get its lock fails the deploy instead
  of stalling the API; keep each migration short. An index on a large existing table goes in its own
  migration as `CREATE INDEX CONCURRENTLY` (Prisma runs a migration file containing only that
  statement outside a transaction); plain `CREATE INDEX` blocks writes to the table while it builds.
- A failed migration blocks later deploys (Prisma P3009) until resolved: docs/OPERATIONS.md
  "P3009 복구".

Workflow:

```bash
# 1. edit apps/api/prisma/schema/<module>.prisma (and the shared enum twin if you add enum values)
pnpm --filter @house/api db:format                 # adds missing @map/@@map, then prisma format
# 2. generate the migration SQL from the diff (uses your own shadow DB house_shadow_<module>,
#    created automatically; touches nobody else's database):
pnpm --filter @house/api db:migration:new <module> <change_name>
#    → prisma/schema/migrations/<timestamp>_<module>_<change_name>/migration.sql
# 3. review the SQL (it must contain only YOUR change), then
pnpm db:generate && pnpm --filter @house/api test:e2e <module>   # e2e runner migrates your test DB
pnpm db:migrate                                                   # apply to house_dev when ready
```

The per-module shadow DB (`house_shadow_<module>`) keeps parallel teams from colliding. New geo tables: add `lat`/`lng` + `location Unsupported("geography(Point, 4326)")?` +
`@@index([location], type: Gist)` and append to your migration:
`CREATE TRIGGER "<table>_sync_location" BEFORE INSERT OR UPDATE OF lat, lng, location ON "<table>" FOR EACH ROW EXECUTE FUNCTION house_sync_location();`
Trigram index: `@@index([col(ops: raw("gin_trgm_ops"))], type: Gin, map: "<table>_<col>_trgm_idx")`.
The lead merges migrations; if two teams generate on the same base, the later one regenerates.

## 12. Style

TypeScript strict, `noUncheckedIndexedAccess`; no `any` (lint error). Prettier (100 cols, single
quotes). Comments: sparse, explain _why_. Run before handing off:
`pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @house/api test:e2e <module>`.
