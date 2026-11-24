# Frontend integration notes — a-agency (broker console: shell, apply, dashboard, profile, staff)

Scope: `apps/web/src/app/agent/**` (layout, `/agent`, `/agent/apply`, `/agent/profile`,
`/agent/staff`, in-shell 404), `apps/web/src/features/a-agency/**`, and the mock resources listed
below. See `docs/FRONTEND.md` for conventions.

The agencies / media / auth controllers do not exist yet (module READMEs + Prisma schema only), so
every **payload shape** below is an assumption derived from
`apps/api/prisma/schema/agencies.prisma`, `packages/shared/src/schemas/{agencies,media}.ts` and the
module READMEs. Each response is parsed by exactly one zod schema in
`apps/web/src/features/a-agency/api/schemas.ts` — reconcile the schema and the mock fixture together.

## BLOCKING — must be decided before backend integration

1. **`GET /agencies/mine` must answer more than AGENCY_OWNER.** The agencies README lists it as
   AGENCY_OWNER only, but the console needs it for
   - the **applicant**: role USER who owns a PENDING / REJECTED agency (status tracking, resubmit,
     documents), and
   - **staff**: AGENT members of an ACTIVE agency (`myRole: "AGENT"`; sidebar, profile read-only,
     등록 정보).

   For "no agency yet" prefer **`200 null`** over `404` (a 404 is logged as a console error on every
   apply page load). Alternative: expose `GET /agencies/mine/application` for applicants and keep
   `/agencies/mine` owner-only — then only `fetchMyAgency()` (`features/a-agency/api/queries.ts`)
   and the layout's `loadAgency()` change. Until then the client treats **403 for a USER-role caller
   as "no agency"** (the form renders instead of an error state); 403 for AGENT is still an error.

2. **Schema changes required** (Prisma / shared) — see the section of that name below: invite codes
   for not-yet-registered staff, the profile PATCH fields, the consent record and a dedicated
   보증서류 document type.

## Routes

| Route            | Who                                     | What                                                                                                 |
| ---------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/agent`         | AGENT · AGENCY_OWNER                    | Dashboard: KPIs, 7-day views, expiring listings, 실매물 확인 due, new 내놓기·구하기                  |
| `/agent/apply`   | any signed-in user                      | New application · invite-code join (`?tab=join`) · status tracking · resubmit · 등록 정보 (approved) |
| `/agent/profile` | AGENT (read-only) · AGENCY_OWNER (edit) | Public profile editor: logo, cover, intro, specialties, business hours, phone + live preview         |
| `/agent/staff`   | AGENCY_OWNER (AGENT sees a notice)      | Members, invitations (one-time codes), remove                                                        |
| `/agent/**`      | —                                       | Unknown console paths render the in-shell 404 (`[...rest]` catch-all)                                |

`app/agent/layout.tsx` is the layout for **every** `/agent` route, including the a-listings
(`/agent/listings/**`) and a-inbox (`/agent/requests/**`, `/agent/notifications`) groups
(`/agent/inquiries` only redirects to `/agent`, D5):

- It reads the session with `getServerSession()` and **does not redirect** — every page guards
  itself with its own path (`requireAgent(AGENT_ROUTES.profile)`, `requireUser('/agent/apply')` …),
  so an expired session returns to the exact deep link (`/login?returnTo=%2Fagent%2Fprofile`).
  Layout and page render in one pass (no Suspense boundary), so the page's redirect is a real 307.
  A page that forgot its guard is hidden behind `AgentSignedOut` (sign-in prompt).
- It fetches `GET /agencies/mine` once on the server and seeds the client cache
  (`agencyKeys.mine`, `HydrationBoundary`) → dashboard, profile and apply render without a skeleton
  and without a second request. Client code reads it through `useMyAgency()`.
- Sidebar entries and the mobile tab bar live in `features/a-agency/nav.ts` (`AGENT_ROUTES`,
  `AGENT_NAV`, `AGENT_TAB_BAR`). The sidebar now has **공동중개 찾기**
  (`/agent/listings/co-broker`), the topbar bell opens the console's own **`/agent/notifications`**
  (a-inbox) with an unread dot, and `/agent/notifications` has a crumb ("알림").
- Below 1024 px the sidebar collapses into the drawer (menu button); the bottom tab bar is ≤ 720 px.

## Endpoints used

| Method | Path                                        | Used by                                                                                              | Backend status                                   |
| ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| GET    | `/api/v1/agencies/mine`                     | layout (sidebar + cache seed), apply, profile, dashboard                                             | README (listed as AGENCY_OWNER) — see BLOCKING 1 |
| PATCH  | `/api/v1/agencies/mine`                     | profile save                                                                                         | README — body fields see assumption 3            |
| POST   | `/api/v1/agencies`                          | application submit (`agencyRegisterSchema`: fields + uploaded `documents` incl. 등록증 + `consents`) | README — consents see assumption 9               |
| POST   | `/api/v1/agencies/mine/documents`           | attach uploaded private documents                                                                    | README — body see assumption 4                   |
| GET    | `/api/v1/agencies/mine/members`             | staff list                                                                                           | README                                           |
| POST   | `/api/v1/agencies/mine/members`             | staff invite                                                                                         | README — body/response see assumption 5          |
| DELETE | `/api/v1/agencies/mine/members/:memberId`   | remove member / cancel invitation                                                                    | README                                           |
| POST   | `/api/v1/media?purpose=` (multipart `file`) | documents (`AGENCY_DOCUMENT`), logo/cover (`AGENCY_LOGO`)                                            | README (media)                                   |
| GET    | `/api/v1/media/:id/private`                 | "보기" link of a submitted document (new tab)                                                        | README (media)                                   |
| GET    | `/api/v1/me/notifications` (unread count)   | topbar bell dot (w-me's `useUnreadNotificationCount`)                                                | w-me                                             |

## Assumed endpoints (not in any backend README — please confirm or rename)

| Method | Path                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/agencies/mine/resubmit`  | Owner corrects a REJECTED application → back to PENDING. Body = `agencyResubmitSchema` (all fields optional; `documents` = newly uploaded files, added to the attached ones; no `consents`). Also used by the status screen's "다시 신청" after the owner only replaced documents (body = the stored application).                                                                                              |
| POST   | `/api/v1/agencies/join`           | A signed-in USER redeems a staff invite code. Body `{ code, consents }` (8 chars, A–Z/2–9; D8 consent required) → `{ agencyId, agencyName, role }`; member → ACTIVE, user role → AGENT, session `agencyId` updated. Errors: `404 AGENCY_INVITE_INVALID`, `410 AGENCY_INVITE_EXPIRED`, `409 AGENCY_ALREADY_MEMBER` (field path `code` in `details` when possible).                                               |
| GET    | `/api/v1/agencies/mine/dashboard` | One aggregate for the console home + sidebar badges (shape below). AGENT / AGENCY_OWNER of an APPROVED agency; otherwise `403 AGENCY_NOT_APPROVED`.                                                                                                                                                                                                                                                             |
| GET    | `/api/v1/geo/geocode?query=`      | Address search with coordinates for the office location (server-side Kakao Local 주소 검색 with the REST API 키, D13). `{ items: [{ roadAddress, jibunAddress?, zipCode?, buildingName?, lat, lng }] }`, max 10, `query` ≥ 2 chars. If the backend will not expose this, swap `AddressField` for the Daum postcode popup + a client geocoder — the form only needs `roadAddress`, `jibunAddress`, `lat`, `lng`. |

Listing **ad extension** ("연장") is not offered: no backend README or a-listings flow defines it.
The dashboard's "광고 만료 임박" rows open the listing ("매물 보기"). If the listings module adds an
extension endpoint (e.g. `POST /agency/listings/:id/extend`), put a confirm-dialog action on those
rows (`ListingRow` in `DashboardView.tsx`).

## Assumed payload shapes

1. **`GET /agencies/mine`** → `myAgencySchema` (or `null`, see BLOCKING 1).
   `{ id, name, representativeName, registrationNumber, businessNumber?, phone, mobile?, email?,
roadAddress, jibunAddress?, addressDetail?, zipCode?, lat, lng, intro?, businessHours?,
specialties: AssetType[], logo?: MediaDto, cover?: MediaDto, status, statusReason?, approvedAt?,
createdAt, updatedAt, activeListingCount, viewCount, warningCount, myRole: OWNER|AGENT,
documents: [{ id, type: AgencyDocumentType, mediaId, mimeType?, fileName?, createdAt }],
statusHistory: [{ id, fromStatus, toStatus, reason?, createdAt }] }`.
   **Owner-only fields** (omit / null them for staff — the mock does): `businessNumber`,
   `mobile`, `email` (the representative's private contact data), `documents`, `statusHistory`.
   The profile page shows the 휴대폰 번호 field to the owner only. `statusReason` carries the
   rejection / suspension reason shown to the applicant.
2. **`businessHours`** = the Prisma JSON `{ mon..sun: { open: "HH:mm", close: "HH:mm" } | null }`
   (closed day = `null` or missing key). The "영업 중" pill and the one-line summary are computed
   client-side in Asia/Seoul (`features/a-agency/lib/business-hours.ts`).
3. **`PATCH /agencies/mine`** — the profile page sends **only the fields the owner changed**
   (`buildProfilePatch` in `features/a-agency/lib/profile.ts`), never `null` for untouched fields:
   - always `specialties` — **zod 4 still applies `.default([])` inside `.partial()`**, so
     `agencyUpdateSchema.parse({ intro: 'x' })` yields `specialties: []`. A handler that writes the
     parsed body would wipe the specialties on every PATCH that omits them. Either drop the default
     from the update schema or keep this client behaviour.
   - `intro: string` — `''` clears it (accepted by the shared schema as is).
   - `phone`, `mobile` — `mobile: null` clears the number. **Required change:**
     `agencyUpdateSchema.mobile` → `phoneSchema.nullable().optional()` (today `null` → 400).
   - **Required additions to `agencyUpdateSchema`:** `businessHours` (shape 2, nullable),
     `logoMediaId: string | null`, `coverMediaId: string | null`. `z.object` strips unknown keys, so
     without them hours and logo are silently dropped. The client compares the response with what
     it sent and shows an error toast ("영업시간·로고이(가) 저장되지 않았어요") instead of a false
     success, keeping the draft.
   - There is **no cover image** in the Prisma model (`logoMediaId` only) and no `AGENCY_COVER`
     media purpose — the page uploads the cover with purpose `AGENCY_LOGO`. **Media presets:**
     `AGENCY_LOGO` needs a square, `fit: inside` variant (the generic `thumb` is a 320×240 cover crop
     that cuts wordmarks; the UI uses `medium` with `object-fit: contain`). A 1600×500 cover uploaded
     as `AGENCY_LOGO` gets logo presets — add an `AGENCY_COVER` purpose, or drop the cover block in
     `ProfileView.tsx` / `ProfilePreview.tsx` (one section each) if covers are out of scope.
     Media processing is asynchronous (no variants until READY): the UI shows a local object-URL
     preview of the picked file meanwhile.
   - The mock validates with `agencyUpdateSchema.extend({ mobile nullable, businessHours,
logoMediaId, coverMediaId })` — i.e. the shared schema plus exactly the additions above.
     Response: the updated `myAgencySchema` object. 상호 / 소재지 / 대표자 are shown read-only.
4. **`POST /agencies/mine/documents`** body `{ type: AgencyDocumentType, mediaId, fileName? }` →
   the created document `{ id, type, mediaId, mimeType?, fileName?, createdAt }`. Flow: files are
   uploaded to `POST /media?purpose=AGENCY_DOCUMENT` as soon as they are picked; after
   `POST /agencies` succeeds the media ids are attached (in parallel). If an attach fails the
   application still exists as PENDING and the status screen offers the missing slots ("서류 보완
   필요"). The UI treats the **latest document per type** as current (re-uploads supersede).
   Must be allowed for the owner while PENDING or REJECTED, **and while APPROVED for the
   보증서류 (renewal, "갱신본 제출")**.
   Slots: `REGISTRATION_CERT` (필수), `BUSINESS_REG_CERT` (필수), **손해배상책임 보증서류
   (공제증서 · 보증보험증권), 권장** — review may be held without it, as in the admin design
   ("3종 확인" / "공제증서 누락 → 보완 요청") — and `BROKER_LICENSE` (선택). Until a dedicated
   **`DEDUCTION_CERT`** AgencyDocumentType exists the 보증서류 travels as **`OTHER`** (the admin
   console already labels OTHER "공제증서 등 기타"); there is no separate "기타" slot any more.
   **REJECTED:** a document replaced after the rejection is not reviewed until the owner resubmits;
   the status screen then shows "서류를 바꿨어요. 다시 신청해야 재심사가 시작돼요" with a
   **다시 신청** button (confirm dialog → `POST /agencies/mine/resubmit` with the stored data).
   사업자등록번호 is required in the form (optional in `agencyRegisterSchema`) and checked with
   the 국세청 check-digit algorithm before submit. The office pin must lie inside 순천시
   (bbox 34.80–35.15 N, 127.18–127.65 E; `features/a-agency/lib/location.ts`) — please validate the
   same on the server.
5. **Members** — `GET` returns `{ items: Member[] }` (a bare array is accepted too) with ACTIVE and
   INVITED members: `{ id, userId?, role: OWNER|AGENT, status, displayName, title?, phone?,
isLicensed, licenseNumber?, joinedAt?, inviteCode?, inviteExpiresAt?, activeListingCount? }`.
   `POST` body `{ displayName, title?, isLicensed, licenseNumber?, phone? }` — **blank optional
   fields are omitted, never sent as `''`**, and `licenseNumber` only when `isLicensed`
   (`toInvitePayload` in `features/a-agency/lib/staff.ts`; the mock validates with the strict
   `inviteMemberPayloadSchema`, `phone` = shared `phoneSchema.optional()`). Creates an **INVITED**
   member and returns it with an `inviteCode` (8 chars, shown as `ABCD-EFGH`) and
   `inviteExpiresAt` (7 days). The invitee redeems it through `POST /agencies/join`. `DELETE`
   removes an ACTIVE member or cancels an invitation (204); the owner cannot be removed
   (`409 AGENCY_OWNER_NOT_REMOVABLE` in the mock). Owner only → `403` for AGENT.
6. **Dashboard** → `agencyDashboardSchema`:
   `{ listings: { active, reserved, draft, closed30d, coBrokered },
views: { total7d, changeRatio: number|null, daily: [{ date: "YYYY-MM-DD", views }], profileViews7d, favorites7d },
dealRequests: { newCount, newSellCount, newWantedCount, items: [{ id, type: DealRequestType, title, summary, createdAt, proposed }] },
expiringListings: [{ id, title, summary?, dealType, price?, deposit?, monthlyRent?, expiresAt, verifiedAt? }],
verificationDue: [{ …same, verifiedAt?, verificationDueAt }] }`.
   `newSellCount` / `newWantedCount` split `newCount` by type (the `items` feed is truncated, so the
   client cannot count it); the KPI chips are hidden when they are absent. `verificationDue`
   includes **overdue** listings (shown "n일 지남", same helper as a-listings). Money is 만원.
   The API also sends `inquiries: { unreadCount: 0, items: [] }` (D5: no inquiry backend for
   launch); the schema does not read it and the console has no inquiry widget. Sidebar / tab-bar
   badges: `dealRequests.newCount`, `verificationDue.length`.
   Deep links: 실매물 확인 KPI / "전체" → `/agent/listings?due=1&sort=VERIFY_DUE`, "확인 기록" →
   `/agent/listings/:id/edit?step=verify`. If the backend
   prefers separate endpoints, only `fetchDashboard()` in `features/a-agency/api/queries.ts` has to
   change.
7. **Duplicate registration** — `409 AGENCY_REGISTRATION_DUPLICATE` is mapped to the 등록번호 field.
   Other validation errors use `details[].path` = register field names.
8. **Role change after approval / join** — the frontend expects the session role to become
   AGENCY_OWNER (approval) or AGENT (join) without re-login (`SessionService.update`). After a
   successful join the page does a full navigation to `/agent` so every server guard re-runs.
   **사무소 나가기** (소속 중개사 only — the account menu of the console top bar shows it when
   `myRole === AGENT`): confirm dialog → `POST /agencies/membership/leave` (204; the server sets the
   session to role USER without an acting agency and hands the member's ads to the 대표; the owner
   gets `400 AGENCY_OWNER_NOT_REMOVABLE`) → every cached query except the session is dropped, the
   session is re-read, then `router.replace('/agent/apply')` + `router.refresh()` so the console
   layout re-resolves the user on the server and shows the apply / join state
   (`shell/LeaveAgencyDialog.tsx`; mock `agencies/membership/leave/route.ts` switches the mock
   session to USER).
9. **Consents** — the application form has two separate required checkboxes: a truthfulness
   declaration ("입력 내용과 제출 서류가 사실과 같습니다") and **[필수] 개인정보 수집·이용 동의**
   with an inline notice (items, purpose, retention, right to refuse). The join form has the same
   privacy consent. **Implemented (D8, stage-1 gate):** `registerAgency` / `joinAgency` read the
   current version from `GET /terms/:type` (`fetchActionConsents` in `src/lib/api/consents.ts`) and
   send `consents: [{ type: 'PRIVACY_AGENCY_APPLICATION' | 'PRIVACY_AGENCY_JOIN', version }]`; the
   server records it with the application / membership. The resubmit takes no consents. The wording, items and
   retention periods (`APPLICATION_PRIVACY_NOTICE` / `JOIN_PRIVACY_NOTICE` in
   `features/a-agency/lib/application.ts`) need legal review before launch.

## Schema changes required

| Area                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff invitations (`agencies.prisma`)    | `AgencyMember.userId` is NOT NULL with `@@unique([agencyId, userId])` and there are no invite columns, but an invitation exists **before** the invitee has a user. Either make `userId` nullable (+ `inviteCodeHash`, `inviteExpiresAt`, `invitedBy`), or — preferred — add **`AgencyInvite`** `{ id, agencyId, displayName, title?, isLicensed, licenseNumber?, phone?, code (or codeHash), expiresAt, createdBy, redeemedByUserId?, redeemedAt?, revokedAt? }` and create the `AgencyMember` on redeem. The members list returns invites as `status: INVITED` rows.      |
| Invite code readability                  | The staff page shows a persistent **"코드 복사"** chip on each pending invitation, so the owner must be able to **re-read** the code until it is redeemed or expires (store it encrypted, not only hashed; it is single-use: redeemable once, by one person, within 7 days). If the backend only keeps a hash, the code is shown once after `POST` and the list needs a **"코드 재발급"** action instead (`POST /agencies/mine/members/:id/reissue` → new code) — `StaffView.tsx` only has to swap the copy chip for that button. Never return `inviteCode` to non-owners. |
| `agencyUpdateSchema` (`packages/shared`) | `mobile` nullable; add `businessHours`, `logoMediaId`, `coverMediaId` (assumption 3); consider removing the `specialties` default for updates.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `agencyRegisterSchema` / join body       | add `consents: { type, version }[]` and persist it (assumption 9).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `AgencyDocumentType` (`packages/shared`) | add `DEDUCTION_CERT` (손해배상책임 보증서류) and switch `DEDUCTION_CERT_TYPE` in `features/a-agency/lib/application.ts` to it (assumption 4).                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Media purposes                           | square `inside` preset for `AGENCY_LOGO`; `AGENCY_COVER` if covers stay (assumption 3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Dashboard aggregate                      | `newSellCount`, `newWantedCount` (assumption 6).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Mock resources (apps/web/src/app/mock-api/v1)

Owned by this group:

- `agencies/route.ts` — `POST` (register). The `GET` (public search) in the same file belongs to
  w-agencies.
- `agencies/mine/**` — `route.ts` (GET, PATCH), `resubmit/`, `documents/`, `members/`,
  `members/[memberId]/`, `dashboard/`, `_store.ts` (in-memory state on `globalThis`), `_fixtures.ts`,
  `_register.ts`.
- `agencies/join/route.ts` — also switches the mock session cookie to the AGENT fixture user.
- `geo/geocode/route.ts` + `geo/_fixtures.ts` — 18 fictional Suncheon addresses.
- `media/[id]/private/route.ts` — added to the media resource created by another group
  (`media/_store.ts`, `media/route.ts`, `media/[id]/**` are theirs).

Mock sessions: `USER` = applicant (no agency until the form is submitted), `AGENT` /
`AGENCY_OWNER` = staff / owner of the approved fixture office (B01 신대중앙 공인중개사사무소).
Demo data: duplicate 등록번호 `46150-2017-00112`; valid invite code `K7MQ-4RXD` (pending invitation
of the fixture office). The dashboard fixture has one overdue 실매물 확인 ("2일 지남").

### Mock-only route (no backend counterpart)

`GET /mock-api/v1/agencies/mine/dev-state?status=NONE|PENDING|PENDING_DOCS|REJECTED|APPROVED|SUSPENDED[&dashboard=empty|full][&reset=1][&returnTo=/agent/apply]`
puts the mock USER's application into a state so every screen of `/agent/apply` can be opened;
`dashboard=empty` shows the dashboard empty states; `reset=1` restores all agencies fixtures.
`GET /agencies/mine/dashboard?_empty=1` / `?_fail=1` force the empty / error response.

## Notes for the integrator

- Routing: there is intentionally **no `app/agent/loading.tsx`** — a segment-level Suspense
  boundary would start streaming before the page guard and turn its redirect into a client-side
  one. Sibling groups can add `loading.tsx` in their own deeper segments.
- Every console page **must** call `requireAgent(<its own path>)` (or `requireUser` for
  `/agent/apply`): the layout no longer redirects, so the page's guard is what sends an expired
  session to `/login?returnTo=<that page>`.
- Server requests per console page: `/auth/me` is requested by the layout (`getServerSession`) and
  again by the page guard — `lib/auth/server.ts` (foundation) should wrap `getServerSession` in
  React `cache()` to share one call per request (`apiFetch` always passes an AbortSignal, so Next's
  fetch memoisation does not apply).
- Non-agents: the layout allows any signed-in user (for `/agent/apply`); `AgentShell` shows a
  "중개사 회원 전용" gate on every other console path and redirects to `/agent/apply`. The API must
  still enforce AGENT / AGENCY_OWNER on every console endpoint.
- Unsaved edits on `/agent/profile`: reload / close → browser prompt; in-app links (sidebar, tab
  bar, header) → confirm dialog (`useUnsavedChangesGuard` in `features/a-agency/lib/`, reusable
  by a-listings). Browser Back is not intercepted (the App Router offers no blocking API).
- Private documents are opened with a plain link to `/api/v1/media/:id/private` (cookie auth, new
  tab). The endpoint should answer with `Content-Disposition: inline`, `X-Content-Type-Options:
nosniff` and `Cache-Control: private, no-store`.
- Phone numbers are plain validated fields (`contactPhoneSchema` / `phoneSchema`); nothing is
  verified and no SMS is implied anywhere in this group.
- The office position is picked by moving the map under a fixed centre pin (`LocationPicker`),
  which works identically on the Kakao map and the static fallback; coordinates are rounded to
  5 decimals. In the form the map does not trap scrolling: a plain mouse wheel scrolls the page
  (Ctrl/⌘ + wheel zooms), on touch screens the map is inert until tapped ("눌러서 위치 조정하기"),
  a pan only counts at zoom ≥ 15 and only inside 순천시.
- 직원 관리 shows two legal reminders as static copy: 고용·고용관계 종료 신고 (공인중개사법 제15조) and
  the 중개보조원 limit (5 × 개업·소속 공인중개사). Please have the wording reviewed before launch.
