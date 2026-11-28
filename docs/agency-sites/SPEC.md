# Office sites, subscriptions and inquiries — build spec

Owner decisions of 2026-11-28 (they override `docs/frontend-integration/DECISIONS.md`; D5 "no inquiry backend" is
superseded). Korean UI copy below is final unless a reviewer finds it wrong.

| #   | Decision                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Every 중개사무소 can have its own site at `https://<slug>.suncheonmap.kr` ("사무소 홈페이지"): same design system as the main site, branded as the office's own, showing **only listings whose primary agency is that office**. |
| O2  | Customisation is simple: logo, cover photo, intro (existing profile fields) + a brand colour from a preset palette + a one-line tagline.                                                                                        |
| O3  | The office **requests** a slug in the broker console; an admin **approves** (may edit the slug), rejects or later suspends.                                                                                                     |
| O4  | The office site and the main-site listing (입점) are both paid products, **but both are free for now**: admins record subscriptions; enforcement switches exist and default to off.                                             |
| O5  | Inquiries (문의) are built, "고객센터" style: a customer leaves a written inquiry to an office, the office answers in the console inbox, a member sees the answer thread under MY.                                              |
| O6  | Office sites are read-only/anonymous (sessions stay host-only on the main domain). Login-only actions link to the main site. Guests can still send inquiries (name + phone + consent).                                          |
| O7  | Payment is offline for now (bank transfer); an admin types the period. No PG integration.                                                                                                                                       |
| O8  | SEO: the office home is canonical on its own host; an office-site listing page is canonical to the main-site listing URL (no duplicate content).                                                                                |
| O9  | DNS is at 가비아 (no DNS API) → no wildcard cert; per-slug HTTP-01 certificates issued by a root timer on the server.                                                                                                           |

Rollback note: new enum values (TermsType, NotificationType, the new enums) are written in the same release that adds
them. This deliberately skips the two-release rule of CONVENTIONS §11 — the service is pre-launch with test data only.
Record this in DECISIONS.md.

---

## 1. Shared contract (`packages/shared`)

### 1.1 Enums (each Prisma enum gets an identical `as const` twin + `*_LABEL`; enum-parity spec must pass)

| Enum                    | Values (label)                                                                                             | Where                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `AgencySiteStatus`      | `REQUESTED` 신청 중 · `ACTIVE` 운영 중 · `REJECTED` 반려 · `SUSPENDED` 정지                                | `enums/agency.ts` + Prisma      |
| `SubscriptionProduct`   | `SITE` 사무소 홈페이지 · `PLATFORM` 메인 사이트 입점                                                       | `enums/agency.ts` + Prisma      |
| `InquiryChannel`        | `MESSAGE` 문의글 · `CALL` 전화 · `SMS` 문자 · `COPY` 번호 복사                                             | `enums/inquiry.ts` + Prisma     |
| `InquiryStatus`         | `NEW` 새 문의 · `IN_PROGRESS` 응대 중 · `DONE` 응대 완료                                                   | `enums/inquiry.ts` + Prisma     |
| `InquirySource`         | `MAIN` 순천부동산지도 · `SITE` 사무소 홈페이지                                                             | `enums/inquiry.ts` + Prisma     |
| `InquiryAuthor`         | `CUSTOMER` · `AGENCY`                                                                                      | `enums/inquiry.ts` + Prisma     |
| `TermsType` (+1)        | `INQUIRY_PRIVACY` 문의 개인정보 수집·이용 및 제공 동의; `ACTION_CONSENT_TERMS.INQUIRY = [INQUIRY_PRIVACY]` | `enums/user.ts` + `auth.prisma` |
| `NotificationType` (+4) | `INQUIRY_RECEIVED`, `INQUIRY_REPLIED`, `AGENCY_SITE_APPROVED`, `AGENCY_SITE_REJECTED` (labels in Korean)   | `enums/user.ts` + `core.prisma` |

`INQUIRY_RECEIVED`, `AGENCY_SITE_APPROVED`, `AGENCY_SITE_REJECTED` are agency-feed types (add to
`AGENCY_ONLY_NOTIFICATION_TYPES` and the web `AGENCY_ONLY_TYPES`). `INQUIRY_REPLIED` goes to the member's own feed and
its `data` must **not** contain `agencyId` (that would route it to the agency feed) — use `{ inquiryId, agencyName }`.

Brand colour is **not** a Prisma enum (a validated `VarChar(20)`): `AgencySiteColor` const + `AGENCY_SITE_COLORS`
record in `packages/shared/src/agencies/site.ts`, keys `BLUE` (default, `#1D4FF2` = BRAND), `NAVY`, `GREEN`, `TEAL`,
`RED`, `ORANGE`, `PURPLE`, `BROWN`, `BLACK`. Each entry: `{ label, brand, hover, press, soft, soft2, line, contrast }`
mirroring the `--brand*` tokens in `packages/ui/src/styles/tokens.css`; `brand` must reach ≥ 4.5:1 against white
(unit-test it with a WCAG contrast function).

### 1.2 Slug rules (`packages/shared/src/agencies/site.ts`)

- `normalizeSiteSlug(s) = s.trim().toLowerCase()`.
- Valid: 3–30 chars, `^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`, no `--` anywhere (blocks punycode `xn--`).
- `RESERVED_SITE_SLUGS` (exported set): www, admin, api, app, apps, m, mobile, mail, email, smtp, imap, pop, pop3,
  ftp, sftp, ns, ns1, ns2, dns, mx, webmail, autodiscover, autoconfig, static, assets, cdn, img, image, images, media,
  upload, uploads, files, dev, test, testing, staging, stage, beta, alpha, demo, local, localhost, preview, help,
  support, cs, blog, news, status, docs, doc, wiki, about, login, logout, auth, oauth, sso, signup, register, account,
  accounts, me, my, agent, agents, agency, agencies, office, offices, site, sites, map, maps, search, listing, listings,
  complex, complexes, deal, deals, home, root, system, server, web, www1, www2, billing, pay, payment, shop, store,
  ads, ad, suncheon, suncheonmap, house, brand, official, notice, notices, event, events, kakao, naver, google, apple,
  null, undefined.
- `siteSlugProblem(s): null | 'INVALID' | 'RESERVED'`; `siteSlugSchema` (zod, normalises then validates, Korean messages).
- `siteUrl(slug, rootDomain, protocol='https:', port?)` helper used by API + web.

### 1.3 Request schemas (zod; Korean error messages, `trimmed()` helpers as in `agencies/schemas.ts`)

- `agencySiteRequestSchema` `{ slug: siteSlug, color?: AgencySiteColor, tagline?: string ≤ 60 | null }`
- `agencySiteUpdateSchema` `{ color?: AgencySiteColor, tagline?: string ≤ 60 | null }` (at least one field)
- `agencySiteAvailabilityQuerySchema` `{ slug: string }`
- `adminAgencySiteDecisionSchema` `{ action: 'APPROVE'|'REJECT'|'SUSPEND'|'RESUME', slug?: siteSlug (APPROVE only), reason?: string 1–500 (required for REJECT and SUSPEND) }`
- `adminAgencySiteListQuerySchema` `{ status?: AgencySiteStatus, q?: string, page, pageSize }` (pagination helpers as other admin lists)
- `adminSubscriptionCreateSchema` `{ product, startsOn: 'YYYY-MM-DD', endsOn?: 'YYYY-MM-DD' | null (≥ startsOn), amountWon?: int ≥ 0 | null, memo?: string ≤ 500 | null }`
- `adminSubscriptionUpdateSchema` `{ endsOn?: date | null, memo?: string | null, cancel?: true }` (at least one)
- `listingFilterSchema` gains `primaryAgencyId?: uuid` and `withoutComplex?: boolean` (query-string boolean like the
  other flags). Used by `GET /listings` and `GET /map/search`.
- `inquiryCreateSchema` `{ agencyId: uuid, listingId?: uuid | null, name: string 1–30, phone?: koreanPhone | null, message: string 5–1000, source: InquirySource, consents: actionConsentsSchema(ACTION_CONSENT_TERMS.INQUIRY), website?: string (honeypot; must be empty/absent) }`
- `inquiryContactEventSchema` `{ agencyId: uuid, listingId?: uuid | null, channel: 'CALL'|'SMS'|'COPY', source: InquirySource }`
- `agencyInquiryListQuerySchema` `{ status?: InquiryStatus, channel?: InquiryChannel, source?: InquirySource, unread?: boolean, q?: string ≤ 50, page, pageSize (default 12, max 50) }`
- `agencyInquiryUpdateSchema` `{ status?: InquiryStatus, memo?: string ≤ 1000 | null, read?: boolean }` (at least one)
- `inquiryReplySchema` `{ message: string 1–1000 }` (agency reply and member follow-up)
- `agencyInquiryReadAllSchema` `{ all: true }`
- `agencyInquiryDeleteSchema` `{ reason?: string ≤ 200 }`

Phone format: reuse the existing Korean phone schema used by deal requests/agency forms (format-only; no SMS).

### 1.4 Response types (`types.ts` style plain TS interfaces; the web/admin re-declare zod parsers)

```ts
interface AgencySiteView {
  id: string;
  agencyId: string;
  status: AgencySiteStatus;
  slug: string | null; // approved slug (ACTIVE / SUSPENDED); null before first approval
  requestedSlug: string | null; // slug asked for (REQUESTED) or last rejected request
  color: AgencySiteColor;
  tagline: string | null;
  url: string | null; // https://<slug>.<root> when ACTIVE (even before https is ready)
  httpsReady: boolean; // true when httpsReadyAt is set OR PUBLIC_BASE_URL is not https (dev)
  live: boolean; // ACTIVE && agency APPROVED && httpsReady && subscription gate passes
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}
interface MyAgencySiteResponse {
  site: AgencySiteView | null;
  rootDomain: string; // e.g. "suncheonmap.kr" (dev: "localhost")
  subscription: { required: boolean; active: boolean; endsOn: string | null };
}
interface SiteSlugAvailability {
  slug: string;
  available: boolean;
  reason: null | 'INVALID' | 'RESERVED' | 'TAKEN';
}
interface PublicAgencySite {
  slug: string;
  color: AgencySiteColor;
  tagline: string | null;
  url: string;
  agency: AgencyProfile; // exactly what GET /agencies/:id returns
}
interface AdminAgencySiteListItem {
  site: AgencySiteView;
  agency: { id: string; name: string; representativeName: string; status: AgencyStatus };
}
interface AgencySubscriptionView {
  id: string;
  agencyId: string;
  product: SubscriptionProduct;
  startsOn: string;
  endsOn: string | null;
  amountWon: number | null;
  memo: string | null;
  canceledAt: string | null;
  state: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELED'; // derived in KST days
  createdByName: string | null;
  createdAt: string;
}
interface AgencySubscriptionsResponse {
  items: AgencySubscriptionView[];
  current: Record<SubscriptionProduct, boolean>;
}

interface InquiryListingRef {
  id: string;
  title: string;
  assetType: AssetType;
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  coverPhotoUrl: string | null;
}
interface InquiryMessageView {
  id: string;
  author: InquiryAuthor;
  body: string;
  authorName: string | null;
  createdAt: string;
}
interface AgencyInquiryView {
  id: string;
  channel: InquiryChannel;
  status: InquiryStatus;
  source: InquirySource;
  listing: InquiryListingRef | null; // null = office page / office site home
  customerName: string | null; // MESSAGE: as submitted; contact events: masked member name or null
  customerPhone: string | null; // MESSAGE only
  isMember: boolean;
  canReply: boolean; // canReply = MESSAGE && member && member not withdrawn
  message: string | null;
  memo: string | null;
  handledByName: string | null;
  readAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: InquiryMessageView[]; // detail only (follow-ups and replies, oldest first)
}
interface AgencyInquiryPage extends Paginated<AgencyInquiryView> {
  unreadCount: number;
  statusCounts: Record<InquiryStatus, number>;
}
interface MyInquiryListItem {
  id: string;
  agency: { id: string; name: string; logoUrl: string | null };
  listing: InquiryListingRef | null;
  status: InquiryStatus;
  preview: string;
  replyCount: number;
  hasUnreadReply: boolean;
  lastMessageAt: string;
  createdAt: string;
}
interface MyInquiryDetail {
  id: string;
  agency: { id: string; name: string; phone: string; logoUrl: string | null };
  listing: InquiryListingRef | null;
  status: InquiryStatus;
  name: string | null;
  phone: string | null;
  message: string;
  messages: InquiryMessageView[];
  createdAt: string;
}
interface InquiryCreated {
  id: string;
  createdAt: string;
  member: boolean;
}
```

`GET /agencies/:id` (`AgencyProfile`) gains `site: { url: string } | null` — set only when the site is `live`.

### 1.5 Error codes

`errors/agencies.ts`: `AGENCY_SITE_NOT_FOUND` (404), `AGENCY_SITE_SLUG_INVALID` (400), `AGENCY_SITE_SLUG_RESERVED`
(400), `AGENCY_SITE_SLUG_DUPLICATE` (409), `AGENCY_SITE_ALREADY_ACTIVE` (409), `AGENCY_SITE_INVALID_TRANSITION` (409),
`AGENCY_SUBSCRIPTION_NOT_FOUND` (404), `AGENCY_SUBSCRIPTION_INVALID_PERIOD` (400).
New `errors/inquiries.ts` (register in `errors/index.ts`): `INQUIRY_NOT_FOUND` (404), `INQUIRY_AGENCY_NOT_FOUND` (404),
`INQUIRY_LISTING_NOT_FOUND` (404), `INQUIRY_PHONE_REQUIRED` (400), `INQUIRY_REPLY_NOT_ALLOWED` (409),
`INQUIRY_REJECTED` (400, honeypot), `INQUIRY_DAILY_LIMIT` (429). Korean messages for all.

---

## 2. Database (Prisma, additive migrations, folder names `<ts>_<module>_<change>`)

`agencies.prisma`:

```prisma
model AgencySite {
  id               String           @id @default(uuid(7)) @db.Uuid
  agencyId         String           @unique @db.Uuid
  status           AgencySiteStatus @default(REQUESTED)
  slug             String?          @db.VarChar(30)  /// approved; partial unique index (SQL) WHERE slug IS NOT NULL
  requestedSlug    String?          @db.VarChar(30)
  color            String           @default("BLUE") @db.VarChar(20)
  tagline          String?          @db.VarChar(60)
  requestedAt      DateTime         @db.Timestamptz(3)
  decidedAt        DateTime?        @db.Timestamptz(3)
  decidedByAdminId String?          @db.Uuid
  decisionReason   String?          @db.VarChar(500)
  httpsReadyAt     DateTime?        @db.Timestamptz(3)  /// written by deploy/sites.sh once the cert is live
  createdAt / updatedAt
  agency Agency @relation(...)   (onDelete Cascade)
  @@index([status, requestedAt])
}
model AgencySubscription {
  id, agencyId, product SubscriptionProduct, startsOn DateTime @db.Date, endsOn DateTime? @db.Date,
  amountWon Int?, memo String? @db.VarChar(500), canceledAt DateTime? @db.Timestamptz(3),
  createdByAdminId String? @db.Uuid, createdAt, updatedAt
  @@index([agencyId, product])
}
```

`slug` uniqueness: `CREATE UNIQUE INDEX agency_sites_slug_key ON agency_sites (slug) WHERE slug IS NOT NULL;` (hand-added
SQL, documented with `///`). A slug stays reserved while the site is ACTIVE or SUSPENDED.

New module file `inquiries.prisma`: `Inquiry` (agencyId, listingId?, userId?, channel, status, source, customerName
VarChar(30)?, customerPhone VarChar(20)?, message Text?, memo VarChar(1000)?, handledByUserId?, readAt?,
customerReadAt?, lastMessageAt, consentTermsDocumentIds uuid[] default [], visitorHash VarChar(64)?, piiScrubbedAt?,
deletedAt?, deleteReason VarChar(200)?, createdAt, updatedAt; indexes `[agencyId, deletedAt, lastMessageAt]`,
`[agencyId, readAt]`, `[userId, createdAt]`) and `InquiryMessage` (inquiryId, author, body Text, authorUserId?,
authorName VarChar(50)?, createdAt; index `[inquiryId, createdAt]`). Back-relations in agencies/listings/auth files.

Migrations are generated with `pnpm --filter @house/api db:migration:new <module> <change>` against the local
PostgreSQL (`postgresql://house:house@localhost:5432`, see "Local stack" below), then reviewed and extended by hand.
`pnpm --filter @house/api db:drift` must pass.

Seed: `INQUIRY_PRIVACY` sample terms (수집 항목: 이름·연락처·문의 내용 / 목적: 문의 응대 / 제공받는 자: 문의를 받는 중개사무소
/ 보유 기간: 마지막 답변 후 1년, 그 전에 회원 탈퇴 시 즉시 파기) with the `> 견본` marker like other purpose terms.
FEATURES default gains `siteSubscriptionRequired: false`, `platformSubscriptionRequired: false`.

---

## 3. API (`apps/api`, `/api/v1`)

### 3.1 Office sites + subscriptions (agencies module)

| Method + path                                    | Who                                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `GET /agencies/mine/site`                        | AGENCY_OWNER (approved) + staff read | `MyAgencySiteResponse`. Staff (AGENT) may read; only the owner writes.                                                                                                                                                                                                                                                                                                                            |
| `GET /agencies/mine/site/availability?slug=`     | AGENCY_OWNER                         | `SiteSlugAvailability` (TAKEN = another site's approved slug or another office's open request).                                                                                                                                                                                                                                                                                                   |
| `POST /agencies/mine/site`                       | AGENCY_OWNER                         | Create or re-request (allowed when no site, `REJECTED`, or `REQUESTED` to change the request). `ACTIVE`/`SUSPENDED` → 409 `AGENCY_SITE_ALREADY_ACTIVE`. Sets `REQUESTED`, `requestedAt=now`. Audit.                                                                                                                                                                                               |
| `PATCH /agencies/mine/site`                      | AGENCY_OWNER                         | Colour / tagline, any status except none. Invalidates public cache.                                                                                                                                                                                                                                                                                                                               |
| `GET /sites/:slug`                               | public                               | `PublicAgencySite`; 404 `AGENCY_SITE_NOT_FOUND` unless the site is servable: ACTIVE + agency APPROVED and not deleted + subscription gate. `httpsReady` is **not** required here (it only gates links that the main site and the console show — `live`). Cached like the public profile; bump on any site/agency change.                                                                          |
| `GET /admin/agency-sites?status&q&page&pageSize` | admin (OPERATOR+)                    | `Paginated<AdminAgencySiteListItem>`, oldest request first for REQUESTED.                                                                                                                                                                                                                                                                                                                         |
| `GET /admin/agencies/:id/site`                   | admin                                | `{ site: AgencySiteView                                                                                                                                                                                                                                                                                                                                                                           | null }` |
| `POST /admin/agencies/:id/site/decision`         | admin                                | APPROVE (REQUESTED → ACTIVE; slug = body.slug ?? requestedSlug; 409 if taken), REJECT (REQUESTED → REJECTED, reason), SUSPEND (ACTIVE → SUSPENDED, reason), RESUME (SUSPENDED → ACTIVE). Notification to the owner (APPROVED/REJECTED types; suspend uses REJECTED type? no — suspend/resume send no notification), audit row, cache bump. Approving resets `httpsReadyAt` when the slug changes. |
| `GET /admin/agencies/:id/subscriptions`          | admin                                | `AgencySubscriptionsResponse`                                                                                                                                                                                                                                                                                                                                                                     |
| `POST /admin/agencies/:id/subscriptions`         | admin (ADMIN+)                       | create → `AgencySubscriptionView`; audit                                                                                                                                                                                                                                                                                                                                                          |
| `PATCH /admin/subscriptions/:id`                 | admin (ADMIN+)                       | update / cancel → view; audit                                                                                                                                                                                                                                                                                                                                                                     |

Subscription gate: `FEATURES.siteSubscriptionRequired === true` ⇒ a site is `live` only with an ACTIVE `SITE`
subscription (startsOn ≤ today(KST) ≤ endsOn or endsOn null, not canceled). `platformSubscriptionRequired` is stored and
shown but **not enforced** yet (documented as future work).

Admin dashboard: `DashboardQueues.pendingAgencySites { total, items: [{ agencyId, agencyName, requestedSlug, requestedAt }] }`,
dashboard summary badge `agencySitesPending`, admin notification kind `AGENCY_SITE_REQUEST` (lazy collector like
agency applications).

### 3.2 Origins (lead-owned `common/auth/origin-policy.ts`, `config/env.schema.ts`)

- New optional env `SITE_ROOT_DOMAIN` (default: hostname of `PUBLIC_BASE_URL`; document in `.env.example`).
- User surface (never `isAdminPath`) additionally accepts `<protocol>//<label>.<SITE_ROOT_DOMAIN>[:<port>]` where
  protocol and port equal `PUBLIC_BASE_URL`'s, `label` passes the slug rules (§1.2, reserved labels refused, which
  also refuses `admin`/`www` and the first label of `ADMIN_BASE_URL`'s host). CsrfGuard accepts these origins; the
  CORS delegate does **not** grant them credentialed cross-origin access (office pages call `/api/v1` on their own
  host, so they never need CORS — review finding SEC-2). No cookies change (sessions stay host-only, so subdomain
  requests are anonymous). Tests in `origin-policy.spec.ts` + core e2e.

### 3.3 CSRF cookie for anonymous visitors (audit bug i)

`GET /auth/csrf` sets the `house_csrf` cookie **only when there is a session**; anonymous callers get the token in the
body only (CsrfGuard does not check tokens for anonymous requests). e2e assertion.

### 3.4 Listings filters (listings module)

`primaryAgencyId` → `l.primary_agency_id = $1`; `withoutComplex=true` → `l.complex_id IS NULL`. Both in list and map
search, fingerprinted for caches. e2e next to the `agencyId` case.

### 3.5 Inquiries (new module `apps/api/src/modules/inquiries`, own queue for its job)

| Method + path                        | Who                                 | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /inquiries`                    | public, optional session            | Honeypot `website` non-empty → 400 `INQUIRY_REJECTED`. Agency must be APPROVED (404). `listingId` must be public and linked to the agency by an ACTIVE `listing_agencies` row (404). Guest: `phone` required (400 `INQUIRY_PHONE_REQUIRED`). Consents verified (guest: store verified terms document ids on the row; member: `consentForAction`). Throttle `THROTTLE.INQUIRY` (5/min) + daily cap 10 per user or per IP (`INQUIRY_DAILY_LIMIT`). Creates MESSAGE inquiry, `lastMessageAt=now`, notifies all ACTIVE members (`INQUIRY_RECEIVED`, `data {agencyId, inquiryId}`). → 201 `InquiryCreated`. |
| `POST /inquiries/contact-events`     | public, optional session            | Logs CALL/SMS/COPY as an inquiry row with status DONE and `readAt = createdAt` (no PII at all — not even a member's masked name, no consent was given; never counts toward 새 문의 or the unread badge) unless the same visitor (user id or IP hash) + agency + listing + channel was logged in the last 6 h (Redis). No notification. → 204.                                                                                                                                                                                                                                                                                                                                                                                              |
| `GET /agency/inquiries`              | ACTIVE member of an APPROVED agency | `AgencyInquiryPage`, newest `lastMessageAt` first, excludes deleted. `q` matches customer name / phone / message / listing title.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `GET /agency/inquiries/:id`          | member                              | detail with `messages`; 404 for other agencies' rows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `PATCH /agency/inquiries/:id`        | member                              | status / memo / read; `handledByUserId` = caller when status changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST /agency/inquiries/:id/replies` | member                              | only `canReply` (else 409 `INQUIRY_REPLY_NOT_ALLOWED`); adds AGENCY message (authorName = member display name), NEW → IN_PROGRESS, notifies the customer (`INQUIRY_REPLIED`).                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `POST /agency/inquiries/read`        | member                              | `{all:true}` → `{ updated, unreadCount }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `DELETE /agency/inquiries/:id`       | member                              | soft delete (spam/cleanup) with optional reason → 204                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `GET /me/inquiries`                  | user                                | `Paginated<MyInquiryListItem>` (MESSAGE rows of the caller, incl. deleted-by-agency ones? **no**, excluded).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `GET /me/inquiries/:id`              | owner user                          | `MyInquiryDetail`; sets `customerReadAt`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /me/inquiries/:id/messages`    | owner user                          | follow-up CUSTOMER message; status → NEW, `readAt=null`, notifies members (`INQUIRY_RECEIVED`, `data {agencyId, inquiryId, followUp:true}`).                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Console dashboard (`deal-requests/services/console-dashboard.service.ts`): replace the D5 stub with real
`inquiries { unreadCount, items }` (latest 3 MESSAGE rows) — keep module dependency direction acyclic (a port
implemented by the inquiries module, or a read-only Prisma query — follow the module conventions).

Retention job (daily, own queue, `JOBS_ENABLED` gate): scrub `customerName/customerPhone/message` and message bodies →
`piiScrubbedAt` for inquiries whose `lastMessageAt` is older than 365 days, and immediately for inquiries of withdrawn
(deleted) users. Scrubbed rows stay countable.

Every endpoint: happy path, authz failure, validation failure in e2e (`test/e2e/inquiries/*`, env
`test/env/inquiries.env`: DB `house_test_inquiries`, `REDIS_DB=10`).

---

## 4. Web (`apps/web`)

### 4.1 Office site routing

- Env: `NEXT_PUBLIC_SITE_ROOT_DOMAIN` (optional; default hostname of `NEXT_PUBLIC_SITE_URL`). Add to the deploy build
  env defaults (`deploy/lib/common.sh` build env) only if not derivable — prefer deriving.
- `middleware.ts`: when the request host (`x-forwarded-host` / `host`, validated like `publicRedirect`) is
  `<label>.<root>[:port]` and `label` passes the slug rules (reserved → treat as main site), rewrite:
  - `/` → `/office-site/<slug>`; `/listing/<id>` → `/office-site/<slug>/listing/<id>`;
    `/robots.txt` → `/office-site/<slug>/robots.txt`; `/sitemap.xml` → `/office-site/<slug>/sitemap.xml`.
  - `/_next/*`, `/api/*`, `/media/*`, `/mock-api/*`, favicons/icons/manifest pass through untouched.
  - Any other path → 307 to the same path on the main site (`NEXT_PUBLIC_SITE_URL`).
  - On the main host, `/office-site/*` → 404.
  - Matcher widened accordingly; existing protected-path redirect behaviour unchanged (tests in `middleware.test.ts`).
- Dev: `http://<slug>.localhost:3000` (browsers resolve `*.localhost`).

### 4.2 Office site pages (`app/office-site/[slug]/…`, own shell, no `loading.tsx`)

- Data: `GET /sites/:slug` (revalidate 60, tags `site:<slug>`), listings `GET /listings?primaryAgencyId=<id>&…`.
- `OfficeSiteShell`: header (logo + name → `/`; anchors 매물 · 사무소 소개 · 오시는 길; 전화 (logs CALL event) + 문의하기 (opens
  the inquiry dialog, `source: 'SITE'`)), mobile compact header + sticky bottom bar (전화 / 문의하기), footer with the office
  disclosure (상호 · 대표 · 등록번호 · 주소 · 전화, the 공인중개사법 표시 items) + "이 홈페이지는 순천부동산지도가 제공해요" link to
  the main site + the platform business line. Brand colour = CSS vars from `AGENCY_SITE_COLORS` on the shell root.
- Home: hero (cover or `OfficeCoverArt`, logo, name, tagline, 대표 공인중개사, 등록 확인 badge, 보유 매물 수), 매물 (asset/deal
  chips, sort, grid of listing cards → `/listing/<id>` relative, `?page`), 사무소 소개 (intro, specialties, licensed
  members), 오시는 길 (address, hours, `MapView` — Kakao falls back to the static map automatically when the subdomain is
  not registered in Kakao Developers, 길찾기 link).
- Listing detail: reuse the listing page in an `office` variant — only listings whose `primaryAgency.id` is the site's
  agency (else 404); no 관심/신고 buttons (신고 → link "순천부동산지도에서 신고하기" to the main listing URL), no similar
  listings from other offices, breadcrumbs to the office home, contact = this office only (inquiry dialog with
  `source: 'SITE'`). Canonical → main listing URL (O8).
- Metadata: home title `"<사무소명> | 순천 부동산"`, description from tagline/intro, canonical = site URL, OG image =
  cover/logo/default. `robots.txt` allows all + sitemap; `sitemap.xml` lists the home only. JSON-LD `RealEstateAgent`.
- Unknown / not-live slug → 404 page (office-site variant) with a link to the main site.
- Main site `/agency/[id]`: "홈페이지" button when `agency.site` is set.

### 4.3 Inquiries (customer side)

- `InquiryDialog` (shared component, e.g. `features/w-inquiry/`): name, phone (required for guests, optional for
  members — prefilled from the session profile), message (5–1000, counter), consent checkboxes via
  `useActionTerms('INQUIRY')`, hidden honeypot `website`, submit → success state ("문의를 보냈어요 … MY > 문의 내역에서
  답변을 볼 수 있어요" for members; "중개사무소가 남겨 주신 번호로 연락드릴 거예요" for guests).
- Listing `ContactDialog` → two parts: 바로 연락 (전화/문자/번호 복사 — each also POSTs a contact event) and 문의 남기기 (the
  form). Same for the complex panel `InquiryDialog` and the agency page 문의하기 (replace the `/deal?agencyId` link).
- MY: `/me/inquiries` list + `/me/inquiries/[id]` thread with follow-up box; MY menu entry "문의 내역"; notifications:
  `INQUIRY_REPLIED` → `/me/inquiries/<id>`.
- Login brand panel copy "여러 중개사와 나눈 문의를 한곳에서" is now true — keep.

### 4.4 Broker console

- Restore the inbox from git `2f313a5^` (`features/a-inbox/inquiries/*`, `lib/inquiry.ts`, schemas/queries/params,
  `db8c90b^:apps/web/src/app/agent/inquiries/page.tsx`) adapted to §1.4: thread view with `messages`, reply box only when
  `canReply` (guest → "비회원 문의예요. 남긴 번호로 전화해 주세요" + memo), source badge "홈페이지", delete (스팸 처리).
  Nav item 문의함 + `unreadInquiries` badge, dashboard KPI/widget back, notifications `inquiryId` → `/agent/inquiries?id=`.
  Update tests that asserted D5 (nav.test, lib.test, `e2e/tests/web/broker.spec.ts`).
- New `/agent/site` (nav "내 홈페이지"): owner-only writes, staff read-only. States: none → request form (slug input with
  live availability check + `.suncheonmap.kr` suffix, colour swatches with preview, tagline); REQUESTED → pending card
  (can edit the request); ACTIVE → URL (copy, open), "주소 준비 중 (최대 10분)" while `!httpsReady`, colour/tagline
  editor with live preview, links to 사무소 정보 (logo/cover/intro); REJECTED → reason + re-request; SUSPENDED → notice.
  Subscription line ("현재 무료로 제공 중이에요" when not required).

### 4.5 Mock mode

Every new endpoint gets a mock handler under `app/mock-api/v1/**` (`mockGuard` first) matching §1.4, so mock-mode UI
work keeps working; the subdomain pages work in mock mode with fixture slugs (e.g. `demo`).

---

## 5. Admin (`apps/admin`)

- Agency detail: `AgencySitePanel` (status pill, slug/request, colour swatch, tagline, URL link, approve with editable
  slug, reject/suspend with `ReasonDialog`, resume) and `AgencySubscriptionsPanel` (table, add dialog, end/cancel) in
  new files; mutations invalidate `['admin-agencies']` **and** `['admin-dashboard']`.
- Queue: `/agencies/sites` list (tabs REQUESTED / ACTIVE / SUSPENDED / REJECTED) + dashboard queue panel + nav badge
  `agencySitesPending` + admin notification kind label.
- Settings → 기능 (FEATURES): `siteSubscriptionRequired` "사무소 홈페이지 유료 적용", `platformSubscriptionRequired` "메인
  입점 유료 적용 (준비 중 — 아직 적용되지 않아요)".
- Audit labels for `agency_site.*` / `subscription.*`, resource types `AgencySite`, `AgencySubscription`, field labels.
- Fix (audit): agencies list never sends `sort` (send `OLDEST` for PENDING, `NEWEST` otherwise); decisions must also
  invalidate `['admin-dashboard']`; dashboard panel decisions also invalidate `['admin-agencies']`.
- Mocks + schema fixture tests for everything new.

---

## 6. Deploy (`deploy/`)

- DNS (operator, 가비아): A record `*` → server IP. Docs in DEPLOY.md.
- nginx: port-80 `server_name *.{{DOMAIN}}` (ACME + 301 to https; HTTP template serves the web locations directly);
  `house.conf.template` includes `/etc/nginx/house/sites/*.conf`; split static TLS params into
  `snippets/house-tls-params.conf` used by `house-tls.conf` and the per-slug servers.
- `deploy/sites.sh` (root, flock): read live slugs from PostgreSQL (`pg_run psql`), re-validate each slug with the same
  rules as §1.2 (untrusted input), issue `certbot certonly --webroot … --cert-name house-site-<slug> -d <slug>.DOMAIN`
  when missing, render `/etc/nginx/house/sites/<slug>.conf` (`write_if_changed`, IPv6 rule), `nginx -t` (remove the new
  file on failure) then one reload, `UPDATE agency_sites SET https_ready_at = now() WHERE slug = … AND https_ready_at IS
NULL` for slugs whose server file is live, remove files (keep certs) for slugs no longer live. Pace: at most 10 new
  certs per run. `--staging` honoured. `TLS_ENABLED=false` → no-op.
  **Amended after review (D-B, HTTPS readiness):** the server file and certificate are kept for every slug assigned to a
  site in status ACTIVE or SUSPENDED (agency not deleted), whether or not it is servable or gated right now (the web app
  404s it meanwhile); new certificates are issued only for live slugs; a file is removed only once its slug is no longer
  assigned to such a site, and `https_ready_at` is cleared for an assigned slug without a working server. The API keeps
  `httpsReadyAt` across SUSPEND / RESUME and gate changes and resets it only when the approved slug changes. A
  `nginx -t` failure that restores the previous file keeps that slug served; a busy certbot (certbot.timer renew)
  defers issuance without the failure backoff; a release without `apps/web/src/app/office-site` (forced rollback) gets
  no office server and every `https_ready_at` is cleared.
- `install.sh`: kit files, `house-sites.service` + `house-sites.timer` (every 5 min) or a cron fallback, sites dir.
- Permissions-Policy duplicate: `proxy_hide_header Permissions-Policy;` in `house-proxy.conf`, drop `interest-cohort=()`.
- Tests in `deploy/tests` (pure functions: slug validation, server-file rendering; nginx render test additions) and
  shellcheck-clean scripts.
- Docs: DEPLOY.md (DNS wildcard record, Kakao Developers 사이트 도메인 registration of office hosts, how certs appear),
  OPERATIONS.md (approving sites, checking `house-sites` logs, Let's Encrypt limits 50/week).

---

## 7. Audit UI fixes (same batch)

a) `w-listing/lib/view.ts` buildingUse → `BUILDING_USE_LABEL`; b) `MapSearchPage.tsx` scale bar only when `isStatic`;
c) complex-less listings count at zoom < 16 via `GET /listings?withoutComplex=true&bbox=…` total; d) mobile landing
without `c` uses zoom 12 (or fits markers); e1) `formatFloor` exact when `floor` known (one rule for all cards);
e2) one initials rule for `AgencyLogo`; f) '·' separators never start a line (all four CSS sites + mobile title meta);
g) `/support` shows only configured contact cards; h) Breadcrumb link hit area; i) see §3.3; j) report empty state
gets an h1; plus: ShareDialog "카카오톡으로 보내기" hidden until it works; AboutView "운영자 정보는 준비 중이에요" only when
the settings are really empty.

---

## 8. Local stack (Windows dev PC)

- PostgreSQL 16 + PostGIS 3.7 and Redis 8 run from `C:\dev\house-stack` (outside the repo): `localhost:5432`
  (user `house` / password `house`, superuser) and `localhost:6379`. Do not stop or restart them.
- `psql`: `C:\dev\house-stack\pgsql\bin\psql.exe` (set `PGPASSWORD=house`).
- API unit tests: `pnpm --filter @house/api test -- <path>`; e2e: `pnpm --filter @house/api test:e2e <module>` (works on
  Windows). Shared must be rebuilt after edits: `pnpm --filter @house/shared build`.
- Web/admin: `pnpm --filter @house/web test|typecheck|lint`, same for `@house/admin`.
- Never commit or push; never touch production.
