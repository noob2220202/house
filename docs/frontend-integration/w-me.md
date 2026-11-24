# Frontend integration notes — w-me (마이페이지)

Scope: `/me` overview, 관심 매물·단지, 최근 본 매물, 알림, 내 정보 in `apps/web`.
Code: `apps/web/src/app/(me)/**`, `apps/web/src/features/w-me/**`, mocks under
`apps/web/src/app/mock-api/v1/me/**`. See `docs/FRONTEND.md` for the shared conventions.

## Routes

| Path                | Page                                                                            | Mobile tab |
| ------------------- | ------------------------------------------------------------------------------- | ---------- |
| `/me`               | MY 홈: 요약 타일, 관심 매물 미리보기, 최근 본 매물, 알림                        | MY         |
| `/me/favorites`     | 관심 매물 (`?page=`) · 관심 단지 (`?tab=complexes&page=`), 삭제 + 실행 취소     | 관심       |
| `/me/recent`        | 최근 본 매물, 날짜별 묶음 (오늘 / 어제 / 이번 주 / 지난 기록), 하트로 관심 담기 | MY         |
| `/me/notifications` | 알림 센터: 전체 / 안 읽음, 개별 읽음, 모두 읽음, 더 보기                        | MY         |
| `/me/profile`       | 내 정보: 닉네임·연락처, 마케팅 수신 동의(변경 일시 표시), 연결된 계정, 계정     | MY         |

All pages are `noindex`. `/me/recent` and `/me/profile` are new paths owned by this group
(`ME_ROUTES` in `features/w-me/routes.ts`); the others come from `ROUTES` in `config/nav.ts`.

### Route group and shell

- The pages live in their own route group **`app/(me)`** (`<SiteShell mobileHeader={false}>`): on
  mobile every page draws its own top bar (title + back) through `<MePage>`; on desktop
  `app/(me)/me/layout.tsx` adds the sticky side navigation (`<MeShell>`).
- Other groups can put their `/me/**` pages into `app/(me)/me/` to get the same chrome (wrap the body
  in `<MePage title … backHref …>`). Already there: `/me/account` and `/me/withdraw` (w-auth) and
  `/me/requests`, `/me/requests/[id]` (w-deal) — the side navigation and the notification deep links
  (`/me/requests/{dealRequestId}`) point at them.
- **Every page under `app/(me)/me` must call its own guard** — `requireMe(path)` from
  `features/w-me/server.ts` (per-request cached) or `requireUser(path)` — so an expired session returns
  to the exact URL. The layout cannot know the current path; without a session it renders the page
  bare plus a client-side fallback redirect (`MeAuthFallback`).

### Pieces reused from / offered to other groups

- From w-auth: `LinkedAccountsPanel` (연결된 계정 on `/me/profile`), `AUTH_ROUTES.account`
  (계정 설정) and `AUTH_ROUTES.withdraw` (회원 탈퇴 entry). 회원 탈퇴 itself, consent history and
  "모든 기기에서 로그아웃" are w-auth's.
- Offered: `MePage`, `MeShell`, `MeListingCard` (ListingCard fed from the API summary, with
  거래완료/계약중 label), `ListingMiniRow`, `NotificationRow`, `useUnreadNotificationCount()` (header
  bell dot), `useToggleFavoriteListing()` / `useToggleFavoriteComplex()` (PUT/DELETE with optimistic
  cache updates of the my-page lists).

## Endpoints used

Listed in the backend module READMEs (paths are real, **payload shapes are assumed** — controllers
are not implemented yet):

| Method     | Path                                   | README        | Used for                           |
| ---------- | -------------------------------------- | ------------- | ---------------------------------- |
| GET        | `/api/v1/me/favorites/listings`        | listings      | 관심 매물 list, overview count     |
| PUT/DELETE | `/api/v1/me/favorites/listings/:id`    | listings      | add (undo, recent hearts) / remove |
| GET        | `/api/v1/me/favorites/complexes`       | complexes     | 관심 단지 list, overview count     |
| PUT/DELETE | `/api/v1/me/favorites/complexes/:id`   | complexes     | add (undo) / remove                |
| GET        | `/api/v1/me/recent-views`              | listings      | 최근 본 매물                       |
| GET        | `/api/v1/me/notifications` (cursor)    | deal-requests | 알림 feed, unread counter          |
| POST       | `/api/v1/me/notifications/read`        | deal-requests | mark read                          |
| PATCH      | `/api/v1/me/profile`                   | auth          | nickname, phone, marketingOptIn    |
| GET        | `/api/v1/auth/me`, POST `/auth/logout` | auth          | session (foundation)               |

## Assumed endpoints

Not listed in any README — please add them or tell us the real path:

1. **`GET /api/v1/me/profile`** → the profile shown on 내 정보. Needed because `/auth/me` has no
   consent timestamp. Shape (`profileSchema`): the `/auth/me` fields plus
   `marketingOptInAt` (ISO datetime of the latest MARKETING consent change — required for the
   "수신 동의 일시" display), `createdAt`, `lastLoginAt`. `PATCH /me/profile` is expected to return the
   same shape. If the backend prefers, `marketingOptInAt` can simply be added to `/auth/me` and this
   endpoint dropped (one line in `features/w-me/api.ts`).
2. **`GET /api/v1/me/identities`** → linked social accounts (shared with w-auth, which also assumes
   `DELETE /me/identities/{provider}`): `{ items: [{ id, provider, email?, lastUsedAt?, createdAt }] }`.

## Assumed payload shapes (zod schemas in `features/w-me/schemas.ts`)

Fix the schema and the fixture (`mock-api/v1/me/_fixtures.ts`) together; `schemas.test.ts` keeps them
in step.

1. **Listing summary** (items of favourites / embedded in recent views) — `listingSummarySchema`:
   `{ id, assetType, dealType, status, title, subtitle?, complexId?, emdName?, locationNote?,
salePrice?, deposit?, monthlyRent?, presalePrice?, premium?, exclusiveArea?, supplyArea?, floor?,
totalFloors?, floorClass?, direction?, builtYear?, verifiedAt?, agencyCount, coverPhotoUrl?,
isFavorite? }` — names follow the Prisma `Listing` columns; money in 만원, areas in ㎡.
   - `title` = complex or building name, `subtitle` = 동 or room type. If the backend sends
     `complexName` / `dong` instead, map them in `lib/listing-card.ts`.
   - 분양권 headline price = `presalePrice + premium` (same as `priceSort`).
   - Favourites keep listings that left the market: `status` `CLOSED` / `HIDDEN` render as
     거래완료 / 광고 종료 (status pill, grey photo, a neutral foot note instead of the 실매물 확인
     badge) so the user can remove them. Please do not filter them out.
   - Other page groups (home, map, listing) define their own listing-card schemas; they should be
     unified into one shared schema once the backend response is final.
2. **`GET /me/favorites/listings`** → pagination envelope of `listing summary + favoritedAt`,
   newest first. Query: `page`, `pageSize` (12 on the list page, 3 on the overview — `total` feeds
   the counters).
3. **`GET /me/favorites/complexes`** → envelope of `{ id, name, emdName?, households?, builtYear?,
moveInYm?, pyeongLabels[], salePrice?{min,max}, jeonsePrice?{min,max}, presalePrice?{min,max},
counts{presale,sale,jeonse,monthly}, pricePerPyeong?, coverPhotoUrl?, favoritedAt }`.
4. **`PUT` / `DELETE /me/favorites/{listings|complexes}/:id`** → idempotent, body ignored by the
   client (mock answers `204`).
5. **`GET /me/recent-views?targetType=LISTING&page&pageSize`** → envelope of
   `{ targetType, targetId, viewedAt, listing: ListingSummary | null }` newest first, with
   `listing.isFavorite` set for the signed-in user (drives the heart). Rows whose listing is gone
   (`listing: null`) are skipped.
6. **`GET /me/notifications?cursor&limit&unreadOnly`** → `CursorPage` + counter:
   `{ items: [{ id, type, title, body?, data?, readAt?, createdAt }], nextCursor, unreadCount }`.
   `unreadOnly=true` is an assumed filter; `unreadCount` (all unread, regardless of the filter) feeds
   the badges — without it the client can only count the loaded rows.
7. **`POST /me/notifications/read`** body `{ ids: string[] }` or `{ all: true }` →
   `{ updated, unreadCount }` (response optional).
8. **Notification deep links** are built on the client from `type` + `data`
   (`lib/notifications.ts` → `notificationHref`, used by the my-page list and the overview panel):
   - **Agency events** — a row with `data.agencyId`, or one of the agency-only types
     `DEAL_REQUEST_RECEIVED` / `PROPOSAL_ACCEPTED` / `CONTACT_GRANTED` (the enum semantics of the
     deal-requests README: a request arrived, our proposal was accepted, the requester opened their
     contact to us) — open the broker console: `dealRequestId` → `/agent/requests/{id}`,
     `inquiryId` → `/agent/inquiries?id=…`. Labels: 새 요청 도착 / 제안 수락됨 / 연락처 공개됨.
   - **Requester events** — `PROPOSAL_RECEIVED` + `dealRequestId` → `/me/requests/{id}`;
     `LISTING_HIDDEN` + `listingId` → `/listing/{id}`; `AGENCY_APPROVED`/`AGENCY_WARNED` → `/agent`,
     `AGENCY_REJECTED` → the apply page; `SYSTEM` → `data.url` (site-relative paths only), else
     `dealRequestId` → `/me/requests/{id}`, `complexId` → `/complex/{id}`, `listingId` →
     `/listing/{id}`. Unknown `type` values fall back to `SYSTEM`.
   - `GET /me/notifications` is ONE feed per user and brokers are users too, so the audience must be
     readable from the row itself. **Backend please:** put `data.agencyId` on every notification sent
     to an agency member (the discriminator the client relies on), and decide how the requester-side
     confirmations are sent — "요청이 중개사무소 N곳에 전달됐어요" and "제안을 수락해 연락처가
     공개됐어요" have no enum value today, so the mock sends them as `SYSTEM` + `dealRequestId`. Either
     add enum values (e.g. `DEAL_REQUEST_DELIVERED`, `CONTACT_SHARED`) or keep `SYSTEM` and document a
     `data.audience: 'REQUESTER' | 'AGENCY'` field; both need one line in `lib/notifications.ts`.
9. **`PATCH /me/profile`** body = `updateProfileSchema` from `@house/shared` (only changed fields;
   `phone: null` clears it). Field errors are expected as `VALIDATION_FAILED` with
   `details[].path` = `nickname` | `phone` (e.g. duplicate / forbidden nickname).
   The marketing switch saves immediately with `{ marketingOptIn }` and the response's
   `marketingOptInAt` is shown to the user ("YYYY.MM.DD HH:mm 수신 동의/거부").

## Mock-only behaviour

- State lives in memory per mock role (`_store.ts`, on `globalThis`) and resets when the server
  restarts. Sign in with `/mock-api/v1/auth/oauth/kakao/start?returnTo=/me&as=user|agent|owner`.
- `?_fail=1` on any GET of the `/me` mocks answers 500 (error states), `?_delay=ms` slows it down.
- `PATCH /me/profile` rejects the nicknames `관리자`, `운영자`, `admin` with a field error (to exercise
  server-side validation mapping) and mirrors a marketing change into the w-auth consent history.
- The fixtures have no photos (`coverPhotoUrl: null`) → branded placeholders; with real media URLs the
  cards render `next/image`.

## Not covered here

- Recording a recent view and the 관심 toggle on listing / complex pages (w-listing, w-complex, w-map).
  After such a toggle those pages should invalidate `['me-favorites']` (see `meKeys`).
- Clearing the recent-view history (no endpoint in the README).
- Notification preferences per type and push / e-mail delivery (no endpoint yet).
- **Price-change / sold alerts for favourites** are NOT promised anywhere in the UI copy, because the
  backend has nothing for them. If they are wanted, the backend needs: a `FAVORITE_PRICE_CHANGED`
  and a `FAVORITE_CLOSED` `NotificationType` (with `data.listingId`), and a `previousPrice` (만원)
  plus `priceChangedAt` on the favourites payload so the cards can show "▼ 1,000". The client side
  is small: two entries in `NOTIFICATION_META`, a price-delta line in `MeListingCard`.
