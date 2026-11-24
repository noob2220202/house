# Frontend integration notes — w-deal (내놓기 · 구하기)

Scope: `/deal`, `/deal/sell`, `/deal/find`, `/deal/{sell|find}/complete`, `/me/requests`,
`/me/requests/[id]` in `apps/web`. Code: `apps/web/src/features/w-deal/**`, routes under
`src/app/(site)/deal/**` and `src/app/(me)/me/requests/**` (inside w-me's `MeShell`), mocks under
`src/app/mock-api/v1/{deal-requests,me/deal-requests,me/proposals,media}/**`.

The deal-requests, media and agencies modules only have a README + Prisma models, so **every response
shape below is an assumption**. Each one is parsed by a zod schema in
`src/features/w-deal/api/schemas.ts`; fix the schema and the mock fixture together.

## Routes

| Route                                                            | Auth   | Notes                                                                                          |
| ---------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `/deal`                                                          | public | Intro per DealRequest design (hero, two entry cards, how it works, FAQ + FAQPage JSON-LD)      |
| `/deal/sell`                                                     | user   | 내놓기 wizard: 매물 정보 → 거래 조건 → 사진·연락처 (+ 전달 범위·동의) → 확인·전달              |
| `/deal/find`                                                     | user   | 구하기 wizard: 찾는 조건 → 예산·면적 → 연락처·전달 → 확인·등록                                 |
| `/deal/sell/complete?id=`, `/deal/find/complete?id=`             | user   | Confirmation after create (new paths, under the protected `/deal/sell`, `/deal/find` prefixes) |
| `/me/requests?type=sell\|find&status=open\|matched\|ended&page=` | user   | 내 요청 관리 (server-rendered list)                                                            |
| `/me/requests/[id]`                                              | user   | Request + received proposals, compare, accept / decline, contact consent, stop                 |

## Endpoints from the backend README (paths as documented, payloads assumed)

| Method | Path                                                    | Used for                        | Assumed request / response                                                                                                                                                                      |
| ------ | ------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/deal-requests`                                 | create (both wizards)           | body = `dealRequestCreateSchema` (`@house/shared`) **+ `photoMediaIds?: string[]`** → `201` with at least `{ id }` (the client parses only `id`, see below)                                     |
| GET    | `/api/v1/me/deal-requests?type&status&page&pageSize`    | list                            | pagination envelope of `DealRequest`. **`status` is csv** (`CLOSED,CANCELLED,EXPIRED` for the "종료" chip)                                                                                      |
| GET    | `/api/v1/me/deal-requests/:id`                          | detail, completion page         | `DealRequestDetail` (= `DealRequest` + `proposals[]` + `targetAgencies[]`); 404 for someone else's request                                                                                      |
| POST   | `/api/v1/me/deal-requests/:id/cancel` · `/close`        | 요청 중단 (취소 / 종료)         | no body → updated `DealRequestDetail`; `409 DEAL_REQUEST_CLOSED` when already ended                                                                                                             |
| POST   | `/api/v1/me/deal-requests/:id/contact-grants`           | reveal contact to one agency    | body `contactGrantSchema` `{ agencyId }` → `201 { agencyId, grantedAt }`                                                                                                                        |
| DELETE | `/api/v1/me/deal-requests/:id/contact-grants/:agencyId` | revoke                          | `204`                                                                                                                                                                                           |
| POST   | `/api/v1/me/proposals/:id/accept` · `/decline`          | answer a proposal               | no body → updated `Proposal`. Accept is assumed to move an `OPEN` request to `MATCHED` (it keeps receiving proposals)                                                                           |
| POST   | `/api/v1/media?purpose=DEAL_REQUEST_PHOTO`              | photo upload (multipart `file`) | `201 MediaDto`; the UI shows `variants.thumb.url` (falls back to `medium`). Variants may be missing (PENDING): the tile keeps the local preview and polls `GET /media/:id` every 1 s for ≤ 20 s |
| GET    | `/api/v1/media/:id`                                     | thumbnail polling               | `MediaDto`                                                                                                                                                                                      |
| DELETE | `/api/v1/media/:id`                                     | remove an uploaded photo        | `204` (best effort; orphans are cleaned by the backend)                                                                                                                                         |

`DealRequest` (list item) — Prisma columns of `deal_requests` plus:
`emdName?`, `complexName?`, `photos: MediaDto[]`, `proposalCount`, `pendingProposalCount` (SENT/VIEWED),
`targetAgencyCount` (how many agencies received it). Numbers are numbers (not Prisma `Decimal` strings).
`addressDetail`, `contactName`, `contactPhone` are returned to the owner only.

`Proposal` — `{ id, dealRequestId, agencyId, agency: AgencyBrief, memberName?, message, status,
listings: ProposalListing[], contactGranted, createdAt, viewedAt?, respondedAt? }`.
`AgencyBrief` — `{ id, name, representativeName?, phone?, roadAddress?, specialty?,
activeListingCount?, avgResponseMinutes?, logoUrl? }` (`specialty` = display tag such as
"신대 레이크파크 단지 전문"; `avgResponseMinutes` feeds "평균 응답 12분").
`ProposalListing` — `{ id, title, assetType, dealType, price?, deposit?, monthlyRent?, exclusiveArea?,
floorLabel?, thumbUrl? }`.

Error codes handled: `VALIDATION_FAILED` (details mapped back to form fields by the first path segment —
API field names are translated in `SERVER_FIELD_MAP`, `SellWizard.tsx`, incl. `photoMediaIds.*` → 사진),
`MEDIA_NOT_FOUND` / `MEDIA_NOT_READY` (assumed code for a photo that is not READY yet) → back to the
photo step with the message on the photo field, `DEAL_REQUEST_NOT_FOUND`, `DEAL_REQUEST_CLOSED`,
`PROPOSAL_NOT_FOUND`; everything else shows the message from the API in a toast.

Create response: only `{ id }` is parsed (`z.looseObject`) — the completion page loads the detail. A
shape drift in the 201 body therefore cannot report a false failure (which made users submit again and
create duplicates). Area fields (`exclusiveArea`, `areaMin`, `areaMax`, area types) are parsed with
`z.coerce.number()` because Prisma `Decimal` columns serialize as strings unless the DTO converts them;
add contract tests when the backend DTO lands.

## Assumed endpoints (do not exist in any README yet)

0. `GET /api/v1/regions` (shared with w-map, which sends `?sggCode`) — `[{ code, name, parentName? }]`
   (or `{ items }`) for the 구하기 region picker. Sent **without** `sggCode`: the backend answers for its
   configured `REGION_SGG_CODE`. The static list in `lib/regions.ts` only supplies the presentation
   ("많이 찾는 지역" + chip hints, matched by name) and is the fallback while loading / on error.

1. `GET /api/v1/deal-requests/target-agencies?q&emdCode&regionCodes&page&pageSize` — approved agencies
   that would receive a request for the given region codes. Pagination envelope of `AgencyBrief` plus
   `areaLabel?` ("신대·선월"). Used for (a) the reach card "몇 곳의 중개사가 받나요? 12곳" (`total` + the
   first three items), (b) the count in the "전체 중개사" option, (c) the "선택한 중개사" picker (`q`
   searches 상호 / 대표 / 주소). Could be replaced by `GET /agencies?q&emdCode` once its list DTO carries
   the same fields; the reach count needs the same matching rule the backend uses for
   `ALL_AGENCIES_IN_REGION`.
2. `GET /api/v1/deal-requests/address-match?roadAddress&buildingName&bcode` — resolves the road
   address picked in the postcode search to `{ emdCode?, emdName?, lat?, lng?, complex: { id, name,
emdName?, households?, builtYear?, floorsMax?, areaTypes: [{ id, pyeongLabel?, exclusiveArea,
supplyArea? }], market?: { recentTradePrice?, recentTradeYm?, recentTradePyeong?, askingMin?,
askingMax?, perPyeong? } } | null }`. Drives "단지 확인됨", the 평형 select and "이 단지 시세 참고".
   Alternative: compose `GET /complexes?q=` + `/complexes/:id` + `/complexes/:id/stats` on the client.
   The Daum postcode widget returns no coordinates, so `lat` / `lng` are **not** sent on create — the
   backend is expected to geocode `roadAddress` (or return the point here).

## Fields the UI collects that the API has no column for

| UI                                                   | Sent as                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 가격 협의 가능 / 날짜 협의 가능 / 즉시 입주          | leading lines of `description` ("· 가격 협의 가능"…; `composeDescription` ↔ `splitDescription`). Dedicated booleans would be cleaner.                                                                                                                                                                                                                |
| 동 / 호 (complex units)                              | `addressDetail` = "103동 1502호" (private). **`floor` is not sent for 아파트·오피스텔** — derived from 호 it narrows the unit. When the matched complex has `floorsMax`, the class travels as the first `description` line ("· 중층 (총 25층)").                                                                                                      |
| 층 (other assets)                                    | `floor` as typed.                                                                                                                                                                                                                                                                                                                                     |
| 평형 (구하기, 아파트·오피스텔)                       | bands mapped to 전용 ㎡ (10평대 ≤40, 20평대 40–62, 30평대 62–95, 40평대 95–125, 50평 이상 ≥125) → `areaMin`/`areaMax` = hull of the picked bands; the exact bands as "· 희망 평형: 20평대, 30평대". "직접 입력" sends a typed 전용 ㎡ range. Other assets: 평/㎡ 실면적 range.                                                                        |
| 전세 + 월세 보증금 (구하기)                          | two ranges in the UI; `depositMin`/`depositMax` = their union, the per-type ranges as "· 전세 보증금 2억 이하" / "· 월세 보증금 3,000 이하". Per-deal-type deposit columns would be cleaner.                                                                                                                                                          |
| 사진                                                 | `photoMediaIds` (see above) — `DealRequestPhoto` exists in Prisma but **not in `dealRequestCreateSchema`, so a backend parsing with it strips the field**. Order = selection order (대표 first). The wizard blocks "다음 단계로" while uploads are in flight.                                                                                         |
| 약관 동의 (개인정보 수집·이용, 중개사무소 정보 제공) | two separate, unchecked, required checkboxes with the statutory notice inline (수집 항목·목적·보유기간·거부 시 불이익; 제공받는 자·목적·항목·보유기간). **Recorded (D8):** `dealApi.create` reads the current `DEAL_REQUEST_PRIVACY` / `DEAL_REQUEST_PROVIDE` versions from `GET /terms/:type` and sends them as `consents` on `POST /deal-requests`. |
| 거래 유형 (내놓기)                                   | single choice → `dealTypes: [x]`; the price fields cannot express two deal types at once.                                                                                                                                                                                                                                                             |

Limits used by the UI: photos ≤ 20 × 10MB (JPEG/PNG/WEBP/HEIC), selected agencies ≤ 5 (design; API
allows 20), regions ≤ 20, description ≤ 2,800 typed characters (3,000 minus the flag lines).

## Things that differ from the design draft on purpose

- No "안심번호 (050)" and no "인증 완료" on the phone field: the platform has no SMS / virtual numbers.
  The copy says the contact is only revealed to agencies the user grants (`DealRequestContactGrant`).
- The design shows intro + form on one page with a 3-step stepper; the form now lives on
  `/deal/sell` as a 4-step wizard (the lettered groups A–D are kept), 구하기 is extrapolated from it.
- 오피스텔 was added to the asset-type tiles (`AssetType.OFFICETEL` exists in the shared enum).
- "[선택] 이 단지 시세 변동 알림 받기" and "1:1 채팅 문의" were dropped (no backend feature); the FAQ
  links to 전체 FAQ and 중개보수 계산기 instead (`/support` has no page yet — link 고객센터 once it exists).
- 내놓기 preselects 매매 (as in the design); changing the asset type falls back to its first deal type.
- Contact disclosure is opt-in: the "연락처 공개" switch opens a confirmation showing exactly what is
  revealed, and the accept dialog's "이 중개사무소에 내 연락처 공개" starts unchecked. A grant can be
  revoked also after the request ended.

## Region codes — 순천시 is 12150 (D1)

The live Kakao postcode service returns 순천 addresses with sido **"전남광주통합특별시"**, `sigunguCode`
**12150** and `bcode` 1215…… (e.g. 왕지동 1215013200, 해룡면 신대리 1215031022). Since the stage-1
integration (DECISIONS.md D1) the backend, the seed and `packages/shared` use the same code space
(`DEFAULT_SGG_CODE = '12150'`, `DEFAULT_REGION_NAME = '전남광주통합특별시 순천시'`) and the mocks
use 12150 codes too.

`lib/daum-postcode.ts` maps `bcode` / `sigunguCode` through shared `canonicalRegionCode`, so a
legacy 46150…… code (cached postcode data) is turned into its 12150…… code at the boundary.
`lib/service-area.ts` → `SERVICE_SGG_CODES` = `NEXT_PUBLIC_REGION_SGG_CODES` (csv, default
`DEFAULT_SGG_CODE`), compared after `canonicalRegionCode`.
The address dialog accepts an address when `sigungu === BRAND.region` ("순천시") or its code / `bcode`
starts with a service code; the reach lookup and the picker suggestions send the canonical `bcode`. Cards
and summaries drop the long 시·도 prefix (`displayAddress`); the submitted `roadAddress` keeps it.

The 구하기 picker loads its codes from `GET /regions` (above), so it follows whatever the backend is
configured with. The static fallback list keeps the provisional mock codes (4615…, same as the w-map
mock) — they are **not verified 법정동 codes**. Server-rendered names on `/me/requests` still resolve
through that static list (unknown codes would show as the raw code): the `DealRequest` DTO should
carry region names (e.g. `regions: [{ code, name }]`).

## Third-party script

`lib/daum-postcode.ts` loads the Kakao 우편번호 script on demand from
`https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js` (override with
`NEXT_PUBLIC_POSTCODE_SCRIPT_URL`). The old `t1.daumcdn.net` host is retired on 2026-11-30 (the provider
notice was shown inside the widget). A CSP, when added, must allow the script host `t1.kakaocdn.net`
and the widget iframe `postcode.map.kakao.com` (keep `postcode.map.daum.net` until the provider drops
it). If the script cannot be loaded the dialog falls
back to typing the road address; in mock mode it also lists sample addresses.

## Mock notes

- State lives on `globalThis` (`deal-requests/_store.ts`): five seeded requests of the mock user
  (S1 open 내놓기 with 3 proposals, W1 open 구하기 with 3 proposals + listings, S2 matched, W2 closed,
  S3 expired). Mutations work and reset when the dev server restarts.
- Ids follow the other mocks: agencies `mockUuid('agency-B01')`, listings `mockUuid('L01')`,
  complexes `mockUuid('C01')`, area types `mockUuid('C01-A34')`.
- `media/**` is shared with a-agency (`getMedia`, `toMediaDto`, private documents). Uploaded bytes are
  kept in memory and served at `/mock-api/v1/media/:id/file` (mock only).
- Drafts: `localStorage["house:deal-draft:{sell|find}:{userId}"]`, versioned, 30-day TTL, removed on
  submit. They contain the phone number and 동/호, hence the per-user key.
