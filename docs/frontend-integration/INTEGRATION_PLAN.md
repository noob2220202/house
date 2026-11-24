# Frontend ↔ real backend integration plan

Sources: frontend `/home/user/house-merge/apps/{web,admin}` (trial merge, branch `integration-test`),
backend `/home/user/house/apps/api` (develop `66d950c`), shared `/home/user/house/packages/shared`.
Full per-endpoint table: `docs/frontend-integration/endpoint-inventory.md`
(generated from the mock route handlers vs the `@Controller`/`@Get…` decorators; backend route list in
`contract/be_routes.txt`). Note: `docs/frontend-integration/INDEX.md` says "apps/api has no feature
controller yet". That was true when the frontend was built, but it is no longer the case: develop now has 34 controllers and 213 routes.

## 0. Score

| | count |
|---|---|
| Frontend endpoint+method pairs (excluding the mock-only routes in INDEX §9) | 216 |
| Path+method exists in backend | 166 (77 %) |
| …of which a breaking difference is known | 12 |
| …of which a non-breaking difference is known (parse passes, data degraded) | 20 |
| Missing in backend | 50 |
| **Would work unchanged** (match + non-breaking) | **154 / 216 = 71 % (upper bound)** |

The 134 "MATCHES" rows only match on path and method. Their response shapes were not compared field by field.
Most frontend parsers are lenient (`nullish`, `.default`), but the listing-summary check showed that
lenient parsing hides data loss. Treat 71 % as an upper bound. Also, **`apps/admin` does not type-check
after the merge** (see §1), so until WI-1 lands the admin console cannot be built against the real
`@house/shared` at all.

## 1. Typecheck after merge (`pnpm exec tsc --noEmit -p .`)

Root cause of most errors: **two zod versions**. `apps/web` and `apps/admin` pin `zod 4.1.13`, while `packages/shared`
and `apps/api` use `4.6.7`, so shared schemas are not assignable to the apps' zod types.

### apps/web (12 errors)
| File:line | Class | Fix |
|---|---|---|
| `src/features/a-listings/cobroker/CoBrokerView.tsx:51,82` | zod version mismatch | bump zod (WI-1) |
| `src/features/w-listing/components/ReportDialog.tsx:28,68` | zod version mismatch | WI-1 |
| `src/app/mock-api/v1/listings/route.ts:108`, `map/search/route.ts:18` | zod mismatch (mock) | WI-1 |
| `src/features/w-auth/components/withdraw/WithdrawForm.tsx:83` | **real contract**: `withdrawSchema` requires `confirm: true` | send `{ confirm: true, reason }` (WI-2) |
| `src/features/w-deal/lib/sell-form.ts:295` | shared now has `photoMediaIds` `.default([])`, so the output type requires it | send `photoMediaIds ?? []` (WI-1). §2 item already resolved |
| `src/features/w-me/lib/notifications.ts:23` | `NotificationType` gained `LISTING_EXPIRED`, `CO_BROKER_REQUESTED` | add meta rows (WI-1) |
| `src/features/a-agency/lib/staff.ts:50` | invite payload type requires `phone` | WI-5 (invites move to `/agencies/mine/invites` anyway) |
| `src/app/mock-api/v1/agencies/mine/_register.ts:90` | mock: `specialties` optional in shared | WI-1 |
| `src/app/mock-api/v1/agency/listings/_store.ts:275` | mock: `maintenanceFeeItems` gone, replaced by `maintenanceFee{…}` | WI-6 |

### apps/admin (27 errors)
| File:line | Class | Fix |
|---|---|---|
| `src/features/m-ads/lib/banner-form.ts:6`, `banner-form.test.ts:1`, `popup-form.test.ts:1` | **real**: `bannerInputSchema`/`BannerInput`/`popupInputSchema` no longer exist (now `bannerCreateSchema`, `bannerUpdateSchema`, `popupCreateSchema`, `popupUpdateSchema`) | WI-4 |
| `src/app/mock-api/v1/admin/banners/**`, `popups/**` (7) | same renames + `reorderSchema` → `bannerReorderSchema`/`popupReorderSchema` | WI-4 |
| `src/app/mock-api/v1/admin/reports/[id]/resolve/route.ts:38,59` | resolve status no longer includes `IN_REVIEW` | WI-10 FE |
| `src/app/mock-api/v1/admin/site-settings/[key]/route.ts:13` | zod mismatch + local HOME_LAYOUT schema | WI-1 / WI-S |
| `src/app/mock-api/v1/admin/videos/route.ts` (9), `videos/[id]/route.ts:29` | zod mismatch → `unknown` input; nullable description | WI-1 |
| `src/app/mock-api/v1/admin/auth/totp/verify/route.ts:40` | `code` optional (recoveryCode alternative) | WI-3 |

## 2. Cross-cutting contracts

| Contract | Frontend | Backend today | Verdict |
|---|---|---|---|
| Base path | `/${API_PREFIX}` = `/api/v1` (`apps/web/src/lib/api/config.ts`) | `app.setGlobalPrefix(API_PREFIX)` (`apps/api/src/bootstrap/configure-app.ts:87`) | OK |
| Session cookies | `house_sid`, `house_admin_sid` (`COOKIE_NAMES`) | same (`session.service.ts:184`) | OK |
| CSRF | cookie `house_csrf` + header `x-csrf-token`, refresh via `GET /auth/csrf` on 403 `*CSRF*` | header `x-csrf-token` compared to the session token (`common/auth/csrf.guard.ts`); `CSRF_FAILED` 403; user and admin **share** the `house_csrf` cookie name; admin has its own `GET /admin/auth/csrf`; README: "use `csrfToken` from the body, don't rely on the cookie" | **Admin broken**: `apps/admin/src/lib/api/csrf.ts:28` calls `/auth/csrf` (user path, so the token is not bound to the admin session). If `COOKIE_DOMAIN` is shared, web and admin overwrite each other's `house_csrf` |
| Error envelope | `{code,message,details?[{path,code,message}],requestId}` | same (`filters/all-exceptions.filter.ts`, `errors/zod-issues.ts`: dot path) | OK |
| Pagination | `{items,page,pageSize,total,totalPages}`; cursor `{items,nextCursor}`; max pageSize 100 used | `Paginated<T>` identical; `MAX_PAGE_SIZE 100` | OK |
| `GET /auth/me` | `sessionUserSchema` (`apps/web/src/lib/auth/types.ts:8`): `nickname: string`, `agencyId`, `signupCompleted` | `MeResponse` (`packages/shared/src/schemas/auth.ts:207`): `nickname: string\|null`, `agency{agencyId,agencyName,agencyStatus,memberRole}\|null`, `pendingRequiredTerms[]`, `identities[]` | DIFFERS: a null nickname means 502 for the whole site. `agencyId` and `signupCompleted` are always undefined |
| OAuth start | `?returnTo=/auth/callback?next…` + `&link=1` (`apps/web/src/features/w-auth/lib/flow.ts:106`) | `?returnTo&intent=login\|link` (`shared/schemas/auth.ts:43`) | link mode broken: `link=1` is ignored and the flow becomes a LOGIN |
| OAuth callback redirects | errors → `/auth/callback?error=`; new user → has a session with `signupCompleted=false`; linked → `/me/account?linked=` | errors → `/login?error=CODE` (link: `returnTo?error=`); new user → `/signup?provider=` + pending httpOnly cookie, **no session**; suspended → `/login?error=AUTH_ACCOUNT_SUSPENDED&withdrawable=1`; linked → `returnTo ?? /my/account` (`auth.constants.ts:55-60`, `oauth/oauth.service.ts`) | **Signup broken** (frontend never calls `GET/POST /auth/signup`). Error codes differ: `AUTH_IDENTITY_DUPLICATE`/`AUTH_PROVIDER_ALREADY_LINKED`/`AUTH_LAST_IDENTITY` vs frontend `AUTH_IDENTITY_ALREADY_LINKED`/`AUTH_IDENTITY_LAST` |
| Admin login + TOTP | login → `{mfaVerified,totpEnrolled}`; enrol = `setup` → `verify`; re-enrol from the account page = empty `setup` → `verify`; 401 `AUTH_TOTP_INVALID` treated as a form error; 423 `AUTH_ACCOUNT_LOCKED` message | login → `{mfaRequired,totpEnrolled,csrfToken}` (pre-MFA session, 10 min idle); enrol = `setup` (empty body, half session OK, **B4 resolved**) → **`activate`** `{code}` → `{recoveryCodes, admin, csrfToken}`; `verify` only for enrolled admins, `{code}` or `{recoveryCode}`; re-enrol = `setup {currentPassword, code\|recoveryCode}` on a verified session, else 403 `AUTH_REAUTH_REQUIRED`; login refusals are all 401; second-factor lock is 423; password ≥ 12 | Enrolment and re-enrolment both broken. Lockout handling OK. Password minimum mismatch (frontend 10) |
| Media upload | `POST /media?purpose=` multipart `file`, poll `GET /media/:id` | same (`media/media.controller.ts:42`), plus `GET /media/:id/private` | OK by path |
| Banner slots (B6) | design frame 1240×220 (mobile 358×160) | `BANNER_SLOT_SPECS.MAIN_HERO` 1920×520 / 750×560 (`shared/constants/ads.ts:17`) | Unresolved |

## 3. Blockers B1–B8: backend today and recommendation

| # | Backend today | Recommendation (who changes) |
|---|---|---|
| B1 region codes | `DEFAULT_SGG_CODE='46150'`, `DEFAULT_REGION_NAME='전라남도 순천시'` (`shared/constants/region.ts:5,7`); unchanged | Owner decision. Recommended: keep 46150 as the canonical code in the DB and have the backend map `12150…` bcodes from the Kakao postcode to 46150 on input (deal-requests/agencies). The web app keeps accepting both. **Backend + shared** |
| B2 `/agencies/mine` audience | owner of any status (USER applicant OK), 404 `AGENCY_NOT_FOUND` when none; staff get 404; separate `GET /agencies/membership` exists | **Frontend**: treat 404 as none (already done) and, for `role=AGENT`, load `GET /agencies/membership` (+ public `GET /agencies/:id`) in `apps/web/src/app/agent/layout.tsx` + `features/a-agency/api/queries.ts`. Optional backend: let staff read a reduced `/agencies/mine` |
| B3 invitations | **Resolved differently**: invite codes in Redis (sha256, single use), `GET/POST/DELETE /agencies/mine/invites`, code shown **once** on creation; join `POST /agencies/join` | **Frontend**: staff page uses `/agencies/mine/invites` (no INVITED rows in members, no re-read of a code, no `/reissue`: revoke + create) |
| B4 admin TOTP setup | **Resolved** (half session accepted, pending secret in Redis, re-enrolment re-auth) but with a separate `activate` step | **Frontend** (WI-3) |
| B5 notification audience | one feed per user; no `data.agencyId` and no `scope` filter seen in `deal-requests/notifications/*`; types list unchanged except `LISTING_EXPIRED`, `CO_BROKER_REQUESTED` | **Backend**: add `data.agencyId` for agency-addressed types + optional `scope=agency`; frontend filters on it |
| B6 banner size | unchanged 1920×520 | Owner decision. Recommended: change the shared `MAIN_HERO` spec to the design (2480×440 upload, 1074×480 mobile), because the approved design wins. **Shared (backend owner)**; admin validation follows automatically |
| B7 inquiries | no inquiry module, no contact-events endpoint | Owner decision. Recommended for launch: hide `/agent/inquiries` and the dashboard inquiry feed (**frontend**) and add `POST /listings/:id/contact-events` later (**backend**) |
| B8 consents | `agencyRegisterSchema`/join/deal-request create have no `consents`; `TermsType` = SERVICE/PRIVACY/LOCATION/MARKETING only | **Backend + shared**: add `TermsType` `PRIVACY_AGENCY_APPLICATION`, `PRIVACY_AGENCY_JOIN`, `DEAL_REQUEST_PRIVACY`, `DEAL_REQUEST_PROVIDE` and a `consents[{type,version}]` field recorded as `Consent` rows. The legal text needs owner/legal review |

## 4. Work items (parallel, disjoint file sets)

Rule: **only WI-S edits `packages/shared`**. Backend items edit only `apps/api/src/modules/<their module>`.
Frontend items are split by app and feature folder.

### WI-S — shared package (backend owner) — `packages/shared/src/**`
1. `enums/admin.ts` `SiteSettingKey` + `admin/schemas.ts` `siteSettingSchemas`: add `HOME_LAYOUT {sections[{key,visible}]}`, `APP_LINKS {iosUrl?,androidUrl?}`; expose both in `GET /site-settings/public`.
2. `constants/ads.ts:17` `MAIN_HERO` spec → design size (B6).
3. `enums/user.ts` `TermsType` + agencies/deal-requests schemas `consents` (B8).
4. `constants/region.ts` B1 decision.
5. `utils/url.ts` `isSafeLinkUrl`: reject `\` and control characters (INDEX §2).
6. Optional: `marketingOptInAt` on `MeResponse`; `emdName` on `ListingSummary`.

### WI-1 — monorepo deps + compile fixes (frontend) — `apps/web/package.json`, `apps/admin/package.json`, `pnpm-lock.yaml`, `apps/web/src/features/w-deal/lib/sell-form.ts`, `apps/web/src/features/w-me/lib/notifications.ts`, `apps/web/src/app/mock-api/v1/{listings,map/search,agencies/mine/_register.ts}`, `apps/admin/src/app/mock-api/v1/admin/{videos,site-settings}/**`
- zod `4.1.13` → `4.6.7` in both apps (clears about 15 errors).
- `photoMediaIds ?? []`; notification meta for `LISTING_EXPIRED`, `CO_BROKER_REQUESTED`.

### WI-2 — user auth / signup / account (frontend) — `apps/web/src/lib/auth/**`, `apps/web/src/features/w-auth/**`, `apps/web/src/app/(auth)/**`, `apps/web/src/app/(me)/me/{account,profile,withdraw}/**`
1. `/signup` page: `GET /auth/signup` (prefill + current terms) → `POST /auth/signup {nickname, ageOver14:true, phone?, consents[], marketingOptIn}`. Use the `csrfToken` from the response.
2. `/login` reads `?error=` (and `withdrawable=1` → `/auth/withdrawn` using `POST /auth/withdraw {confirm:true}`). Keep `/auth/callback` only as the success `returnTo`.
3. Link: `&intent=link` instead of `&link=1` (`features/w-auth/lib/flow.ts:106`). Map `AUTH_IDENTITY_DUPLICATE`, `AUTH_PROVIDER_ALREADY_LINKED`, `AUTH_LAST_IDENTITY` in `features/w-auth/lib/oauth-errors.ts`.
4. `sessionUserSchema`: `nickname` nullable, `agencyId` ← `agency?.agencyId`, `signupCompleted` ← `pendingRequiredTerms.length === 0`. Handle 403 `AUTH_TERMS_REQUIRED` (re-consent via `POST /me/consents`).
5. Replace `GET /me/profile` with `/auth/me`. `WithdrawForm.tsx:83` sends `confirm: true`.
6. Terms history: `GET /terms/:type?version=` instead of `/terms/:type/versions/:version`. Hide the versions list until the backend adds it (WI-8).
7. Backend one-liner (owned by the auth module, can ride with WI-8): `apps/api/src/modules/auth/auth.constants.ts:59` `ACCOUNT: '/me/account'`.

### WI-3 — admin auth (frontend) — `apps/admin/src/features/m-core/**`, `apps/admin/src/lib/api/csrf.ts`, `apps/admin/src/lib/auth/types.ts`, `apps/admin/src/app/mock-api/v1/admin/auth/**`
1. `csrf.ts:28` → `/admin/auth/csrf`. Store the `csrfToken` from login/verify/activate/password responses (they rotate the session).
2. `TotpEnroll` confirm → new `activateTotp(code)` = `POST /admin/auth/totp/activate` → `{recoveryCodes, admin, csrfToken}`. `verifyTotp` only for enrolled admins. Add a recovery-code entry (`{recoveryCode}`).
3. Account re-enrolment (`components/account/AccountView.tsx:213`): ask for current password + current code/recovery code first, then `setup` with that body, then `activate`.
4. `ADMIN_PASSWORD_MIN` 10 → 12 (`features/m-core/lib/otp.ts:31`); better to reuse shared `adminPasswordSchema`.
5. `adminAccountSchema`: drop `totpEnrolledAt`/`passwordChangedAt` or ask the backend to add them. Show `recoveryCodesRemaining`.

### WI-4 — admin ads (frontend) — `apps/admin/src/features/m-ads/**`, `apps/admin/src/app/mock-api/v1/admin/{banners,popups,banner-slots}/**`
- `bannerInputSchema`→`bannerCreateSchema`/`bannerUpdateSchema`, `popupInputSchema`→`popupCreateSchema`/`popupUpdateSchema`, `reorderSchema`→`bannerReorderSchema`/`popupReorderSchema`. Upload size follows WI-S.2.

### WI-5 — broker console agency (frontend) — `apps/web/src/features/a-agency/**`, `apps/web/src/app/agent/layout.tsx`, `apps/web/src/app/agent/{staff,apply,profile}/**`, `apps/web/src/app/mock-api/v1/agencies/**`
- B2: staff path via `GET /agencies/membership`. B3: `/agencies/mine/invites` (code once; revoke = `DELETE /agencies/mine/invites/:inviteId`). Members list is `Paginated`, without INVITED rows.
- Invite payload per `agencyInviteCreateSchema` (`label?`, `expiresInHours`). License flag via `PATCH /agencies/mine/members/:memberId`.

### WI-6 — listing shapes (frontend) — `apps/web/src/lib/api/schemas/listing.ts`, `apps/web/src/features/a-listings/**`, `apps/web/src/app/mock-api/v1/agency/listings/**`
- `listingSummarySchema`: add a preprocess mapping `complex.name`→`complexName`, `complex.id`→`complexId`, `coverPhoto.mediumUrl`→`coverPhotoUrl`, `floorLabel`, `exclusiveAreaPyeong`→`pyeongLabel`. `emdName` comes from WI-S.6. Without this mapping, every card loses its photo and complex name.
- Listing editor draft: `maintenanceFee {billingType, items[{kind,included,amountWon}], unavailableReason}` replaces `maintenanceFeeWon`/`maintenanceFeeItems:string[]` (`features/a-listings/api/schemas.ts:119-120`, `wizard/StepDeal.tsx`).
- Admin complex photos (in `apps/admin/src/features/m-content/**`, owned by WI-10F): whole-list `PUT /admin/complexes/:id/photos`.

### WI-7 — notifications (frontend) — `apps/web/src/features/w-me/**` (notification files), `apps/web/src/features/a-inbox/**` (notification parts)
- Unread count from `GET /me/notifications/unread-count` → `{unread}`. Mark-read returns `{updated, unread}`. B5 filter once the backend adds `data.agencyId`.

### WI-8 — backend public/user endpoints — `apps/api/src/modules/{listings,complexes,agencies,deal-requests,auth,admin(public-content)}`
Missing (frontend calls them today): `GET /home/summary`, `GET /home/popular-regions`, `GET /search/suggest` (or the frontend uses `/complexes/autocomplete`), `GET /listings/:id/similar` (or the frontend does 3× `/listings`), `POST /listings/:id/view`, `GET /complexes/:id/nearby`, `GET /complexes/:id/agencies`, `GET /agencies/regions` (or the frontend uses `/agencies/map`), `GET/PUT/DELETE /me/favorites/agencies[/:id]`, `GET/PUT /me/interest-regions`, `GET /deal-requests/target-agencies`, `GET /deal-requests/address-match`, `GET /geo/geocode`, `GET /policies/:slug`, `GET /terms/:type/versions`. B5 `data.agencyId`, B8 consents.

### WI-9 — backend broker console — `apps/api/src/modules/{agencies,listings,deal-requests}` (console controllers only; coordinate with WI-8 per module)
Missing: `GET /agencies/mine/dashboard`, `GET /agency/listings/summary`, `GET /agency/listings/co-broker-candidates`, `GET /agency/deal-requests/:id/listing-candidates` (or the frontend uses `/agency/listings?status=ACTIVE&q`), inquiries ×5 (B7: hide or build).

### WI-10 — admin endpoints (split: backend `apps/api/src/modules/admin/**`, frontend `apps/admin/src/features/{m-core(dashboard/search/notifications),m-content,m-moderation}/**`)
- Backend missing: `GET /admin/dashboard/queues`, `GET /admin/search`, `GET /admin/notifications` + read/read-all, `GET /admin/stats/{traffic,listings,deal-requests,ads}`, `GET /admin/social-login`, `PUT /admin/videos/order`, `DELETE /admin/admins/:id` (or the frontend uses PATCH status), `POST /admin/deal-requests/:id/spam-flag`, report attachments, `GET /admin/site-settings/HOME_LAYOUT` (WI-S.1).
- Frontend renames: `GET /admin/agencies/:id/documents/:docId` → `…/:docId/file`; `POST …/registry-check` → `GET …/registry-check?refresh=1`; complex photo CRUD → whole-list `PUT`; report resolve without `IN_REVIEW`.

## 5. Order
WI-1 and WI-S first (unblock compile and shared types). Then WI-2, WI-3, WI-4, WI-5, WI-6, WI-7 in parallel on the
frontend and WI-8, WI-9, WI-10(backend) in parallel on the backend. Re-run `tsc` and the app tests after each item.
