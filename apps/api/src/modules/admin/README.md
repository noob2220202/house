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

| Method             | Path                                                                                       | Auth              |
| ------------------ | ------------------------------------------------------------------------------------------ | ----------------- |
| POST               | `/reports` (THROTTLE.REPORT + daily cap `REPORT_CREATE`)                                   | User              |
| GET                | `/notices` · `/notices/:id` · `/faqs` · `/videos` · `/site-settings/public`                | Public (cached)   |
| GET                | `/admin/permissions`                                                                       | any admin         |
| GET                | `/admin/dashboard` (+ `notificationsUnread` of the caller) · `/queues` †                   | DASHBOARD_READ    |
| GET                | `/admin/search?q&limit` (q ≥ 2 chars besides spaces/hyphens, limit ≤ 20)                   | DASHBOARD_READ    |
| GET · POST         | `/admin/notifications?cursor&limit&unreadOnly` · `/:id/read` · `/read-all`                 | DASHBOARD_READ    |
| GET                | `/admin/stats/{traffic,listings,deal-requests,ads}?days=7\|30\|90`                         | DASHBOARD_READ    |
| GET                | `/admin/social-login` (read-only, no secrets)                                              | SETTINGS_MANAGE   |
| GET                | `/admin/audit-logs` · `/:id`                                                               | AUDIT_READ        |
| GET · PATCH        | `/admin/reports` · `/:id` · POST `/:id/resolve`                                            | REPORTS_MANAGE    |
| GET · POST         | `/admin/listings` · `/:id` · `/:id/hide` · `/:id/unhide` · `/:id/close`                    | LISTINGS_MODERATE |
| GET                | `/admin/users` · `/:id`                                                                    | MEMBERS_READ      |
| POST               | `/admin/users/:id/suspend` · `/:id/unsuspend`                                              | MEMBERS_SUSPEND   |
| CRUD               | `/admin/notices` · `/admin/faqs` (+ PUT `/order`) · `/admin/videos` (+ PUT `/order` → 204) | CONTENT_MANAGE    |
| CRUD + POST        | `/admin/terms` · `/:id/publish` (drafts editable, published immutable)                     | TERMS_MANAGE      |
| GET · PUT          | `/admin/site-settings` · `/:key`                                                           | SETTINGS_MANAGE   |
| GET · POST · PATCH | `/admin/admins` · `/:id` · `/:id/reset-password` · `/reset-totp` · `/unlock`               | ADMINS_MANAGE     |
| DELETE             | `/admin/admins/:id` → 204 (soft delete)                                                    | ADMINS_MANAGE     |

Response shapes of the WI-10 routes (dashboard queues, search, notifications, stats, social login)
follow the admin app's zod schemas (`apps/admin/src/features/{m-core,m-content}/api/schemas.ts`);
they are typed locally in `schemas.ts` (TODO: move to `packages/shared`). Routes owned by other
modules that the admin app calls: `/admin/agencies/:id/documents/:docId/file`,
`GET /admin/agencies/:id/registry-check?refresh=1`, `/admin/agency-sites`,
`/admin/agencies/:id/site[/decision]`, `/admin/agencies/:id/subscriptions`, `/admin/subscriptions/:id`
(agencies), `/admin/deal-requests/**` (deal-requests).

† `GET /admin/dashboard` answers the shared `AdminDashboard` plus `agencies.sitesPending` (REQUESTED
사무소 홈페이지 of offices that are not deleted; the admin app's badge `agencySitesPending`).
`GET /admin/dashboard/queues` adds `pendingAgencySites: { total, items: [{ agencyId, agencyName,
requestedSlug, requestedAt }] }`, oldest request first.

## Notes

- **Topbar search** (`GET /admin/search`): listings match title, 단지, 건물, 주소, 대표 사무소, 읍면동 —
  and the 매물번호 exactly (`parseListingNo`: "100412", "매물번호 100412"); rows carry `listingNo`.
- **Site settings** (`siteSettingSchemas[key]`, all keys in `GET /site-settings/public`): BUSINESS_INFO,
  CONTACT, SEO, FEATURES (incl. the 이용권 switches `siteSubscriptionRequired` — enforced by the agencies
  module; a write bumps its public cache via `AgencySiteGateService.featuresChanged()` — and
  `platformSubscriptionRequired`, stored but not enforced yet), FOOTER, plus (D9) `HOME_LAYOUT` `{ sections: [{ key, visible }] }` — the home
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

- **Dashboard queues** (`DashboardQueuesService`, cached 30 s, same for every admin): pending
  agencies oldest first with the document checklist (등록증 + 사업자등록증, as the admin app's
  `REQUIRED_AGENCY_DOCUMENTS`; `registryStatus` is always `null` — the lookup runs on the detail
  page), OPEN/MATCHED deal requests newest first, open reports grouped per target (newest report,
  `reportCount`; `handledThisWeek` / `avgHandleHours` since Monday 00:00 KST), banners and popups
  ending within `ADS_ENDING_SOON_DAYS` (CTR from `banner_stat_daily`). 5 rows per panel + `total`.
- **Search** (`AdminSearchService`, never cached): listings (title, complex, building, address,
  office, 읍면동), agencies (name, 대표, 등록번호 via `registration_key`, address, 읍면동), members
  (nickname, name, e-mail, phone digits). The query also matches without spaces/hyphens. Members
  come back masked (`김*진`, `ki***@…`, `010-****-5678`). `listingNo` is always `null` (no
  human-facing listing number exists).
- **Notifications** (`admin_notifications` + per-admin `admin_notification_reads`): shared by all
  admins, derived from the source tables by `AdminNotificationsService.sync()` — new PENDING
  agencies (`AGENCY_APPLIED`), new 사무소 홈페이지 requests (`AGENCY_SITE_REQUEST`, re-armed by a
  re-request: the request time is part of the key), new open reports (`REPORT_RECEIVED`, "N건째"), OPEN deal requests
  with no target office after 30 min (`DEAL_REQUEST_UNASSIGNED`), banners/popups ending within 3
  days (`AD_EXPIRING`, re-armed when the end date changes). One row per event (`dedupe_key`),
  events older than 7 days are skipped. The sync runs lazily (at most once a minute, Redis lock)
  on `GET /admin/notifications` / `GET /admin/dashboard` and every 5 min from the
  admin-maintenance queue; rows older than 90 days are purged daily (04:53 KST). The feed shows 30
  days, newest first, keyset cursor. Read / read-all are audited. `LISTING_REVIEW`, `SECURITY`
  and `SYSTEM` kinds are accepted but not produced yet.
- **Stats** (`AdminStatsService`, cached 2 min per section/window/day): daily KST series of
  `days` points ending today plus `previous` totals of the `days` before. Traffic: visitors from
  the HyperLogLogs, `pageViews` = counted visitor requests (public API GETs, so several per page —
  a proxy, not browser page views), `devices` from the UA of those requests, signups from
  `users.created_at`, `signupsByProvider` by each new member's first identity, `topPages` is `[]`
  (the API does not see page paths). Listings: `created` = first publication (`published_at`),
  `closed` = `closed_at`, active split, top complexes by cumulative `view_count`. Deal requests:
  per type per day, proposals per day, `responseRate` / `avgFirstResponseMinutes` over requests
  created in the period, top 5 regions + "그 밖의 지역". Ads: `banner_stat_daily` (flushed by the
  ads job every 5 min) per day and per slot. The visitor sketches and counters are kept 200 days.
- **Social login** (`SocialLoginStatusService`): 카카오 · 네이버 · Google only. `enabled` follows the
  auth module's rule (Kakao: client id; Naver/Google: id + secret), the client id is masked, no
  secret is ever returned; `lastSuccessAt` / `last24h.success` come from `identities.last_used_at`
  and `userShare` from linked identities ÷ non-withdrawn members. Failed callbacks are not
  recorded, so `last24h.failure` is 0 and `healthy` = `enabled`.
- **Deleting an admin account** is a soft delete (`admin_account_deletions` row, `admin-account.delete`
  audit with the before-snapshot): not oneself (403 `ADMIN_SELF_MODIFICATION`), never the last
  active SUPER_ADMIN (409 `ADMIN_LAST_SUPER_ADMIN`). The AdminUser row stays DISABLED with a
  tombstoned e-mail (`deleted+<id>@deleted.invalid`, the address can be reused), credentials and
  IP allowlist cleared, sessions ended; it disappears from `/admin/admins` and every
  `/admin/admins/:id` route answers 404.
- **Site settings** responses also carry `updatedByAdminName` (= `updatedBy.name`) for the admin app.

## Tests

- e2e: `pnpm --filter @house/api test:e2e admin` (`house_test_admin`, Redis DB 8).
- Unit: `pnpm --filter @house/api test -- src/modules/admin`, shared: `pnpm --filter @house/shared test -- src/admin`.
