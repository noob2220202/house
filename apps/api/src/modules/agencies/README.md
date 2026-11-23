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
| `ports/agency-media.port.ts`               | media checks / URLs until MediaService exposes them (`AGENCY_MEDIA`)                   |
| `ports/agency-listings.reader.ts`          | listing counts + 대표 매물 until ListingsModule exposes a reader                       |

Shared schemas, types, rules (status transitions, 등록번호/사업자번호 normalization), business-hours
and disclosure helpers live in `packages/shared/src/agencies/`.

## Endpoints (prefix `/api/v1`)

| Method       | Path                                                      | Auth                      | Notes                                                    |
| ------------ | --------------------------------------------------------- | ------------------------- | -------------------------------------------------------- |
| GET          | `/agencies?q&emdCode&bbox&specialties&sort&page&pageSize` | Public                    | APPROVED only; trigram on name / 대표 / address          |
| GET          | `/agencies/map?bbox&zoom&q&specialties`                   | Public                    | REGION_CLUSTERS / GRID_CLUSTERS / MARKERS by zoom        |
| GET          | `/agencies/:id`                                           | Public                    | profile, staff, listing counts, 대표 매물, disclosure    |
| POST         | `/agencies`                                               | User                      | 등록 신청 → PENDING (needs a REGISTRATION_CERT document) |
| GET          | `/agencies/mine`                                          | User (owner)              | own agency, any status, documents + status history       |
| PATCH        | `/agencies/mine`                                          | User (owner)              | profile only (PENDING/APPROVED); logo                    |
| POST         | `/agencies/mine/resubmit`                                 | User (owner)              | REJECTED → PENDING                                       |
| GET/POST     | `/agencies/mine/documents`                                | User (owner)              | private document refs (media AGENCY_DOCUMENT, PRIVATE)   |
| DELETE       | `/agencies/mine/documents/:docId`                         | User (owner)              | only before approval; keeps ≥ 1 등록증                   |
| GET          | `/agencies/mine/members`                                  | AGENCY_OWNER              | paginated, `includeRemoved`                              |
| PATCH/DELETE | `/agencies/mine/members/:memberId`                        | AGENCY_OWNER              | remove downgrades the agent to USER + updates sessions   |
| GET/POST     | `/agencies/mine/invites`                                  | AGENCY_OWNER              | code returned once on creation                           |
| DELETE       | `/agencies/mine/invites/:inviteId`                        | AGENCY_OWNER              |                                                          |
| POST         | `/agencies/join`                                          | User                      | redeem code → AGENT (THROTTLE.AUTH)                      |
| GET          | `/agencies/membership`                                    | User                      | caller's live membership                                 |
| POST         | `/agencies/membership/leave`                              | User (agent)              | owners cannot leave                                      |
| GET          | `/admin/agencies?status&q&sort&page`                      | Admin (OPERATOR+)         | review queue (status=PENDING, oldest first)              |
| GET          | `/admin/agencies/:id`                                     | Admin                     | detail incl. owner contact, members, warnings            |
| POST         | `/admin/agencies/:id/decision`                            | Admin (SUSPENDED: ADMIN+) | APPROVED / REJECTED / SUSPENDED (+reason), audited       |
| GET          | `/admin/agencies/:id/documents/:docId/file`               | Admin                     | streams the private file, `no-store`, view audited       |
| GET          | `/admin/agencies/:id/registry-check?refresh`              | Admin                     | MATCH / MISMATCH / NOT_FOUND / UNAVAILABLE               |

Status machine (admin): PENDING → APPROVED | REJECTED, APPROVED → SUSPENDED, SUSPENDED → APPROVED.
Owner: REJECTED → PENDING (resubmit). First approval sets the owner's role to AGENCY_OWNER and updates
their live sessions; rejection detaches the session agency; suspension revokes open invite codes.

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
