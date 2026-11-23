# Admin back-office module (`apps/api/src/modules/admin`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

Everything under `/api/v1/admin/*` that no other module owns, public site content, 허위매물 신고,
the daily-visitor counter and the admin-wide audit safety net. Agency review lives in the agencies
module (`/admin/agencies`, `POST /:id/decision`), banners/popups in ads, complexes/trade-sync in
complexes, deal requests in deal-requests — the dashboard links to them.

## Permissions

`@RequirePermission(AdminPermission.X)` (this folder) expands to `@Roles(...)` with the admin roles
holding X (`ADMIN_ROLE_PERMISSIONS` in `@house/shared/admin`):

| Permission                                                                      | OPERATOR | ADMIN | SUPER_ADMIN |
| ------------------------------------------------------------------------------- | -------- | ----- | ----------- |
| DASHBOARD_READ, REPORTS_MANAGE, LISTINGS_MODERATE, CONTENT_MANAGE, MEMBERS_READ | ✓        | ✓     | ✓           |
| MEMBERS_SUSPEND, TERMS_MANAGE, SETTINGS_MANAGE, AUDIT_READ                      |          | ✓     | ✓           |
| ADMINS_MANAGE                                                                   |          |       | ✓           |

Every admin route also needs an admin session with TOTP verified (global AuthGuard).

## Endpoints (prefix `/api/v1`)

| Method             | Path                                                                         | Auth              |
| ------------------ | ---------------------------------------------------------------------------- | ----------------- |
| POST               | `/reports` (THROTTLE.REPORT + daily cap `REPORT_CREATE`)                     | User              |
| GET                | `/notices` · `/notices/:id` · `/faqs` · `/videos` · `/site-settings/public`  | Public (cached)   |
| GET                | `/admin/permissions`                                                         | any admin         |
| GET                | `/admin/dashboard`                                                           | DASHBOARD_READ    |
| GET                | `/admin/audit-logs` · `/:id`                                                 | AUDIT_READ        |
| GET · PATCH        | `/admin/reports` · `/:id` · POST `/:id/resolve`                              | REPORTS_MANAGE    |
| GET · POST         | `/admin/listings` · `/:id` · `/:id/hide` · `/:id/unhide` · `/:id/close`      | LISTINGS_MODERATE |
| GET                | `/admin/users` · `/:id`                                                      | MEMBERS_READ      |
| POST               | `/admin/users/:id/suspend` · `/:id/unsuspend`                                | MEMBERS_SUSPEND   |
| CRUD               | `/admin/notices` · `/admin/faqs` (+ PUT `/order`) · `/admin/videos`          | CONTENT_MANAGE    |
| CRUD + POST        | `/admin/terms` · `/:id/publish` (drafts editable, published immutable)       | TERMS_MANAGE      |
| GET · PUT          | `/admin/site-settings` · `/:key`                                             | SETTINGS_MANAGE   |
| GET · POST · PATCH | `/admin/admins` · `/:id` · `/:id/reset-password` · `/reset-totp` · `/unlock` | ADMINS_MANAGE     |

## Notes

- **Audit.** Mutations use `@Audit` + `RequestContext.setAuditBefore()`, or `AuditService.record(…, tx)`
  (report resolution). `AdminMutationAuditInterceptor` (APP_INTERCEPTOR) is the safety net for
  every module: an undecorated, successful `/admin/**` mutation that wrote no audit row for its
  request id gets an `auto:<resource>.<handler>` row (secrets stripped). `AdminAuditCoverageService`
  logs undecorated admin mutations at bootstrap.
- **Visitors.** `VisitorCounterMiddleware` PFADDs a hashed visitor id (session token, else ip+UA)
  into `admin:visitors:<KST YYYYMMDD>` for public GETs from non-bots. The SSR frontend must forward
  the browser's IP / User-Agent.
- **Terms.** Publishing a required version that becomes current makes users who agreed only to
  older versions appear in `/auth/me.pendingRequiredTerms` (computed by the auth module).
- **Listing moderation** goes through `LISTING_MODERATION` (adapter over `ListingsModerationService`).
- **Reports.** One open report per (user, target); resolution can hide the listing and/or warn the
  agency (`AgenciesService.recordWarning`) and notifies the reporter and the agency owner.

## Tests

- e2e: `pnpm --filter @house/api test:e2e admin` (`house_test_admin`, Redis DB 8).
- Unit: `pnpm --filter @house/api test -- src/modules/admin`, shared: `pnpm --filter @house/shared test -- src/admin`.
