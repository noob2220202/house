# Frontend integration notes — w-auth (login, OAuth landing, signup completion, account settings, withdrawal)

Scope: `apps/web/src/features/w-auth/**`, the routes below, and the mock resources listed at the end.
Design reference: `design/drafts/project/Login.dc.html`. Conventions: `docs/FRONTEND.md`.

## Routes

| Path              | File                                     | Notes                                                                                                                                                                                                                                                         |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`          | `src/app/(auth)/login/page.tsx`          | Public, full metadata (the foundation's `robots.ts` disallows `/login` and `/signup` for crawlers). `?returnTo=<path>` · `?as=agent` (중개사 회원) · `?reason=expired\|logout\|required`. Failed social login: `?error=<code>[&withdrawable=1]` → error card. |
| `/auth/callback`  | `src/app/(auth)/auth/callback/page.tsx`  | OAuth landing of a successful login: `?next=<path>&provider=kakao\|naver\|google&intent=agent` (a stray `?error=` is forwarded to `/login`).                                                                                                                  |
| `/signup`         | `src/app/(auth)/signup/page.tsx`         | Social signup: the backend sends first-time members to `?provider=<slug>` with a pending signup cookie and no session.                                                                                                                                        |
| `/auth/withdraw`  | `src/app/(auth)/auth/withdraw/page.tsx`  | 회원 탈퇴 of a suspended member (no session, ticket cookie from the refused login).                                                                                                                                                                           |
| `/auth/withdrawn` | `src/app/(auth)/auth/withdrawn/page.tsx` | Farewell page after withdrawal (public, noindex).                                                                                                                                                                                                             |
| `/me/account`     | `src/app/(me)/me/account/page.tsx`       | 계정 설정: linked accounts, consent history, logout / logout-all, withdrawal entry. Inside the w-me `/me` layout.                                                                                                                                             |
| `/me/withdraw`    | `src/app/(me)/me/withdraw/page.tsx`      | 회원 탈퇴 flow. Inside the w-me `/me` layout.                                                                                                                                                                                                                 |

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

## Flow (real auth module, WI-2 — 2026-11-24)

1. `/login` builds `GET /api/v1/auth/oauth/{provider}/start?returnTo=<landing>` where
   `<landing>` = `/auth/callback?next=<original target>&provider=<slug>[&intent=agent]`
   (`buildCallbackPath`, clamped to the backend's 500-char `returnTo` limit). Full-page navigation.
   Clicking a provider also keeps `{ intent, next }` in `sessionStorage` (`lib/login-context.ts`).
2. Known member: the backend sets the session and redirects to our landing; `/auth/callback`
   verifies the session (`GET /auth/me`) and continues to `/agent/apply` (중개사 회원 without an
   agency), `/agent` or the target. It stores the provider for the "최근 사용" hint.
3. First-time member: the backend redirects to **`/signup?provider=<slug>`** with an httpOnly pending
   signup cookie (scoped to `/api/v1/auth/signup`) and **no session**. `/signup` loads
   `GET /auth/signup` in the browser (prefill + current account terms), asks 만 14세 이상 (required,
   covered by 전체 동의), every current document (MARKETING optional) and a nickname (backend rule:
   2–20, 한글·영문·숫자·`_ . -`, no spaces), then `POST /auth/signup
{ nickname, ageOver14: true, consents[], marketingOptIn }`. The answer (`{ user, returnTo,
csrfToken }`) seeds the session cache; `returnTo` (our landing path) gives the destination and
   intent. The optional 관심 지역 are saved afterwards with the new session. 401 →
   "가입 시간이 지났어요", `AUTH_REJOIN_COOLDOWN` → blocking notice, `AUTH_TERMS_INVALID` → reload
   the terms and ask again. No marketing channel choice: the backend stores one `marketingOptIn`.
4. Failures: the backend redirects to **`/login?error=<AuthErrorCode>`**; `/login` then renders the
   error card (copy in `lib/oauth-errors.ts`). `AUTH_ACCOUNT_SUSPENDED&withdrawable=1` adds
   "회원 탈퇴 진행" → **`/auth/withdraw`** (suspended withdrawal: `POST /auth/withdraw
{ confirm: true, reason? }` with the 10-minute ticket cookie) → `/auth/withdrawn`.
5. Link: `start?returnTo=/me/account&intent=link`; the backend returns `/me/account?linked=<slug>`
   or `/me/account?error=<code>` (`AUTH_IDENTITY_DUPLICATE`, `AUTH_PROVIDER_ALREADY_LINKED`, …),
   shown as a callout on 계정 설정. Unlink: `DELETE /me/identities/:provider` → remaining list,
   `409 AUTH_LAST_IDENTITY`.
6. Session (`lib/auth/types.ts`): `sessionUserSchema` parses `MeResponse` — `nickname` null →
   display "회원" (`hasNickname=false`), `agencyId` ← `agency.agencyId`, `signupCompleted` always
   true (a session exists only after signup), `pendingRequiredTerms`, `marketingOptInAt`.
   `fetchSessionUser` skips the request when the readable `house_csrf` cookie (always set and
   cleared together with the session cookie) is absent, so anonymous visitors log no 401.
7. Re-consent: when `pendingRequiredTerms` is non-empty the `SessionProvider` opens
   `ReconsentDialog` (once per tab and set of documents, not on auth/terms/withdraw pages, and only
   while no other modal is open) and any mutation refused with `403 AUTH_TERMS_REQUIRED` opens it
   again. It posts `POST /me/consents` for the pending documents only. 약관 동의 내역 offers
   "동의하기" for them.

## Endpoints used

| Method | Path                                                                               | Used by                          |
| ------ | ---------------------------------------------------------------------------------- | -------------------------------- |
| GET    | `/auth/oauth/{provider}/start`                                                     | login, link (`intent=link`)      |
| GET    | `/auth/me`                                                                         | session, landing, guards         |
| GET    | `/auth/signup` · POST `/auth/signup`                                               | signup                           |
| POST   | `/auth/logout` · `/auth/logout-all`                                                | 계정 설정                        |
| POST   | `/auth/withdraw`                                                                   | suspended member's withdrawal    |
| GET    | `/terms` · `/terms/:type[?version=]`                                               | re-consent, terms modal, history |
| GET    | `/me/consents` · POST `/me/consents`                                               | 약관 동의 내역, re-consent       |
| PATCH  | `/me/profile` (→ `MeResponse`)                                                     | (w-me profile form)              |
| GET    | `/me/identities` · DELETE `/me/identities/:provider`                               | 로그인 계정                      |
| POST   | `/me/withdraw` `{ confirm: true, reason? }`                                        | 회원 탈퇴                        |
| PUT    | `/me/interest-regions` (frontend contract, built by the backend to the mock shape) | signup                           |

## Mock resources (`apps/web/src/app/mock-api/v1`)

Mocks follow the real contract above. `auth/_state.ts` keeps pending signups, withdrawal tickets and
consents; `auth/signup`, `auth/withdraw` are new. Mock-only start parameters
(`/mock-api/v1/auth/oauth/{provider}/start`): `as=user|agent|owner`, `as=new` (pending signup),
`as=auto` (new on the first visit of a browser), `as=reconsent` (PRIVACY not agreed),
`as=suspended`, `fail=<code>` (`access_denied` → `AUTH_OAUTH_CANCELLED`). In mock mode `/login`
shows these as a dashed "MOCK" row. `GET /me/profile` is mock-only (the backend has no GET there).

## Shared pieces for other groups (`@/features/w-auth`)

`AUTH_ROUTES`, `LinkedAccountsPanel` (summary by default — used on 내 정보; `manage` = link / unlink on 계정 설정), `ConsentHistoryPanel`,
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
