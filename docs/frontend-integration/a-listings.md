# Frontend integration notes — a-listings (broker console: listing management + wizard + co-brokerage)

Scope: `apps/web/src/app/agent/listings/**`, `apps/web/src/features/a-listings/**` and the mock
resources listed below. The console chrome (`app/agent/layout.tsx`, `AgentShell`, `ConsolePage`,
`AGENT_ROUTES`) belongs to a-agency. See `docs/FRONTEND.md` for conventions.

The listings / complexes / media controllers do not exist yet (module READMEs + Prisma schema +
`packages/shared` only), so every **response shape** below is an assumption derived from
`apps/api/src/modules/listings/README.md`, `apps/api/prisma/schema/listings.prisma` and
`packages/shared/src/{schemas,enums,errors}/listings.ts`. Request bodies use the shared schemas
(`listingDraftSchema`, `listingStatusChangeSchema`, `listingVerificationSchema`) unchanged. Each
response is parsed by exactly one zod schema in `apps/web/src/features/a-listings/api/schemas.ts` —
reconcile the schema and the mock fixture together.

## Routes

| Route                       | Who                  | What                                                                                                                              |
| --------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/agent/listings`           | AGENT · AGENCY_OWNER | Table (cards on mobile): status tabs, search, filters, sort, 실매물 확인 due, bulk status / verify / delete, row menu, pagination |
| `/agent/listings/new`       | AGENT · AGENCY_OWNER | 7-step wizard; the draft is created on the first step change, then the URL becomes `/agent/listings/:id/edit?step=…`              |
| `/agent/listings/[id]/edit` | AGENT · AGENCY_OWNER | Same wizard on an existing listing (`?step=property·deal·detail·photos·description·verify·preview`)                               |
| `/agent/listings/[id]`      | —                    | Redirects to `…/edit` (the editor is the detail view)                                                                             |
| `/agent/listings/co-broker` | AGENT (read) · OWNER | Pick a complex (+ 동) → other offices' public listings → join as co-broker (`?complexId=&dong=&page=`)                            |

All routes are `noindex` (console layout) and server-guarded with `requireAgent()`. URL state:
`/agent/listings?status=&q=&deal=&asset=&due=1&co=1&sort=&page=` (defaults omitted,
`features/a-listings/lib/list-params.ts`).

Wizard steps: ① 종류·소재지 (asset type → complex search + 동/호/층, or address search + map pin)
② 거래·가격 (매매/전세/월세/분양권 + 프리미엄, 관리비 + 포함 항목, 입주가능일) ③ 면적·상세 (전용/공급 ㎡ ↔ 평,
방/욕실, 방향 + 기준, 사용승인일, 주차) ④ 사진 (multi upload, drag / button reorder, cover, captions)
⑤ 설명·옵션 ⑥ 실매물 확인 (method / date / memo + history) ⑦ 미리보기·게시 (public page components fed with
a `GET /listings/:id`-shaped payload, office disclosure, publish). The right-hand checklist tracks the
표시·광고 명시사항 live (`lib/requirements.ts`) and every row jumps to its field.

## Endpoints used

| Method | Path                                                     | Used by                                                   | Backend status                                          |
| ------ | -------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| POST   | `/api/v1/agency/listings`                                | wizard: first save (creates a DRAFT)                      | README — body `listingDraftSchema`, see assumption 3    |
| PATCH  | `/api/v1/agency/listings/:id`                            | wizard: every later save                                  | README — full-replace semantics, see assumption 3       |
| DELETE | `/api/v1/agency/listings/:id`                            | list: delete (single / bulk)                              | README                                                  |
| POST   | `/api/v1/agency/listings/:id/publish`                    | wizard: 광고 게시하기                                     | README — error contract see assumption 4                |
| POST   | `/api/v1/agency/listings/:id/status`                     | list: 계약중 / 거래완료 / 숨김 / 광고중 (single, bulk)    | README — body `listingStatusChangeSchema`, assumption 5 |
| POST   | `/api/v1/agency/listings/:id/verifications`              | wizard step ⑥, list dialog (single / bulk)                | README — body `listingVerificationSchema`, assumption 6 |
| PUT    | `/api/v1/agency/listings/:id/photos`                     | wizard step ④ (order / cover / captions)                  | README — body see assumption 7                          |
| POST   | `/api/v1/agency/listings/:id/co-brokers`                 | co-broker page: join                                      | README (AGENCY_OWNER) — body see assumption 8           |
| DELETE | `/api/v1/agency/listings/:id/co-brokers`                 | list row menu: 공동중개 나가기                            | README (AGENCY_OWNER)                                   |
| GET    | `/api/v1/complexes?q=&pageSize=`                         | complex picker (wizard, co-broker page)                   | README (complexes) — row shape see assumption 9         |
| GET    | `/api/v1/complexes/:id`                                  | pre-fill (층수 · 사용승인일 · 주차 · 평형), preview       | README (complexes), shape shared with w-complex         |
| POST   | `/api/v1/media?purpose=LISTING_PHOTO` (multipart `file`) | photo upload → `MediaDto`                                 | README (media)                                          |
| GET    | `/api/v1/media/:id`                                      | photo upload: poll until the variants exist (≤ 6 × 1.5 s) | README (media)                                          |
| GET    | `/api/v1/agencies/mine`                                  | preview: office disclosure of an unsaved draft            | README (agencies), schema owned by a-agency             |

## Assumed endpoints (not in any backend README — please confirm or rename)

| Method | Path                                                               | Purpose                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/agency/listings`                                          | The README only lists `POST/PATCH/DELETE /agency/listings[/:id]`. Listings of the caller's agency (own **and** co-brokered). Query: `status` (csv of `ListingStatus`), `q`, `dealTypes` (csv), `assetTypes` (csv), `verificationDue=true`, `coBrokered=true`, `sort`, `page`, `pageSize` → pagination envelope of rows (assumption 1). |
| GET    | `/api/v1/agency/listings/summary`                                  | Counters for the status tabs and reminder chips: `{ total, byStatus: { DRAFT, ACTIVE, RESERVED, CLOSED, HIDDEN }, verificationDue, expiringSoon, coBrokered }`. Could be folded into the list response (`meta`) — only `fetchSummary()` would change.                                                                                  |
| GET    | `/api/v1/agency/listings/:id`                                      | Full editable listing **including the private `ho`** for members of a co-brokering office (assumption 2). `404 LISTING_NOT_FOUND` for everyone else (no IDOR).                                                                                                                                                                         |
| GET    | `/api/v1/agency/listings/co-broker-candidates?complexId=&dong=&q=` | ACTIVE / RESERVED listings of **other** offices in a complex that the caller may join, with `joined` (already co-brokering). Pagination envelope of candidate rows (assumption 8). Never returns `ho`. If the backend prefers, `GET /listings?complexId=&agencyId!=` + a `joined` flag would do.                                       |
| GET    | `/api/v1/geo/geocode?query=`                                       | Address search with coordinates for non-complex listings (owned / documented by a-agency). `{ items: [{ roadAddress, jibunAddress?, zipCode?, buildingName?, lat, lng }] }`.                                                                                                                                                           |

`sort` values of `GET /agency/listings` (broker-side, not `ListingSort`): `UPDATED` (default) ·
`LATEST` (createdAt) · `VERIFY_DUE` (earliest due first, unverified last) · `PRICE_DESC` · `PRICE_ASC`
· `VIEWS`.

## Assumed payload shapes

1. **List row** (`agencyListingItemSchema`):
   `{ id, listingNo?, status, dealType, assetType, name, dong?, ho?, title?, salePrice?, deposit?,
monthlyRent?, presalePrice?, premium?, exclusiveArea?, supplyArea?, landArea?, floor?, totalFloors?,
floorClass?, direction?, coverPhotoUrl?, photoCount, verifiedAt?, verificationDueAt?, publishedAt?,
expiresAt?, updatedAt?, hiddenReason?, viewCount, favoriteCount, inquiryCount, agencyCount,
isPrimary, primaryAgencyName?, missingCount? }`.
   `name` = complex name → building name → address. `ho` is included because the caller is a member.
   `isPrimary` = the caller's agency is the primary (최초 등록) office; `primaryAgencyName` is set when
   it is not. `agencyCount` = ACTIVE `ListingAgency` rows. `missingCount` (DRAFT only) = number of
   명시사항 the publish validator would reject — optional, the UI hides the tag without it.
   `inquiryCount` is not a Prisma column yet (count of inquiries on the listing).
2. **Editor payload** (`agencyListingSchema`) — response of `GET /agency/listings/:id` **and of every
   mutation** (`POST`, `PATCH`, `publish`, `status`, `verifications`, `photos`):
   the `Listing` columns (`id, status, dealType, title?, description?, salePrice?, deposit?,
monthlyRent?, presalePrice?, premium?, maintenanceFeeWon?, maintenanceFeeItems[], moveInType?,
moveInDate?, floorDisplay, options[], publishedAt?, expiresAt?, closedAt?, hiddenReason?, verifiedAt?,
viewCount, favoriteCount, createdAt, updatedAt`) plus `listingNo?`, `verificationDueAt?`,
   `inquiryCount`, `isPrimary`, and
   - `property`: every `propertyInputSchema` field (incl. `ho`) + `emdCode?`, `emdName?`;
     Decimal columns may arrive as strings (the schema coerces);
   - `complex?: { id, name, emdName? }`;
   - `photos: [{ id?, mediaId, url, thumbUrl?, caption?, isCover }]` ordered by `sortOrder`
     (`url` = display-size media URL, as in the public listing payload);
   - `verifications: [{ id, method, verifiedAt, note?, verifiedByName? }]` newest first;
   - `agencies: [{ agencyId, isPrimary, name, representativeName, registrationNumber, phone,
roadAddress, addressDetail?, logoUrl?, contactName?, contactPhone?, joinedAt? }]` — ACTIVE
     co-brokering offices with their 명시사항 (the preview's disclosure block reads these).
     **Not in Prisma yet:** `listingNo` (human-friendly number such as `26-0412`, shown in the list,
     wizard header and co-broker search; the UI copes with `null`) and `verificationDueAt` (see 6).
3. **`POST` / `PATCH /agency/listings[/:id]`** — the wizard always sends the **whole**
   `listingDraftSchema` object and omits what is empty or does not apply (e.g. no `salePrice` for a
   전세, no floors for land). PATCH is therefore expected to **replace** the draft (omitted optional
   field → cleared), not merge. A draft is first stored as soon as `property.assetType`,
   `roadAddress`, `lat`, `lng` exist (the fields `propertyInputSchema` requires). 동/호 are sent with
   their unit (`"103동"`, `"1502호"`), 관리비 in 원, money in 만원, `premium` signed.
   For ACTIVE / RESERVED listings the mock re-runs the publish validator on PATCH and answers
   `422 LISTING_PUBLISH_REQUIREMENTS` (nothing saved) when an edit would remove a 명시사항.
   Only the primary office edits (`403 LISTING_NOT_AGENCY_MEMBER` for a co-broker); CLOSED listings
   are read-only (`409 LISTING_INVALID_STATUS_TRANSITION` in the mock). Validation errors:
   `400 VALIDATION_FAILED` with `details[].path` = dotted draft paths (`property.totalFloors`) — the
   wizard maps them to fields (`formFieldOf`).
4. **Publish** — `POST …/publish` on a DRAFT → ACTIVE, sets `publishedAt`, `expiresAt`
   (mock: +60 days) and `listingNo`. Failure: `422 LISTING_PUBLISH_REQUIREMENTS` with
   `details: [{ field, label }]` where `field` is a **dotted draft path**. The wizard marks each
   field, jumps to the first one and lists the labels. Paths it understands (anything else is shown
   as text from `label`): `property.assetType`, `property.roadAddress` (also `property.lat|lng`,
   `location`), `property.floor`, `property.totalFloors`, `dealType`, `salePrice` (also `price`),
   `deposit`, `monthlyRent`, `presalePrice`, `premium`, `maintenanceFeeWon`, `moveInType`,
   `moveInDate`, `property.exclusiveArea`, `property.supplyArea`, `property.landArea`,
   `property.rooms`, `property.baths`, `property.direction`, `property.directionBasis`,
   `property.approvalDate`, `property.parkingSpaces`, `title`, `description`. Office-side items
   (명칭 · 소재지 · 연락처 · 등록번호 · 대표 성명) have no wizard field — send a `label` and the
   alert shows it (the preview also warns and links to `/agent/profile`).
   The client-side mirror of the validator (`lib/requirements.ts`, used for the checklist, the inline
   step validation and the mock) applies these **per-type rules — please confirm**: land needs only
   종류 · 소재지 · 거래 · 가격 · 대지면적; 단독주택 does not need 해당 층; 방·욕실 수 only for 주거용
   (APT · OFFICETEL · ONEROOM · HOUSE); 분양권 (미준공) does not need 사용승인일; 월세 보증금 `0`,
   프리미엄 `0`, 관리비 `0` and 주차 `0` are valid answers; `moveInType=DATE` needs `moveInDate`;
   **관리비 포함 항목** (`maintenanceFeeItems`, at least one) is required when a 원룸·투룸 / 오피스텔 /
   주택 listing has `maintenanceFeeWon ≥ 100,000` (정액 관리비 월 10만원 이상 → 부과 항목 표시,
   2024 세부기준 개정; `needsFeeItems()`) — the publish validator should report it as
   `{ field: 'maintenanceFeeItems', label: '관리비 포함 항목' }`. 해당 층 defaults to the exact floor;
   `floorDisplay = CLASS` (저·중·고) is the broker's explicit choice when the client asks for it.
   The backend validator stays authoritative — a stricter backend only produces more field errors.
5. **Status** — transitions the UI offers (`lib/status.ts`): ACTIVE → RESERVED · CLOSED · HIDDEN;
   RESERVED → ACTIVE · CLOSED; HIDDEN → ACTIVE **only when `hiddenReason` is empty** (a listing
   hidden by the operator shows "운영팀 확인 중" and cannot be re-opened); DRAFT → ACTIVE through
   publish only; CLOSED is final. Only the primary office changes the status. Labels come from
   `LISTING_STATUS_LABEL` (광고중 · 계약중 · 거래완료 · 숨김 · 작성중). Bulk actions send one request
   per listing (`Promise.allSettled`) and report partial failures.
6. **실매물 확인** — `POST …/verifications` (`{ method, verifiedAt: YYYY-MM-DD, note? }`), allowed
   for any member of a co-brokering office; a future `verifiedAt` → `400`. Response = editor payload
   with the new record first and `verifiedAt` updated. **Validity window:** the UI reminds when the
   latest verification is older than **30 days** ("D-n", "n일 지남", list filter / banner / dashboard
   badge). It prefers `verificationDueAt` from the API and falls back to `verifiedAt + 30d`
   (`VERIFICATION_VALID_DAYS`, `VERIFICATION_SOON_DAYS = 7` in `lib/status.ts`). Please confirm the
   policy or send `verificationDueAt`. `verifiedByName` = display name of the recording member.
   **`note` is office-internal** (the wizard labels it "사무소 내부용"; brokers write things like
   "임대인 12월 말 퇴거 예정"): the public `GET /listings/:id` must send `note: null` (or omit it) —
   the preview already does.
7. **Photos** — `PUT …/photos` body `{ photos: [{ mediaId, caption?, isCover }] }`: the complete
   ordered list (array order = `sortOrder`, exactly one cover; the wizard keeps the cover first).
   Photos missing from the array are detached. `422 LISTING_PHOTO_LIMIT` above
   `MAX_LISTING_PHOTOS` (30). Files are uploaded one by one to
   `POST /media?purpose=LISTING_PHOTO` as soon as they are picked (client pre-check: JPG / PNG / WEBP
   / HEIC, ≤ 10 MB; HEIC files with an empty browser MIME type get it from the extension) and
   attached on the next save. Response = editor payload. Because variants are built by the
   `media-processing` queue, an upload response without variants is fine: the wizard polls
   `GET /media/:id` and, if the variants are still missing, shows the local file until the next load.
   `PUT …/photos` with a still-PENDING media should answer a clear error (the wizard shows it).
8. **Co-brokerage** — candidate row (`coBrokerCandidateSchema`): the public summary fields of a
   listing + `agencyCount`, `primaryAgencyName`, `joined`. `POST …/co-brokers` body
   `{ contactName?, contactPhone? }` (→ `ListingAgency.contactName/contactPhone`, phone validated
   with `contactPhoneSchema`; empty = office defaults), AGENCY_OWNER only, listing must be ACTIVE /
   RESERVED; `409 LISTING_ALREADY_CO_BROKER` when already joined. `DELETE …/co-brokers` withdraws
   the caller's agency (204); the primary office cannot (`409 LISTING_PRIMARY_CANNOT_WITHDRAW`).
   Both error codes are **not in `ListingsErrorCode` yet**. Staff (AGENT) see the page read-only.
   The wizard also calls the candidates endpoint while a new listing's 단지 + 동 are typed and
   suggests joining instead of creating a duplicate. Candidate rows are seen by **other** offices:
   besides never containing `ho`, they must drop the exact `floor` when the listing uses
   `floorDisplay = CLASS` (keep `floorClass`), as the mock does. The page paginates (`page`).
9. **Complex search row** (`complexSearchItemSchema`): only `{ id, name, roadAddress?, emdName?,
households?, builtYear? }` are read. Complex detail (`complexForListingSchema`): `{ id, name,
roadAddress?, jibunAddress?, emdName?, lat, lng, households?, floorsMax?, approvalDate?, builtYear?,
parkingTotal?, parkingPerHousehold?, heatingType?, avgPricePerPyeong?, areaTypes: [{ id,
exclusiveArea, supplyArea?, typeName?, pyeongLabel?, rooms?, baths? }] }` — `areaTypes[].rooms|baths`
   pre-fill the 방/욕실 수 when present.
10. **Preview** — step ⑦ builds a `ListingDetail` (w-listing's schema for `GET /listings/:id`) from
    the form (`lib/preview.ts`) and renders w-listing's own components, so the preview follows the
    public page automatically. `ho` and the 실매물 확인 `note` are never part of it and the exact
    floor is dropped when `floorDisplay = CLASS`, mirroring what the public API must do. The
    preview is inert where it matters: links that would leave the wizard and live actions (관심,
    문의하기, 신고, 공유) are swallowed with a toast (`lib/preview-guard.ts`); gallery / lightbox,
    ㎡ ↔ 평 and map zoom keep working.

## Mock resources (apps/web/src/app/mock-api/v1)

Owned by this group:

- `agency/listings/route.ts` (GET list, POST create), `summary/`, `co-broker-candidates/`,
  `[id]/route.ts` (GET, PATCH, DELETE), `[id]/publish/`, `[id]/status/`, `[id]/verifications/`,
  `[id]/photos/`, `[id]/co-brokers/`, `_store.ts` (in-memory state on `globalThis`, reset on server
  restart), `_fixtures.ts`.
- `complexes/route.ts` — `GET /complexes?q=` search, **added** to w-complex's resource folder (their
  fixtures, no other file touched).

Reused from other groups (read-only): `agencies/mine` + `geo/geocode` (a-agency), `complexes/[id]`
(w-complex), `media` upload (`media/route.ts`, `_store.ts`), `listings/mock-photo/[name]` (w-listing
illustrations used as seed photos).

Fixtures (mockdata.md §4, office B01 신대중앙 공인중개사사무소): 15 listings of the office in every
status and deal type (`L01` 신대 레이크파크 1단지 103동 매매 4억 4,500 … ), one co-brokered listing
(`L02` 선월 하이츠 2차 분양권, primary office B05), drafts with holes (`D01` 아파트: price / 입주가능일 /
관리비 missing, `D02` 원룸·투룸 월세), land (`T01`), an operator-hidden listing (`L19`), plus `X01…X08`
listings of other offices (B02 · B03 · B05) in four complexes that can be joined. Fixture codes work as id aliases (`/agent/listings/L01/edit`); `Lnn`
ids equal the public listing mock ids, so "공개 페이지 보기" opens the matching public page.
`GET /agency/listings?_fail=1` forces a 500 (error state).

Mock sessions: `AGENCY_OWNER` (김서진, may join / leave co-brokerage) and `AGENT` (오세린, read-only
co-broker page); `USER` gets `403` and the console shell's "not an agent" gate.

## Notes for the integrator

- **Save model** — the wizard saves on every step change (and on 임시저장): create once, then PATCH
  only when the payload signature changed, then `PUT photos` only when the photo list changed.
  Navigation and publish wait for uploads / saves in flight; leaving with unsaved edits triggers
  `beforeunload`.
- **Forms** — react-hook-form holds strings (`ListingFormValues`); `toDraftPayload()` converts and
  reports format issues, `schemaIssues()` range-checks the result with the shared
  `listingDraftSchema`, `publishRequirements()` adds the per-step 명시사항 checks. A zod resolver is
  not used for the wizard because the draft is intentionally permissive and validation is per step;
  the co-broker join dialog uses `zodResolver`.
- **Private data** — 호수 is shown only inside the console (list row with a lock icon, wizard
  input); the preview payload and the co-broker candidate rows never contain it, nor the 실매물
  확인 메모.
- **Unsaved edits** — the wizard saves on step changes, so in-app links (sidebar, 매물 목록, 취소)
  are intercepted while the current step has unsaved edits: a dialog offers 저장하고 나가기 /
  저장하지 않고 나가기 / 계속 작성 (`lib/leave.ts`); reloads and tab closes use `beforeunload`.
- **Published listings** keep their asset type (tiles locked) and stay ACTIVE while edited; every
  step change PATCHes the live listing (the page says so), and the last step's button becomes
  "변경 내용 저장". If edits to a live listing should go back to review or
  re-verification, the status in the PATCH response already drives the UI.
- **Dashboard coupling** — after any mutation the group invalidates `['agency-listings']` and
  a-agency's `['agencies', 'mine-dashboard']` (sidebar badge "실매물 확인 필요").
- **Generic pieces built here that could move to `@house/ui`**: `PickChip` (pill radio / checkbox
  with hint), `FormGroup` / `FormRow` (lettered fieldset + label column, same anatomy as the
  DealRequest form), `LegalHint`, the photo grid with reorder (`StepPhotos`), `PinPicker`
  ("move the map under the pin" on top of `MapView`), the row "⋯" menu (`RowMenu`).
- **Naver map** — `PinPicker` uses `MapView`, so it switches to Naver Maps automatically when
  `NEXT_PUBLIC_NAVER_MAP_KEY_ID` is set; it was only exercised with `StaticMapView`.
- **Responsive** — the layouts follow the width of their own box (container queries), not only the
  viewport: the table becomes cards when its panel is narrower than 760px (phones, and tablets where
  the console sidebar takes the room; bulk selection is table-only, cards keep the per-row actions
  and the "⋯" menu), and the wizard switches to its compact form (numbered stepper, stacked label /
  control, paired inputs) when the form is narrower than 700px. A wider panel that still cannot fit
  all six columns scrolls sideways with the action column pinned. On phones (≤ 720px) the
  checklist collapses above the form and the wizard footer sticks above the console tab bar.
- **Known shell quirk (not this group)** — the console sidebar links to `ROUTES.support`
  (`/support`), which has no page yet: the production build's link prefetch gets a 404 and
  Playwright's `networkidle` never settles on desktop widths. Use `waitUntil: 'load'` in scripts.
