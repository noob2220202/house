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
| GET          | `/agencies/:id`                                           | Public                            | profile, staff, listing counts, 대표 매물, disclosure    |
| POST         | `/agencies`                                               | User                              | 등록 신청 → PENDING (needs a REGISTRATION_CERT document) |
| GET          | `/agencies/mine`                                          | User (owner)                      | own agency, any status, documents + status history       |
| PATCH        | `/agencies/mine`                                          | User (owner)                      | profile (PENDING/APPROVED); APPROVED: 소재지 → 400 \*    |
| POST         | `/agencies/mine/resubmit`                                 | User (owner)                      | REJECTED → PENDING; 409 if active in another agency      |
| GET/POST     | `/agencies/mine/documents`                                | User (owner)                      | private document refs (media AGENCY_DOCUMENT, PRIVATE)   |
| DELETE       | `/agencies/mine/documents/:docId`                         | User (owner)                      | only before approval; keeps ≥ 1 등록증                   |
| GET          | `/agencies/mine/members`                                  | AGENCY_OWNER                      | paginated, `includeRemoved`                              |
| PATCH/DELETE | `/agencies/mine/members/:memberId`                        | AGENCY_OWNER                      | remove downgrades the agent to USER + updates sessions   |
| GET/POST     | `/agencies/mine/invites`                                  | AGENCY_OWNER                      | code returned once on creation                           |
| DELETE       | `/agencies/mine/invites/:inviteId`                        | AGENCY_OWNER                      |                                                          |
| POST         | `/agencies/join`                                          | User                              | redeem code → AGENT (THROTTLE.AUTH)                      |
| GET          | `/agencies/membership`                                    | User                              | caller's live membership                                 |
| POST         | `/agencies/membership/leave`                              | User (agent)                      | owners cannot leave                                      |
| GET          | `/admin/agencies?status&q&sort&page`                      | Admin (OPERATOR+)                 | review queue (status=PENDING, oldest first)              |
| GET          | `/admin/agencies/:id?includeRemoved`                      | Admin                             | full contacts; each view audited `agency.pii-view` †     |
| DELETE       | `/admin/agencies/:id` `{ reason }`                        | Admin (OPERATOR+)                 | soft-delete a PENDING / REJECTED application, audited    |
| POST         | `/admin/agencies/:id/decision`                            | Admin (suspend/reinstate: ADMIN+) | APPROVED / REJECTED / SUSPENDED (+reason), audited       |
| PATCH        | `/admin/agencies/:id/location`                            | Admin (OPERATOR+)                 | 소재지 change after 이전신고 check (+reason), audited    |
| GET          | `/admin/agencies/:id/documents/:docId/file`               | Admin                             | streams the private file, `no-store`, view audited       |
| GET          | `/admin/agencies/:id/registry-check?refresh`              | Admin                             | MATCH / MISMATCH / NOT_FOUND / UNAVAILABLE               |

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

## For other modules

```ts
imports: [AgenciesModule]
constructor(private readonly agencies: AgenciesService) {}
await agencies.assertActiveMember(user.userId, user.agencyId);            // 403 unless ACTIVE + APPROVED
await agencies.getDisclosure(agencyId);  / getDisclosures(ids)             // 표시·광고 명시사항
await agencies.recordWarning({ agencyId, reason, reportId, adminId }, tx); // reports resolution
```

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/agencies`
- e2e: `pnpm --filter @house/api test:e2e agencies` (DB `house_test_agencies`, Redis DB 4). The registry
  is replaced by `FakeBrokerRegistry` (test/e2e/agencies/helpers.ts); nothing touches the network.
