# Auth module (`apps/api/src/modules/auth`)

Social login (카카오 / 네이버 / Google **only** — no Apple, no SMS, no phone verification), server-side
sessions, CSRF, member account (profile, identities, consents, withdrawal), terms read API, and
back-office login (email + argon2id + mandatory TOTP).

## Layout

| Path                  | What                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session/`            | `SessionService` (Redis sessions, SESSION_RESOLVER): opaque 256-bit token cookie, SHA-256 id, sliding + absolute expiry, per-subject index (list / revoke one / logout-all), CSRF token     |
| `oauth/`              | `OAuthProvider` interface + `OAUTH_PROVIDERS` registry, Kakao / Naver / Google providers, `GoogleIdTokenVerifier` (JWKS, RS256, iss/aud/exp/nonce), state store, `OAuthService`, controller |
| `oauth/oauth-http.ts` | `OAUTH_HTTP` — the only network boundary; e2e replaces it with `test/e2e/auth/fakes/fake-oauth-http.ts`                                                                                     |
| `signup/`             | pending social signup (Redis, httpOnly cookie) → `POST /auth/signup` with terms consents                                                                                                    |
| `users/`              | `/auth/me`, `/me/*` (profile, identities, consents, withdraw), `UserSessionService` (session start + acting agency)                                                                         |
| `terms/`              | current terms documents + append-only `UserConsent` records; `TermsConsentGuard` (global) + `@SkipTermsCheck()`                                                                             |
| `admin/`              | admin login, TOTP (otplib, AES-256-GCM secret at rest), recovery codes, lockout, IP allowlists (`AdminIpGuard` global + per account in the session)                                         |
| `jobs/`               | PII scrub of withdrawn members (`auth-maintenance` queue, daily 04:17 KST when `JOBS_ENABLED`)                                                                                              |

Adding a provider: a class implementing `OAuthProvider`, an `AuthProvider` enum value + slug in
`@house/shared`, env keys, and one entry in the `OAUTH_PROVIDERS` factory. The flow doesn't change.

## Endpoints (prefix `/api/v1`)

| Method   | Path                                                         | Auth                    | Notes                                                                                            |
| -------- | ------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------ |
| GET      | `/auth/providers`                                            | Public                  | enabled providers                                                                                |
| GET      | `/auth/oauth/{kakao,naver,google}/start`                     | Public                  | `?returnTo=/path&intent=login\|link` → 302 to provider (link needs a user session)               |
| GET      | `/auth/oauth/{kakao,naver,google}/callback`                  | Public                  | 302 to web: `returnTo` / `/signup?provider=` / `/login?error=CODE` / `/me/account?linked=`       |
| GET      | `/auth/signup`                                               | Public (pending cookie) | provider prefill + current terms                                                                 |
| POST     | `/auth/signup`                                               | Public (pending cookie) | `{nickname, ageOver14: true, phone?, consents[], marketingOptIn}` → user + session               |
| GET      | `/auth/csrf`                                                 | Public                  | re-issues `house_csrf`, returns `{csrfToken}`                                                    |
| GET      | `/auth/me`                                                   | User                    | profile, identities, agency membership, `pendingRequiredTerms`, `marketingOptInAt`               |
| POST     | `/auth/logout` · `/auth/logout-all`                          | User                    |                                                                                                  |
| GET      | `/auth/sessions` · DELETE `/auth/sessions/:id`               | User                    | logged-in devices                                                                                |
| PATCH    | `/me/profile`                                                | User                    | nickname, phone (format only, never verified), marketingOptIn (+ consent row)                    |
| GET      | `/me/identities` · DELETE `/me/identities/:provider`         | User                    | last identity can't be removed                                                                   |
| GET/POST | `/me/consents`                                               | User                    | required terms can't be revoked                                                                  |
| POST     | `/me/withdraw`                                               | User                    | `{confirm: true, reason?}`; blocked (409) while owning an agency                                 |
| POST     | `/auth/withdraw`                                             | Public (ticket cookie)  | suspended member's withdrawal, `{confirm: true, reason?}`; `house_withdraw` ticket, single use   |
| GET      | `/terms` · `/terms/:type?version=`                           | Public                  | list = account terms; `:type` any TermsType (`DEAL_REQUEST_PRIVACY`, `deal-request-privacy`, …)  |
| POST     | `/admin/auth/login`                                          | Public                  | → pre-TOTP session (10 min idle)                                                                 |
| POST     | `/admin/auth/totp/setup` · `/totp/activate` · `/totp/verify` | pre-TOTP admin session  | session rotated on success; rotation: verified session + `{currentPassword, code\|recoveryCode}` |
| GET      | `/admin/auth/csrf`                                           | admin session           |                                                                                                  |
| GET      | `/admin/auth/me` · POST `/logout` · POST `/password`         | Admin (TOTP verified)   |                                                                                                  |

## Security rules worth knowing

- Sessions: every rewrite (sliding touch, patch) is a compare-and-set Lua script that also requires
  the id to still be in its subject index, so a revoke can never be undone by a concurrent request
  and a touch never overwrites a patch. A record missing from its index is not a session.
- Admin login answers every refusal (unknown email, disabled, outside the account allowlist,
  locked, wrong password) with the same 401. Wrong passwords at the login step count per
  (admin, client IP; IPv6 by /64) in Redis within a 15-min window; 5 lock only that pair for 15 min
  (audited as `admin.login.client_lock`) and never touch the account or its sessions, so knowing an
  admin's email is not enough to lock them out. Second-factor failures (and wrong passwords on
  re-auth from a verified session) share the account-wide counter that only a completed second
  factor resets; 5 lock the account for 15 min, end its sessions (audited as `admin.account.lock`)
  and answer 423 (the caller already proved the password). A completed second factor also clears
  that client's password counter.
- Admin path checks (`isAdminPath`) normalize case, escapes and duplicate slashes like the router.
- Withdrawal: identities are removed, but an HMAC tombstone (`withdrawn_identities`) blocks signup
  with the same social account for 30 days (`AUTH_REJOIN_COOLDOWN`). Live deal requests are
  cancelled and their contacts erased at once; the PII scrub later clears profile fields, consent
  ip/UA, report phone/ip, notifications, recent views, favorites and former staff rows, and drops
  expired tombstones.
- Signup requires the 만 14세 이상 confirmation (`ageOver14: true`, stored as `ageConfirmedAt`).
- Terms re-consent is enforced server-side: once a new required version is effective, a member's
  state-changing requests (POST/PUT/PATCH/DELETE) answer 403 `AUTH_TERMS_REQUIRED` with
  `details.missing: TermsType[]` until they agree via `POST /me/consents`. Reads and
  `@SkipTermsCheck()` routes (`/auth/*`, `/me/*`) stay usable; admin sessions are not affected. Only
  "agreed" is cached (Redis, keyed by the current required document ids), so publishing needs no
  cache bust.
- Two kinds of terms documents (shared `ACCOUNT_TERMS_TYPES` / `ACTION_CONSENT_TERMS`, D8):
  - **account terms** (SERVICE, PRIVACY, LOCATION, MARKETING): signup, `/me/consents`, `GET /terms` and
    the re-consent guard above use only these;
  - **purpose consents** (`PRIVACY_AGENCY_APPLICATION` for `POST /agencies`, `PRIVACY_AGENCY_JOIN` for
    `POST /agencies/join`, `DEAL_REQUEST_PRIVACY` + `DEAL_REQUEST_PROVIDE` for `POST /deal-requests`):
    the form reads the current version from `GET /terms/:type` and sends
    `consents: [{ type, version }]` with the submission. `TermsService.consentForAction(tx, …)` checks
    it against the current published version and appends `UserConsent` rows in the submission's
    transaction. Errors: 400 `AUTH_CONSENT_REQUIRED` (`details.missing`), 400
    `AUTH_CONSENT_OUTDATED` (`details.outdated: [{ type, version, currentVersion }]` — the form was
    open while a new version took effect), 503 `AUTH_CONSENT_UNAVAILABLE` (no published document:
    publish one in the admin), 400 `AUTH_TERMS_INVALID` for a type the action does not take. They are
    required whatever the document's `isRequired` says, never block other requests, and cannot be
    revoked through `/me/consents` (they belong to the submission).
- `marketingOptInAt` (`users.marketing_opt_in_at`): start of the current marketing opt-in (정보통신망법
  제50조 수신동의 일자) — set when a member opts in (signup, profile, consents), kept while they stay
  opted in, cleared on opt-out and withdrawal. Backfilled from the consent history by migration
  `20261124070239_auth_consent_types_marketing_opt_in_at`.
- Suspended members can withdraw (개인정보 보호법 제36·37조). Their refused social login redirects to
  `/login?error=AUTH_ACCOUNT_SUSPENDED&withdrawable=1` and sets a 10-minute single-use httpOnly
  ticket (`house_withdraw`, path `/api/v1/auth/withdraw`) good only for `POST /auth/withdraw`. Their
  PII is kept `SUSPENDED_PII_RETENTION_DAYS` (90) instead of 30 days, the rejoin tombstone lasts as
  long, and reports / audit rows / `suspendedReason` stay as evidence until the scrub. **State the
  90-day period in the 개인정보처리방침.**
- The PII scrub also erases former agency staff rows (`agency_members`: displayName → `탈퇴 회원`,
  title, phone, licenseNumber) and any listing contact still pointing at them.

## Frontend contract

- After any response that (re)creates a session (signup, admin login/activate/verify/password)
  use the `csrfToken` from the body for the `x-csrf-token` header; after the OAuth redirect call
  `GET /auth/csrf`. Don't rely on reading the `house_csrf` cookie: user and admin sessions share
  that cookie name.
- Web routes the callback redirects to: `/login`, `/signup`, `/me/account` (`WEB_PATHS`, D11).

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/auth`
- e2e: `pnpm --filter @house/api test:e2e auth` (`house_test_auth`, Redis DB 1; providers faked at
  the HTTP boundary, Google id_tokens really signed and verified)
