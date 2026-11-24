# Deal requests (내놓기 / 구하기) module (`apps/api/src/modules/deal-requests`)

Registered in `AppModule`. Read `docs/CONVENTIONS.md` first.

## Rules

- `SELL_OR_LEASE` (owner 내놓기: property + desired terms) and `WANTED` (seeker 구하기: regions/complexes + ranges).
  Cross-field rules (deal types per asset type, price fields matching deal types, ranges, asset-specific
  fields, targets, no mobile numbers typed into the description) live in `@house/shared`
  `dealRequestRuleIssues` and run inside `dealRequestCreateSchema`.
- Login required. Contact name + phone are typed by the requester; `phoneSchema` validates/normalizes —
  **never verified, no SMS**. Abuse control: `@Throttle(THROTTLE.DEAL_REQUEST)`, daily cap
  `DEAL_REQUEST_CREATE` (counted only after validation passes), max 10 OPEN/MATCHED requests per member,
  `PROPOSAL_CREATE` cap per agency, admin moderation.
- 개인정보 동의 (D8): the body carries `consents: [{ type: 'DEAL_REQUEST_PRIVACY', version }, { type:
'DEAL_REQUEST_PROVIDE', version }]` (수집·이용 + 제3자(중개사무소) 제공, versions from
  `GET /terms/:type`). Both current published versions are required; they are checked before the daily
  cap is consumed and recorded as `UserConsent` rows in the create transaction (auth
  `TermsService.consentForAction`; `AUTH_CONSENT_REQUIRED` / `AUTH_CONSENT_OUTDATED` /
  `AUTH_CONSENT_UNAVAILABLE`, see the auth README).
- Region codes / complexes must lie in `REGION_SGG_CODE` (12150). Legacy `46150…` codes (e.g. a Kakao postcode `bcode` from before 2026-07-01) are accepted and stored as `12150…` (shared `regionCodeSchema`).
- Visibility: `ALL_AGENCIES_IN_REGION` (APPROVED agencies with the same 시군구) or `SELECTED_AGENCIES`
  (`DealRequestTarget`, approved agencies only). An agency also keeps seeing requests it proposed to,
  unless the requester withdrew. New/region/targeted requests of non-ACTIVE members, expired or deleted
  ones are never in an inbox (`services/deal-request-access.ts`).
- Privacy: agency/admin selects never load contact or 동·호 (`deal-request.selects.ts`). Contact is loaded in a
  separate query only for an agency with an active `DealRequestContactGrant` while the request is
  OPEN/MATCHED/CLOSED **and the requester is ACTIVE** (a suspended/withdrawn requester's contact is never
  served, scrub or not). Grants come from `POST …/contact-grants` or accepting a proposal with
  `shareContact` — **required** boolean, no default (개인정보 제3자 제공 needs an explicit opt-in). Cancel and
  admin close revoke all grants. Admins see a masked contact only. Contact + 동·호 are erased 90 days after a
  request ends. For withdrawn members everything identifying (contact, 동·호, road address, lat/lng/location,
  floor, area, description, photos → media soft-deleted) is erased by
  `DealRequestMaintenanceService.scrubUser(userId, now, tx)` — meant to be called inside the withdrawal
  transaction, then `dispatch(notices)` after commit — with the `scrub` job as the safety net.
- Lifecycle: OPEN → MATCHED (proposal accepted) → CLOSED (거래 완료) / CANCELLED; OPEN → EXPIRED after 30 days
  (`expire` job; MATCHED never expires — the requester closes it). `POST …/extend` pushes an OPEN request's
  expiry to now + 30 days or reopens an EXPIRED one (≤ `MAX_EXTENSIONS` = 3 times, reopening counts toward
  the 10 active requests, not after contact was scrubbed). Proposals: SENT → VIEWED (requester opened the request) → ACCEPTED / DECLINED, or
  WITHDRAWN by the agency.
- Notifications: in-app rows in `notifications` (written in the same transaction), then
  `NotificationDispatcher.dispatch()` (token `NOTIFICATION_DISPATCHER`, default in-app only) for e-mail/push.
  There is deliberately no SMS channel. New requests fan out to brokers via the `deal-request.fanout` job.

## Endpoints (prefix `/api/v1`)

| Method | Path                                                                           | Auth                                       |
| ------ | ------------------------------------------------------------------------------ | ------------------------------------------ |
| POST   | `/deal-requests`                                                               | User                                       |
| GET    | `/me/deal-requests` · `/me/deal-requests/:id`                                  | User (owner, else 404)                     |
| POST   | `/me/deal-requests/:id/cancel` · `/close` · `/extend`                          | User (owner)                               |
| POST   | `/me/deal-requests/:id/contact-grants` `{agencyId}`                            | User (owner)                               |
| DELETE | `/me/deal-requests/:id/contact-grants/:agencyId`                               | User (owner)                               |
| POST   | `/me/proposals/:id/accept` `{shareContact}` · `/decline`                       | User (request owner)                       |
| GET    | `/agency/deal-requests?scope&type&assetType&dealType` · `/:id`                 | AGENT / AGENCY_OWNER of an APPROVED agency |
| POST   | `/agency/deal-requests/:id/proposals`                                          | AGENT / AGENCY_OWNER                       |
| GET    | `/agency/proposals?status` · POST `/agency/proposals/:id/withdraw`             | AGENT / AGENCY_OWNER                       |
| GET    | `/me/notifications?cursor&limit&unreadOnly` · `/me/notifications/unread-count` | User                                       |
| POST   | `/me/notifications/read` `{ids}` or `{all:true}`                               | User                                       |
| GET    | `/admin/deal-requests` · `/admin/deal-requests/:id`                            | Admin (TOTP)                               |
| POST   | `/admin/deal-requests/:id/close` `{reason}` (audited)                          | Admin (TOTP)                               |

## Jobs (queue `deal-requests`, own queue so no other worker competes)

- `deal-request.fanout` — enqueued on create (`jobId fanout-<id>`); advisory-locked + idempotent.
- `deal-request.expire` — hourly at :07 KST (only when `JOBS_ENABLED`).
- `deal-request.scrub` — daily 04:41 KST (only when `JOBS_ENABLED`).

## Ports (swap for the owning module's service when it exists)

`DEAL_REQUEST_AGENCIES` (agency 시군구 / approval / member recipients), `DEAL_REQUEST_LISTINGS`
(proposable listings), `DEAL_REQUEST_COMPLEXES`, `DEAL_REQUEST_MEDIA` — Prisma read-only bindings in `ports/`.

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/deal-requests`, shared rules:
  `pnpm --filter @house/shared test -- src/deal-requests`.
- e2e: `pnpm --filter @house/api test:e2e deal-requests` (DB `house_test_deal_requests`, Redis DB 5).
