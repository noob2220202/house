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
  ones are never in an inbox (`services/deal-request-access.ts`). A request an admin flagged as spam
  (`spamFlaggedAt`) is hidden from every agency — inbox (all scopes), detail, candidates, proposals,
  dashboard and the new-request fan-out — even from offices that already proposed, until the flag is cleared.
- Privacy: agency/admin selects never load contact or 동·호 (`deal-request.selects.ts`). Contact is loaded in a
  separate query only for an agency with an active `DealRequestContactGrant` while the request is
  OPEN/MATCHED/CLOSED (CLOSED: only until `CONTACT_RETENTION_DAYS` after `closedAt`) **and the requester is
  ACTIVE** (a suspended/withdrawn requester's contact is never served, scrub or not). Grants come from
  `POST …/contact-grants` or accepting a proposal with `shareContact` — **required** boolean, no default
  (개인정보 제3자 제공 needs an explicit opt-in). Cancel and admin close revoke all grants. Admins see a masked
  contact only.
- Pre-grant agency view (DEAL_REQUEST_PROVIDE 제공 항목, `DealRequestMapper.agency`): without that grant
  (`detailsShared: false`) a 내놓기 request carries 읍면동 / 단지, asset / deal type, prices, move-in date, the
  area band (`areaRange`, shared `DEAL_REQUEST_AREA_BANDS`), `photoCount`, lat/lng snapped to the centre of a
  `DEAL_REQUEST_LOCATION_GRID_DEG` (0.002°, ≈ 200 m) cell and only the form's flag lines of the description
  (`publicDealRequestDescription`: 가격 협의 가능 / 즉시 입주 가능 / 입주일 협의 가능 / 저·중·고층) — `roadAddress`,
  `floor`, `exclusiveArea` are null and `photos` is empty. With the grant (`detailsShared: true`) everything
  plus `contact`. 구하기 requests are not reduced (their conditions and description are the 제공 항목).
- Retention (DEAL_REQUEST_PRIVACY notice): `CONTACT_RETENTION_DAYS` = **30** days after a request ended
  (CLOSED / CANCELLED / EXPIRED) the `scrub` job erases contact, 동·호, road address, lat/lng/location, floor,
  area, description and photos (media soft-deleted) and revokes the grants; the request record (type, asset /
  deal type, prices, 읍면동 / 단지, wanted conditions, dates) stays in the requester's history. Selection is by
  residue, so rows of an earlier policy are caught up and re-runs are no-ops. For withdrawn members the same
  is erased at once by `DealRequestMaintenanceService.scrubUser(userId, now, tx)` — called inside the
  withdrawal transaction, then `dispatch(notices)` after commit — with the `scrub` job as the safety net.
  The seeded notices (`prisma/seed/base.ts` `DEAL_REQUEST_PRIVACY_BODY` / `DEAL_REQUEST_PROVIDE_BODY`) state
  exactly these rules; `test/e2e/deal-requests/compliance.e2e-spec.ts` checks them.
- Proposal author (공인중개사법 제18조의4): any ACTIVE member may send a proposal. The requester's
  `ProposalView.agent` is `{ displayName, isAssistant, phone }`; for a 중개보조원 (not OWNER, not
  `isLicensed`) `isAssistant` is true and `phone` null — the UI labels them 중개보조원 and calls the office
  number of the agency disclosure.
- Lifecycle: OPEN → MATCHED (proposal accepted) → CLOSED (거래 완료) / CANCELLED; OPEN → EXPIRED after 30 days
  (`expire` job; MATCHED never expires — the requester closes it). `POST …/extend` pushes an OPEN request's
  expiry to now + 30 days or reopens an EXPIRED one (≤ `MAX_EXTENSIONS` = 3 times, reopening counts toward
  the 10 active requests, not after contact was scrubbed). Proposals: SENT → VIEWED (requester opened the request) → ACCEPTED / DECLINED, or
  WITHDRAWN by the agency.
- Notifications: in-app rows in `notifications` (written in the same transaction), then
  `NotificationDispatcher.dispatch()` (token `NOTIFICATION_DISPATCHER`, default in-app only) for e-mail/push.
  There is deliberately no SMS channel. New requests fan out to brokers via the `deal-request.fanout` job.
- Notification audience (B5): one feed per user, but every row addressed to someone **as a member of
  an agency** carries `data.agencyId` — `NotificationsService.createForMembers({ userId, agencyId }[])`
  (fan-out, proposal accepted / declined, contact granted, request ended), the agencies module's
  approval / rejection / warning rows, and listing notices written through `createFor` / `createEach`
  (LISTING_HIDDEN, LISTING_EXPIRED, CO_BROKER_REQUESTED with `data.listingId` get the listing's
  primary agency). `?scope=agency` = `data.agencyId` is set **or** the type is agency-only
  (DEAL_REQUEST_RECEIVED, PROPOSAL_ACCEPTED, CONTACT_GRANTED, LISTING_EXPIRED, CO_BROKER_REQUESTED,
  LISTING_HIDDEN — covers older rows and the listings module's direct writes without `agencyId`);
  `?scope=personal` = everything else. The scope applies to the feed, its `unreadCount`, `unread-count`
  and `read {all:true}` (the `unread` it returns is of that scope); without `scope` nothing changes.

## Endpoints (prefix `/api/v1`)

| Method | Path                                                                                                                 | Auth                                       |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| POST   | `/deal-requests`                                                                                                     | User                                       |
| GET    | `/me/deal-requests` · `/me/deal-requests/:id`                                                                        | User (owner, else 404)                     |
| POST   | `/me/deal-requests/:id/cancel` · `/close` · `/extend`                                                                | User (owner)                               |
| POST   | `/me/deal-requests/:id/contact-grants` `{agencyId}`                                                                  | User (owner)                               |
| DELETE | `/me/deal-requests/:id/contact-grants/:agencyId`                                                                     | User (owner)                               |
| POST   | `/me/proposals/:id/accept` `{shareContact}` · `/decline`                                                             | User (request owner)                       |
| GET    | `/deal-requests/target-agencies?q&emdCode&regionCodes&page&pageSize` ¹                                               | Public                                     |
| GET    | `/deal-requests/address-match?roadAddress&buildingName&bcode` ²                                                      | Public                                     |
| GET    | `/agencies/mine/dashboard` ³                                                                                         | AGENT / AGENCY_OWNER of an APPROVED agency |
| GET    | `/agency/deal-requests?scope&type&assetType&dealType` · `/:id`                                                       | AGENT / AGENCY_OWNER of an APPROVED agency |
| GET    | `/agency/deal-requests/:id/listing-candidates?q&page&pageSize` ⁴                                                     | AGENT / AGENCY_OWNER                       |
| POST   | `/agency/deal-requests/:id/proposals`                                                                                | AGENT / AGENCY_OWNER                       |
| GET    | `/agency/proposals?status` · POST `/agency/proposals/:id/withdraw`                                                   | AGENT / AGENCY_OWNER                       |
| GET    | `/me/notifications?cursor&limit&unreadOnly&scope` → `{items,nextCursor,unreadCount}`                                 | User                                       |
| GET    | `/me/notifications/unread-count?scope` → `{unread}`                                                                  | User                                       |
| POST   | `/me/notifications/read?scope` `{ids}` or `{all:true}`                                                               | User                                       |
| GET    | `/admin/deal-requests?…&spam=flagged\|suspected` · `/admin/deal-requests/:id`                                        | Admin (TOTP)                               |
| POST   | `/admin/deal-requests/:id/close` `{reason}` (audited)                                                                | Admin (TOTP)                               |
| POST   | `/admin/deal-requests/:id/spam-flag` `{flagged, reason?}` (reason ≥ 5 when flagging; audited `dealRequest.spamFlag`) | Admin (TOTP)                               |

¹ Offices a request reaches and the "선택한 중개사" picker: every APPROVED office of `REGION_SGG_CODE`
(the `ALL_AGENCIES_IN_REGION` rule — `total` is the reach count); offices whose 읍면동 is one of the
codes first, then by active listings. `q` = 상호 / 대표 / 주소 (ILIKE, `%`/`_` literal). Codes accept
legacy 46150… (canonicalized). Response = `Paginated<{ id, name, representativeName, phone,
roadAddress, specialty ("아파트·오피스텔 전문"), activeListingCount, avgResponseMinutes (null, not
measured), logoUrl }>` + `areaLabel` (up to 3 region names joined by `·`, null without codes). Default
`pageSize` 10 (max 50). Cached 60 s under the agencies' public version.

² Registered complex of a Kakao postcode result: same road name + building number as
`complexes.road_address` (any 시도 spelling), else the same building name (spaces / punctuation
ignored) in the 읍면동 of `bcode` (or the service 시군구). → `{ emdCode, emdName, lat, lng, complex:
{ id, name, emdName, households, builtYear, floorsMax, areaTypes[{ id, pyeongLabel, exclusiveArea,
supplyArea }], market: { recentTradePrice, recentTradeYm "YYYY-MM", recentTradePyeong, askingMin,
askingMax, perPyeong } | null } | null }`. Market = latest non-cancelled 매매 실거래 (평 / 평당가 from
공급면적, else 전용) + min / max 매매가 of advertised listings. No match → `emdCode` = `bcode`, its
name, no point. 400 without `roadAddress`. Cached 300 s.

³ Console home, composed here (`ConsoleDashboardService`) from the agencies module's
`AgencyDashboardService` (listings, views, expiring / 실매물 확인 due — see the agencies README) and the
inbox: `dealRequests.newCount/newSellCount/newWantedCount` (OPEN, not yet proposed to, by type) and
`items` = the latest 4 visible requests in the `GET /agency/deal-requests` item shape. `inquiries`
comes from the inquiries module (`InquiryDashboardService`, imported — inquiries never imports this
module): `unreadCount` = unread rows of the office's inbox, `items` = its latest 3 written inquiries
(MESSAGE) in the `GET /agency/inquiries` item shape. Notification scope: `INQUIRY_RECEIVED`,
`AGENCY_SITE_APPROVED` and `AGENCY_SITE_REJECTED` are agency-only types (`notification-scope.ts`);
`INQUIRY_REPLIED` is personal.

⁴ ACTIVE listings the agency actively (co-)brokers (the proposal rule), for a request it can see
(404 otherwise). `q` = title or 단지명. Ranked like the web picker (`domain/listing-match.ts`: all
stated conditions met first, then number of met conditions — asset type, deal type, region / complex,
budget, area, rooms; ties by latest 실매물 확인). Item = `{ id, title, assetType, dealType, price
(매매 / 전세 / 분양권 = 분양가 + 프리미엄), deposit / monthlyRent (월세), exclusiveArea, floorLabel,
rooms, emdCode, emdName, complexId, thumbUrl, verifiedAt }`; default `pageSize` 50 (max 100).

## Jobs (queue `deal-requests`, own queue so no other worker competes)

- `deal-request.fanout` — enqueued on create (`jobId fanout-<id>`); advisory-locked + idempotent.
- `deal-request.expire` — hourly at :07 KST (only when `JOBS_ENABLED`).
- `deal-request.scrub` — daily 04:41 KST (only when `JOBS_ENABLED`): 30-day erasure of ended requests +
  withdrawn members' residue (see Retention).

## Ports (swap for the owning module's service when it exists)

`DEAL_REQUEST_AGENCIES` (agency 시군구 / approval / member recipients), `DEAL_REQUEST_LISTINGS`
(proposable listings), `DEAL_REQUEST_COMPLEXES`, `DEAL_REQUEST_MEDIA` — Prisma read-only bindings in `ports/`.
`RequestFormService` (target agencies, address match), `ListingCandidatesService` and
`RegionNamesService` also read the agencies / complexes / trades / listings / regions tables
read-only (no owning-module reader exists for these queries).

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/deal-requests` (incl. `domain/domain.spec.ts`), shared rules:
  `pnpm --filter @house/shared test -- src/deal-requests`.
- e2e: `pnpm --filter @house/api test:e2e deal-requests` (DB `house_test_deal_requests`, Redis DB 5);
  `console.e2e-spec.ts` covers the dashboard, target agencies, address match, listing candidates and
  the B5 notification audience; `compliance.e2e-spec.ts` the retention scrub, the pre-grant view, the
  중개보조원 label and the seeded notice text.
