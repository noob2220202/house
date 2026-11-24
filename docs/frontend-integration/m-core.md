# Frontend integration notes — m-core (admin login · TOTP · shell data · dashboard · search · notifications · account)

Scope: `apps/admin/src/features/m-core/**`, the routes below and the mock resources listed at the
end. Design reference: `design/drafts/project/AdminDashboard.dc.html` (login / search /
notifications / account have no draft and are extrapolated from the design system and
`Login.dc.html`). Conventions: `docs/FRONTEND.md`.

## Routes

| Path                | File                                          | Notes                                                                                                                                                                |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`            | `src/app/login/page.tsx`                      | Public (the only page without a session). `?returnTo=<site-relative path>` · `?reason=expired`. Signed-in admins (`mfaVerified`) are redirected to the target.       |
| `/`                 | `src/app/(console)/page.tsx`                  | Dashboard per the draft. `?denied=1` shows the "권한 없음" notice (`requireAdmin(returnTo, minRole)` redirects there).                                               |
| `/search`           | `src/app/(console)/search/page.tsx`           | Global search results, `?q=`. Target of the topbar search (Enter) and of the phone search icon.                                                                      |
| `/notifications`    | `src/app/(console)/notifications/page.tsx`    | Notification centre behind the topbar bell.                                                                                                                          |
| `/settings/account` | `src/app/(console)/settings/account/page.tsx` | 내 계정: profile, role → menu access, TOTP re-enrolment, password change. Open to every admin role (the sidebar's "사이트 설정" parent is ADMIN+, this page is not). |
| layout              | `src/app/(console)/layout.tsx`                | `requireAdmin()` + first-paint shell counters, renders `<ConsoleShell>` (foundation `AdminShell` wired to live data).                                                |

All pages inherit `robots: noindex, nofollow` from the root layout (back-office, nothing public).

## Login flow

1. `POST /admin/auth/login { email, password }` (`adminLoginSchema`) → `{ mfaVerified, totpEnrolled }`
   and a **half-authenticated** `house_admin_sid` cookie.
2. `totpEnrolled = true` → 6-digit code → `POST /admin/auth/totp/verify { code }`
   (`adminTotpVerifySchema`) → session upgraded → full-page navigation to `returnTo`.
3. `totpEnrolled = false` (first login / after a reset by a SUPER_ADMIN) →
   `POST /admin/auth/totp/setup` → `{ secret, otpauthUrl }` → the QR is rendered **in the browser**
   from the `otpauth://` URI (`features/m-core/lib/qr.ts`, no image service, the secret never leaves
   the page) + manual key → first code via `/totp/verify` → `recoveryCodes` shown once (copy /
   download, must be acknowledged) → console.
4. "다른 계정으로 로그인" calls `POST /admin/auth/logout` to drop the half-authenticated session.
5. Session loss anywhere in the console (any query/mutation answering `401` that is not a form
   error, `AUTH_TOTP_REQUIRED` included) → `/login?returnTo=<current path>&reason=expired`
   (`SessionWatcher`; on a full page load `SessionRedirect`, see the notes below).
6. Phones: next to the QR, an "이 휴대폰의 인증 앱에 추가" button opens the `otpauth://` URI directly
   (shown for `max-width: 720px` or a coarse pointer — a QR cannot be scanned by the same device).

Error codes handled explicitly (`features/m-core/lib/session.ts`): `AUTH_INVALID_CREDENTIALS`,
`AUTH_ACCOUNT_LOCKED`, `AUTH_ACCOUNT_SUSPENDED`, `AUTH_IP_NOT_ALLOWED`, `AUTH_TOTP_INVALID`,
`AUTH_SESSION_EXPIRED` / `UNAUTHENTICATED` (restart the flow). Validation errors map to fields via
`details[].path` (`email`, `password`, `code`, `currentPassword`, `newPassword`).

## Endpoints listed in the backend READMEs (payload shapes are assumptions — no controller exists yet)

| Method | Path                                  | Used by                                 | Shape assumed by the frontend (zod schema in `features/m-core/api/schemas.ts`)                                                                                                                                                                                                      |
| ------ | ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/admin/auth/login`            | login step 1                            | body `adminLoginSchema`; response `adminLoginResultSchema` `{ mfaVerified: boolean (default false), totpEnrolled: boolean (default true) }`. Sets the admin session cookie in a "TOTP pending" state.                                                                               |
| POST   | `/api/v1/admin/auth/totp/verify`      | login step 2, enrolment, re-enrolment   | body `{ code: "123456" }`; response `totpVerifyResultSchema` `{ recoveryCodes?: string[] }` (present once, right after an enrolment). Invalid code → `AUTH_TOTP_INVALID` with a **non-401** status (the mock uses 400) or 401 with that code.                                       |
| POST   | `/api/v1/admin/auth/totp/setup`       | first enrolment, account page           | no body; response `totpSetupSchema` `{ secret: base32, otpauthUrl: "otpauth://totp/…" }`. Must be callable with the half-authenticated session **and** with a verified one (re-enrolment).                                                                                          |
| GET    | `/api/v1/admin/auth/me`               | session, account page                   | `AdminUser` (foundation) + optional `totpEnabled`, `totpEnrolledAt`, `passwordChangedAt`, `lastLoginIp` (`adminAccountSchema`). 401 while the TOTP step is pending (or `mfaVerified: false`, both are handled).                                                                     |
| POST   | `/api/v1/admin/auth/logout`           | account menu, cancel login              | —                                                                                                                                                                                                                                                                                   |
| GET    | `/api/v1/admin/dashboard`             | shell (badges, bell, status card), KPIs | `dashboardSummarySchema`, see below.                                                                                                                                                                                                                                                |
| POST   | `/api/v1/admin/agencies/:id/decision` | dashboard 승인 / 반려                   | `agencyDecisionSchema` `{ status: APPROVED \| REJECTED, reason? }`. 승인 is offered only when `readyToApprove` (m-moderation/lib/labels.ts: documents complete && `registryStatus === 'MATCHED'`); otherwise the row links to 심사하기 `/agencies/:id`. Mock owned by m-moderation. |

`GET /admin/dashboard` (`dashboardSummarySchema`):

```jsonc
{
  "generatedAt": "2026-11-23T05:20:00.000Z",
  "badges": {
    "listingsPending": 12,
    "agenciesPending": 4,
    "dealRequestsOpen": 5,
    "reportsOpen": 3,
  },
  "notificationsUnread": 8,
  "kpis": {
    "visitors": { "today": 3482, "yesterday": 3206 },
    "newListings": { "today": 47, "yesterday": 35, "pendingReview": 12 },
    "dealRequests": { "today": 5, "sell": 3, "find": 2, "unassigned": 1 },
    "pendingAgencies": { "count": 4, "oldestWaitingDays": 3, "needsDocuments": 1 },
  },
  // 카카오 · 네이버 · Google only — any other provider fails the schema
  "socialLogin": [{ "provider": "KAKAO", "enabled": true, "healthy": true }],
}
```

The README only promises "pending agencies, open reports, active listings" counters — everything
else in this payload is an assumption. `badges`, `notificationsUnread` and `socialLogin` default to
zero / empty when missing; `kpis` is required for the KPI row.

## Assumed endpoints (not in any backend README)

| Method | Path                                                         | Used by                     | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/admin/dashboard/queues`                             | dashboard panels            | `dashboardQueuesSchema`: `{ pendingAgencies: { total, items[] }, dealRequests: { total, items[] }, reports: { total, items[], handledThisWeek, avgHandleHours }, expiringAds: { total, items[] } }` — item shapes: `pendingAgencySchema` (incl. `registryStatus: MATCHED \| MISMATCH \| NOT_FOUND \| UNAVAILABLE \| null`, the same field as `GET /admin/agencies`), `dashboardDealRequestSchema`, `dashboardReportSchema`, `expiringAdSchema`. |
| GET    | `/api/v1/admin/stats/traffic?days=7\|30\|90`                 | 방문 추이 chart             | Shared with the stats page (m-content owns the mock): `{ days, points: [{ date: "YYYY-MM-DD" (KST), visitors, pageViews, signups }], signupsByProvider: [{ provider, count }] }`, oldest → newest, last point = today.                                                                                                                                                                                                                          |
| GET    | `/api/v1/admin/search?q=&limit=`                             | topbar suggestions, /search | `adminSearchSchema`: `{ query, listings: { total, items[] }, agencies: { total, items[] }, users: { total, items[] } }`. `q` ≥ 2 chars (else `400 VALIDATION_FAILED`, path `q`). Member `email` / `phone` are expected **already masked** by the API.                                                                                                                                                                                           |
| GET    | `/api/v1/admin/notifications?cursor=&limit=&unreadOnly=true` | notification centre         | `CursorPage`: `{ items: [{ id, kind, title, body?, link?, createdAt, readAt? }], nextCursor, unreadCount }`. `kind` ∈ `AGENCY_APPLIED · LISTING_REVIEW · REPORT_RECEIVED · DEAL_REQUEST_UNASSIGNED · AD_EXPIRING · SECURITY · SYSTEM` (unknown kinds render as SYSTEM). `link` must be a site-relative admin path.                                                                                                                              |
| POST   | `/api/v1/admin/notifications/:id/read`                       | open a notification         | —                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| POST   | `/api/v1/admin/notifications/read-all`                       | 모두 읽음                   | —                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| POST   | `/api/v1/admin/auth/password`                                | account page                | body `{ currentPassword, newPassword }`; wrong current password → validation error on `currentPassword`. Client-side policy (assumed): ≥ 10 chars with a letter and a digit (`ADMIN_PASSWORD_MIN` in `features/m-core/lib/otp.ts`).                                                                                                                                                                                                             |

Notes for the integrator:

- **Dashboard chart**: the stats endpoint only returns one window, so the dashboard asks for a
  longer one and splits it (7-day view → `days=30`, 30-day view → `days=90`) to draw the dashed
  "직전 기간" line. If the backend prefers, add `previous: TrafficPoint[]` to the response and
  simplify `splitTraffic()` (`features/m-core/lib/dashboard.ts`).
- **Dashboard refresh**: summary + queues are refetched every 5 minutes (`DASHBOARD_REFRESH_MS`),
  the summary also on window focus; the server layout fetches the summary once per full navigation
  for the first paint (sidebar badges and bell without pop-in), so `GET /admin/dashboard` should be
  cheap (counters only).
- **Search**: suggestions use `limit=3`, the results page `limit=8`; "모두 보기" links go to
  `/listings?q=`, `/agencies?q=`, `/users?q=` (m-moderation list pages are expected to honour `q`).
  Result rows link to `/listings/:id`, `/agencies/:id`, `/users/:id`.
- **매물번호**: the draft's search placeholder promises a search by listing number, but neither
  `packages/shared` nor the listings README has a human-facing number yet. `listingNo` is therefore
  an optional (nullable) field of a listing hit; the mock derives one from the id
  (`mockListingNo`). If the backend never adds one, drop the field and reword the placeholder.
- **Expiring ads** ("연장 처리") open the m-ads editor drawer where the schedule is extended:
  `/banners?edit=<id>` (banner) or `/banners/popups?edit=<id>` (popup, `kind: "POPUP"`). An ad counts
  as expiring when it is live and ends within 7 KST days; `ctr` is clicks ÷ impressions (0–1, null
  without impressions), `imageUrl` the creative thumbnail (optional).
- **Deal requests / reports** rows link to `/deal-requests/:id` and `/reports/:id` (m-moderation).
  A report row stands for one reported target (listing or office): `id` = newest open report,
  `reportCount` = open reports against the same target.
- **Role model**: the sidebar and the "메뉴 접근 권한" card derive from `ADMIN_NAV` (`minRole`,
  `ADMIN_ROLE_RANK`). Page-level enforcement stays with each page (`requireAdmin(returnTo, minRole)`)
  and, authoritatively, with the API.
- **Stale cookie on a full page load** (the common expiry: `SessionService` sets the cookie's
  `maxAge` to the _absolute_ TTL while Redis drops the session at the _idle_ TTL): the middleware
  lets the request through (cookie present), `GET /admin/auth/me` answers 401 and the console layout
  renders `<SessionRedirect>` instead of the shell, which replaces the location with
  `/login?returnTo=<this page>&reason=expired`. (A server `redirect()` from the layout cannot keep
  the deep link — layouts do not know the pathname.) The layout fetches `/admin/auth/me` and
  `/admin/dashboard` in parallel.
- **`AUTH_TOTP_REQUIRED`**: the API guard answers it (401) on every `/admin/*` route for a session
  that is not TOTP-verified. In the console it counts as a lost session (→ login); during the login
  flow it is the expected state and does **not** restart the flow.
- **Contract risks to settle with the auth module** (README lists `POST /admin/auth/totp/setup` as
  "Admin", which the global guard would reject with `AUTH_TOTP_REQUIRED` for the half-authenticated
  session of a first-time login):
  1. `/totp/setup` must accept the half-authenticated session of an admin **without** an enrolled
     authenticator (first login) — e.g. `@Public()` + an explicit check in the handler.
  2. A setup call must only stage a _pending_ secret; the active secret may only be replaced by a
     successful `/totp/verify`. Otherwise abandoning the re-enrolment dialog on the account page (or
     two setup calls racing) locks the admin out. The frontend shows only the latest setup response.
  3. Re-enrolment from the account page currently needs nothing but the verified session. Consider
     requiring the current TOTP code or password on `/totp/setup` for an already enrolled admin
     (the dialog can ask for it once the API defines the field).
- **Notification links** are followed only when they pass the same check as `returnTo`
  (`safeReturnTo`: site-relative, no `//`, no backslash, no control characters) and render as real
  links (open in new tab works); opening one marks it read.

## Mock-only routes (no backend counterpart)

- `GET /mock-api/v1/admin/auth/dev-login?as=super|admin|operator&returnTo=` (foundation) — instant
  sign-in for screenshots / development.
- `GET /mock-api/v1/admin/auth/dev-accounts` — lists the fictional test accounts for the login
  page's "개발용 목(mock) 로그인" helper (rendered only when `NEXT_PUBLIC_API_MOCK=1`; the endpoint
  404s otherwise, and no credential is compiled into the production bundle). Accounts cover: each
  role, an account without TOTP (enrolment flow) and a locked account. The mock accepts a fixed
  test code or a real authenticator code for the RFC example secret.
- `GET /mock-api/v1/admin/dashboard?_reset=1` — restores the notification fixtures.

## Mock resources owned by m-core

`apps/admin/src/app/mock-api/v1/admin/`: `auth/{login,totp/setup,totp/verify,password,dev-accounts}`
(+ `_mcore.ts`; `auth/{me,logout,dev-login,_fixtures.ts}` are the foundation's), `dashboard/**`,
`search/**`, `notifications/**`. The dashboard mock aggregates like the real endpoint would
(`dashboard/_remote.ts`): over HTTP it reads the approval queue from `GET /admin/agencies`, open
requests from `GET /admin/deal-requests`, the report queue + handling stats from
`GET /admin/reports` (all m-moderation), live banners from `GET /admin/banners` (m-ads) and today's
visitors from `GET /admin/stats/traffic` (m-content). So the dashboard, the sidebar badges, the
management pages and the stats page agree, and every dashboard row opens a record that exists in
the sibling mock. Each source falls back to local fixtures (the numbers of the draft) when its
sibling mock is missing or slow (2.5 s timeout). `features/m-core/api/schemas.test.ts` and
`dashboard-mock.test.ts` parse the fixtures and the aggregated payloads with the page schemas.
The search mock works the same way (`search/_remote.ts`): its corpus is the m-moderation
`/admin/listings`, `/admin/agencies` and `/admin/users` lists (local `_fixtures.ts` per group as a
fallback), matched ignoring case, spaces and hyphens; member e-mail / phone / name are matched on
the full value but returned masked.

## Shell changes made by m-core (foundation files)

Small, additive edits in `apps/admin/src/components/shell/` so the layout holds at every width:

- `AdminShell` / `AdminTopbar`: optional `topbarSearch` / `search` slot. m-core passes
  `<GlobalSearch>` (live suggestions, ⌘K / Ctrl+K, phone icon link); without the prop the original
  submit-only pill is rendered.
- `AdminShell.module.css`: a 721–960px block (the sidebar is still visible there, the topbar used to
  overflow horizontally and squeeze the title out) and, per the 390 draft, no outline on the bell at
  phone width.

## Deviations from the draft

- No Apple tile in the sidebar "간편 로그인 연동" card and no "4/4" counter (카카오 · 네이버 ·
  Google only).
- The draft is a fixed 1440 × 1000 artboard; the page is fluid: 2 × 2 KPIs below 1208px, single
  column below 1181px, and the stacked "phone" panel layouts (cards instead of the table, stats above
  the chart) already from 1040px down because the sidebar keeps taking 240px until 720px.
- A search icon was added to the phone topbar (the draft has no way to reach search on a phone).
