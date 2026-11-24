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

- **Site settings** (`siteSettingSchemas[key]`, all keys in `GET /site-settings/public`): BUSINESS_INFO,
  CONTACT, SEO, FEATURES, FOOTER, plus (D9) `HOME_LAYOUT` `{ sections: [{ key, visible }] }` — the home
  sections in display order (`HomeSectionKey`: HERO_SEARCH, CATEGORY_TILES, MAIN_BANNER,
  POPULAR_COMPLEXES, NEW_LISTINGS, DEAL_REQUEST_CTA, FEATURED_AGENCIES, LOCAL_VIDEOS, NOTICES, APP_BAND),
  each key at most once; a key that is not listed keeps its default place and stays visible — and
  `APP_LINKS` `{ iosUrl?, androidUrl? }` (absolute `https://`, no credentials; `null` clears a link).
  The base seed writes defaults (all sections, APP_BAND hidden; no links). Link URLs anywhere in the
  settings reject backslashes and control characters (`isSafeLinkUrl`).

- **Audit.** Mutations use `@Audit` + `RequestContext.setAuditBefore()`, or `AuditService.record(…, tx)`
  (report resolution, member suspension, terms publication). `AdminMutationAuditInterceptor`
  (APP_INTERCEPTOR) is the safety net for every module: an undecorated, successful `/admin/**`
  mutation that wrote no audit row for its request id gets an `auto:<resource>.<handler>` row
  (secrets stripped). The request-id match is only trusted for server-generated ids: requests with a
  client-chosen `x-request-id` are counted in Redis (`admin:audit:rid:<id>`, 10 min), and when two
  requests share an id (or Redis is unavailable) the fallback row is always written.
  `AdminAuditCoverageService` logs undecorated admin mutations at bootstrap.
- **Personal data.** Lists and mutation responses mask contacts. `GET /admin/users/:id` (name,
  email, phone) and `GET /admin/reports/:id` (reporterPhone, when present) return them in full and
  write a `member.pii-view` / `report.pii-view` audit row (개인정보 접속기록; the row holds no PII).
  Audit snapshots of suspensions are projections (`id, status, suspendedAt, suspendedReason`);
  report snapshots carry the masked phone. Reporter phone + ip: erased with the reporter's PII
  scrub (auth `PiiScrubService`) or `REPORT_CONTACT_RETENTION_DAYS` (180) after the report closed
  (`admin-maintenance` queue, daily 04:41 KST, `ReportsService.scrubExpiredContacts`).
- **Visitors.** `VisitorCounterMiddleware` PFADDs a hashed visitor id (session token, else ip+UA)
  into `admin:visitors:<KST YYYYMMDD>` for public GETs from non-bots. The SSR frontend must forward
  the browser's IP / User-Agent.
- **Terms.** Publishing a required version that becomes current makes users who agreed only to
  older versions appear in `/auth/me.pendingRequiredTerms` (computed by the auth module).
  `POST /:id/publish` refuses an effectiveAt in the past (`details.reason: PAST`), not after the
  latest published version (`NOT_AFTER_LATEST`), or — for a revision of an already published type —
  less than `TERMS_NOTICE_DAYS` (7) away (`NOTICE_PERIOD`; unfavourable changes should use
  `TERMS_NOTICE_DAYS_UNFAVORABLE` = 30). Body `{ urgent: true, reason }` overrides the notice
  period only; the audit row records it.
- **Content format.** Notice content, FAQ answers and terms content are Markdown without raw HTML
  (`ADMIN_CONTENT_FORMAT`). The schemas refuse HTML tags and non-http(s)/mailto/tel link
  destinations; frontends must still render with a Markdown renderer that drops raw HTML (e.g.
  react-markdown without rehype-raw) and never use `dangerouslySetInnerHTML`.
- **Listing moderation** goes through `LISTING_MODERATION` (adapter over `ListingsModerationService`;
  force-close is `ListingsModerationService.close`, one transaction).
- **Reports.** One open report per (user, target); resolution claims the report, hides the listing
  (same transaction), warns the agency (`AgenciesService.recordWarning`), notifies the reporter and
  the agency owner and writes the audit row, all atomically; map tiles are invalidated after commit.

## Tests

- e2e: `pnpm --filter @house/api test:e2e admin` (`house_test_admin`, Redis DB 8).
- Unit: `pnpm --filter @house/api test -- src/modules/admin`, shared: `pnpm --filter @house/shared test -- src/admin`.
