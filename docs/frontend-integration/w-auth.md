# Frontend integration notes — w-auth (login, OAuth landing, signup completion, account settings, withdrawal)

Scope: `apps/web/src/features/w-auth/**`, the routes below, and the mock resources listed at the end.
Design reference: `design/drafts/project/Login.dc.html`. Conventions: `docs/FRONTEND.md`.

## Routes

| Path              | File                                     | Notes                                                                                                                                                                                     |
| ----------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`          | `src/app/(auth)/login/page.tsx`          | Public, full metadata (the foundation's `robots.ts` disallows `/login` and `/signup` for crawlers). `?returnTo=<path>` · `?as=agent` (중개사 회원) · `?reason=expired\|logout\|required`. |
| `/auth/callback`  | `src/app/(auth)/auth/callback/page.tsx`  | OAuth landing. `?next=<path>&provider=kakao\|naver\|google&intent=agent` on success, `?error=<code>` on failure.                                                                          |
| `/signup`         | `src/app/(auth)/signup/page.tsx`         | Signup completion for `signupCompleted=false` users. `?returnTo=&provider=&intent=`.                                                                                                      |
| `/auth/withdrawn` | `src/app/(auth)/auth/withdrawn/page.tsx` | Farewell page after withdrawal (public, noindex).                                                                                                                                         |
| `/me/account`     | `src/app/(me)/me/account/page.tsx`       | 계정 설정: linked accounts, consent history, logout / logout-all, withdrawal entry. Inside the w-me `/me` layout.                                                                         |
| `/me/withdraw`    | `src/app/(me)/me/withdraw/page.tsx`      | 회원 탈퇴 flow. Inside the w-me `/me` layout.                                                                                                                                             |

`(auth)` pages use `AuthShell` (no site header / tab bar, mini footer from the design). Extra route
constants: `AUTH_ROUTES` in `src/features/w-auth/routes.ts`.

Deviations from the design draft (owner decisions): **no Apple button, no e-mail / password form, no
"아이디·비밀번호 찾기"** — the only login methods are 카카오 / 네이버 / Google. The marketing channel
checkboxes (앱 푸시 · 문자 · 이메일) are dropped: the backend stores one `marketingOptIn` flag and the
platform sends no SMS. A nickname field was added to the 약관 동의 card (required by the scope). The
중개사무소 인증 form of the draft lives on `/agent/apply` (a-agency group); signup only shows the
explanatory card and links to it.

Responsive notes: the draft stacks the split login below 1100px; the implementation keeps the split
down to 961px (tighter gutters, smaller moon) so the login card stays above the fold on a 1024px
tablet, and from 960px down stacks with the compact brand band of the mobile draft. The 관심 지역 mini
map shows the same band of the map at every card width (height follows the width, min 176px) and
clamps the pins of regions near the map edge.

## Flow

1. `/login` builds `GET /api/v1/auth/oauth/{provider}/start?returnTo=<landing>` where
   `<landing>` = `/auth/callback?next=<original target>&provider=<slug>[&intent=agent]`
   (`buildCallbackPath`, clamped to the backend's 500-char `returnTo` limit). Full-page navigation.
2. The backend finishes the provider round trip and redirects to `returnTo` (our landing) with the
   session cookie set.
3. `/auth/callback` verifies the session on the server (`GET /auth/me`) and continues to:
   - `/signup?returnTo=…` when `signupCompleted === false`,
   - `/agent/apply` when the member chose 중개사 회원 and is not an agent yet (`/agent` or the target when already an agent),
   - otherwise the original target (never an auth page; site-relative only).
     It also stores the provider in `localStorage` (`house:auth:recent-provider`) for the "최근 사용" hint.
4. `/signup` posts consents → profile → interest regions, refreshes the session and shows step 3.
5. `requireUser()` (`src/lib/auth/server.ts`) now also redirects `signupCompleted === false` users to
   `/signup?returnTo=…`, so protected pages are never reachable before the required terms are agreed.

## Endpoints used (listed in `apps/api/src/modules/auth/README.md`)

| Method | Path                                              | Used by                                        | Shape used by the frontend                                                                                        |
| ------ | ------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/auth/oauth/{kakao\|naver\|google}/start` | login buttons, account linking                 | `?returnTo=<site-relative path, ≤ 500>`                                                                           |
| GET    | `/api/v1/auth/me`                                 | landing, signup, guards                        | `SessionUser` incl. `signupCompleted` (see foundation.md)                                                         |
| POST   | `/api/v1/auth/logout`                             | 로그아웃                                       | —                                                                                                                 |
| POST   | `/api/v1/auth/logout-all`                         | 모든 기기에서 로그아웃                         | — (the current session is destroyed too; the client then navigates to `/login?reason=logout`)                     |
| GET    | `/api/v1/terms`                                   | signup                                         | current document per type: `[{ id, type, version, title, isRequired, effectiveAt }]` (bare array or `{ items }`)  |
| GET    | `/api/v1/terms/:type`                             | "보기" modal (`type` = `SERVICE` …, uppercase) | same + `content` (plain text, rendered with `white-space: pre-wrap`, never as HTML)                               |
| GET    | `/api/v1/me/consents`                             | 약관 동의 내역                                 | latest record per current document: `[{ termsDocumentId, type, version, title, isRequired?, agreed, createdAt }]` |
| POST   | `/api/v1/me/consents`                             | signup                                         | `consentInputSchema`: `{ consents: [{ termsDocumentId, agreed }] }` — one entry per current document              |
| PATCH  | `/api/v1/me/profile`                              | signup (nickname, marketingOptIn)              | `updateProfileSchema`                                                                                             |
| POST   | `/api/v1/me/withdraw`                             | 회원 탈퇴                                      | `withdrawSchema`: `{ reason? }` (≤ 500 chars: "선택 사유 — 자유 입력")                                            |

## Assumed endpoints / behaviours (reconcile when the auth controllers land)

1. **Callback redirect contract.** After `GET /auth/oauth/{provider}/callback` the backend redirects to
   the `returnTo` given at start (our `/auth/callback?...`). On failure it must redirect to
   **`/auth/callback?error=<code>[&provider=<slug>]`** — `<code>` is an `AuthErrorCode`
   (`AUTH_OAUTH_STATE_INVALID`, `AUTH_OAUTH_PROVIDER_ERROR`, `AUTH_ACCOUNT_SUSPENDED`, …) or the raw
   OAuth2 `error` (`access_denied`, `server_error`, …). Unknown codes fall back to a generic message.
   All copy lives in `src/features/w-auth/lib/oauth-errors.ts`. The code is shown small for support
   only when it is a known code or looks like one (letters and single underscores, ≤ 40) — anything
   else is shown as `UNKNOWN`, so a crafted link cannot print text or a phone number on our page.
   When the failed round trip was a **link** (item 7) the redirect must also carry **`&link=1`**: the
   page then says "계정 연결을 취소했어요 / 계정을 연결하지 못했어요" and offers "계정 설정으로" instead of
   "다시 로그인".
2. **`signupCompleted`** on `GET /auth/me`: `false` until every required current terms document is
   agreed; becomes `true` after `POST /me/consents`. A new required version should flip it back to
   `false` (re-consent) — the signup page then works as the re-consent screen.
3. **`POST /me/consents`** answers `400 AUTH_TERMS_REQUIRED` when a required document is not agreed
   (the form shows the message inline). The MARKETING consent is also sent as `marketingOptIn` in the
   following `PATCH /me/profile`; the backend should keep both in sync.
4. **`GET/PUT /api/v1/me/interest-regions`** (new, not in the README):
   `{ regionKeys: string[] (max 5), notify: boolean }`. `regionKeys` are the stable keys of
   `src/features/w-auth/lib/regions.ts` (`sindae`, `seonwol`, `yeonhyang`, …: 순천 생활권 단위, grouped
   신도시·택지 / 도심 / 대학가 / 읍·면). If the backend prefers 법정동 codes, map them in that file. A
   failure of this call does not block the signup (toast only).
5. **`GET /api/v1/me/identities`** → `[{ id?, provider, email?, lastUsedAt?, createdAt? }]` (bare or
   `{ items }`); same schema and query key (`['me-identities']`) as the w-me group.
6. **`DELETE /api/v1/me/identities/{kakao|naver|google}`** — unlink one provider;
   `409 AUTH_IDENTITY_LAST` when it is the only login method (the UI already disables the button).
7. **Linking another provider**: `GET /auth/oauth/{provider}/start?returnTo=/me/account?linked=<slug>&link=1`
   while signed in adds the identity to the current user instead of logging in. If that identity
   belongs to another user the backend should redirect to `/auth/callback?error=AUTH_IDENTITY_ALREADY_LINKED&link=1`.
   (Accounts are never auto-linked by e-mail.) Security: the link `state` must be bound to the
   current session (a link started in one session must never complete in another), and the
   `?linked=<slug>` return is only a hint — the settings page confirms "연결했어요" only when
   `GET /me/identities` really contains that provider.
8. **`GET /api/v1/terms/:type/versions/:version`** (shared with w-content, see `w-content.md`):
   the 약관 동의 내역 "보기" opens **the version the user agreed to** (`record.version`), not the
   current document. Shape = the `/terms/:type` document (`isRequired` may be omitted).
9. **Interest-region keys vs 법정동 codes.** Every other region field of the backend is a 법정동 code
   (`regionCodeSchema`: deal requests, listings, ads). `regionKeys` are 생활권 keys because 신대·선월지구
   are parts of 해룡면 (리 level) — if the backend models interest regions as codes, add a `codes`
   array per entry in `lib/regions.ts` (one key can map to several 리/동 codes) and send those.
10. **Extra error codes** the UI knows but `AuthErrorCode` does not define yet: `AUTH_ACCOUNT_WITHDRAWN`
    (login with a withdrawn account before the PII scrub), `AUTH_IDENTITY_ALREADY_LINKED`,
    `AUTH_IDENTITY_LAST`, `AUTH_WITHDRAW_AGENCY_OWNER` (any `409` on `POST /me/withdraw` is shown as a
    blocking notice with the server message; the form also blocks `AGENCY_OWNER` up front).
11. **Withdrawal copy** mentions "개인정보처리방침에서 정한 기간" for the PII scrub — no number is shown,
    so it stays correct whatever `piiScrubAfter` is.
12. `GET /terms` is fetched on the server with `revalidate: 300` and tag `terms`.

## Mock resources (`apps/web/src/app/mock-api/v1`)

| Path                                         | Owner              | Notes                                                                                                         |
| -------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `terms/route.ts`, `terms/[type]/route.ts`    | w-auth             | Fixtures in `terms/_fixtures.ts` (placeholder texts, versions 1.0 / 1.1).                                     |
| `me/consents/route.ts`                       | w-auth             | Completes the mock signup (sets `house_mock_signup=done`).                                                    |
| `me/interest-regions/route.ts`               | w-auth             | Assumed endpoint.                                                                                             |
| `me/identities/[provider]/route.ts`          | w-auth             | DELETE; mutates the w-me in-memory store (`me/_store.ts`).                                                    |
| `me/withdraw/route.ts`                       | w-auth             | 409 for the mock `AGENCY_OWNER`.                                                                              |
| `auth/logout-all/route.ts`, `auth/_state.ts` | w-auth             | Mock signup cookie + consent / region state.                                                                  |
| `auth/me/route.ts`                           | foundation, edited | Now reflects profile edits from the `/me` mocks and `signupCompleted` from the mock cookie.                   |
| `auth/oauth/[provider]/start/route.ts`       | foundation, edited | Keeps `as=user\|agent\|owner` (default user). Added `as=new`, `as=auto`, `fail=<code>`, `link=1` (see below). |

Mock-only parameters of the fake login (`/mock-api/v1/auth/oauth/{provider}/start`):

- `as=new` — first-time user (`signupCompleted=false`) → the landing sends them to `/signup`.
- `as=auto` — what the `/login` buttons send in mock mode: new user on the first visit of a browser, member afterwards.
- `fail=<code>` — redirects to `/auth/callback?error=<code>` (e.g. `access_denied`, `AUTH_OAUTH_STATE_INVALID`).
- `link=1` — adds the provider to the signed-in mock user.
- Any `/me/**` mock answers 500 with `?_fail=1`; `terms` mocks too.

In mock mode `/login` shows a small dashed "MOCK" row with these shortcuts (never rendered against the real API).

## Shared pieces for other groups (`@/features/w-auth`)

`AUTH_ROUTES`, `LinkedAccountsPanel` (link / unlink, self-contained), `ConsentHistoryPanel`,
`SessionPanel`, `WithdrawEntry`, `ProviderMark`, `loginPath()`, `signupPath()`, `oauthLoginUrl()`,
`maskEmail()`, `maskName()`.

## Files outside the group folder that were touched

- `src/lib/auth/paths.ts` — added `signupUrl()`.
- `src/lib/auth/server.ts` — `requireUser()` redirects unfinished signups to `/signup`.
- `src/app/mock-api/v1/auth/me/route.ts`, `src/app/mock-api/v1/auth/oauth/[provider]/start/route.ts` — see above.
- `src/middleware.ts` — unchanged (already protects `/me/**`, `/agent/**`, `/deal/sell/**`, `/deal/find/**`).

## Tests and manual checks

- Unit / component tests (Vitest): `src/features/w-auth/lib/*.test.ts` (flow routing and open-redirect
  rules, consents, regions, masking, OAuth error copy, nickname and withdrawal schemas) and
  `src/features/w-auth/components/**/*.test.tsx` (login panel, callback error, terms agreement, region
  picker, steps, linked accounts, withdrawal form).
- Browser flows against the mock API (Playwright, dev server on port 3107): `.tmp/w-auth/e2e.mjs`
  (middleware redirects, returnTo round trip, 최근 사용, 중개사 routing, error landing, account error /
  empty states, 409 on withdrawal); `.tmp/w-auth/shots.mjs <scenario> <width>` takes the screenshots.

## Review fixes (independent review, 2026-11-24)

- `safeNext` resolves dot segments the way a browser does before deciding (`/..//evil.example` →
  `//evil.example` → rejected; `/me/../login` → rejected as an auth page). Same-origin before too, but
  the target is now canonical before it is handed to the router or the backend.
- OAuth landing: unknown error codes are no longer echoed verbatim (see Assumed 1); a failed account
  link reads as a link and returns to 계정 설정 (`&link=1`, Assumed 7). The mock start route passes
  `link=1` through with `fail=`.
- 약관 동의 내역 → "보기" shows the agreed version (`exactVersion` on `TermsModal`, Assumed 11), and the
  card links "내 정보" for the marketing switch.
- `?linked=<slug>` toast only after the identity list confirms it; only that query param is removed
  from the URL (the panel is also embedded on `/me/profile`).
- 회원 탈퇴: a blocked account (대표 계정 up front, or any `409`) sees the notice first, above the fold,
  and the reason / consent fields it cannot use are not rendered; after a `409` focus moves to the notice.
- 전체 동의 uses the native `indeterminate` state (a real checkbox ignores `aria-checked="mixed"`).
- "나중에 선택" (or no region chosen) no longer sends an empty `PUT /me/interest-regions`.
- The 계정 설정 withdrawal card title is a heading; "최근 사용" is a separate word in the button's name;
  copy no longer attaches a particle to the swappable brand name ("{BRAND} 서비스를").

## Known gaps (not owned by this group)

- `ROUTES.support` (`/support`) has no page yet, so the 고객센터 links on the login card, the error
  landing and the mini footer answer 404 until a group builds it.
- The linked-accounts and consent mocks keep their state per mock role in memory, so two browsers
  signed in with the same mock role see each other's changes.
