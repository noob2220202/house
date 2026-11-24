# Frontend integration notes — foundation

Scope: `packages/ui`, the `apps/web` and `apps/admin` shells, shared libs (API client, auth, mocks,
formatting, map, SEO). See `docs/FRONTEND.md` for conventions.

## Endpoints used by the foundation

| Method | Path                                                        | Used by                                                                        | Backend status         |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------- |
| GET    | `/api/v1/auth/csrf`                                         | API client (issues the readable `house_csrf` cookie before the first mutation) | listed in auth README  |
| GET    | `/api/v1/auth/me`                                           | `SessionProvider`, `getServerSession()`                                        | listed in auth README  |
| POST   | `/api/v1/auth/logout`                                       | `useSession().logout()`                                                        | listed in auth README  |
| GET    | `/api/v1/auth/oauth/{kakao\|naver\|google}/start?returnTo=` | `oauthStartUrl()` (full-page navigation)                                       | listed in auth README  |
| GET    | `/api/v1/site-settings/public`                              | footer business info, feature flags                                            | listed in admin README |
| GET    | `/api/v1/admin/auth/me`                                     | `AdminSessionProvider`, `requireAdmin()`                                       | listed in auth README  |
| POST   | `/api/v1/admin/auth/logout`                                 | `useAdminSession().logout()`                                                   | listed in auth README  |

## Assumed endpoints / payload shapes (reconcile when the backend lands)

None of the controllers exist yet (only module READMEs), so the **payload shapes** below are
assumptions. Each is parsed by one zod schema — fix the schema and the mock fixture together.

1. `GET /auth/me` → `SessionUser` (`apps/web/src/lib/auth/types.ts`):
   `{ id, role: USER|AGENT|AGENCY_OWNER, status, nickname, name?, email?, phone?, profileImageUrl?, agencyId?, marketingOptIn?, signupCompleted? }`;
   `401 UNAUTHENTICATED` when signed out. `signupCompleted=false` is expected to mean "required terms
   not accepted yet → send to /signup".
2. `GET /admin/auth/me` → `AdminUser` (`apps/admin/src/lib/auth/types.ts`):
   `{ id, email, name, role: OPERATOR|ADMIN|SUPER_ADMIN, mfaVerified, lastLoginAt? }`; 401 when signed
   out. The console layout treats `mfaVerified=false` as "not logged in".
3. `GET /site-settings/public` → object keyed by `SiteSettingKey`, every key optional:
   `{ BUSINESS_INFO?: businessInfoSchema fields, CONTACT?: { phone, email, hours?, kakaoChannelUrl? }, SEO?: { title, description }, FEATURES?: Record<string, boolean> }`
   (`apps/web/src/lib/site/settings.ts`). Missing fields render the design's bracket placeholders.
4. `GET /auth/csrf` → sets the `house_csrf` cookie (readable by JS). The client reads the cookie; as a
   fallback it also accepts `{ csrfToken }` in the JSON body.
5. CSRF failures are expected as `403` with a `code` containing `CSRF` (the client refreshes the
   token and retries once).
6. Error body `{ code, message, details?: [{ path, code, message }], requestId }` and validation code
   `VALIDATION_FAILED` (per docs/CONVENTIONS.md §4–5) — `ApiError.fieldErrors()` relies on `details[].path`
   being the form field name (dot path).
7. Session cookies are `house_sid` (user) and `house_admin_sid` (admin), httpOnly. The Next
   middlewares only check their presence (`apps/*/src/middleware.ts`); names are asserted against
   `COOKIE_NAMES` in unit tests.

## Mock-only routes (no backend counterpart)

- web `GET /mock-api/v1/auth/oauth/{provider}/start?returnTo=&as=user|agent|owner` — signs a fake
  user in immediately (no provider round trip) and redirects to `returnTo`.
- admin `GET /mock-api/v1/admin/auth/dev-login?as=super|admin|operator&returnTo=` — signs a fake
  admin in. The placeholder `/login` page links to it in mock mode only.

## Routing assumptions other groups should confirm

- Canonical user-site paths are defined in `apps/web/src/config/nav.ts` (`ROUTES`) and admin paths in
  `apps/admin/src/config/nav.ts` (`ADMIN_ROUTES`). Header, footer, tab bar and sidebar link to them
  before the pages exist (unknown paths 404 inside the chrome).
- The web middleware protects `/me/**`, `/agent/**`, `/deal/sell/**`, `/deal/find/**`
  (`PROTECTED_PREFIXES` in `apps/web/src/lib/auth/paths.ts` + the `matcher` in `src/middleware.ts`).
  `/agent/apply` is expected to be reachable by any signed-in user (`requireUser`), everything else
  under `/agent` by AGENT / AGENCY_OWNER (`requireAgent`).
- Admin topbar links: search → `/search?q=`, bell → `/notifications`, account → `/settings/account`
  (to be built by m-core).

## Deployment notes

- Browser calls are same-origin: nginx must proxy `/api/v1/**` to the API and serve `/media/**`.
  `next.config.mjs` rewrites cover dev (`INTERNAL_API_URL`, `MEDIA_ORIGIN`). For `next/image` to
  optimise `/media/*` in production, `MEDIA_ORIGIN` must point at the origin that serves media
  (nginx), or use absolute media URLs listed in `NEXT_PUBLIC_MEDIA_HOSTS`.
- CSP is intentionally minimal (`frame-ancestors`, `base-uri`, `form-action`, `object-src`). A full
  script/style CSP needs nonces plus allow-listing the Naver Maps and (later) Daum postcode / Kakao
  SDK hosts — do it once those integrations are final.
- Naver Maps: set `NEXT_PUBLIC_NAVER_MAP_KEY_ID` and register the site URL in the NCP console;
  without it the static Suncheon map is used.
- `/dev/ui` and `/mock-api/**` answer 404 in production builds (mock mode off).
