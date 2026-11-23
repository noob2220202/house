# Admin back-office module (`apps/api/src/modules/admin`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- Everything under `/api/v1/admin/*` that is not owned by another module (those modules expose their own admin controllers under the same prefix).
- Reports (허위매물 신고): public create (login required, `@Throttle(THROTTLE.REPORT)`, daily cap), admin workflow RECEIVED → IN_REVIEW → RESOLVED/REJECTED with resolution action (hide listing → `ListingsService`, warn agency → `AgencyWarning`), notifications.
- Content: notices, FAQ, local videos (YouTube URL → `parseYoutubeVideoId`, thumbnail), terms documents (versioned; publish), site settings (`siteSettingSchemas` per key: 사업자 정보 상호/대표/사업자등록번호/통신판매업 신고번호/주소/개인정보보호책임자/연락처 …).
- Users: list/search, suspend/unsuspend (destroy sessions), view withdrawn status. Admin accounts management (SUPER_ADMIN only).
- Audit log viewer (`auditLogQuerySchema`). Every admin mutation uses `@Audit(...)` or `AuditService.record(..., tx)`.
- Dashboard counters (pending agencies, open reports, active listings).

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method    | Path                                                                                            | Auth           |
| --------- | ----------------------------------------------------------------------------------------------- | -------------- |
| POST      | `/api/v1/reports`                                                                               | User           |
| GET       | `/api/v1/notices` · `/:id` · `/api/v1/faqs` · `/api/v1/videos` · `/api/v1/site-settings/public` | Public         |
| GET/PATCH | `/api/v1/admin/reports[/:id]` · POST `/:id/resolve`                                             | Admin          |
| CRUD      | `/api/v1/admin/notices` · `/admin/faqs` · `/admin/videos` · `/admin/terms`                      | Admin          |
| GET/PUT   | `/api/v1/admin/site-settings/:key`                                                              | Admin (ADMIN+) |
| GET/POST  | `/api/v1/admin/users` · `/:id/suspend` · `/:id/unsuspend`                                       | Admin          |
| CRUD      | `/api/v1/admin/admins`                                                                          | SUPER_ADMIN    |
| GET       | `/api/v1/admin/audit-logs` · `/api/v1/admin/dashboard`                                          | Admin          |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/admin/**`
- `apps/api/test/e2e/admin/**` (+ your own factories there)
- Prisma: `admin.prisma` (Report, AuditLog, Notice, Faq, LocalVideo, SiteSetting) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/admin.ts`, `packages/shared/src/enums/admin.ts`, `packages/shared/src/errors/admin.ts`
- Queues: `notifications` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/admin.env` → database `house_test_admin`, Redis DB index 8.
- Run: `pnpm --filter @house/api test:e2e admin` (migrates `house_test_admin` first). Unit: `pnpm --filter @house/api test -- src/modules/admin`.
