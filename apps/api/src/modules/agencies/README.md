# Agencies module (`apps/api/src/modules/agencies`)

중개사무소: 등록 신청 → admin review (승인/반려/정지), staff by invite code, public search / map /
profile, and the 표시·광고 disclosure data listings need. Read `docs/CONVENTIONS.md` first.

## Layout

| Path                                       | What                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `controllers/my-agency.controller.ts`      | `/agencies` (register), `/agencies/mine/**`, `/agencies/join`, `/agencies/membership`  |
| `controllers/agencies.controller.ts`       | public `/agencies`, `/agencies/map`, `/agencies/:id` (registered after the one above)  |
| `controllers/admin-agencies.controller.ts` | `/admin/agencies/**` review endpoints                                                  |
| `services/agencies.service.ts`             | **exported** `AgenciesService` for other modules                                       |
| `services/agency-registration.service.ts`  | register, resubmit, own profile, private documents                                     |
| `services/agency-members.service.ts`       | staff list/update/remove, invites, join, leave                                         |
| `services/agency-invite.store.ts`          | invite codes in Redis (sha256 only, single-use via GETDEL, TTL)                        |
| `services/agency-public.service.ts`        | search, map clusters/markers (cached tiles), profile (cached)                          |
| `services/agency-review.service.ts`        | admin queue/detail/decision (+history, notification, audit), document stream, registry |
| `services/agency-dashboard.service.ts`     | **exported** console-home numbers (listings, daily views, expiring / 실매물 확인 due)  |
| `domain/dashboard.ts`                      | pure helpers: KST days, views from daily snapshots, dashboard listing rows             |
| `jobs/agencies.processor.ts`               | queue `agencies`: hourly `agencies.daily-stats` snapshot (only when `JOBS_ENABLED`)    |
| `agency-search.repository.ts`              | raw PostGIS / pg_trgm SQL (bound parameters only)                                      |
| `clients/broker-registry.client.ts`        | registry lookup interface + data.go.kr implementation (`BROKER_REGISTRY` token)        |
| `ports/agency-media.port.ts`               | media checks / URLs via MediaService (`AGENCY_MEDIA`, same-tx `assertUsable`)          |
| `ports/agency-listings.reader.ts`          | listing counts + 대표 매물 until ListingsModule exposes a reader                       |
| `ports/agency-listings.sync.ts`            | listing side effects: counters on suspend/reinstate, contacts of departed staff        |

Shared schemas, types, rules (status transitions, 등록번호/사업자번호 normalization), business-hours
and disclosure helpers live in `packages/shared/src/agencies/`.

## Endpoints (prefix `/api/v1`)

| Method       | Path                                                      | Auth                              | Notes                                                    |
| ------------ | --------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| GET          | `/agencies?q&emdCode&bbox&specialties&sort&page&pageSize` | Public                            | APPROVED only; trigram on name / 대표 / address          |
| GET          | `/agencies/map?bbox&zoom&q&specialties`                   | Public                            | REGION_CLUSTERS / GRID_CLUSTERS / MARKERS by zoom        |
| GET          | `/agencies/regions`                                       | Public                            | 읍면동 facet `{ total, items[] }`, cached ‡              |
| GET          | `/agencies/:id`                                           | Public                            | profile, staff, listing counts, 대표 매물, disclosure    |
| POST         | `/agencies`                                               | User                              | 등록 신청 → PENDING (등록증 + D8 `consents` required)    |
| GET          | `/agencies/mine`                                          | User (owner or staff)             | owner: full view; staff: reduced view (B2) §             |
| GET          | `/agencies/mine/dashboard`                                | AGENT / AGENCY_OWNER              | console home; served by the deal-requests module ¶       |
| PATCH        | `/agencies/mine`                                          | User (owner)                      | profile (PENDING/APPROVED); APPROVED: 소재지 → 400 \*    |
| POST         | `/agencies/mine/resubmit`                                 | User (owner)                      | REJECTED → PENDING; 409 if active elsewhere; `consents`? |
| GET/POST     | `/agencies/mine/documents`                                | User (owner)                      | private document refs (media AGENCY_DOCUMENT, PRIVATE)   |
| DELETE       | `/agencies/mine/documents/:docId`                         | User (owner)                      | only before approval; keeps ≥ 1 등록증                   |
| GET          | `/agencies/mine/members`                                  | AGENCY_OWNER                      | paginated, `includeRemoved`                              |
| PATCH/DELETE | `/agencies/mine/members/:memberId`                        | AGENCY_OWNER                      | remove downgrades the agent to USER + updates sessions   |
| GET/POST     | `/agencies/mine/invites`                                  | AGENCY_OWNER                      | code returned once on creation                           |
| DELETE       | `/agencies/mine/invites/:inviteId`                        | AGENCY_OWNER                      |                                                          |
| POST         | `/agencies/join`                                          | User                              | redeem code → AGENT (THROTTLE.AUTH), `consents` D8       |
| GET          | `/agencies/membership`                                    | User                              | caller's live membership                                 |
| POST         | `/agencies/membership/leave`                              | User (agent)                      | owners cannot leave                                      |
| GET          | `/admin/agencies?status&q&sort&page`                      | Admin (OPERATOR+)                 | review queue (status=PENDING, oldest first)              |
| GET          | `/admin/agencies/:id?includeRemoved`                      | Admin                             | full contacts; each view audited `agency.pii-view` †     |
| DELETE       | `/admin/agencies/:id` `{ reason }`                        | Admin (OPERATOR+)                 | soft-delete a PENDING / REJECTED application, audited    |
| POST         | `/admin/agencies/:id/decision`                            | Admin (suspend/reinstate: ADMIN+) | APPROVED / REJECTED / SUSPENDED (+reason), audited       |
| PATCH        | `/admin/agencies/:id/location`                            | Admin (OPERATOR+)                 | 소재지 change after 이전신고 check (+reason), audited    |
| GET          | `/admin/agencies/:id/documents/:docId/file`               | Admin                             | streams the private file, `no-store`, view audited       |
| GET          | `/admin/agencies/:id/registry-check?refresh`              | Admin                             | MATCH / MISMATCH / NOT_FOUND / UNAVAILABLE               |

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
```

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/agencies` (incl. `domain/dashboard.spec.ts`)
- e2e: `pnpm --filter @house/api test:e2e agencies` (DB `house_test_agencies`, Redis DB 4);
  `console.e2e-spec.ts` covers regions, the staff `/agencies/mine`, resubmit consents and the
  daily-views snapshot (the dashboard endpoint itself is tested in the deal-requests suite). The registry
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
