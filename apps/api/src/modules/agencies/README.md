# Agencies module (`apps/api/src/modules/agencies`)

중개사무소: 등록 신청 → admin review (승인/반려/정지), staff by invite code, public search / map /
profile, and the 표시·광고 disclosure data listings need. Read `docs/CONVENTIONS.md` first.

## Layout

| Path                                           | What                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controllers/my-agency.controller.ts`          | `/agencies` (register), `/agencies/mine/**`, `/agencies/join`, `/agencies/membership`                                                                                                                                                           |
| `controllers/agencies.controller.ts`           | public `/agencies`, `/agencies/map`, `/agencies/:id` (registered after the one above)                                                                                                                                                           |
| `controllers/admin-agencies.controller.ts`     | `/admin/agencies/**` review endpoints                                                                                                                                                                                                           |
| `controllers/my-agency-site.controller.ts`     | `/agencies/mine/site/**` 사무소 홈페이지 of the caller's office (registered first)                                                                                                                                                              |
| `controllers/sites.controller.ts`              | public `/sites/:slug` (office-site pages of the web)                                                                                                                                                                                            |
| `controllers/admin-agency-sites.controller.ts` | `/admin/agency-sites`, `/admin/agencies/:id/site[/decision]`, `/admin/agencies/:id/subscriptions`, `/admin/subscriptions/:id`                                                                                                                   |
| `services/agency-sites.service.ts`             | owner request / colour + 한 줄 소개, availability, public site read (cached)                                                                                                                                                                    |
| `services/agency-site-review.service.ts`       | admin queue + decisions (approve with edited slug, reject, suspend, resume; notification, audit)                                                                                                                                                |
| `services/agency-subscriptions.service.ts`     | admin 이용권 records (offline payment; create / end / cancel, audited)                                                                                                                                                                          |
| `services/agency-site-gate.service.ts`         | **exported** office host URLs, https readiness, subscription gate (FEATURES + SITE periods, KST days)                                                                                                                                           |
| `domain/sites.ts`                              | pure rules: decision transitions, servable / live, row → view mappers                                                                                                                                                                           |
| `services/agencies.service.ts`                 | **exported** `AgenciesService` for other modules                                                                                                                                                                                                |
| `services/agency-registration.service.ts`      | register, resubmit, own profile, private documents                                                                                                                                                                                              |
| `services/agency-members.service.ts`           | staff list/update/remove, invites, join, leave                                                                                                                                                                                                  |
| `services/agency-invite.store.ts`              | invite codes in Redis (sha256 only, single-use via GETDEL, TTL)                                                                                                                                                                                 |
| `services/agency-public.service.ts`            | search, map clusters/markers (cached tiles), profile (cached)                                                                                                                                                                                   |
| `services/agency-review.service.ts`            | admin queue/detail/decision (+history, notification, audit), document stream, registry                                                                                                                                                          |
| `services/agency-dashboard.service.ts`         | **exported** console-home numbers (listings, daily views, expiring / 실매물 확인 due)                                                                                                                                                           |
| `domain/dashboard.ts`                          | pure helpers: KST days, views from daily snapshots, dashboard listing rows                                                                                                                                                                      |
| `jobs/agencies.processor.ts`                   | queue `agencies`: hourly `agencies.daily-stats` snapshot, daily `agencies.purge-rejected` (only when `JOBS_ENABLED`)                                                                                                                            |
| `services/agency-retention.service.ts`         | 개인정보 파기: rejected (not resubmitted) applications 1 year after the latest rejection — agency row hard-deleted (staff, documents, history cascade), document uploads soft-deleted + files removed, audited `agency.purge-rejected` (SYSTEM) |
| `agency-search.repository.ts`                  | raw PostGIS / pg_trgm SQL (bound parameters only)                                                                                                                                                                                               |
| `clients/broker-registry.client.ts`            | registry lookup interface + data.go.kr implementation (`BROKER_REGISTRY` token)                                                                                                                                                                 |
| `ports/agency-media.port.ts`                   | media checks / URLs via MediaService (`AGENCY_MEDIA`, same-tx `assertUsable`)                                                                                                                                                                   |
| `ports/agency-listings.reader.ts`              | listing counts + 대표 매물 until ListingsModule exposes a reader                                                                                                                                                                                |
| `ports/agency-listings.sync.ts`                | listing side effects: counters on suspend/reinstate, contacts of departed staff                                                                                                                                                                 |

Shared schemas, types, rules (status transitions, 등록번호/사업자번호 normalization), business-hours
and disclosure helpers live in `packages/shared/src/agencies/`.

## Endpoints (prefix `/api/v1`)

| Method       | Path                                                                             | Auth                              | Notes                                                             |
| ------------ | -------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| GET          | `/agencies?q&emdCode&bbox&specialties&openNow&handlesPresale&sort&page&pageSize` | Public                            | APPROVED only; trigram on name / 대표 / address ◇                 |
| GET          | `/agencies/map?bbox&zoom&q&specialties`                                          | Public                            | REGION_CLUSTERS / GRID_CLUSTERS / MARKERS by zoom                 |
| GET          | `/agencies/regions`                                                              | Public                            | 읍면동 facet `{ total, items[] }`, cached ‡                       |
| GET          | `/agencies/:id`                                                                  | Public                            | profile, staff, listing counts, 대표 매물, disclosure             |
| POST         | `/agencies`                                                                      | User                              | 등록 신청 → PENDING (등록증 + D8 `consents` required)             |
| GET          | `/agencies/mine`                                                                 | User (owner or staff)             | owner: full view; staff: reduced view (B2) §                      |
| GET          | `/agencies/mine/dashboard`                                                       | AGENT / AGENCY_OWNER              | console home; served by the deal-requests module ¶                |
| PATCH        | `/agencies/mine`                                                                 | User (owner)                      | profile (PENDING/APPROVED); APPROVED: 소재지 → 400 \*             |
| POST         | `/agencies/mine/resubmit`                                                        | User (owner)                      | REJECTED → PENDING; 409 if active elsewhere; `consents`?          |
| GET/POST     | `/agencies/mine/documents`                                                       | User (owner)                      | private document refs (media AGENCY_DOCUMENT, PRIVATE)            |
| DELETE       | `/agencies/mine/documents/:docId`                                                | User (owner)                      | only before approval; keeps ≥ 1 등록증                            |
| GET          | `/agencies/mine/members`                                                         | AGENCY_OWNER                      | paginated, `includeRemoved`                                       |
| PATCH/DELETE | `/agencies/mine/members/:memberId`                                               | AGENCY_OWNER                      | remove downgrades the agent to USER + updates sessions            |
| GET/POST     | `/agencies/mine/invites`                                                         | AGENCY_OWNER                      | code returned once on creation                                    |
| DELETE       | `/agencies/mine/invites/:inviteId`                                               | AGENCY_OWNER                      |                                                                   |
| POST         | `/agencies/join`                                                                 | User                              | redeem code → AGENT (THROTTLE.AUTH), `consents` D8                |
| GET          | `/agencies/membership`                                                           | User                              | caller's live membership                                          |
| POST         | `/agencies/membership/leave`                                                     | User (agent)                      | owners cannot leave                                               |
| GET          | `/admin/agencies?status&q&sort&page`                                             | Admin (OPERATOR+)                 | review queue (status=PENDING, oldest first)                       |
| GET          | `/admin/agencies/:id?includeRemoved`                                             | Admin                             | full contacts; each view audited `agency.pii-view` †              |
| DELETE       | `/admin/agencies/:id` `{ reason }`                                               | Admin (OPERATOR+)                 | soft-delete a PENDING / REJECTED application, audited             |
| POST         | `/admin/agencies/:id/decision`                                                   | Admin (suspend/reinstate: ADMIN+) | APPROVED / REJECTED / SUSPENDED (+reason), audited                |
| PATCH        | `/admin/agencies/:id/location`                                                   | Admin (OPERATOR+)                 | 소재지 change after 이전신고 check (+reason), audited             |
| GET          | `/admin/agencies/:id/documents/:docId/file`                                      | Admin                             | streams the private file, `no-store`, view audited                |
| GET          | `/admin/agencies/:id/registry-check?refresh`                                     | Admin                             | MATCH / MISMATCH / NOT_FOUND / UNAVAILABLE                        |
| GET          | `/agencies/mine/site`                                                            | AGENCY_OWNER / AGENT (read)       | `MyAgencySiteResponse` (site, rootDomain, 이용권 line) ▲          |
| GET          | `/agencies/mine/site/availability?slug`                                          | AGENCY_OWNER                      | `{ slug, available, reason: INVALID / RESERVED / TAKEN }`         |
| POST         | `/agencies/mine/site` `{ slug, color?, tagline? }`                               | AGENCY_OWNER                      | request / re-request → REQUESTED (200); 409 if ACTIVE / SUSPENDED |
| PATCH        | `/agencies/mine/site` `{ color?, tagline? }`                                     | AGENCY_OWNER                      | any status; bumps the public cache                                |
| GET          | `/sites/:slug`                                                                   | Public                            | `PublicAgencySite`; 404 unless servable ▲                         |
| GET          | `/admin/agency-sites?status&q&page&pageSize`                                     | Admin (OPERATOR+)                 | REQUESTED oldest first, else recently changed first               |
| GET          | `/admin/agencies/:id/site`                                                       | Admin                             | `{ site: AgencySiteView \| null }`                                |
| POST         | `/admin/agencies/:id/site/decision`                                              | Admin (suspend/resume: ADMIN+)    | APPROVE (+slug) / REJECT / SUSPEND (+reason) / RESUME, audited    |
| GET          | `/admin/agencies/:id/subscriptions`                                              | Admin                             | `{ items, current: { SITE, PLATFORM } }`                          |
| POST         | `/admin/agencies/:id/subscriptions`                                              | Admin (ADMIN+)                    | record a paid period (201), audited                               |
| PATCH        | `/admin/subscriptions/:id` `{ endsOn?, memo?, cancel? }`                         | Admin (ADMIN+)                    | end / extend / cancel, audited                                    |

◇ `GET /agencies` → `Paginated<AgencySearchItem>` (`AgencySummary` + `businessHours` +
`handlesPresale`). `openNow=true` keeps offices open at the request time in Asia/Seoul by their
영업시간 (`open ≤ now < close` on today's KST weekday, `kstClock` = the clock shared `isOpenAt`
uses; 휴무 days and offices without hours drop out). `handlesPresale=true` keeps offices with an
ACTIVE `ListingAgency` row (own or co-brokered) on a public 분양권 listing whose primary office is
disclosable; the same rule fills `handlesPresale` on every row.

**Cover image.** `PATCH /agencies/mine { coverMediaId }` (null removes it) attaches a PUBLIC upload
of the owner with purpose `AGENCY_COVER` (a logo upload is rejected), else `400 AGENCY_COVER_INVALID`.
`MyAgency` carries `coverMediaId` + `coverUrl`, the public profile `coverUrl` (large variant; null
when unset or the file was deleted). A replaced / removed cover (like the logo) restarts its orphan
grace period; the DB guard `agencies_media_live` refuses a new reference to a deleted media row.

‡ `GET /agencies/regions` → `{ total, items: [{ emdCode, name, count, lat, lng }] }`: APPROVED offices
grouped by their 8-digit 읍면동 (리 codes roll up to the 읍면), named from `regions` (8-digit row or its
10-digit `…00` twin; codes the table does not know are left out of `items`), busiest first; `lat/lng` =
region centroid, else the offices' mean position. `total` counts every approved office (also those
without a 읍면동). Cached 300 s under the public agency version (bumped on approvals, profile edits).

§ **B2 — staff and `GET /agencies/mine`.** The response carries `myRole` (web `myAgencySchema`).
The owner gets the full view (`myRole: OWNER`, any status). An ACTIVE AGENT of a live agency gets the
same shape for the agency they work for with `myRole: AGENT`, but `documents: []`,
`statusHistory: []` and `businessNumber: null` (owner-only data); owner-only routes stay 403. A
rejected applicant who has since joined another office gets that office (AGENT). 404
`AGENCY_NOT_FOUND` when the user neither owns nor works for an agency. `GET /agencies/membership`
(`{ memberId, role, displayName, agency: { id, name, phone, roadAddress, status } }`) is unchanged and
is also enough for the console shell (`{ id, name, status, myRole: role }`).

¶ **Console dashboard.** `GET /agencies/mine/dashboard` is composed in the deal-requests module
(`ConsoleDashboardService`: it needs the inbox, and deal-requests depends on agencies); the listing
and view numbers come from `AgencyDashboardService` here:

- `listings`: counts over listings the agency actively (co-)brokers (not deleted): `active`,
  `reserved`, `draft`, `closed30d` (CLOSED with `closedAt` in the last 30 days), `coBrokered`
  (ACTIVE/RESERVED where the agency is not primary).
- `views`: `daily` (7 KST days ending today), `total7d`, `changeRatio` (vs the previous 7 days, null
  unless both weeks were observed) from `agency_daily_stats` — one row per agency and KST day holding
  the cumulative `SUM(listings.view_count)` of its (co-)brokered listings; views(D) = snap(D) −
  snap(D−1), clamped at 0, unknown days 0. The snapshot is upserted by every dashboard read (today)
  and by the hourly `agencies.daily-stats` job (:53 KST, every approved agency). `favorites7d` =
  favorites added in the last 7 days on its listings. `profileViews7d` is always 0: office profile
  views are not counted yet.
- `expiringListings`: live (ACTIVE/RESERVED) listings of the primary agency whose ad period ends
  within 7 days, soonest first. `verificationDue`: live listings of the primary agency never verified
  or whose 실매물 확인 is older than 23 days, never-verified then oldest first;
  `verificationDueAt` = KST date of `verifiedAt` + 30 days (null when never verified). Both lists
  are capped at 20 rows; row = `{ id, title, summary ("34평 · 20/25층"), dealType, price, deposit,
monthlyRent, expiresAt, verifiedAt, verificationDueAt }` (매매/분양권 → `price`, 전세 → `deposit`,
  월세 → `deposit` + `monthlyRent`, 만원).

Status machine (admin): PENDING → APPROVED | REJECTED, APPROVED → SUSPENDED, SUSPENDED → APPROVED.
Owner: REJECTED → PENDING (resubmit). First approval sets the owner's role to AGENCY_OWNER and updates
their live sessions; rejection detaches the session agency; suspension revokes open invite codes.
Suspending or reinstating needs ADMIN (keyed on the transition, so an OPERATOR cannot lift a
suspension). Listings are public only while their primary agency is APPROVED (listings module rule);
on suspend/reinstate the counters of affected complexes/agencies are recomputed and the listing search
cache is bumped. A user who joined another office after a rejection cannot resubmit (409).

\* 소재지 (road/jibun address, detail, zip, 읍면동, lat/lng) is on the 등록증 and in every ad's
disclosure, so once APPROVED the owner gets `400 AGENCY_NOT_EDITABLE` with
`details.fields` / `reason: LOCATION_REQUIRES_REVIEW`; an admin applies it via
`PATCH /admin/agencies/:id/location` after checking the 이전신고. 연락처 (phone/mobile/email) changes
of an approved office are allowed and audited (`agency.contact.update`).

등록번호 is stored canonically (`46150-2020-00012`, upper-case, single hyphens) and compared on the
generated column `registration_key` (letters/digits/한글 only), so spellings differing in
punctuation or case are duplicates. Only a **live** office (APPROVED / SUSPENDED, not deleted)
holds a number: partial unique index `agencies_registration_key_live` + the same filter in
`assertRegistrationNumberFree`. Pending / rejected applications never reserve it, so a stranger
cannot lock a real office out by applying with its public number. Approval re-checks under an
advisory lock on the key (409 `AGENCY_REGISTRATION_DUPLICATE` with `details.agencyId` of the holder)
and auto-rejects the other PENDING applications for that number (history, `AGENCY_REJECTED`
notification, `agency.reject` audit with `duplicateOfAgencyId`, sessions detached). An admin can
soft-delete a PENDING / REJECTED application (`DELETE /admin/agencies/:id`): status REJECTED +
`deletedAt`, staff rows REMOVED, applicant notified, `agency.delete` audited; documents are kept.

**중개보조원 and ads (공인중개사법 제18조의2①).** Only the 개업공인중개사 (OWNER) and 소속공인중개사
(`isLicensed`) may be named with the office's ads (`isAdvertisableMember` in shared). Joining by
invite always records a 중개보조원 (`isLicensed: false`; a self-declared flag is stripped); the
owner sets `isLicensed: true` with a license number via `PATCH /agencies/mine/members/:memberId`
(400 without one). The PATCH carries changes onto `ListingAgency` contacts in the same transaction:
losing the license moves the member's ad contacts to the 대표 (as on departure); a rename / new
phone of an advertisable member updates their ads (phone only where not overridden per listing).
The public profile lists only OWNER + licensed ACTIVE staff. Removing / leaving staff moves their
listing contacts to the 대표.

† Admin personal data: `GET /admin/agencies` masks the applicant's name and email; decision and
location responses mask owner and staff contacts; the full detail (owner name/email/phone, staff
phone/license number) writes an `agency.pii-view` audit row (field names only). REMOVED staff are
listed only with `includeRemoved=true`, phones masked.

### 사무소 홈페이지 + 이용권 (docs/agency-sites/SPEC.md §3.1)

▲ Lifecycle: the owner requests a slug (`REQUESTED`; again after `REJECTED`, or to change a pending
request) → an admin approves (may edit the slug; `ACTIVE`, owner notified `AGENCY_SITE_APPROVED`),
rejects with a reason (`REJECTED`, `AGENCY_SITE_REJECTED`), suspends a live site with a reason
(`SUSPENDED`, ADMIN+) or resumes it. Suspend / resume notify nobody. Every write is audited
(`agency_site.request|update|approve|reject|suspend|resume`, resource `AgencySite`) and bumps the
public cache. A slug is "taken" while another office holds it as its approved slug (kept through
SUSPENDED) or as an open request; claims are serialized by `lockSiteSlug`, and the partial unique
indexes `agency_sites_slug_key` / `agency_sites_requested_slug_open_key` turn a race into
`409 AGENCY_SITE_SLUG_DUPLICATE`. Approving with a different slug resets `httpsReadyAt`
(deploy/sites.sh issues the per-host certificate and sets it again); nothing else does —
SUSPEND / RESUME, the office's own status and the subscription gate keep it, because sites.sh
keeps the host's server + certificate while the slug belongs to an ACTIVE or SUSPENDED site. The
approval notice says the address opens shortly (보통 10분), never that it is open already.
Slug rules (`AgencySiteGateService.slugProblem`, used by availability, request and APPROVE): the
shared format + `RESERVED_SITE_SLUGS`, plus the first DNS label of `ADMIN_BASE_URL`'s host
(`RESERVED`; a custom `--admin-subdomain` such as `manage` is never servable — sites.sh refuses it
as ADMIN_HOST). The admin list sorts REQUESTED by oldest request, the other tabs by `decidedAt`
(newest first; an owner's colour / 한 줄 소개 edit does not reorder them).

- **Servable** (`GET /sites/:slug`): ACTIVE + office APPROVED and not deleted + subscription gate.
- **Live** (`AgencySiteView.live`, `AgencyProfile.site = { url }` on `GET /agencies/:id`): servable and
  https-ready (`httpsReadyAt` set, or `PUBLIC_BASE_URL` is plain http as in dev).
- **URL**: `<PUBLIC_BASE_URL protocol>//<slug>.<SITE_ROOT_DOMAIN>[:port]` (`AppConfig.siteRootDomain`,
  default the host of `PUBLIC_BASE_URL`; dev `http://<slug>.localhost:3000`).
- **Subscription gate**: `FEATURES.siteSubscriptionRequired === true` (site setting, default off) ⇒ live
  only with a `SITE` period covering today in KST (startsOn ≤ today ≤ endsOn or open-ended, not
  canceled). `platformSubscriptionRequired` is recorded and shown but not enforced yet (future work).
  FEATURES lives in the admin module's `site_settings`; this module only reads it (cached in the public
  namespace; AdminModule imports AgenciesModule, so no service can be injected the other way) and the
  admin module calls `AgencySiteGateService.featuresChanged()` after a FEATURES write.
- 이용권 periods are recorded by admins after an offline payment (`amountWon` in 원); nothing is charged.
  Audited `subscription.create|update|cancel` (resource `AgencySubscription`).

### 개인정보 동의 (D8)

`POST /agencies` takes `consents: [{ type: 'PRIVACY_AGENCY_APPLICATION', version }]` and
`POST /agencies/join` takes `consents: [{ type: 'PRIVACY_AGENCY_JOIN', version }]`, with the version the
form showed (`GET /terms/:type`). The current published version is required; a `UserConsent` row is
written in the same transaction as the application / membership (auth `TermsService.consentForAction`,
errors in the auth README). A join with a missing or outdated consent is refused before the invite
code is claimed, so the code survives. `POST /agencies/mine/resubmit` takes an optional
`consents: [{ type: 'PRIVACY_AGENCY_APPLICATION', version }]` (local `agencyResubmitWithConsentsSchema`
in `dto.ts` until the shared schema has it): when sent, the current version is required and recorded
in the resubmission transaction; when omitted, the application's consent still covers it.

## For other modules

```ts
imports: [AgenciesModule]
constructor(private readonly agencies: AgenciesService) {}
await agencies.assertActiveMember(user.userId, user.agencyId);            // 403 unless ACTIVE + APPROVED
await agencies.getDisclosure(agencyId);  / getDisclosures(ids)             // 표시·광고 명시사항
await agencies.recordWarning({ agencyId, reason, reportId, adminId }, tx); // reports resolution
// AgencyDashboardService (also exported): listingDashboard(agencyId), snapshot(now?, agencyId?)
// AgencySiteGateService (also exported): featuresChanged() after a FEATURES write, urlFor(slug)
```

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/agencies` (incl. `domain/dashboard.spec.ts`)
- e2e: `pnpm --filter @house/api test:e2e agencies` (DB `house_test_agencies`, Redis DB 4);
  `console.e2e-spec.ts` covers regions, the staff `/agencies/mine`, resubmit consents and the
  daily-views snapshot (the dashboard endpoint itself is tested in the deal-requests suite).
  `sites.e2e-spec.ts` covers every 사무소 홈페이지 / 이용권 endpoint (incl. the FEATURES gate and an
  https `PUBLIC_BASE_URL`). The registry
  is replaced by `FakeBrokerRegistry` (test/e2e/agencies/helpers.ts); nothing touches the network.
- Registry lookup: `VworldBrokerRegistryClient` calls 브이월드 `getEBOfficeInfo` (the nsdi.go.kr API moved
  there in 2024; data.go.kr only has the bulk file). Needs `VWORLD_API_KEY`; the key is domain-bound, so the
  call sends `VWORLD_DOMAIN` (default: `PUBLIC_BASE_URL` host) as `domain` and Referer.
  `ldCode` is the office's 시군구 (12150 since the 2026-07-01 reorganisation); when no office matches, the
  lookup is retried once with the legacy code (46150, `legacyRegionCode`) and a warning is logged — whether
  브이월드 files offices registered before the reorganisation under the new code is undocumented.
- Region codes: `emdCode` (profile / application) accepts legacy `46150…` codes and stores `12150…`
  (shared `regionCodeSchema`); `sggCode` is derived from it. 등록번호 keep their issued form
  (`46150-2020-00012`) — they are identifiers, not region codes, and are never rewritten.
