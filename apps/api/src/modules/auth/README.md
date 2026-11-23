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
| `terms/`              | current terms documents + append-only `UserConsent` records                                                                                                                                 |
| `admin/`              | admin login, TOTP (otplib, AES-256-GCM secret at rest), recovery codes, lockout, IP allowlists (`AdminIpGuard` global + per account in the session)                                         |
| `jobs/`               | PII scrub of withdrawn members (`auth-maintenance` queue, daily 04:17 KST when `JOBS_ENABLED`)                                                                                              |

Adding a provider: a class implementing `OAuthProvider`, an `AuthProvider` enum value + slug in
`@house/shared`, env keys, and one entry in the `OAUTH_PROVIDERS` factory. The flow doesn't change.

## Endpoints (prefix `/api/v1`)

| Method   | Path                                                         | Auth                    | Notes                                                                                            |
| -------- | ------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------ |
| GET      | `/auth/providers`                                            | Public                  | enabled providers                                                                                |
| GET      | `/auth/oauth/{kakao,naver,google}/start`                     | Public                  | `?returnTo=/path&intent=login\|link` → 302 to provider (link needs a user session)               |
| GET      | `/auth/oauth/{kakao,naver,google}/callback`                  | Public                  | 302 to web: `returnTo` / `/signup?provider=` / `/login?error=CODE` / `/my/account?linked=`       |
| GET      | `/auth/signup`                                               | Public (pending cookie) | provider prefill + current terms                                                                 |
| POST     | `/auth/signup`                                               | Public (pending cookie) | `{nickname, ageOver14: true, phone?, consents[], marketingOptIn}` → user + session               |
| GET      | `/auth/csrf`                                                 | Public                  | re-issues `house_csrf`, returns `{csrfToken}`                                                    |
| GET      | `/auth/me`                                                   | User                    | profile, identities, agency membership, `pendingRequiredTerms`                                   |
| POST     | `/auth/logout` · `/auth/logout-all`                          | User                    |                                                                                                  |
| GET      | `/auth/sessions` · DELETE `/auth/sessions/:id`               | User                    | logged-in devices                                                                                |
| PATCH    | `/me/profile`                                                | User                    | nickname, phone (format only, never verified), marketingOptIn (+ consent row)                    |
| GET      | `/me/identities` · DELETE `/me/identities/:provider`         | User                    | last identity can't be removed                                                                   |
| GET/POST | `/me/consents`                                               | User                    | required terms can't be revoked                                                                  |
| POST     | `/me/withdraw`                                               | User                    | `{confirm: true, reason?}`; blocked while owning an agency or suspended                          |
| GET      | `/terms` · `/terms/:type?version=`                           | Public                  |                                                                                                  |
| POST     | `/admin/auth/login`                                          | Public                  | → pre-TOTP session (10 min idle)                                                                 |
| POST     | `/admin/auth/totp/setup` · `/totp/activate` · `/totp/verify` | pre-TOTP admin session  | session rotated on success; rotation: verified session + `{currentPassword, code\|recoveryCode}` |
| GET      | `/admin/auth/csrf`                                           | admin session           |                                                                                                  |
| GET      | `/admin/auth/me` · POST `/logout` · POST `/password`         | Admin (TOTP verified)   |                                                                                                  |

## Security rules worth knowing

- Sessions: every rewrite (sliding touch, patch) is a compare-and-set Lua script that also requires
  the id to still be in its subject index, so a revoke can never be undone by a concurrent request
  and a touch never overwrites a patch. A record missing from its index is not a session.
- Admin login answers every refusal (unknown email, disabled, outside the account allowlist,
  locked, wrong password) with the same 401. Password and TOTP failures share one counter that only
  a completed second factor resets; 5 failures lock for 15 min (audited as `admin.account.lock`).
  The TOTP step answers 423 when it locks (the caller already proved the password).
- Admin path checks (`isAdminPath`) normalize case, escapes and duplicate slashes like the router.
- Withdrawal: identities are removed, but an HMAC tombstone (`withdrawn_identities`) blocks signup
  with the same social account for 30 days (`AUTH_REJOIN_COOLDOWN`). Live deal requests are
  cancelled and their contacts erased at once; the PII scrub later clears profile fields, consent
  ip/UA, report phone/ip, notifications, recent views and favorites, and drops expired tombstones.
- Signup requires the 만 14세 이상 confirmation (`ageOver14: true`, stored as `ageConfirmedAt`).

## Frontend contract

- After any response that (re)creates a session (signup, admin login/activate/verify/password)
  use the `csrfToken` from the body for the `x-csrf-token` header; after the OAuth redirect call
  `GET /auth/csrf`. Don't rely on reading the `house_csrf` cookie: user and admin sessions share
  that cookie name.
- Web routes the callback redirects to: `/login`, `/signup`, `/my/account` (`WEB_PATHS`).

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/auth`
- e2e: `pnpm --filter @house/api test:e2e auth` (`house_test_auth`, Redis DB 1; providers faked at
  the HTTP boundary, Google id_tokens really signed and verified)
