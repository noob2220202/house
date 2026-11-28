# Frontend integration notes — a-inbox (broker inbox: 내놓기·구하기 requests, proposals, 문의함, notifications)

Scope: `apps/web/src/app/agent/{requests,requests/[id],inquiries,notifications}/**`,
`apps/web/src/features/a-inbox/**` and the mock resources listed below. The customer side of 문의
(the dialog, MY > 문의 내역) is `features/w-inquiry` — see "문의 (inquiries)" at the end. See `docs/FRONTEND.md` for
conventions. The console chrome (`app/agent/layout.tsx`, `<AgentShell>`, sidebar / tab bar) belongs
to a-agency.

> **Status (2026-11-28):** the inbox runs against the `deal-requests` module of `apps/api`
> (`controllers/agency-deal-requests.controller.ts`, `notifications/`), built to the shapes below
> (DECISIONS rule 2). **The 문의함 is back:** owner decision O5 of 2026-11-28 supersedes D5
> (`docs/agency-sites/SPEC.md` §3.5 / §4.4); it reads the `inquiries` module (`AgencyInquiryView`
> and friends in `packages/shared/src/inquiries/types.ts`). The "assumed" wording of the request
> sections below is kept for history.

Each response is parsed by exactly one zod schema in
`apps/web/src/features/a-inbox/api/schemas.ts`; reconcile the schema and its mock fixture together.

## Routes

| Route                  | Who                  | What                                                                                                                                                                                                               |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/agent/requests`      | AGENT · AGENCY_OWNER | 내놓기·구하기 requests that reach the office. Stage tabs with counts, type / 지역 / 매물 종류 filters, sort, pagination — all in the query string.                                                                 |
| `/agent/requests/[id]` | AGENT · AGENCY_OWNER | Request detail (no private data), requester contact (masked until consent), proposal form **or** the proposal we sent (progress timeline, message, attached listings, 철회).                                       |
| `/agent/inquiries`     | AGENT · AGENCY_OWNER | 문의함: written inquiries (문의글) and logged 전화 · 문자 · 번호 복사. Status tabs with counts, channel / 안 읽음 / 홈페이지 filters, search; drawer with the thread, reply (members only), 처리 상태, memo, 삭제. |
| `/agent/notifications` | AGENT · AGENCY_OWNER | Notification centre of the console: inbox counters + the member's notification feed with console deep links, 안 읽음 filter, 모두 읽음, cursor "더 보기".                                                          |

All pages call `requireAgent()` on the server (signed-out → `/login?returnTo=…`, plain users →
`/agent/apply`) and are `noindex` through the console layout. URL state:

- `/agent/requests?stage=new|proposed|accepted|ended&type=sell|find&region=<emd,emd>&asset=<AssetType,…>&sort=expiring&page=N`
- `/agent/inquiries?status=new|progress|done&channel=message|call|sms|copy&source=main|site&unread=1&q=&page=N&id=<inquiryId>`
  (`id` opens the drawer; notification deep links use `AGENT_ROUTES.inquiry(id)`)

Filter changes are shallow (`history.pushState`, no server round trip); defaults are left out of the
URL. `INBOX_ROUTES` (`features/a-inbox/routes.ts`) holds the paths; `/agent/notifications` is new
(not in `ROUTES` / `AGENT_ROUTES`).

## Endpoints used

| Method | Path                                          | Used by                                             | Backend status                                                            |
| ------ | --------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| GET    | `/api/v1/agency/deal-requests`                | request list (stage tabs without counters)          | API (`?scope&type&assetType&dealType&page`) — assumptions 1–3             |
| GET    | `/api/v1/agency/proposals?status=SENT,VIEWED` | 응답 대기 tile (`total` only)                       | API (`AgencyProposalView` page)                                           |
| GET    | `/api/v1/agencies/mine/dashboard`             | 새 요청 tile (`dealRequests.newCount`)              | API (a-agency)                                                            |
| GET    | `/api/v1/agency/deal-requests/:id`            | request detail                                      | README ("contact only if granted") — response: assumptions 2, 4           |
| POST   | `/api/v1/agency/deal-requests/:id/proposals`  | send proposal — body `proposalCreateSchema`         | README + shared schema — response: assumption 5; price: assumption 6      |
| POST   | `/api/v1/agency/proposals/:id/withdraw`       | 제안 철회                                           | README — response: assumption 5                                           |
| GET    | `/api/v1/me/notifications` (cursor)           | notification feed + unread counter (w-me's hooks)   | README — shapes documented in `w-me.md` (6); agency payload: assumption 9 |
| POST   | `/api/v1/me/notifications/read`               | mark one / all read                                 | README — `w-me.md` (7)                                                    |
| GET    | `/api/v1/agencies/mine`                       | office name for the greeting template               | a-agency                                                                  |
| GET    | `/api/v1/agencies/mine/dashboard`             | only **invalidated** (sidebar badges) after actions | a-agency (assumed there)                                                  |
| GET    | `/api/v1/agency/inquiries`                    | 문의함 list (`agencyInquiryListQuerySchema` query)  | inquiries — `AgencyInquiryPage` (`unreadCount`, `statusCounts`)           |
| GET    | `/api/v1/agency/inquiries/:id`                | drawer (with `messages`)                            | inquiries — `AgencyInquiryView`                                           |
| PATCH  | `/api/v1/agency/inquiries/:id`                | status / memo / read (opening an unread row)        | `agencyInquiryUpdateSchema`; response body not used (the drawer re-reads) |
| POST   | `/api/v1/agency/inquiries/:id/replies`        | 답변 보내기 (only when `canReply`)                  | `inquiryReplySchema`; 409 `INQUIRY_REPLY_NOT_ALLOWED`; body not used      |
| POST   | `/api/v1/agency/inquiries/read`               | 모두 읽음 `{ all: true }`                           | `{ updated, unreadCount }` (read leniently)                               |
| DELETE | `/api/v1/agency/inquiries/:id`                | 삭제 `{ reason? }` (스팸·광고 / 장난 / 중복 / 정리) | 204                                                                       |

Error codes handled explicitly (from `packages/shared/src/errors/deal-requests.ts`):
`DEAL_REQUEST_NOT_FOUND` (404 → "요청을 찾을 수 없어요"), `DEAL_REQUEST_CLOSED`,
`DEAL_REQUEST_NOT_TARGETED`, `PROPOSAL_DUPLICATE` (toast + the detail reloads), `PROPOSAL_NOT_FOUND`.
`400 VALIDATION_FAILED` with `details: [{ path: 'message' | 'listingIds', message }]` is mapped to
the form fields.

## Assumed endpoints (not in any backend README — please confirm or rename)

| Method | Path                                                                  | Purpose                                                                                                                                                                                                                                                                                  |
| ------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/agency/deal-requests/:id/listing-candidates?q&page&pageSize` | The agency's **ACTIVE** listings that may be attached to a proposal (picker), `q` = title search, page envelope of `inboxListingSchema`. Can be replaced by `GET /agency/listings?status=ACTIVE&q=` if that returns the same fields — the client ranks by match itself (`lib/match.ts`). |

All of them: AGENT / AGENCY_OWNER of an APPROVED agency, scoped to the caller's agency; CSRF header
on mutations.

## Assumed payload shapes

1. **`GET /agency/deal-requests` query** — README has `?type&page`. The inbox additionally sends
   `stage` (`NEW | PROPOSED | ACCEPTED | ENDED`, see 3), `regionCodes` (CSV of 읍면동 codes: the
   request's own `emdCode` **or** one of its wanted `regionCodes`), `assetTypes` (CSV), `sort=EXPIRING`
   (soonest `expiresAt` first, ended requests last; default newest first) and `pageSize` (10).
   If the backend keeps only `type&page`, the stage tabs / region / asset filters need a client-side
   fallback (not built — the list is paginated).
2. **Request as an agency sees it** → `agencyDealRequestSchema`:
   `{ id, type, status, assetType, dealTypes[], visibility, targeted,
description?, emdCode?, emdName?, complexId?, complexName?, exclusiveArea?, floor?,
desiredSalePrice?, desiredDeposit?, desiredMonthlyRent?, photos: MediaDto[], regionCodes[],
complexIds[], priceMin?, priceMax?, depositMin?, depositMax?, rentMin?, rentMax?,
areaMin?, areaMax?, roomsMin?, moveInDate?, expiresAt?, closedAt?, createdAt, updatedAt?,
proposalCount, myProposal: MyProposal | null, contactGranted }`.
   - **Privacy**: before consent the API must send only the masked name and the location down to
     읍면동 / 단지 — never `contactName`, `contactPhone`, `roadAddress`, `addressDetail`, `lat/lng`.
     The UI renders exactly what it receives and reconstructs nothing (unit-tested against the
     fixtures).
   - `targeted` = the requester picked this agency (`SELECTED_AGENCIES`) → "지정 요청" chip.
   - The API sends **no requester name** before consent (only `contact.name` with a grant) and
     **no names for `complexIds`**: the UI shows "요청자 · 연락처 비공개" and "선택한 단지 N곳".
     `complexName` comes from the backend `complex{id,name}` (내놓기), `emdName` and the names of
     `regionCodes` from w-deal's `SUNCHEON_REGIONS` table.
   - `proposalCount` = proposals from all agencies ("다른 사무소 제안 N곳" = count − ours).
   - `expiresAt` drives "마감 D-n" (the README mentions expiry via the cleanup job; the field name
     is assumed).
3. **No stage counters.** The API list has no `stageCounts`, so the stage tabs show no numbers.
   The `/agent/notifications` tiles read 새 요청 from `GET /agencies/mine/dashboard`
   (`dealRequests.newCount`) and 응답 대기 from `GET /agency/proposals?status=SENT,VIEWED&pageSize=1`
   (`total`). The stage is derived (`lib/stage.ts`):
   ENDED = request not OPEN/MATCHED, or our proposal DECLINED/WITHDRAWN · ACCEPTED = our proposal
   ACCEPTED or contact granted · PROPOSED = our proposal SENT/VIEWED · NEW = no proposal yet.
   **Open:** the real list query is `scope&type&assetType&dealType&page&pageSize`; the inbox's
   `stage`, `regionCodes`, `assetTypes` and `sort` are honoured only by the mock.
4. **Detail** → `agencyDealRequestDetailSchema` = the list item with the full `myProposal` plus
   `contact: { name, phone, roadAddress?, addressDetail?, grantedAt? } | null` — present **only
   while the DealRequestContactGrant for this agency is active** (revocation makes it `null` again).
   A request that does not reach the agency answers `404 DEAL_REQUEST_NOT_FOUND`.
5. **`MyProposal`** (response of create / withdraw, and `myProposal`):
   `{ id, status: ProposalStatus, message, listings: InboxListing[], memberName?, createdAt,
viewedAt?, respondedAt? }`; the list may send `message: ''` / `listings: []`. `viewedAt` /
   `respondedAt` feed the progress timeline (보냄 → 요청자 확인 → 수락/거절 → 연락처 공개). Create →
   `201`. Withdraw is offered while the request is active and the proposal is SENT / VIEWED; the
   UI states that a withdrawn or declined proposal cannot be re-sent (one proposal per agency per
   request, `PROPOSAL_DUPLICATE`) — confirm that a WITHDRAWN proposal really blocks a new one.
   `InboxListing` = `{ id, title, assetType, dealType, price?, deposit?, monthlyRent?,
exclusiveArea?, floorLabel?, rooms?, emdCode?, emdName?, complexId?, thumbUrl?, verifiedAt? }`
   (the same card w-deal renders on the requester's side).
6. **Suggested price** — `proposalCreateSchema` is `{ message, listingIds }`; there is **no price
   field**. For 내놓기 requests the form has an optional 예상 매매가 / 전세가 / 보증금·월세 input; it is
   sent as a leading line of the message (`"· 예상 매매가 4억 4,500\n\n<text>"`, the same "· flag"
   convention w-deal uses for request descriptions) and parsed back for display
   (`lib/proposal.ts`, `splitProposalMessage`). Only leading lines with one of the labels the form
   writes (`· 예상 매매가 …`, `· 예상 전세가 …`, `· 예상 보증금 …`, `· 예상 보증금/월세 …`) are read back
   as prices — an agent's own "· " bullet lines stay part of the message text. 80 characters of the
   2,000 limit are reserved for it. If the backend adds real columns (e.g. `offerPrice`, `offerDeposit`, `offerMonthlyRent` in
   만원), change `toProposalBody()` and `MyProposalCard` only. 구하기 proposals carry prices through
   the attached listings instead.
7. **Inquiry** → `agencyInquirySchema` (= `AgencyInquiryView`). MESSAGE rows carry the name and
   phone as submitted; CALL / SMS / COPY rows (contact events) never carry a phone and show a
   masked member name or "비회원 고객". `canReply` decides between the reply box and the guest
   notice ("비회원 문의예요. 남긴 번호로 전화해 주세요"); `source: SITE` shows a "홈페이지" badge.
   Unknown enum values fall back (`.catch`), so a newer API never breaks the list. After every
   mutation the drawer re-reads `GET /agency/inquiries/:id` (mutation response bodies are not
   relied on) and the list, the dashboard (sidebar badge) and the tile counters are invalidated.
8. **Listing candidates** → page of `InboxListing` (ACTIVE listings of the agency, any type); the
   mock returns them best-match first, the client ranks again and labels each row
   ("조건 일치" / which conditions differ). The match is a hint, never a filter.
9. **Agency notifications** use the member's own feed (`GET /me/notifications`). To deep-link into
   the console the payload must carry `data.agencyId` plus `data.dealRequestId` (types
   `DEAL_REQUEST_RECEIVED`, `PROPOSAL_ACCEPTED`, `CONTACT_GRANTED`) — `lib/notifications.ts`.
   Without `agencyId` a notification falls back to the my-page links (`/me/requests/:id` …), because
   an agent's own 내놓기·구하기 lands in the same feed. `INQUIRY_RECEIVED` (`data { agencyId,
inquiryId, followUp? }`) and any agency row with `data.inquiryId` open
   `/agent/inquiries?id=<inquiryId>`; `AGENCY_SITE_APPROVED` / `_REJECTED` open `/agent/site`. These
   three types are agency-only (`AGENCY_ONLY_TYPES`, `w-me/lib/notifications.ts`);
   `INQUIRY_REPLIED` (`data { inquiryId, agencyName }`, no `agencyId`) opens `/me/inquiries/<id>`.

## Mock resources (owned by this group)

`apps/web/src/app/mock-api/v1/agency/`

| Folder / file                                                                                                 | What                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deal-requests/route.ts`, `[id]/route.ts`                                                                     | List and detail. Dev switches: `?_empty=1`, `?_fail=1`, `?_delay=ms`.                                                                                                        |
| `deal-requests/[id]/proposals/route.ts`                                                                       | Create a proposal (validates with `proposalCreateSchema`, 409 duplicate / closed, own ACTIVE listings only).                                                                 |
| `deal-requests/[id]/listing-candidates/route.ts`                                                              | Picker source.                                                                                                                                                               |
| `deal-requests/_seed.ts`, `_listings.ts`                                                                      | 11 seeded requests of fictional people covering every stage (req-01 … req-11) and 16 ACTIVE listings of the mock office (ids reuse the public mocks).                        |
| `deal-requests/_store.ts`                                                                                     | Agency view of the store, DTO mapping (no requester name, contact only with a grant), guards, agency notifications.                                                          |
| `proposals/[id]/withdraw/route.ts`                                                                            | Withdraw.                                                                                                                                                                    |
| `proposals/route.ts`                                                                                          | `GET` list (`?status` CSV, `AgencyProposalView` shape) — the 응답 대기 tile reads its `total`.                                                                               |
| `inquiries/route.ts`, `inquiries/[id]/route.ts`, `inquiries/[id]/replies/route.ts`, `inquiries/read/route.ts` | 문의함 of B01: list (`?_empty=1`, `?_fail=1`), detail, PATCH, DELETE, replies, read-all. The store is shared with the customer side (`app/mock-api/v1/inquiries/_store.ts`). |

`agency/listings/**` belongs to a-listings and is not touched.

- The mock office is **B01 신대중앙 공인중개사사무소** for both console roles
  (`…/auth/oauth/kakao/start?as=owner|agent`). `as=user` gets `403` from every `/agency/**` handler.
- The inbox is **joined with the w-deal mock**: requests the mock USER creates at `/deal/sell` /
  `/deal/find` that reach B01 appear in `/agent/requests`; a proposal sent from the console shows up
  on `/me/requests/[id]` (and notifies the mock user); accepting it / granting contact there flips
  the console to "제안 수락" / reveals the contact. Only _reading_ `deal-requests/_store.ts`,
  `deal-requests/_fixtures.ts` and `me/_store.ts` of the other groups — none of their files were
  edited.
- The a-agency dashboard mock takes its request feed and 새 요청 badge from this store (ids
  `req-01 …`), so they move with the inbox; its other numbers are a separate fixture.
- State lives on `globalThis`; restarting the dev server resets it.

## Behaviour notes

- **Consent gate**: until `contact` arrives, the detail shows "<masked name> 님 · 연락처 비공개" with
  the reason for the current state (no proposal yet / under review / accepted but not granted /
  ended). After the grant: name, phone (`tel:` / `sms:` / copy), and for 내놓기 the 도로명 + 동·호,
  with a purpose-limitation notice. Nothing private is cached beyond the TanStack Query entry of
  the detail.
- **Proposal form** (react-hook-form + zod, `lib/proposal.ts`): message 10–1,920 chars with
  one-tap starter sentences (greeting uses the office + member name), optional price for 내놓기
  (`parsePriceInput`: "4억 4,000" or 44000; "희망가 그대로" shortcut; 월세 needs 보증금 with 월세), up
  to 10 listings from the picker. A proposal cannot be edited after sending (stated under the
  button) — there is no update endpoint.
- **Request detail** is fetched on the server (`serverGetAuthed`) and seeded into the TanStack
  Query cache (`HydrationBoundary`), so it paints with content instead of a skeleton. A failed
  server fetch (404 / 5xx) is not dehydrated: the client requests it again and shows its own
  "요청을 찾을 수 없어요" / retry state (soft 404, the console is `noindex`). The detail refetches on
  window focus, so an acceptance / contact grant made meanwhile shows up when the agent returns.
- Requester photos (if any) open their `large` (else `medium`) variant in a new tab.
- **Listing picker** loads one page (50). When `total` is larger it says so and points to the
  search box.
- Phones: the list toolbars wrap instead of scrolling sideways (every filter stays visible), and
  the notification counters are one compact row of three so the feed starts above the fold.
- **After every mutation** the lists, counters and a-agency's dashboard query (sidebar badges) are
  invalidated.
- Sidebar / tab-bar badges, the topbar bell and breadcrumb are rendered by a-agency's shell.

## Not covered / follow-ups

- The shell's topbar bell (a-agency) opens `/agent/notifications`, so the inbox pages carry no
  separate "알림" header button.
- `GET /me/notifications` is one feed per user; the console asks for `scope=agency` (B5) and also
  drops rows without the agency marker on the client, so personal notifications stay on the
  my-page.
- No realtime: the two lists refetch when the tab regains focus (once stale, 30 s), on navigation
  and after mutations — no polling, no push.
- Requester-side "제안 확인(VIEWED)" is assumed to be set by the backend when the requester opens
  the proposal list.

## 문의 (inquiries) — customer side and console (SPEC §4.3 / §4.4)

- **Dialog** (`features/w-inquiry/components/InquiryDialog.tsx`): one component for the listing
  page (`w-listing/components/ContactDialog.tsx`), the complex panel
  (`w-complex/panel/InquiryDialog.tsx`) and the office page / map panel
  (`w-agencies/components/AgencyInquiryButton.tsx`). Two tabs:
  - **바로 연락**: the number (tap to copy), 문자 보내기 with the 매물번호, 전화 걸기. Every press
    sends `POST /inquiries/contact-events` (fire and forget).
  - **문의 남기기**: name; phone (required for guests, optional for members, prefilled from the
    session); message 5–1,000 with starters and a counter; the `INQUIRY_PRIVACY` consent with its
    published text inline (`useActionTerms('INQUIRY')`); a hidden honeypot `website`. Sends
    `POST /inquiries`.

  The 전화 buttons open the dialog on 바로 연락, the 문의하기 buttons on 문의 남기기. Server codes
  map onto the form: `INQUIRY_PHONE_REQUIRED` → the phone field, `VALIDATION_FAILED` details → the
  fields, an outdated consent → the terms are read again and the box is unticked, anything else →
  a message above the button. On success a member gets a link to `/me/inquiries/<id>`; a guest
  reads "중개사무소가 남겨 주신 번호로 연락드릴 거예요".

  `ListingInteractions` takes `inquirySource` (`SITE` on the office's own site; it also hides the
  "다른 매물 보기" link). The plain `tel:` links on the listing page and in the complex panel log
  CALL events too.

- **MY > 문의 내역** (`/me/inquiries`, `/me/inquiries/[id]`, menu entry "문의 내역"):
  - the list is `GET /me/inquiries` (`MyInquiryListItem`) and shows "새 답변" while
    `hasUnreadReply`;
  - the thread is `MyInquiryDetail`; reading it marks the replies read;
  - the follow-up box sends `POST /me/inquiries/:id/messages`.
- **Console**:
  - nav item 문의함 with the `unreadInquiries` badge (from the dashboard's
    `inquiries.unreadCount`), in the sidebar and the mobile tab bar;
  - dashboard KPI "읽지 않은 문의" and panel "최근 문의" (the latest 3 written inquiries);
  - an "안 읽은 문의" tile on `/agent/notifications`;
  - nav item 내 홈페이지 → `/agent/site`, a placeholder page until the office-site work lands.
- **Mocks**: one store serves `app/mock-api/v1/inquiries/` (`_store.ts`, `route.ts`,
  `contact-events/route.ts`), `me/inquiries/**`, `agency/inquiries/**` and the dashboard mock.
  An inquiry sent from a listing in mock mode shows up in the B01 console and notifies both console
  roles. A reply there shows up under MY of the mock user and notifies them. The terms mock serves
  the `INQUIRY_PRIVACY` document.
