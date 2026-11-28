# Office sites, subscriptions and inquiries — contract (as built)

The exact names other work must use. SPEC.md is the binding behaviour; this file records what the
foundation actually exports. Everything below is exported from the `@house/shared` barrel (run
`pnpm --filter @house/shared build` after any shared edit; consumers read `dist`).

## Enums (`packages/shared/src/enums/*`, Prisma twins, enum-parity spec passes)

| Shared const / type (+ label)                               | Values                                                                                | Prisma enum (DB type)                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `AgencySiteStatus` + `AGENCY_SITE_STATUS_LABEL` (agency.ts) | REQUESTED, ACTIVE, REJECTED, SUSPENDED                                                | `AgencySiteStatus` (`agency_site_status`)      |
| `SubscriptionProduct` + `SUBSCRIPTION_PRODUCT_LABEL`        | SITE, PLATFORM                                                                        | `SubscriptionProduct` (`subscription_product`) |
| `InquiryChannel` + `INQUIRY_CHANNEL_LABEL` (inquiry.ts)     | MESSAGE, CALL, SMS, COPY                                                              | `InquiryChannel` (`inquiry_channel`)           |
| `INQUIRY_CONTACT_CHANNELS` / type `InquiryContactChannel`   | CALL, SMS, COPY                                                                       | —                                              |
| `InquiryStatus` + `INQUIRY_STATUS_LABEL`                    | NEW, IN_PROGRESS, DONE                                                                | `InquiryStatus` (`inquiry_status`)             |
| `InquirySource` + `INQUIRY_SOURCE_LABEL`                    | MAIN, SITE                                                                            | `InquirySource` (`inquiry_source`)             |
| `InquiryAuthor` + `INQUIRY_AUTHOR_LABEL`                    | CUSTOMER, AGENCY                                                                      | `InquiryAuthor` (`inquiry_author`)             |
| `TermsType` (+1, user.ts)                                   | `INQUIRY_PRIVACY`; `ACTION_CONSENT_TERMS.INQUIRY = ['INQUIRY_PRIVACY']`               | `TermsType`                                    |
| `NotificationType` (+4, user.ts)                            | `INQUIRY_RECEIVED`, `INQUIRY_REPLIED`, `AGENCY_SITE_APPROVED`, `AGENCY_SITE_REJECTED` | `NotificationType`                             |

New: `NOTIFICATION_TYPE_LABEL: Record<NotificationType, string>` (shared fallback captions).
Not done here (owned elsewhere): `AGENCY_ONLY_NOTIFICATION_TYPES` (api `notification-scope.ts`)
and web `AGENCY_ONLY_TYPES` must gain `INQUIRY_RECEIVED`, `AGENCY_SITE_APPROVED`,
`AGENCY_SITE_REJECTED`. `INQUIRY_REPLIED` data is `{ inquiryId, agencyName }` (no `agencyId`).

## Office site rules (`agencies/site.ts`)

- `SITE_SLUG_MIN_LENGTH` 3, `SITE_SLUG_MAX_LENGTH` 30, `SITE_SLUG_PATTERN`, `RESERVED_SITE_SLUGS: ReadonlySet<string>`.
- `normalizeSiteSlug(s)`, `siteSlugProblem(s): null | 'INVALID' | 'RESERVED'` (type `SiteSlugProblem`),
  `isValidSiteSlug(s)`, `siteSlugMessage(s): string | null` (Korean form hint), `siteSlugSchema` (zod).
- `siteUrl(slug, rootDomain, protocol = 'https:', port?)` — default ports are dropped.
- `siteSlugFromHost(host, rootDomain): string | null` — one label under the root that passes the
  slug rules (reserved → null). Intended for the web middleware and the API origin policy.
- Colours: `AgencySiteColor` (BLUE default, NAVY, GREEN, TEAL, RED, ORANGE, PURPLE, BROWN, BLACK),
  `DEFAULT_AGENCY_SITE_COLOR`, `AGENCY_SITE_COLORS: Record<AgencySiteColor, AgencySitePalette>`
  (`{ label, brand, hover, press, soft, soft2, line, contrast }`), `AGENCY_SITE_COLOR_LABEL`,
  `agencySiteColorSchema`, `agencySitePalette(color)` (unknown → BLUE),
  `agencySiteCssVars(color)` → `{ '--brand', '--brand-hover', '--brand-press', '--brand-soft',
'--brand-soft-2', '--brand-line', '--brand-contrast', '--focus' }`. Every `brand` (and hover /
  press) is ≥ 4.5:1 against white and `brand` ≥ 4.5:1 on `soft` (unit-tested).
- `AGENCY_SITE_TAGLINE_MAX` 60. WCAG helpers in utils: `hexToRgb`, `relativeLuminance`, `contrastRatio`.

## Subscriptions (`agencies/subscriptions.ts`)

- `SUBSCRIPTION_REQUIRED_FEATURE = { SITE: 'siteSubscriptionRequired', PLATFORM: 'platformSubscriptionRequired' }`
  (FEATURES keys; the base seed writes both `false`; missing key = false).
- `AgencySubscriptionState` (SCHEDULED, ACTIVE, ENDED, CANCELED) + `AGENCY_SUBSCRIPTION_STATE_LABEL`.
- `subscriptionState({ startsOn, endsOn, canceledAt }, today = kstDate())` — inclusive KST days.

## Request schemas (§1.3)

`agencies/site-schemas.ts`: `agencySiteRequestSchema`, `agencySiteUpdateSchema`,
`agencySiteAvailabilityQuerySchema` (raw slug, trimmed), `adminAgencySiteDecisionSchema`
(`action` from `AgencySiteDecisionAction` APPROVE/REJECT/SUSPEND/RESUME +
`AGENCY_SITE_DECISION_ACTION_LABEL`; blank reason → undefined), `adminAgencySiteListQuerySchema`,
`adminSubscriptionCreateSchema` (`amountWon` in 원, ≤ `AGENCY_SUBSCRIPTION_AMOUNT_MAX`),
`adminSubscriptionUpdateSchema`. Input types: `AgencySiteRequestInput`, `AgencySiteUpdateInput`,
`AgencySiteAvailabilityQuery`, `AdminAgencySiteDecisionInput`, `AdminAgencySiteListQuery`,
`AdminSubscriptionCreateInput`, `AdminSubscriptionUpdateInput`. Tagline / memo `''` → `null`.

`inquiries/schemas.ts`: `inquiryCreateSchema` (phone = `contactPhoneSchema`, any Korean number;
`website` honeypot is accepted by the schema — the API answers `INQUIRY_REJECTED`),
`inquiryContactEventSchema`, `agencyInquiryListQuerySchema` (pageSize default 12, max 50),
`agencyInquiryUpdateSchema` (memo `''` → null), `inquiryReplySchema`, `agencyInquiryReadAllSchema`,
`agencyInquiryDeleteSchema` (body may be absent). Types `InquiryCreateInput`,
`InquiryContactEventInput`, `AgencyInquiryListQuery`, `AgencyInquiryUpdateInput`,
`InquiryReplyInput`, `AgencyInquiryReadAllInput`, `AgencyInquiryDeleteInput`.
`INQUIRY_LIMITS` (`inquiries/constants.ts`): NAME_MAX 30, MESSAGE_MIN 5, MESSAGE_MAX 1000,
REPLY_MAX 1000, MEMO_MAX 1000, SEARCH_MAX 50, DELETE_REASON_MAX 200, PAGE_SIZE_DEFAULT 12,
PAGE_SIZE_MAX 50, DAILY_CAP 10, CONTACT_EVENT_DEDUPE_HOURS 6, RETENTION_DAYS 365.

`listingFilterSchema` (so `listingListQuerySchema`, `mapSearchQuerySchema`) gained
`primaryAgencyId?: uuid` and `withoutComplex?: boolean` (`queryBoolean`).

## Response types (§1.4)

`agencies/site-types.ts`: `AgencySiteView`, `AgencySiteSubscriptionStatus`, `MyAgencySiteResponse`,
`SiteSlugAvailability`, `PublicAgencySite`, `AdminAgencySiteListItem`, `AdminAgencySiteResponse`
(`{ site }`), `AgencySubscriptionView`, `AgencySubscriptionsResponse`.
`inquiries/types.ts`: `InquiryListingRef`, `InquiryMessageView`, `AgencyInquiryView`,
`AgencyInquiryPage`, `AgencyInquiryReadAllResult`, `MyInquiryListItem`, `MyInquiryDetail`,
`InquiryCreated`. `AgencyProfile.site: { url: string } | null` is required: the API
(`agency-public.service.ts`) and the web mock (`toAgencyProfileWire`) return `site: null` for now,
marked `TODO(agency-sites …)`.

## Error codes (§1.5)

`AgenciesErrorCode`: `AGENCY_SITE_NOT_FOUND`, `AGENCY_SITE_SLUG_INVALID`, `AGENCY_SITE_SLUG_RESERVED`,
`AGENCY_SITE_SLUG_DUPLICATE`, `AGENCY_SITE_ALREADY_ACTIVE`, `AGENCY_SITE_INVALID_TRANSITION`,
`AGENCY_SUBSCRIPTION_NOT_FOUND`, `AGENCY_SUBSCRIPTION_INVALID_PERIOD`.
New `InquiriesErrorCode` / `INQUIRIES_ERROR_MESSAGES` (`errors/inquiries.ts`, registered):
`INQUIRY_NOT_FOUND`, `INQUIRY_AGENCY_NOT_FOUND`, `INQUIRY_LISTING_NOT_FOUND`,
`INQUIRY_PHONE_REQUIRED`, `INQUIRY_REPLY_NOT_ALLOWED`, `INQUIRY_REJECTED`, `INQUIRY_DAILY_LIMIT`.
`defaultStatusFor` gives 404 to `*_NOT_FOUND`, 409 to `*_DUPLICATE`, 400 to the rest, so throw
`AGENCY_SITE_ALREADY_ACTIVE`, `AGENCY_SITE_INVALID_TRANSITION`, `INQUIRY_REPLY_NOT_ALLOWED` with
`AppException.conflict(...)` and `INQUIRY_DAILY_LIMIT` with `status: HttpStatus.TOO_MANY_REQUESTS`.

## Database (Prisma models → tables)

- `AgencySite` → `agency_sites` (agencies.prisma): `id, agencyId (unique), status, slug, requestedSlug,
color (VarChar 20, default "BLUE"), tagline, requestedAt, decidedAt, decidedByAdminId, decisionReason,
httpsReadyAt (https_ready_at), createdAt, updatedAt`. Relations: `agency` (Cascade),
  `decidedBy AdminUser?` ("AgencySiteDecidedBy", SetNull). Back-relation `Agency.site`.
  SQL-only: unique `agency_sites_slug_key (slug) WHERE slug IS NOT NULL`; unique
  `agency_sites_requested_slug_open_key (requested_slug) WHERE status = 'REQUESTED'` (a race →
  Prisma P2002 → map to `AGENCY_SITE_SLUG_DUPLICATE`); CHECKs `agency_sites_slug_format`,
  `agency_sites_requested_slug_format` (format only, not reserved words).
- `AgencySubscription` → `agency_subscriptions`: `id, agencyId, product, startsOn (date), endsOn (date?),
amountWon, memo, canceledAt, createdByAdminId, createdAt, updatedAt`; `agency` (Cascade),
  `createdBy AdminUser?` ("AgencySubscriptionCreatedBy", SetNull); back-relation `Agency.subscriptions`.
  CHECKs `agency_subscriptions_period_check` (ends_on ≥ starts_on), `agency_subscriptions_amount_check`.
- `Inquiry` → `inquiries` (new inquiries.prisma): fields as SPEC §2 (`consentTermsDocumentIds uuid[]`,
  `visitorHash`, `piiScrubbedAt`, `deletedAt`, `deleteReason`, …). Relations `agency` (Cascade),
  `listing` (SetNull), `user` ("InquiryCustomer", SetNull), `handledBy` ("InquiryHandledBy",
  SetNull), `messages`. Indexes `[agencyId, deletedAt, lastMessageAt desc]`, `[agencyId, readAt]`,
  `[userId, createdAt desc]`, `[lastMessageAt]` (retention), `[listingId]`, `[handledByUserId]`.
- `InquiryMessage` → `inquiry_messages`: `id, inquiryId, author, body, authorUserId, authorName, createdAt`;
  `inquiry` (Cascade), `authorUser` ("InquiryMessageAuthor", SetNull); index `[inquiryId, createdAt]`.
- Back-relations: `Agency.inquiries`, `Listing.inquiries`, `User.inquiries` / `handledInquiries` /
  `inquiryMessages`, `AdminUser.agencySiteDecisions` / `agencySubscriptions`.

Migrations (apply in this order; `db:drift` passes):

1. `20261128082304_auth_inquiry_privacy_terms`
2. `20261128082328_core_notification_types_inquiries_sites`
3. `20261128082428_agencies_sites_subscriptions`
4. `20261128082526_inquiries_init`

Seed (`prisma/seed/base.ts`): `INQUIRY_PRIVACY` v1.0 sample terms (`INQUIRY_PRIVACY_BODY`, `> 견본`
marker); FEATURES default gains `siteSubscriptionRequired: false`, `platformSubscriptionRequired: false`
(existing databases keep their stored FEATURES value — the seed never overwrites settings).
