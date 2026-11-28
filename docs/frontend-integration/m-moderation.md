# Frontend integration notes — m-moderation (admin: 중개사 승인 · 매물 검수 · 신고 · 내놓기·구하기 · 회원)

Scope: `apps/admin/src/app/(console)/{agencies,listings,reports,deal-requests,users}/**`,
`apps/admin/src/features/m-moderation/**`, and the mock resources listed below. See
`docs/FRONTEND.md` for conventions.

> **Status (2026-11-24):** every endpoint below exists in `apps/api` and the console calls it.
> Changed since the frontend gate (the admin code is authoritative): the private document stream is
> **`GET /admin/agencies/:id/documents/:docId/file`**; the registry re-check is
> **`GET /admin/agencies/:id/registry-check?refresh=1`** (plain `GET` = cached result); 검토 시작 is
> **`PATCH /admin/reports/:id { status: IN_REVIEW }`** (`reportReviewSchema`) and the memo is the
> same `PATCH` with `{ note }` — there is **one note per report** (`resolutionNote`, no separate
> `internalNote` column); `POST /admin/reports/:id/resolve` takes the final decision only
> (`RESOLVED` + action, or `REJECTED`). Report `attachments` are still not sent by the API (the
> admin shows "첨부된 증빙 자료가 없어요"). "Assumed" below is the wording of the gate.

Each response is parsed by exactly one zod schema in
`apps/admin/src/features/m-moderation/api/schemas.ts`, and
`api/schemas.test.ts` asserts that every mock fixture parses with it — reconcile the schema and the
fixture together.

## Routes

| Route                 | What                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/agencies`           | 승인 queue (default tab 승인 대기, oldest first) + office search. Tabs 승인 대기 · 승인 · 반려 · 정지 · 전체. One-click 승인 when 서류 + 등록 조회 are clean.                                                |
| `/agencies/sites`     | 사무소 홈페이지 queue (SPEC `docs/agency-sites/SPEC.md` §5). Tabs 승인 대기 (oldest first) · 운영 중 · 정지 · 반려; 반려 / 승인 (editable slug) from the row. Own sidebar item + badge `agencySitesPending`. |
| `/agencies/[id]`      | Application data, 등록 조회 결과 (application ↔ registry comparison, 다시 조회), private document viewer, applicant account, members, warnings, history, decision.                                          |
| `/listings`           | Listing search + 검수 필요 queue. Tabs 전체 · 검수 필요 · 광고중 · 계약중 · 거래완료 · 숨김, filters 매물 종류 · 거래 유형 · 정렬.                                                                           |
| `/listings/[id]`      | Photos, 명시사항, private 호수, co-brokers, 실매물 확인 records, reports, change history; 숨김 / 숨김 해제 / 강제 종료 with reason.                                                                          |
| `/reports`            | 허위매물 신고 queue. Tabs 새 신고 · 검토 중 · 조치 완료 · 기각 · 전체, filter 신고 대상. 24h handling target shown per row.                                                                                  |
| `/reports/[id]`       | Report text, reporter, evidence viewer, target listing / office, related reports, internal memo, timeline; 검토 시작 / 조치 (매물 숨김 · 중개사 경고) / 기각.                                                |
| `/deal-requests`      | 내놓기·구하기 monitoring. Tabs 전체 · 내놓기 · 구하기 · 스팸 의심 · 스팸 표시, filter 상태.                                                                                                                  |
| `/deal-requests/[id]` | Request, requester + contact, proposals, target offices + contact grants, automatic abuse signals, history; 스팸 표시 / 해제 / 요청 종료.                                                                    |
| `/users`              | Member search (name / e-mail / phone **masked**). Tabs 전체 · 정상 · 이용 정지 · 탈퇴, filters 유형 · 로그인 수단.                                                                                           |
| `/users/[id]`         | Profile, linked identities (카카오 · 네이버 · Google), consents, activity, sanctions; 이용 정지 (reason) / 정지 해제. Shows the audit-log notice.                                                            |

- All list state (tab, filters, search, page) lives in the query string (`lib/list-params.ts`,
  unit tested); defaults are dropped from the URL. `q` is the search key on every list, so the
  topbar search (m-core) can deep-link: `/listings?q=`, `/agencies?q=`, `/users?q=`. `/agencies?q=…`
  without a `status` redirects to `status=ALL` (a search should not be limited to the queue).
- Tab counts need no extra endpoint: one `pageSize=1` list call per tab, reading `total`
  (`fetchCounts`). If the backend prefers a `counts` field / endpoint, only `fetchCounts` changes.
- Detail pages are client-rendered behind the console guard (no SEO; `X-Robots-Tag: noindex`).

## 사무소 홈페이지 · 구독 (agency-sites, 2026-11-28)

Contract: `docs/agency-sites/SPEC.md` §1.4 / §3.1 (shared types in `packages/shared/src/agencies/site-types.ts`).
Parsed by `agencySiteViewSchema`, `adminAgencySiteResponseSchema`, `agencySiteDecisionResultSchema`,
`adminAgencySitePageSchema`, `agencySubscriptionViewSchema`, `agencySubscriptionsResponseSchema`
(`features/m-moderation/api/schemas.ts`); request bodies are the shared zod schemas.

| Method | Path                                                | Used by                                                                                                          |
| ------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/admin/agency-sites?status&q&page&pageSize` | `/agencies/sites` list + tab counts (`pageSize=1` per status)                                                    |
| GET    | `/api/v1/admin/agencies/:id/site`                   | `AgencySitePanel` (detail side column) + the hero "사무소 홈페이지" link when `live`                             |
| POST   | `/api/v1/admin/agencies/:id/site/decision`          | 승인 (`slug` only when the admin corrected it) · 반려 / 정지 (`reason`) · 정지 해제                              |
| GET    | `/api/v1/admin/agencies/:id/subscriptions`          | `AgencySubscriptionsPanel` (detail main column)                                                                  |
| POST   | `/api/v1/admin/agencies/:id/subscriptions`          | 기간 기록 (ADMIN+, `adminSubscriptionCreateSchema`) → 201 `AgencySubscriptionView`                               |
| PATCH  | `/api/v1/admin/subscriptions/:id`                   | 종료일 변경 `{ endsOn }` · 취소 `{ cancel: true }` (ADMIN+)                                                      |
| GET    | `/api/v1/admin/dashboard/queues`                    | new optional queue `pendingAgencySites { total, items: [{ agencyId, agencyName, requestedSlug, requestedAt }] }` |
| GET    | `/api/v1/admin/dashboard`                           | sidebar badge `agencySitesPending`, read from `agencySites.pending` or `agencies.sitesPending` (0 when absent)   |

- The decision answer is read as `{ site }` (same as the GET) or a bare `AgencySiteView`.
- An unknown stored colour reads as `BLUE` instead of failing the response.
- Panels show for offices in APPROVED or SUSPENDED status only.
- Every site / subscription mutation invalidates `['admin-agencies']` and `['admin-dashboard']`.
- Admin bell: new kind `AGENCY_SITE_REQUEST` (label "홈페이지 신청", link `/agencies/sites` or `/agencies/:id#site`).
- Settings › 기능 설정: `siteSubscriptionRequired` "사무소 홈페이지 유료 적용", `platformSubscriptionRequired`
  "메인 입점 유료 적용 (준비 중 — 아직 적용되지 않아요)".
- 작업 기록 labels: resources `AgencySite`, `AgencySubscription`; actions `agency_site.{request,approve,reject,suspend,resume,update}`,
  `subscription.{create,update,cancel}` (also `agency_subscription.*`, `agency.site.*`).
- Approve dialog: the input is pre-filled with `requestedSlug`, normalised and checked with the shared
  `siteSlugMessage` before the POST; `409 AGENCY_SITE_SLUG_DUPLICATE` shows inline. The address preview
  uses `NEXT_PUBLIC_SITE_ROOT_DOMAIN` (default: the user-site hostname without `www.`).

Audit fixes in the same batch: the agencies list now sends `sort=OLDEST` on 승인 대기 and `sort=NEWEST`
elsewhere (the API defaults to OLDEST); agency decisions on the list / detail also invalidate
`['admin-dashboard']`, and dashboard decisions also invalidate `['admin-agencies']`.

## Endpoints used

| Method | Path                                                       | Used by                                            | Backend status                                      |
| ------ | ---------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| GET    | `/api/v1/admin/agencies?status&q&sort&page&pageSize`       | agencies list + counts                             | `adminAgencyListQuerySchema` (`sort` OLDEST/NEWEST) |
| GET    | `/api/v1/admin/agencies/:id`                               | agency detail                                      | agencies README — shape assumed (1)                 |
| GET    | `/api/v1/admin/agencies/:id/documents/:docId/file`         | private document viewer (file stream)              | agencies module ("private file")                    |
| POST   | `/api/v1/admin/agencies/:id/decision`                      | 승인 / 반려 / 정지 / 정지 해제                     | agencies README, body = `agencyDecisionSchema`      |
| GET    | `/api/v1/admin/reports?status&targetType&page&pageSize`    | reports list + counts                              | admin README, `reportListQuerySchema` — `q` assumed |
| GET    | `/api/v1/admin/reports/:id`                                | report detail                                      | admin README — shape assumed (3)                    |
| PATCH  | `/api/v1/admin/reports/:id`                                | 검토 시작 `{ status: IN_REVIEW }`, memo `{ note }` | `reportReviewSchema`                                |
| POST   | `/api/v1/admin/reports/:id/resolve`                        | 조치 / 기각                                        | body = `reportResolveSchema`                        |
| GET    | `/api/v1/admin/users?q&status&role&provider&page&pageSize` | users list + counts                                | admin README ("list/search") — params assumed       |
| POST   | `/api/v1/admin/users/:id/suspend`                          | 이용 정지 `{ reason }`                             | admin README — body assumed                         |
| POST   | `/api/v1/admin/users/:id/unsuspend`                        | 정지 해제 (no body)                                | admin README                                        |

## Assumed endpoints (not in any backend README — please confirm or rename)

| Method | Path                                                    | Purpose                                                                                                                                                                                                            |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/v1/admin/agencies/:id/registry-check[?refresh=1]` | The 국가공간정보 중개업소 조회 for an application (cached; `refresh=1` re-runs it) → `registryCheckSchema`. The detail response also embeds the latest result as `registryCheck`.                                  |
| GET    | `/api/v1/admin/listings`                                | Moderator listing search. Query: `q`, `status`, `assetType`, `dealType`, `agencyId`, `needsReview=true`, `sort=LATEST\|REPORTS\|VIEWS\|PRICE_DESC`, `page`, `pageSize`. DRAFT listings are excluded.               |
| GET    | `/api/v1/admin/listings/:id`                            | Full listing for moderation incl. the **private 호수**, co-brokers, 실매물 확인 records, reports, change history (from the audit log).                                                                             |
| POST   | `/api/v1/admin/listings/:id/hide`                       | `{ reason }` (5–500 chars). ACTIVE / RESERVED → HIDDEN; the reason is sent to every advertising office. `409 LISTING_STATUS_CONFLICT` otherwise.                                                                   |
| POST   | `/api/v1/admin/listings/:id/unhide`                     | `{ reason? }`. HIDDEN → ACTIVE.                                                                                                                                                                                    |
| POST   | `/api/v1/admin/listings/:id/close`                      | `{ reason }`. ACTIVE / RESERVED / HIDDEN → CLOSED (force close; cannot be re-opened by the office).                                                                                                                |
| GET    | `/api/v1/admin/deal-requests`                           | 내놓기·구하기 monitoring, newest first. Query: `q`, `type`, `status`, `spam=flagged\|suspected`, `page`, `pageSize`.                                                                                               |
| GET    | `/api/v1/admin/deal-requests/:id`                       | Request incl. the requester's contact, targets, proposals, contact grants, abuse signals, history. Personal data → audit-logged read.                                                                              |
| POST   | `/api/v1/admin/deal-requests/:id/spam-flag`             | `{ flagged: boolean, reason? }` (reason required, ≥ 5 chars, when `flagged`). A flagged request is hidden from every office until cleared.                                                                         |
| POST   | `/api/v1/admin/deal-requests/:id/close`                 | `{ reason }`. OPEN / MATCHED → CLOSED. `409 DEAL_REQUEST_NOT_OPEN` otherwise.                                                                                                                                      |
| GET    | `/api/v1/admin/users/:id`                               | Member detail with linked identities + consents + sanctions. Personal data → the API must write an audit-log entry (e.g. `USER_VIEWED`) per read; the UI tells the admin so and never refetches in the background. |

Every mutation returns the updated **detail** object (the screens put it straight into the query
cache). Error shape `{ code, message, details?: [{ path, message }] }`; a `details` entry with
`path: "reason"` / `"note"` is shown inline in the dialog.

## Assumed payload shapes (see `api/schemas.ts` for the exact fields)

1. **Agencies** — list item: `{ id, name, representativeName, registrationNumber, phone?, roadAddress,
emdName?, status, statusReason?, createdAt, approvedAt?, suspendedAt?, activeListingCount,
warningCount, documentTypes: AgencyDocumentType[], registryStatus? }`. Detail adds
   `businessNumber, mobile, email, addressDetail, zipCode, lat, lng, intro, specialties, viewCount,
owner { id, name, nickname, email, phone, createdAt, providers[] }, documents[] { id, type,
fileName, mimeType, sizeBytes, createdAt }, registryCheck { status: MATCHED | MISMATCH | NOT_FOUND
| UNAVAILABLE, checkedAt, source, registry { name, representativeName, registrationNumber,
roadAddress, businessStatus, registeredAt }, mismatches: string[], message }, statusHistory[] {
fromStatus, toStatus, reason, decidedByName, createdAt }, warnings[] { reason, reportId, adminName,
createdAt }, members[]`. `mismatches` holds the application field names that differ
   (`name`, `representativeName`, `registrationNumber`, `roadAddress`). The list is ordered oldest
   first for `status=PENDING`, newest first otherwise.
2. **Decision transitions** used by the UI: PENDING → APPROVED | REJECTED, APPROVED → SUSPENDED,
   SUSPENDED → APPROVED (정지 해제), REJECTED → APPROVED (반려 취소). REJECTED / SUSPENDED require
   `reason` (shown to the applicant). Anything else → `409`.
   - **Approval override**: when the required documents are incomplete or the registry check is not
     `MATCHED`, the UI only approves through "확인 후 승인", which sends `{ status: APPROVED, reason }`
     with the admin's written verification ("등록증 원본을 직접 확인했습니다." …). Please store it in
     `AgencyStatusHistory.reason` (it is internal, not sent to the applicant). A clean application
     is approved without a reason (one click, also from the queue).
3. **Reports** — list item: `{ id, targetType, reason, status, action?, detail?, createdAt,
handledAt?, listing? { id, title, assetType, status, dealType, salePrice, deposit, monthlyRent,
presalePrice, complexName, dong, buildingName, emdName, supplyArea, exclusiveArea, floor…,
verifiedAt, publishedAt, photoCount, coverUrl }, agency? { id, name, representativeName, phone,
status, warningCount }, sameTargetCount }` — for a LISTING report `agency` is the listing's primary
   office. Detail adds `reporter { id, nickname, reportCount, upheldCount }, reporterPhone,
resolutionNote, internalNote, handledByName, attachments[] { id, url, fileName }, relatedReports[],
timeline[] { status?, note, adminName, createdAt }`.
   - **One note per report (as built).** The API keeps a single `resolutionNote`: the memo is
     saved with `PATCH /admin/reports/:id { note }` while the report is open, and the resolution's
     `note` replaces it (a blank note keeps the saved memo). The reporter / office notifications
     carry the action label only, never the note. The schema maps `internalNote` ←
     `resolutionNote` for the memo panel. (The gate asked for a separate `internal_note` column;
     not built.)
   - `attachments` (evidence images) are **not** in `reportCreateSchema` yet; the screen shows
     "첨부된 증빙 자료가 없어요" when the array is empty/absent. The viewer loads `url` as a plain
     `<img>` request with the admin cookie (never through the image optimizer), so it can be an
     authorized streaming endpoint.
   - 검토 시작 = `PATCH { status: IN_REVIEW }`; `reportResolveSchema` for the outcome: `{ status: RESOLVED,
action: LISTING_HIDDEN | AGENCY_WARNED | LISTING_HIDDEN_AGENCY_WARNED, note }` (조치), `{ status:
REJECTED, action: NONE, note }` (기각). The UI requires a note for both final outcomes and at
     least one action for RESOLVED. Expected side effects: hide the listing (reason → offices) and/or
     add an `AgencyWarning` linked to the report.
   - The list tabs send a single `status` each (as `reportListQuerySchema` defines); `q` is an extra
     free-text filter (listing / complex / office name, report text) — currently stripped by the
     shared schema, so search will not narrow the list until the backend adds it.
4. **Listings** — list item: `{ id, title, assetType, status, dealType, salePrice, deposit,
monthlyRent, presalePrice, premium, complexName, buildingName, dong, emdName, supplyArea,
exclusiveArea, floorClass, floor, totalFloors, primaryAgency { id, name }, agencyCount, photoCount,
coverUrl, verifiedAt, publishedAt, expiresAt, closedAt, createdAt, hiddenReason, viewCount,
favoriteCount, openReportCount, reviewFlags: (REPORTED | UNVERIFIED | VERIFICATION_EXPIRED |
PRICE_OUTLIER)[] }`. Detail adds `description, roadAddress, ho (private), rooms, baths, direction,
approvalDate, parkingSpaces, maintenanceFeeWon, moveInType, moveInDate, options[], photos[] { id,
url, isCover }, agencies[] { agencyId, name, isPrimary, status, contactName, phone, joinedAt },
verifications[] { method, verifiedAt, byName, note }, reports[] { id, reason, status, createdAt },
history[] { action, actorType, actorName, note, createdAt }`. `history.action` is an audit action
   code; known codes are labelled in `lib/labels.ts` (`LISTING_PUBLISHED`, `LISTING_HIDDEN`, …),
   unknown ones are shown raw. Money is 만원, 관리비 is 원, areas ㎡.
5. **Deal requests** — list item mirrors `DealRequest` plus `regionNames[]` (resolved names),
   `targetAgencyCount`, `proposalCount`, `requester { id, nickname }`, `spamFlaggedAt?`,
   `spamSignalCount`. Detail adds `contactName, contactPhone, description, roadAddress,
addressDetail, floor, roomsMin, moveInDate, spamReason, spamSignals: string[] (human readable),
closeReason, requester { name, status, createdAt, dealRequestCount }, targets[] { agencyId, name },
proposals[] { id, agencyId, agencyName, status, message, listingCount, createdAt },
contactGrants[] { agencyId, agencyName, grantedAt }, history[]`. "스팸 의심" = not flagged, OPEN and
   `spamSignalCount > 0`; if the backend has no automatic signals, send `0` / `[]` and the tab simply
   stays empty.
6. **Users** — list item: `{ id, name?, nickname?, email?, phone?, role, status, providers[],
agency? { id, name }, createdAt, lastLoginAt?, suspendedAt?, withdrawnAt? }`. Detail adds
   `marketingOptIn, suspendedReason, withdrawalReason, piiScrubAfter, piiScrubbedAt, identities[] {
id, provider, email, emailVerified, lastUsedAt, createdAt }, consents[] { termsType, termsTitle,
version, isRequired, agreed, createdAt }, agency { status, memberRole }, activity {
dealRequestCount, reportCount, favoriteCount, activeSessionCount }, sanctions[] { action: SUSPENDED
| UNSUSPENDED, reason, adminName, createdAt }`. A withdrawn member whose PII was destroyed comes
   back with `name / nickname / email / phone = null` and `piiScrubbedAt` set.

## Privacy notes for the backend

- **The users list endpoint MUST return name / e-mail / phone already masked** (`한*윤`,
  `se*****@example.com`, `010-****-1100`). Masking only in the UI would still ship every member's
  full PII to the browser on a read that is not audit-logged. The full values belong to the
  audit-logged `GET /admin/users/:id` only. The UI masks idempotently (`maskName`, `maskEmail`,
  `maskPhoneOnce` leave a value containing `*` as is), so it works with masked values. (The mock
  list still returns raw values because the m-core topbar-search mock matches on them; the UI masks
  them.)
- Audit-logged reads the screens rely on (a notice says so on each): `GET /admin/users/:id`,
  `GET /admin/agencies/:id` (applicant data), `GET /admin/agencies/:id/documents/:docId/file`,
  `GET /admin/deal-requests/:id` (contact), `GET /admin/reports/:id` (reporter phone, evidence),
  `GET /admin/listings/:id` (private 호수, office contact phones).
- The document viewer fetches the private file with `credentials: 'include'`, `cache: 'no-store'`,
  keeps it as an in-memory Blob and revokes the object URL on close. Please send
  `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` and the real `Content-Type`.
  The viewer previews by an **allow-list** (`lib/viewer.ts` → `documentKind`): `image/jpeg`,
  `image/png`, `image/webp` with zoom / rotate, `application/pdf` in an embedded reader. Every other
  type (HTML, XML, SVG, octet-stream …) is dropped and NOT opened: a same-origin `blob:` URL of
  applicant-supplied markup would run script with the admin session. The upload endpoint should
  accept `ALLOWED_DOCUMENT_MIME` only. `403` shows "이 서류를 볼 권한이 없어요".
- Every user-uploaded file served from the API origin (documents, report evidence, listing photos)
  should carry `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none';
sandbox`, and never be served as `text/html` or `image/svg+xml`. Through the nginx same-origin
  proxy, "open image in new tab" on such a file would otherwise execute in the admin origin.
- Route ids are encoded into API paths (`seg()` in `api/queries.ts`), so a crafted
  `/agencies/..%2F…` link cannot point a GET or a decision POST at another endpoint.

## Mock resources (apps/admin, dev only — 404 unless `NEXT_PUBLIC_API_MOCK=1`)

`src/app/mock-api/v1/admin/{agencies,listings,reports,deal-requests,users}/**` — in-memory tables on
`globalThis` (reset on server restart), seeded from `design/drafts/system/mockdata.md` plus a few
extra rows needed for the moderation states. Mutations are consistent across resources: resolving a
report hides the listing and adds an agency warning; listing counters follow the reports table.
Mock-only helpers: `listings/[id]/photos/[index]` and `reports/[id]/attachments/[attId]` serve
generated SVG stand-ins; `agencies/[id]/documents/[docId]` serves a sample certificate image (and a
tiny PDF for one office) so the viewer can be exercised without a media backend.

사무소 홈페이지 / 구독: `agency-sites/_fixtures.ts` keeps two extra tables (`sitesDb`, `subscriptionsDb`)
next to `agenciesDb()`, whose row shape is unchanged. Seeds: 신대중앙 ACTIVE `sindae`, 호수공원 / 연향센트럴
REQUESTED, 오천그린 SUSPENDED, 선월 REJECTED, 순천대정문 ACTIVE with the certificate still pending. `live`
follows the m-content mock FEATURES `siteSubscriptionRequired`; an approval simulates the certificate
after one minute. Decisions and subscription writes add rows to the m-content audit log, so they
show on 작업 기록. The mock agencies list honours `sort` like the API (default OLDEST).

Fixture ids: agencies `a9000000-…-0000000000NN`, listings `b7…`, reports `e5…`, deal requests
`d3…`, members `c1000000-…-0000000001NN`. The m-core dashboard and topbar-search mocks read these
lists over HTTP (`dashboard/_remote.ts`, `search/_remote.ts`), so every screen shows the same rows
and their links open real detail pages. The sidebar badge for 매물 관리 is still m-core's own number
(it does not equal the 검수 필요 tab count).

## Generic pieces worth promoting to `@house/ui`

Built in `features/m-moderation/ui/` because `packages/ui` is read-only for page groups:
`InfoList` (label/value `<dl>` grid), `Timeline`, `Notice` (inline info / warn / danger band),
`DetailHero`, `ReasonDialog` (decision dialog with presets + required reason), `SearchBox`
(debounced pill search), `FilterSelect` (single-choice `FilterDropdown`), `ModList` (Table on
desktop + stacked cards on mobile + footer range / pagination). The DS `Button variant="danger"`
is the outlined one; a solid destructive confirm is styled locally (`.dangerSolid`).
