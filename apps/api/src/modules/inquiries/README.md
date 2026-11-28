# Inquiries (문의) module (`apps/api/src/modules/inquiries`)

Registered in `AppModule`. Read `docs/CONVENTIONS.md` and `docs/agency-sites/SPEC.md` (§1.3–1.5,
§2, §3.5) first.

"고객센터" style: a customer leaves a written inquiry to an office (main site or the office's own
홈페이지 `<slug>.suncheonmap.kr`), the office answers in the console inbox, a member reads the answer
thread under MY > 문의 내역 and can follow up. 전화 / 문자 / 번호 복사 presses are logged as contact
events in the same inbox.

## Endpoints

All paths are under `/api/v1`.

| Method | Path                            | Auth                                    | Notes                                                    |
| ------ | ------------------------------- | --------------------------------------- | -------------------------------------------------------- |
| POST   | `/inquiries`                    | Public, optional session                | → 201 `InquiryCreated`; `THROTTLE.INQUIRY` + daily cap   |
| POST   | `/inquiries/contact-events`     | Public, optional session                | → 204; deduped per visitor, `@SkipTermsCheck()` (beacon) |
| GET    | `/agency/inquiries`             | AGENT / AGENCY_OWNER (ACTIVE, APPROVED) | `AgencyInquiryPage` (`unreadCount`, `statusCounts`)      |
| POST   | `/agency/inquiries/read`        | same                                    | `{ all: true }` → `{ updated, unreadCount }`             |
| GET    | `/agency/inquiries/:id`         | same                                    | detail with `messages`                                   |
| PATCH  | `/agency/inquiries/:id`         | same                                    | `status` / `memo` / `read`                               |
| POST   | `/agency/inquiries/:id/replies` | same                                    | → 201 detail; members only (409 otherwise)               |
| DELETE | `/agency/inquiries/:id`         | same                                    | → 204 soft delete, body `{ reason? }` optional           |
| GET    | `/me/inquiries`                 | any member                              | `Paginated<MyInquiryListItem>`                           |
| GET    | `/me/inquiries/:id`             | the member who asked                    | `MyInquiryDetail`; sets `customerReadAt`                 |
| POST   | `/me/inquiries/:id/messages`    | the member who asked                    | → 201 detail; follow-up; `THROTTLE.INQUIRY` + daily cap  |

Rows of other offices / other members answer **404** (`INQUIRY_NOT_FOUND`); a plain user on
`/agency/**` gets 403 (roles), an AGENT/OWNER without an ACTIVE membership 403
`AGENCY_MEMBERSHIP_REQUIRED`, a non-APPROVED office 403 `AGENCY_NOT_APPROVED`
(`AgenciesService.assertActiveMember`).

## Rules

- **Guests are first-class**: office sites are anonymous (sessions stay host-only on the main
  domain), so a guest leaves name + phone + consent. `phone` is required for guests
  (`INQUIRY_PHONE_REQUIRED`), optional for members; format only (`contactPhoneSchema`), never
  verified, no SMS.
- **Create order** (`InquiriesService.create`): honeypot `website` non-empty → 400 `INQUIRY_REJECTED`
  (nothing stored, no cap used) → office APPROVED and not deleted (404 `INQUIRY_AGENCY_NOT_FOUND`) →
  `listingId` public (ACTIVE / RESERVED, not deleted, primary office APPROVED) and linked to the
  office by an ACTIVE `listing_agencies` row, primary or co-broker (404 `INQUIRY_LISTING_NOT_FOUND`)
  → guest phone → consents → daily cap → one transaction.
- **Consent** (`INQUIRY_PRIVACY`, `ACTION_CONSENT_TERMS.INQUIRY`): `TermsService.verifyActionConsents`
  before the cap. Members get a `user_consents` row in the create transaction
  (`consentForAction`). Guests have no account (`UserConsent.userId` is a required FK), so the
  verified `termsDocumentId`s are stored on the row (`inquiries.consent_terms_document_ids`).
- **Abuse control**: `@Throttle(THROTTLE.INQUIRY)` (5/min per account, else per client IP) and
  `DAILY_CAPS.INQUIRY_CREATE` (10 per KST day) keyed `u:<userId>` for members and `ip:<hash>` for
  guests; over the cap → 429 `INQUIRY_DAILY_LIMIT` (`services/inquiry-caps.ts` maps the generic
  `RATE_LIMITED`). Follow-ups: `THROTTLE.INQUIRY` + `DAILY_CAPS.INQUIRY_FOLLOW_UP` (30).
- **Visitor identity** (`InquiryVisitorService`): never the raw IP — an HMAC (purpose-bound subkey
  of `COOKIE_SECRET`) of the client's network (`req.ip`, follows `TRUST_PROXY`: the IPv4 address, or
  the IPv6 /64 so rotating addresses inside one subscriber's /64 shares one cap and dedupe), 64 hex
  chars, kept on guest rows as `visitor_hash` until retention.
- **Contact events**: CALL / SMS / COPY rows without PII — no name at all, not even a masked one
  (nobody consented to giving it to the office; `isMember` still shows from `userId`), logged once
  per visitor (member id or IP hash) + office + listing (or the office page) + channel per
  `CONTACT_EVENT_DEDUPE_HOURS` (6 h, Redis `SET NX EX` under `inquiries:contact:*`; released if the
  write fails). Presses by the office's own ACTIVE members and by visitors without an address are
  not logged. No notification. They are logs, not cases: stored as `DONE` with `readAt =
  createdAt`, so they never fill the 새 문의 tab / `statusCounts.NEW` or the unread badge; they
  list under 전체 and the channel filter.
- **Inbox**: newest `lastMessageAt` first, soft-deleted rows never show. `q` matches customer name,
  phone (digits of the term), opening text, thread messages and every name the listing card can
  show (title, 단지, building name, road address — `listingTitle`). `statusCounts` count under every
  filter except `status` (the tabs). Opening the detail does not mark it read; `PATCH { read }`
  does. A status change makes the caller the handler (`handledByName` = their member display name).
- **Replies** only when `canReply` = MESSAGE ∧ member ∧ member not withdrawn ∧ not scrubbed (else
  409 `INQUIRY_REPLY_NOT_ALLOWED`; the console tells the office to call a guest back). A reply
  adds an AGENCY message (author name = member display name), marks the row read and moves NEW →
  IN_PROGRESS (handler = the replier). Replies and follow-ups lock the row (`FOR UPDATE`).
- **Follow-ups** (member): a CUSTOMER message; the row is NEW and unread for the office again;
  409 when the office is no longer APPROVED or the thread was scrubbed.
- **MY**: written inquiries of the caller only (contact events and rows the office deleted are
  excluded). `hasUnreadReply` = an AGENCY message newer than `customerReadAt`.
- **Notifications** (in-app, written directly in the caller's transaction by
  `ports/inquiry-notifier.port.ts` — the notifications writer lives in deal-requests, which
  depends on this module):
  - `INQUIRY_RECEIVED` → every ACTIVE member (ACTIVE account) of the office except the customer,
    `data { agencyId, inquiryId, followUp? }`. Agency-only type (deal-requests
    `AGENCY_ONLY_NOTIFICATION_TYPES`, web `AGENCY_ONLY_TYPES`). Text names the listing / source,
    never the customer.
  - `INQUIRY_REPLIED` → the customer's personal feed, `data { inquiryId, agencyName }` — **no
    `agencyId`** (that would route it to the agency feed).
- **Retention** (`InquiryRetentionService`, job `inquiry.scrub` on the module's own queue
  `inquiries`, daily 04:29 KST, `JOBS_ENABLED` gate): `customer_name`, `customer_phone`,
  `message`, `memo`, `delete_reason` (the office's free text may quote the customer),
  `visitor_hash` → NULL, message bodies → `''` (and CUSTOMER author names → NULL),
  `pii_scrubbed_at` set, for rows whose `last_message_at` is older than `RETENTION_DAYS` (365) and
  for every row of a withdrawn member. Rows stay countable. `scrubUser(userId, now, tx)` is
  exported for the withdrawal transaction. A withdrawn office member's name on the replies they
  wrote (AGENCY `author_name`) goes with their PII scrub (auth `PiiScrubService`, as their
  `agency_members.display_name`).
- **Console home**: `InquiryDashboardService.forAgency(agencyId)` (exported) feeds
  `GET /agencies/mine/dashboard` `inquiries { unreadCount, items }` (latest 3 MESSAGE rows).

## Files

- `controllers/` — `inquiries.controller.ts` (public), `agency-inquiries.controller.ts`,
  `me-inquiries.controller.ts`.
- `services/` — `inquiries.service.ts` (create, contact events), `agency-inquiries.service.ts`,
  `my-inquiries.service.ts`, `inquiry-dashboard.service.ts`, `inquiry-retention.service.ts`,
  `inquiry-visitor.service.ts`, `inquiry-caps.ts`.
- `ports/` — `inquiry-directory.port.ts` (read-only agency / listing / member reads),
  `inquiry-notifier.port.ts`.
- `inquiry.selects.ts` (explicit selects; `visitor_hash`, consent ids and delete reasons are never
  selected for views), `inquiry.mapper.ts`, `domain/customer.ts`, `jobs/inquiries.processor.ts`.

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/inquiries`.
- e2e: `pnpm --filter @house/api test:e2e inquiries` (DB `house_test_inquiries`, Redis DB 10):
  `customer` (create, honeypot, consent, caps, throttle, CSRF, contact events + dedupe), `agency`
  (inbox, detail, patch, replies, read-all, delete, notification feed scope), `me` (full thread,
  follow-ups), `retention` (scrub job). The console dashboard block is covered in
  `test/e2e/deal-requests/console.e2e-spec.ts`.
