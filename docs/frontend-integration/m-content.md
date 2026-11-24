# Frontend integration notes — m-content (apps/admin)

Scope: 콘텐츠 (공지사항 · FAQ · 동네TV · 메인 화면 편집), 단지 관리 (목록 · 상세/수정 · 평형 · 사진 ·
실거래가 동기화), 사이트 설정 (사업자 정보 · 고객센터 · 검색 노출 · 기능 설정), 약관·정책 (버전 ·
게시 → 재동의), 간편로그인 연동 (상태 보기), 관리자 계정·권한, 작업 기록 (필터 · 변경 전/후 비교), 통계.

Code: `apps/admin/src/features/m-content/**`, routes under
`apps/admin/src/app/(console)/{content,complexes,stats}` and
`(console)/settings/{page.tsx,site,terms,social-login,admins,audit-logs}`.
(`(console)/settings/account` belongs to m-core.)

> **Status (2026-11-24):** every endpoint below — the "assumed" ones included — exists in
> `apps/api` (`modules/admin/controllers/*`, `modules/complexes/controllers/admin-*`) and the console
> calls it. Changed since the frontend gate (the admin code is authoritative): complex photos are
> **one whole-list call**, `PUT /admin/complexes/:id/photos { items: [{ mediaId, caption }] }` → the
> new list (order = display order, first = 대표 사진, left-out photos are removed) — there is no
> per-photo POST / PATCH / DELETE or `photos/order`; `DELETE /admin/admins/:id` is a soft delete
> (DISABLED, e-mail released) and `POST /admin/admins/:id/unlock` lifts a second-factor lockout;
> `HOME_LAYOUT` is a real shared site setting (D9) that the user-site home follows. "Assumed" below
> is the wording of the gate, kept for history.

Each **payload shape** is parsed by exactly one zod schema in `features/m-content/api/schemas.ts` (responses) or
`api/inputs.ts` (request bodies — these mirror `packages/shared/src/schemas/admin.ts` where a shared
schema exists). Reconcile by editing the schema and the mock fixture together.

## Routes

| Route                                                            | Min role    | Screen                                                                                    |
| ---------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `/content` → `/content/notices`                                  | OPERATOR    | 공지사항 list (status filter, search, publish / pin switches, delete)                     |
| `/content/notices/new`, `/content/notices/[id]`                  | OPERATOR    | Notice editor: markup toolbar, publish settings, live preview                             |
| `/content/faqs`                                                  | OPERATOR    | FAQ by category: accordion preview, reorder, publish switch, drawer editor                |
| `/content/videos`                                                | OPERATOR    | 동네TV: YouTube URL → thumbnail preview, region / complex link, reorder                   |
| `/content/home`                                                  | ADMIN       | 메인 화면 편집: section order / visibility with a wireframe preview (**stub**, see below) |
| `/complexes`                                                     | OPERATOR    | 단지 list (search, 지역, missing photos / 평형, sort) + latest sync strip                 |
| `/complexes/new`, `/complexes/[id]?tab=facts\|areas\|photos`     | OPERATOR    | 단지 facts form, 평형 table + drawer, photo upload / caption / order; delete is ADMIN+    |
| `/complexes/trade-sync`                                          | OPERATOR    | 실거래가 sync runs (polls while RUNNING); manual trigger is ADMIN+                        |
| `/stats?tab=traffic\|listings\|requests\|ads&days=7\|30\|90`     | OPERATOR    | KPIs with deltas, one-metric trend chart, breakdowns, daily table + CSV download          |
| `/settings` → `/settings/site` (operators → `/settings/account`) | —           | redirect                                                                                  |
| `/settings/site?tab=business\|contact\|seo\|features`            | ADMIN       | Site settings, one tab per `SiteSettingKey`, with footer / search-result previews         |
| `/settings/terms`, `/settings/terms/new`, `/settings/terms/[id]` | ADMIN       | 약관 versions per type; draft editor; publish dialog; published versions are read-only    |
| `/settings/social-login`                                         | ADMIN       | Read-only health of 카카오 · 네이버 · Google sign-in                                      |
| `/settings/admins`                                               | SUPER_ADMIN | 관리자 계정: create, role / status / IP allowlist, reset password / OTP, delete           |
| `/settings/audit-logs`                                           | ADMIN       | 작업 기록: period / resource / admin filters, detail drawer with before–after diff        |

Role checks: pages call `requireAdmin(path, minRole)` on the server; buttons that need a higher role
than the page (단지 삭제, 수동 동기화, 메인 화면 편집 탭) are hidden with `useAdminSession().can()`. The
API must enforce the same roles — the UI checks are convenience only.

## Endpoints listed in the backend READMEs

| Method                | Path                                                                                 | Min role                 | Request                                                                                                                                                             | Assumed response                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                   | `/api/v1/admin/notices?q&status=published\|draft&page&pageSize`                      | OPERATOR                 | `q` searches title + content (**assumed filters**)                                                                                                                  | envelope of `noticeSummarySchema`: `{ id, title, isPinned, isPublished, publishedAt, viewCount, createdByAdminName, createdAt, updatedAt }` — pinned first, then newest                |
| GET                   | `/api/v1/admin/notices/:id`                                                          | OPERATOR                 | —                                                                                                                                                                   | summary + `content`                                                                                                                                                                    |
| POST / PATCH / DELETE | `/api/v1/admin/notices[/:id]`                                                        | OPERATOR                 | `noticeInputSchema` (PATCH: any subset)                                                                                                                             | the notice; `publishedAt` is set by the server the first time `isPublished` turns true                                                                                                 |
| GET                   | `/api/v1/admin/faqs?pageSize=100`                                                    | OPERATOR                 | optional `category`, `q`                                                                                                                                            | envelope of `{ id, category, question, answer, sortOrder, isPublished, updatedAt }` ordered by category, `sortOrder`                                                                   |
| POST / PATCH / DELETE | `/api/v1/admin/faqs[/:id]`                                                           | OPERATOR                 | `faqInputSchema`                                                                                                                                                    | the FAQ; a new one / a category change goes to the end of its category                                                                                                                 |
| GET                   | `/api/v1/admin/videos?pageSize=100`                                                  | OPERATOR                 | optional `q`                                                                                                                                                        | envelope of `local_videos` columns + display extra `complexName`                                                                                                                       |
| POST / PATCH / DELETE | `/api/v1/admin/videos[/:id]`                                                         | OPERATOR                 | POST: `localVideoInputSchema`, empty optional fields **left out**; PATCH: changed fields only, `regionCode` / `complexId` = `null` to unlink (**assumed nullable**) | the video (`youtubeVideoId`, `thumbnailUrl` derived by the server)                                                                                                                     |
| GET                   | `/api/v1/admin/terms?type&pageSize=100`                                              | ADMIN                    | —                                                                                                                                                                   | envelope of `termsSummarySchema` (no `content`): `{ id, type, version, title, isRequired, effectiveAt, publishedAt, isCurrent, consentCount, createdAt, updatedAt }` — drafts included |
| GET                   | `/api/v1/admin/terms/:id`                                                            | ADMIN                    | —                                                                                                                                                                   | summary + `content`                                                                                                                                                                    |
| POST                  | `/api/v1/admin/terms`                                                                | ADMIN                    | `termsDocumentInputSchema`                                                                                                                                          | a **draft** (`publishedAt: null`); `409 TERMS_VERSION_EXISTS` on a duplicate `(type, version)`                                                                                         |
| PATCH / DELETE        | `/api/v1/admin/terms/:id`                                                            | ADMIN                    | subset without `type`                                                                                                                                               | drafts only; `409 TERMS_ALREADY_PUBLISHED` otherwise                                                                                                                                   |
| GET / PUT             | `/api/v1/admin/site-settings/:key`                                                   | ADMIN                    | PUT body = the value object (`siteSettingSchemas[key]`)                                                                                                             | `{ key, value \| null, updatedAt, updatedByAdminName }` — `value: null` until first saved                                                                                              |
| GET                   | `/api/v1/admin/admins?q&role&status&pageSize`                                        | SUPER_ADMIN              | —                                                                                                                                                                   | envelope of `adminAccountSchema`: `{ id, email, name, role, status, totpEnabled, ipAllowlist, lockedUntil, lastLoginAt, lastLoginIp, createdAt }`                                      |
| POST                  | `/api/v1/admin/admins`                                                               | SUPER_ADMIN              | `{ email, name, role, password }` (**assumed body**; password = temporary, 12+ chars with letters, digits, symbols)                                                 | the account; `409 ADMIN_EMAIL_TAKEN`                                                                                                                                                   |
| PATCH / DELETE        | `/api/v1/admin/admins/:id`                                                           | SUPER_ADMIN              | `{ name?, role?, status?, ipAllowlist? }` (**assumed body**)                                                                                                        | the account; `409 ADMIN_SELF_CHANGE` (own role / status / delete), `409 ADMIN_LAST_SUPER_ADMIN`                                                                                        |
| GET                   | `/api/v1/admin/audit-logs?resourceType&resourceId&adminUserId&from&to&page&pageSize` | ADMIN                    | `auditLogQuerySchema`; `from` / `to` are sent as KST day bounds (`…T00:00:00+09:00`, `…T23:59:59.999+09:00`)                                                        | envelope of the `audit_logs` columns + display extras `adminName`, `adminEmail`, `resourceLabel`; newest first                                                                         |
| POST / PATCH / DELETE | `/api/v1/admin/complexes[/:id]`                                                      | OPERATOR (DELETE: ADMIN) | `complexFormSchema` — the `complexes` columns that are facts (see `api/inputs.ts`); PATCH: any subset                                                               | `complexDetailSchema`; `409 COMPLEX_EXTERNAL_CODE_TAKEN`, `409 COMPLEX_HAS_LISTINGS` on delete                                                                                         |
| POST                  | `/api/v1/admin/complexes/trade-sync`                                                 | ADMIN                    | `{ yearMonth }` (YYYYMM integer, **assumed body**)                                                                                                                  | `202 { runs: TradeSyncRun[] }` — one run per kind (`APT_TRADE`, `APT_RENT`); `409 TRADE_SYNC_ALREADY_RUNNING`, `409 TRADE_SYNC_FUTURE_MONTH`                                           |
| GET                   | `/api/v1/admin/complexes/trade-sync/runs?status&page&pageSize`                       | OPERATOR                 | —                                                                                                                                                                   | envelope of the `trade_sync_runs` columns + display extra `triggeredByAdminName` (null = scheduled job); newest first                                                                  |
| POST                  | `/api/v1/admin/media?purpose=COMPLEX_PHOTO`                                          | OPERATOR                 | multipart `file` (media module; mock owned by **m-ads**)                                                                                                            | `MediaDto` — only `id` is used, then attached with the photo endpoint below                                                                                                            |

Notes on these:

- **Content format.** `notices.content`, `faqs.answer` and `terms.content` are edited and stored as
  **plain text with light markup** — exactly the format the user site renders (`## 제목`, `### 소제목`,
  `- 항목`, `1. 항목`, blank line = paragraph, `제1조 (목적)` / `부칙` lines, bare `http(s)://` links).
  The editor (`components/MarkupEditor.tsx`) is a textarea with a toolbar that writes this markup;
  the preview uses `lib/rich-text.ts`, a verbatim copy of `apps/web/src/features/w-content/lib/rich-text.ts`
  (candidate for `packages/shared`). No HTML is produced, stored or injected anywhere, so there is
  nothing to sanitize. If the backend decides on HTML content instead, both the editor and the web
  renderer need to change together (with a server-side sanitizer).
- **동네TV bodies.** `localVideoInputSchema` validates `regionCode` (region pattern) and `complexId`
  (UUID) when present, so the create body leaves empty ones out (`api/inputs.ts → videoCreateBody`) —
  an empty string would be a 400. The update body (`videoPatchBody`) sends only changed fields; a
  cleared description is `''`, and unlinking a region / complex sends `null`, which the shared schema
  does not allow today: the backend's update schema should be
  `localVideoInputSchema.partial().extend({ regionCode: regionCodeSchema.nullable().optional(), complexId: idSchema.nullable().optional() })`
  (without `isPublished`'s default, or a PATCH of the title would re-publish). The mock validates
  with exactly these schemas (`videoCreateBodySchema`, `videoPatchSchema`).
- **PATCH and Zod 4 defaults (backend, please read).** In Zod 4, `schema.partial()` still applies
  a field's `.default()` when the field is missing: `noticeInputSchema.partial().parse({ isPinned: true })`
  gives `{ isPinned: true, isPublished: false }`. A PATCH handler built that way would unpublish a
  notice when it is pinned, or re-publish a hidden video / FAQ on a text edit. The admin therefore
  always sends the boolean flags together (notice list toggles send `isPinned` + `isPublished`; the
  video PATCH always carries `isPublished`), but the update schemas should be written without
  defaults (e.g. `z.object({ … }).partial()` over fields that have no `.default()`).
- **Path params.** Every id interpolated into an API path is `encodeURIComponent`-ed
  (`api/index.ts → seg`): route params arrive decoded, so `/content/notices/..%2F..%2Fadmins` must
  not turn into a request on another endpoint.
- **Site settings.** The four real keys are `BUSINESS_INFO`, `CONTACT`, `SEO`, `FEATURES`
  (`SiteSettingKey`). Forms validate more strictly than the shared schemas (required fields,
  사업자등록번호 check digit — the all-zero placeholder `000-00-00000` is allowed, phone pattern,
  `https://` KakaoTalk channel). `SEO.ogImageMediaId` is passed through unchanged (no uploader yet).
  `FEATURES` is a free `Record<string, boolean>`; the UI knows `dealRequests`, `tradeHistory`,
  `community`, `appBand` (labels in `lib/labels.ts → FEATURE_META`) and shows any other stored key
  with its raw name. The user site reads these through `GET /site-settings/public` (revalidate 300 s),
  so the save toast says "5분 안에 반영".
- **Terms lifecycle.** create → draft; `publish` → immutable; the version with the latest
  `effectiveAt ≤ now` among published ones is `isCurrent`. The UI shows 작성 중 / 적용 예정 (D-n) /
  적용 중 / 지난 버전 and allows one draft per type at a time (UI rule only). `effectiveAt` is sent as
  midnight KST of the chosen date. Re-consent: after a **required** version becomes current, the
  backend is expected to treat members without a consent row for that document as
  `signupCompleted: false` (see `w-auth.md`); the publish response may tell how many members that is.
- **Admin accounts.** The UI never shows or stores passwords after submit. Self-protection rules
  (own role / status, last active SUPER_ADMIN) are checked by the API; the UI only disables the
  obvious controls for the signed-in admin.
- **Audit log.** `action` strings are assumed to be dot-separated `noun[.noun].verb`
  (`notice.create`, `complex.photo.add`, `complex.trade_sync.trigger`, `user.view_personal_data` …);
  `lib/labels.ts → auditActionLabel()` turns them into Korean and falls back to the raw string, and
  `FIELD_LABEL` names diff paths. `before` / `after` are arbitrary JSON snapshots; the drawer flattens
  nested objects into dot paths and compares arrays as whole values.

## Assumed endpoints (not in any README yet)

| Method         | Path                                                                                                                                         | Min role    | Request                                                                                                | Response / behaviour                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PUT            | `/api/v1/admin/faqs/order`                                                                                                                   | OPERATOR    | `{ ids: string[] }` — the full order of ONE category                                                   | `204`; sets `sortOrder` 1…n                                                                                                                                                                                                         |
| PUT            | `/api/v1/admin/videos/order`                                                                                                                 | OPERATOR    | `{ ids: string[] }` — the full order                                                                   | `204`                                                                                                                                                                                                                               |
| POST           | `/api/v1/admin/terms/:id/publish`                                                                                                            | ADMIN       | —                                                                                                      | the document + `reconsentUserCount` (nullable); `409 TERMS_ALREADY_PUBLISHED`, `409 TERMS_EFFECTIVE_DATE_INVALID` when `effectiveAt` is not after the currently published version's                                                 |
| GET / PUT      | `/api/v1/admin/site-settings/HOME_LAYOUT`                                                                                                    | ADMIN       | `{ sections: [{ key, visible }] }`                                                                     | same envelope as the other keys — **`HOME_LAYOUT` is not in `SiteSettingKey` yet** (see "메인 화면 편집")                                                                                                                           |
| GET            | `/api/v1/admin/complexes?q&emdCode&missing=photos\|areaTypes&sort=name\|households\|builtYear\|listings\|views\|updatedAt&dir&page&pageSize` | OPERATOR    | —                                                                                                      | envelope of `complexSummarySchema` (facts + `areaTypeCount`, `photoCount`, `activeListingCount`, `viewCount`, `lastTradeDate`)                                                                                                      |
| GET            | `/api/v1/admin/complexes/:id`                                                                                                                | OPERATOR    | —                                                                                                      | `complexDetailSchema`: all fact columns + `areaTypes[]` (with `tradeCount`, `lastSalePrice`), `photos[]` (`{ id, mediaId, url, width, height, caption, sortOrder }`), `trades: { total, unmatched, lastDealDate }`, `favoriteCount` |
| POST           | `/api/v1/admin/complexes/:id/area-types`                                                                                                     | OPERATOR    | `areaTypeFormSchema`: `{ exclusiveArea, supplyArea, typeName, pyeongLabel, households, rooms, baths }` | the 평형; `409 AREA_TYPE_EXISTS` on a duplicate `(exclusiveArea, typeName)`                                                                                                                                                         |
| PATCH / DELETE | `/api/v1/admin/complexes/:id/area-types/:areaTypeId`                                                                                         | OPERATOR    | same body                                                                                              | the 평형 / `204`                                                                                                                                                                                                                    |
| PUT            | `/api/v1/admin/complexes/:id/photos`                                                                                                         | OPERATOR    | `{ items: [{ mediaId, caption? }] }` — the whole list (file uploaded first via `/admin/media`)         |
| POST           | `/api/v1/admin/admins/:id/unlock`                                                                                                            | SUPER_ADMIN | —                                                                                                      |
| POST           | `/api/v1/admin/admins/:id/reset-totp`                                                                                                        | SUPER_ADMIN | —                                                                                                      | the account with `totpEnabled: false`; clears the secret + recovery codes, destroys sessions                                                                                                                                        |
| POST           | `/api/v1/admin/admins/:id/reset-password`                                                                                                    | SUPER_ADMIN | `{ password }`                                                                                         | the account; unlocks it, destroys sessions                                                                                                                                                                                          |
| GET            | `/api/v1/admin/social-login`                                                                                                                 | ADMIN       | —                                                                                                      | `{ items: [{ provider: KAKAO\|NAVER\|GOOGLE, enabled, healthy, clientIdMasked, callbackUrl, lastSuccessAt, last24h: { success, failure }, userShare, message }] }` — secrets are never returned                                     |
| GET            | `/api/v1/admin/stats/traffic?days=7\|30\|90`                                                                                                 | OPERATOR    | —                                                                                                      | `{ days, points: [{ date, visitors, pageViews, signups }], previous: { visitors, pageViews, signups }, devices: { mobile, desktop }, signupsByProvider[], topPages[] }`                                                             |
| GET            | `/api/v1/admin/stats/listings?days`                                                                                                          | OPERATOR    | —                                                                                                      | `{ days, points: [{ date, created, closed }], previous, activeTotal, byAssetType[], byDealType[], topComplexes[] }`                                                                                                                 |
| GET            | `/api/v1/admin/stats/deal-requests?days`                                                                                                     | OPERATOR    | —                                                                                                      | `{ days, points: [{ date, sell, find, proposals }], previous, responseRate, avgFirstResponseMinutes, byRegion[] }`                                                                                                                  |
| GET            | `/api/v1/admin/stats/ads?days`                                                                                                               | OPERATOR    | —                                                                                                      | `{ days, points: [{ date, impressions, clicks }], previous, activeBanners, bySlot[] }`                                                                                                                                              |
| GET            | `/api/v1/regions?sggCode`                                                                                                                    | public      | —                                                                                                      | 읍면동 list for the 지역 select (first assumed by **w-map**; admin mock owned by **m-ads**)                                                                                                                                         |

- **Stats series contract.** `points` are daily rows in KST, oldest → newest, ending today, exactly
  `days` long (missing days = zero rows, not gaps). `previous` holds the totals of the `days` right
  before the window — the KPI deltas come from it. The UI derives everything else (방문당 페이지뷰,
  순증, 요청당 제안, CTR). For 90 days the chart groups points into 7-day buckets on the client.
  m-core's dashboard already assumes `GET /admin/stats/traffic?days=7`; the two should end up as one
  endpoint.
- **Complex `emdCode` → `sggCode`.** The form only sends `emdCode` (+ free-text `emdName`); the
  backend derives `sggCode` from it.

## 메인 화면 편집

The editor stores `{ sections: [{ key, visible }] }` under the shared site-setting key
`HOME_LAYOUT` (D9; `HOME_SECTION_KEYS` in `api/schemas.ts` = shared `HomeSectionKey`).
`HERO_SEARCH` is locked first and visible. The setting is part of `GET /site-settings/public` and
the user-site home renders its sections in that order and skips hidden ones
(`apps/web/src/features/w-home/lib/home-layout.ts`).

## Mock resources (all under `apps/admin/src/app/mock-api/v1/admin/`)

Owned by m-content: `notices/**`, `faqs/**`, `videos/**` (incl. `videos/thumb/[key]` — drawn SVG
stills), `terms/**`, `site-settings/[key]`, `admins/**`, `audit-logs`, `social-login`,
`stats/[section]`, `complexes/**` (incl. `complexes/photo-art/[key]` — drawn SVG photos).
Used but owned by others: `media/**`, `../regions`, `../complexes` (m-ads), `auth/**` (foundation / m-core).

- State lives in one in-memory store on `globalThis` (`features/m-content/mock/store.ts`); it resets
  when the server restarts. Every mutation appends an audit row, so 작업 기록 fills up as you click
  around.
- Dev switches on any m-content page URL (forwarded to its API calls, mock mode only):
  `?_empty=1` (empty lists / never-saved settings), `?_error=1` (500), `?_delay=1500`,
  `?_degraded=1` (간편로그인: Google unhealthy).
- A manual trade sync stays `RUNNING` for ~6 s, then succeeds — enough to see the polling UI.
- Mock sign-in: `/mock-api/v1/admin/auth/dev-login?as=super|admin|operator&returnTo=/`.

## Tests

`pnpm --filter admin test` — `features/m-content/lib/*.test.ts` (diff, markup commands, rich-text
parser, stats / chart helpers, terms versions, audit filters, admin account helpers, 사업자등록번호),
`api/inputs.test.ts` (form schemas) and `components/components.test.tsx` (MarkupEditor, RichPreview,
BarList).

## Open points for the integrator

1. ~~`HOME_LAYOUT`~~ — done (D9, above).
2. Filters on the admin list endpoints (`q`, `status`, `role`, `missing`, `sort`) are assumed.
3. `reconsentUserCount` on publish and `consentCount` per version are display extras — the UI hides
   them when null.
4. `complexes.trades.unmatched` (source rows that matched the complex but no 평형) drives a warning on
   the detail page; drop the field and the warning disappears.
5. Audit `action` naming and the display extras (`adminName`, `resourceLabel`) — without them the
   table shows raw codes / ids.
6. Stats endpoints are entirely assumed; if only some sections are built, the others show their
   error state independently (one request per tab).
