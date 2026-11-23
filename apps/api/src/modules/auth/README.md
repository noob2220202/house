# Auth module (`apps/api/src/modules/auth`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- Social login (카카오 / 네이버 / Google **only** — no Apple, no SMS, no phone verification) via in-house OAuth2 authorization-code flows (no Passport).
- Provider registry: `OAuthProvider` interface (`buildAuthorizeUrl`, `exchangeCode`, `fetchProfile`) + one class per provider registered under a DI token map so another provider can be added later without touching the flow. Google uses PKCE + OIDC `id_token` verified against Google JWKS (cache keys; check `iss`, `aud`, `exp`, `nonce`).
- `state` + `nonce` (+ PKCE verifier, returnTo) stored in Redis with a short TTL, single use.
- `identities` (provider, providerUserId) is the only linking key — **never auto-link accounts by email**.
- Profile prefill: name/nickname/email/phone from the provider when returned with consent (Kakao/Naver). Phone is stored as a plain, unverified contact field (normalize with `phoneSchema`).
- Server-side sessions: `SessionService` (already implemented in `session/`) — opaque 256-bit token cookie, Redis record, sliding + absolute expiry, logout-all. Keep `SESSION_RESOLVER` binding.
- Admin accounts: email + argon2id password (`@node-rs/argon2`), mandatory TOTP (`otplib`, secret AES-256-GCM encrypted with `TOTP_ENCRYPTION_KEY`), recovery codes, lockout after failed attempts, optional per-admin + global IP allowlist (`ADMIN_IP_ALLOWLIST`), short admin sessions.
- Terms documents (versions) read API + per-user consent records; required-terms gate at signup.
- Member withdrawal: soft delete (`status=WITHDRAWN`), destroy all sessions, schedule PII scrub (`piiScrubAfter`) handled by the `cleanup` queue job.

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method   | Path                                                                      | Auth                                         |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| GET      | `/api/v1/auth/oauth/{kakao\|naver\|google}/start?returnTo=`               | Public (fixed route, registered in consoles) |
| GET      | `/api/v1/auth/oauth/{kakao\|naver\|google}/callback`                      | Public (fixed route)                         |
| GET      | `/api/v1/auth/me`                                                         | User                                         |
| POST     | `/api/v1/auth/logout` · `/api/v1/auth/logout-all`                         | User                                         |
| GET      | `/api/v1/auth/csrf` (re-issue CSRF cookie)                                | Public                                       |
| PATCH    | `/api/v1/me/profile` (nickname, phone, marketingOptIn)                    | User                                         |
| GET/POST | `/api/v1/terms` · `/api/v1/terms/:type` · `/api/v1/me/consents`           | Public / User                                |
| POST     | `/api/v1/me/withdraw`                                                     | User                                         |
| POST     | `/api/v1/admin/auth/login` → `/api/v1/admin/auth/totp/verify`             | Public (admin path)                          |
| POST     | `/api/v1/admin/auth/totp/setup` · `/logout` · GET `/api/v1/admin/auth/me` | Admin                                        |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/auth/**`
- `apps/api/test/e2e/auth/**` (+ your own factories there)
- Prisma: `auth.prisma` (User, Identity, AdminUser, TermsDocument, UserConsent) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/auth.ts`, `packages/shared/src/enums/user.ts`, `packages/shared/src/errors/auth.ts`
- Queues: `cleanup` (PII scrub of withdrawn users) (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/auth.env` → database `house_test_auth`, Redis DB index 1.
- Run: `pnpm --filter @house/api test:e2e auth` (migrates `house_test_auth` first). Unit: `pnpm --filter @house/api test -- src/modules/auth`.
