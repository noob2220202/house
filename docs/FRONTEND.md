# Frontend guide (apps/web, apps/admin, packages/ui)

Read this before building a page group. The foundation wires every cross-cutting concern; page
groups stay inside their own routes/features and reuse what is described here.

Hard product rules: social login is **카카오 / 네이버 / Google only** (no Apple button anywhere —
the Login design draft shows one; drop it). There is **no SMS / phone verification**; phone numbers
are plain validated fields. The service name is **순천부동산** (decided 2026-11-24; it replaced the
`BRAND` placeholder) and must only come from the brand config (`BRAND.name`), never be typed into
pages. Particles after it take the final-consonant form (순천부동산은 / 을 / 이).

## 0. If your page group already has files (interrupted run)

Agent runs get cut off (usage limit, crash, machine restart) and are restarted with the same task.
If `src/features/<your-key>/`, your routes, your mock resources or
`docs/frontend-integration/<your-key>.md` already exist when you start, they are **your own
unfinished work from an earlier run of your task — not another group's**:

- Audit before writing: read what is there, run typecheck / lint / tests for the app, start your dev
  server and look at every route of your scope at 1440 and 390.
- Keep what is good and finish the remaining scope against the definition of done (section 12). Do
  not rewrite from scratch, and do not leave it untouched assuming somebody else owns it.
- A mock resource folder is another group's only if another group's `features/<key>/` code or
  integration doc uses it; folders only your feature uses are yours to edit.
- Helper scripts under `.tmp/<your-key>*` and the `.next-<your-key>` build dir are leftovers you
  may reuse or delete. If your port is still taken by a stale server from the earlier run, stop
  that one process (only the one on your port).

## 1. Structure

```
packages/ui/                       @house/ui — tokens + shared React components (CSS Modules)
  src/styles/tokens.css            design tokens (ported 1:1 from design/drafts/system/system.css)
  src/styles/base.css              reset + global helper classes (.container, .t-h1, .price …)
  src/components/*                 components (one .tsx + .module.css each)
  src/icons/*, src/art/*           icon set, brand marks, photo stand-ins, Suncheon map art (generated)
  src/brand/*                      BrandMark (the ONE mark SVG) + Logo
  scripts/gen-from-design.mjs      regenerates icons/art from design/drafts/system/snippets.html (`pnpm --filter @house/ui gen`)

apps/web/                          user site + broker console (/agent/**)
  next.config.mjs                  NEXT_DIST_DIR, rewrites (/api/v1, /media), images, security headers
  src/config/                      brand.ts (THE brand config), nav.ts (ROUTES + menus), env.ts
  src/app/layout.tsx               fonts (next/font: Inter + Noto Sans KR), tokens, providers, metadata
  src/app/(site)/                  routes with the default chrome (header, footer, mobile bar)
  src/app/mock-api/v1/<resource>/  mock backend (one folder per resource)
  src/app/dev/ui/                  component gallery (dev only, 404 in production)
  src/components/layout/           SiteShell, SiteHeader, SiteFooter, MobileHeader, MobileTabBar
  src/components/map/              MapView (Naver + static), markers, map chrome
  src/components/{brand,providers,system}/
  src/features/<group-key>/        ← page-specific components of each page group (you create this)
  src/lib/api/                     typed API client, errors, CSRF, server fetch helpers, QueryClient
  src/lib/auth/                    session provider, guards, login/OAuth URLs
  src/lib/format/                  price / area / floor / date / number formatting (unit tested)
  src/lib/map/                     map types, projection, URL state
  src/lib/mock/                    mock-API helpers
  src/lib/seo/                     metadata builder, JSON-LD
  src/lib/site/                    public site settings (footer business info, feature flags)
  src/middleware.ts                cookie-presence gate for /me, /agent, /deal/sell, /deal/find

apps/admin/                        back-office (same foundation: tokens, API client, mock mode)
  src/config/nav.ts                ADMIN_ROUTES + sidebar groups (roles, badge keys)
  src/app/(console)/               authenticated area inside <AdminShell> (server-guarded)
  src/app/login/                   login (placeholder until m-core)
  src/components/shell/            AdminShell, sidebar, topbar, page-header override
  src/lib/{api,auth,format,mock}/  same APIs as apps/web (admin session instead of user session)
```

`apps/api/**` and `packages/shared/**` belong to the backend team: read them, never edit them.
Only the foundation adds npm dependencies.

## 2. Running, parallel dev servers, screenshots

```bash
pnpm install
pnpm --filter @house/shared build         # once — the apps import its dist
pnpm exec playwright install chromium     # once — for screenshots

# Each agent uses ITS OWN port and build dir (never the default .next):
cd apps/web   && NEXT_DIST_DIR=.next-<item> NEXT_PUBLIC_API_MOCK=1 pnpm exec next dev --port <port>
cd apps/admin && NEXT_DIST_DIR=.next-<item> NEXT_PUBLIC_API_MOCK=1 pnpm exec next dev --port <port>

node tools/kill-port.mjs <port>            # stop your server when done (cross-platform)
```

- `NEXT_DIST_DIR` is read by `next.config.mjs`. Next also gets its own derived tsconfig
  (`tsconfig.next-<item>.json`, git-ignored) so the committed `tsconfig.json` and `next-env.d.ts`
  never churn between agents. Do not add `.next*/types` to `tsconfig.json`.
- Shell is Git Bash on Windows: POSIX syntax, forward slashes, node scripts for anything fancy.
- Checks (all must stay green):
  `pnpm --filter @house/ui --filter web --filter admin typecheck` / `lint` / `test`, and
  `NEXT_DIST_DIR=.next-<item> pnpm --filter web --filter admin build`.

Screenshots (look at them with the Read tool and compare with `design/shots/*`):

```bash
node tools/design-shot.mjs http://localhost:<port>/<route> 1440 .tmp/fe-shots/<item>-<route>-1440.png
node tools/design-shot.mjs http://localhost:<port>/<route> 390  .tmp/fe-shots/<item>-<route>-390.png
node tools/design-shot.mjs design/drafts/project/Main.dc.html 1440 .tmp/fe-shots/design-Main-1440.png
```

Protected pages need a session; in mock mode sign in by visiting (Playwright `page.goto`) first:

- web: `/mock-api/v1/auth/oauth/kakao/start?returnTo=/me&as=user|agent|owner`
- admin: `/mock-api/v1/admin/auth/dev-login?as=super|admin|operator&returnTo=/`

`/dev/ui` (apps/web) shows every component for visual QA against `DesignSystem.dc.html`.

## 3. Design system (`@house/ui`)

```ts
import '@house/ui/styles.css'; // tokens + base — already imported by both root layouts
import { Button, ListingCard, Icon } from '@house/ui';
```

Rules

- Styling = **CSS Modules + tokens**. No Tailwind, no CSS-in-JS, no hard-coded colours/radii/shadows:
  use `var(--brand)`, `var(--r-lg)`, `var(--sh-2)`, `var(--s-4)` … (see `tokens.css`). Deal-type
  colours (`--deal-sale|jeonse|monthly|presale`) have fixed meanings and always come with a text label.
- Breakpoint: **mobile is `@media (max-width: 720px)`** exactly like the design system
  (`BREAKPOINTS`/`MEDIA` from `@house/ui` for JS). Gutter/section spacing shrink automatically via tokens.
- Global helper classes from `base.css`: `.container`, `.section`, `.stack`, `.row`, `.grid-auto`,
  `.divider`, `.sec-hd`, `.sr-only`, `.num`, `.only-sm`, `.only-lg`, type scale `.t-display .t-h1 .t-h2
.t-h3 .t-title .t-body .t-sm .t-cap .eyebrow`, `.price .price-xl .price-sm (.unit)`, `.link`,
  `.t-sale .t-jeonse .t-monthly .t-presale`. No text below 12px.
- Links: components that render anchors take `href` + `linkAs={Link}` (next/link). Presentational
  components (Button, ListingCard, ComplexRow, BrokerCard, Breadcrumb, Pagination, Logo, badges, Card,
  Skeleton, states…) have no `'use client'` and work in server components; interactive ones
  (Tabs, SegmentedControl, Popover, Modal, Table, Combobox, charts, Toast…) are client components.
- Fonts: the design's Inter + Noto Sans KR via `next/font/google`, exposed as `--font-latin` /
  `--font-kr`; `--font`, `--font-num`, `--font-brand` build on them. Never set `font-family` by hand.
- Photos: `next/image` with the backend media URL in the `media` slot (`<Image fill sizes=… alt=… />`);
  when there is no photo the components fall back to `<PhotoPlaceholder kind=… />`
  (`photoKindForAsset(assetType)` picks the illustration).
- Missing a generic component? Build it in your `features/<key>/` folder and list it in `openIssues`
  for promotion — do not edit `packages/ui`.

### Component catalog (all from `@house/ui`)

| Area                 | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brand & icons        | `Logo`, `BrandMark`, `Icon` (`IconName`, `ICON_NAMES` — 70+ stroke icons), `CategoryIcon`, `CategoryTile` (apt/room/house/biz/land), `KakaoMark`, `NaverMark`, `GoogleMark`, `SuncheonMapArt`                                                                                                                                                                                                                                                                                                                         |
| Actions              | `Button` (variant primary/secondary/soft/ink/ghost/danger · size sm/md/lg · block · pill · loading · iconLeft/Right · href+linkAs), `IconButton` (label required · pressed · variant outline/plain/floating), `SocialButton` (kakao/naver/google, `round`), `Spinner`                                                                                                                                                                                                                                                 |
| Forms                | `Field`, `Input` (label/help/error/prefix/suffix), `Textarea`, `Select`, `Checkbox`, `Radio`, `RadioGroup`, `Switch`, `Combobox` (autocomplete), `SearchField` (variant hero/pill, optional suggestions), `SegmentedControl` (variant track/pills · tone ink · size sm), `RangeSlider` (two thumbs), `Dropzone` (UI only)                                                                                                                                                                                             |
| Navigation & filters | `Tabs` + `TabPanel` (button tabs or link tabs via `href`), `Chip` (static/toggle/link/removable, variant quick), `FilterChip`, `FilterDropdown` (chip + popover with 초기화/적용), `Breadcrumb`, `Pagination` (`onChange` or `hrefFor`), `paginationRange`, `Stepper` (horizontal/vertical)                                                                                                                                                                                                                           |
| Data display         | `Badge`, `DealBadge` (soft/solid), `DealLabel`, `PremiumBadge` (P +/−), `RankDelta`, `AdBadge`, `VerifiedBadge` (실매물 확인), `BrokersBadge` (중개사 N곳), `StatusPill`, `Tag`, `DealCount` (분/매/전/월), `Card`, `Panel`, `ListingCard`, `ComplexRow`, `BrokerCard`, `StatTile` + `Delta` (KPI), `Table` (sortable · selectable · sticky header · pagination · loading/empty), `Avatar`, `AvatarStack`, `PhotoPlaceholder`, `AdFrame` (main/mobile/side ratios), `Sparkline`, `LineChart`, `BarChart`, `niceTicks` |
| Feedback & overlays  | `Skeleton`, `SkeletonText`, `ListingCardSkeleton`, `LoadingRegion`, `EmptyState`, `ErrorState`, `Modal`, `ConfirmDialog`, `Drawer` (right/left/bottom sheet · ink · flush), `SheetSurface` (non-modal map sheet), `CtaBar` (mobile sticky actions), `Popover`, `Tooltip`, `ToastProvider` + `useToast`                                                                                                                                                                                                                |
| Utilities            | `cx`, `BREAKPOINTS`, `MEDIA`, `dealKindOf(DealType)`, `DEAL_KIND_LABEL`, `photoKindForAsset`, hooks `useControllable`, `useDismiss`, `useFocusTrap`, `useScrollLock`, `useMounted`, `useAnchoredPosition`                                                                                                                                                                                                                                                                                                             |

Props are documented with TSDoc on every component; `/dev/ui` (`apps/web/src/app/dev/ui/Gallery.tsx`)
is the live usage reference.

App-level components (import paths in `apps/web`):

| Import                                             | What                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@/components/layout`                              | `SiteShell`, `SiteHeader`, `SiteFooter`, `MobileHeader`, `MobileTabBar`                                 |
| `@/components/brand/Logo`                          | `Logo` wired to the brand config                                                                        |
| `@/components/map`                                 | `MapView`, markers, `MapSelectedCard`, `MapBreadcrumb`, `MapSummary`, `MapZoomControl`, `MapToolButton` |
| `@/components/system/RouteError`, `…/PageSkeleton` | bodies for `error.tsx` / `loading.tsx`                                                                  |
| apps/admin `@/components/shell`                    | `AdminShell`, `SidebarStatusCard`, `AdminPageHeader`, `useAdminPageHeader`                              |

### Brand

`apps/<app>/src/config/brand.ts` is the single source for the name/tagline, and
`packages/ui/src/brand/BrandMark.tsx` is the single mark SVG. Never type the brand name in JSX —
use `BRAND.name` / `<Logo />`.

## 4. Layout & routing conventions (apps/web)

- Canonical paths live in `src/config/nav.ts` (`ROUTES`): `/map/[assetType]` (apt · oneroom · house ·
  commercial · land), `/complex/[id]`, `/listing/[id]`, `/agencies`, `/agency/[id]`, `/deal`
  (`/deal/sell`, `/deal/find`), `/me/**`, `/login`, `/signup`, `/agent/**`, `/notices`, `/faq`, `/videos`,
  `/tools`, `/terms/[type]`, `/search`. Link with `ROUTES.*`; if your group needs another path, add it
  under your own routes and mention it in your integration doc.
- Default chrome: put pages in `src/app/(site)/…` (header + footer + mobile header + bottom tab bar).
- Different chrome → your own route group with its own layout:
  `export default ({ children }) => <SiteShell footer={false} mobileHeader={false} fill>{children}</SiteShell>` (map);
  `tabBar={false}` for pages with a sticky `CtaBar` (listing detail); the broker console (`/agent`)
  has its own sidebar layout and does not use `SiteShell`.
- Mobile (≤ 720px) follows MobileHome/MobileMap/MobileListing: compact top bar, bottom tab bar
  (홈 · 지도 · 내놓기·구하기 · 관심 · MY), compact footer. `SiteShell` reserves space for the tab bar.
- Every data view ships **loading skeleton + empty state + error state** (`Skeleton*`, `EmptyState`,
  `ErrorState`); add a route `loading.tsx` when the default page skeleton does not match your layout.

Admin: pages go in `apps/admin/src/app/(console)/…`; the sidebar comes from `ADMIN_NAV`
(`src/config/nav.ts`, with `minRole` per item). The topbar title/crumb default to the nav entry;
override with `<AdminPageHeader title="배너 수정" crumb={['운영', { label: '배너·팝업 관리', href: '/banners' }]} />`.
Pass `badges`, `notificationCount`, `sidebarFooter` to `<AdminShell>` in `(console)/layout.tsx`.

## 5. Data & mocks

### API client (`@/lib/api`)

```ts
import { api, apiFetch, ApiError, errorMessage, qk } from '@/lib/api';

const page = await api.get('/listings', {
  query: { page: 1, deal: ['SALE', 'JEONSE'] },
  schema: listingPageSchema,
});
await api.post('/favorites', { listingId }); // CSRF header added automatically
```

- `fetch` with `credentials: 'include'`, JSON in/out (FormData for uploads), 15s timeout.
- Responses are **zod-parsed** when you pass `schema` — use `@house/shared` schemas when they exist,
  otherwise define the schema next to your feature.
- Query arrays are sent as CSV (`deal=SALE,JEONSE`), matching `csvArray` in the backend.
- Mutations send `x-csrf-token` = the readable `house_csrf` cookie (`GET /auth/csrf` issues it; a
  `403 *CSRF*` is retried once). The session cookie is httpOnly and never read in JS.
- Every failure is an `ApiError { status, code, message, details?, requestId? }` (network = status 0).
  `error.fieldErrors()` maps backend validation details to form fields; `errorMessage(e)` gives the
  Korean user-facing text.
- Base URL: browser → same-origin `/api/v1` (nginx in prod, `next.config` rewrite in dev); server →
  `INTERNAL_API_URL` (default `http://127.0.0.1:4000`). In mock mode both target `/mock-api/v1`.

Server components (SEO pages) — `@/lib/api/server`:

```ts
const complex = await serverGet(`/complexes/${id}`, {
  schema,
  revalidate: 300,
  tags: ['complexes'],
}); // throws ApiError → notFound() on 404
const settings = await serverGetOr('/site-settings/public', {}, { schema }); // never throws (also keeps `next build` green without a backend)
const mine = await serverGetAuthed('/me/favorites', { schema }); // forwards cookies, no cache → dynamic route
```

Client interactivity — TanStack Query (provider already mounted):

```ts
const { data, isPending, isError, refetch } = useQuery({
  queryKey: qk('listings', 'map', { bbox, zoom, filters }),
  queryFn: ({ signal }) =>
    api.get('/listings/map', { query: { bbox, zoom, ...filters }, schema, signal }),
});
```

Key convention `[resource, scope, params]`; invalidate by resource. 4xx errors are not retried.

### Mock mode

`NEXT_PUBLIC_API_MOCK=1` → the client targets `/mock-api/v1`, served by Next route handlers.
Handlers return **404 unless mock mode is on**. Adding a resource (no shared registry → no conflicts):

1. Read the real contract first: `apps/api/src/modules/<module>/**` (controllers, dto, README) and
   `packages/shared` (schemas/enums). Mirror paths and payloads **exactly**, including the pagination
   envelope `{ items, page, pageSize, total, totalPages }` and the error shape.
2. Create `src/app/mock-api/v1/<resource>/route.ts` (+ nested folders for sub-routes) and fixtures in
   `src/app/mock-api/v1/<resource>/_fixtures.ts`. Fixture data comes from
   `design/drafts/system/mockdata.md` (all fictional).
3. Check whether another group already created the resource folder; if so only **add** sub-route
   files, never rewrite theirs.
4. If the backend endpoint does not exist yet, keep the `/api/v1/<resource>` convention and record it
   in `docs/frontend-integration/<your-item>.md` under "Assumed endpoints".

```ts
// src/app/mock-api/v1/complexes/route.ts
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { COMPLEXES } from './_fixtures';

export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off; // 404 when mock mode is off
  await mockDelay(req); // visible loading states; ?_delay=1500 to exaggerate
  return mockJson(mockPaginate(COMPLEXES, req));
}
```

Helpers in `@/lib/mock`: `mockGuard`, `mockJson`, `mockError(status, code, message, details?)`,
`mockNotFound`, `mockUnauthenticated`, `mockForbidden`, `mockPaginate`, `mockDelay`, `mockCsv`,
`mockUuid`, `mockSessionRole(req)` (web) / `mockRequireAdmin(req)` (admin), `mockCsrfOk(req)` for
mutations. Example resource: `src/app/mock-api/v1/site-settings/` (footer business info).

Foundation-owned mock resources: web `site-settings/public`, `auth/{csrf,me,logout,oauth/[provider]/start}`;
admin `auth/csrf`, `admin/auth/{me,logout,dev-login}`.

## 6. Auth

- Login starts OAuth with a **full-page navigation**: `oauthStartUrl(AuthProvider.KAKAO, returnTo)` →
  `/api/v1/auth/oauth/{kakao|naver|google}/start?returnTo=<path>` (param name per the backend schema).
  `loginUrl(returnTo)` builds `/login?returnTo=…`; always pass user-supplied targets through
  `safeReturnTo()` (site-relative only).
- Client: `const { user, status, isAgent, refresh, logout } = useSession()` (`@/lib/auth`), backed by
  `GET /auth/me`. `status` is `loading | authenticated | unauthenticated` — reserve space while loading.
- Server (authoritative): `requireUser(returnTo)` / `requireAgent(returnTo)` from `@/lib/auth/server`
  in protected layouts/pages. `src/middleware.ts` only checks cookie presence for `/me`, `/agent`,
  `/deal/sell`, `/deal/find`.
- Auth-gated actions on public pages (관심, 신고): check `useSession()`, and when signed out send the
  user to `loginUrl(currentPath)`.
- Admin: `useAdminSession()` → `{ admin, can(minRole), logout }`; `requireAdmin(returnTo, minRole)` on
  the server; middleware gates everything except `/login`. Email + password + TOTP login is m-core's.
- Never render private fields (호수, owner contact before consent, documents) — the API hides them;
  do not reconstruct them client-side or put them in JSON-LD.

## 7. Forms

react-hook-form + zod resolver, schemas from `@house/shared` where available:

```tsx
const form = useForm<Input>({ resolver: zodResolver(schema), mode: 'onBlur' });
<Input
  label="연락처"
  required
  inputMode="tel"
  autoComplete="tel"
  error={form.formState.errors.phone?.message}
  {...form.register('phone')}
/>;

try {
  await api.post('/deal-requests', values);
} catch (e) {
  if (e instanceof ApiError && e.isValidation)
    Object.entries(e.fieldErrors()).forEach(([k, m]) => form.setError(k as never, { message: m }));
  else toast({ message: errorMessage(e), tone: 'error' });
}
```

Every control needs a visible label (or `aria-label`), required marks, inline errors
(`error` prop → `aria-invalid` + `role="alert"`), sensible `inputMode`/`autoComplete`. Money inputs:
`parsePriceInput` / `formatPriceHint`. Phone: plain field validated with `phoneSchema` /
`contactPhoneSchema` — never "verify" it.

## 8. Formatting utils (`@/lib/format`)

| Function                                                                                                        | Example                                           |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `formatManwon(44500)`                                                                                           | `4억 4,500`                                       |
| `formatDealPrice({ dealType, price, deposit, monthlyRent })`                                                    | `4억 4,500` · `500/45` · `가격 협의`              |
| `formatDealPriceLabeled(…)`                                                                                     | `월세 500/45`, `전세 2억 1,000`                   |
| `formatPriceShort(44000)`                                                                                       | `4.4억` (map markers)                             |
| `formatPriceRange(39000, 48500)`                                                                                | `3억 9,000 ~ 4억 8,500`                           |
| `formatPriceFilter(30000, 50000)`                                                                               | `3억~5억` (filter chips)                          |
| `formatPerPyeong(1180)` · `formatPremium(2700)`                                                                 | `1,180만/평` · `P +2,700`                         |
| `parsePriceInput('4억 2,000')` · `formatPriceHint(42000)`                                                       | `42000` · `4억 2,000만원`                         |
| `formatMaintenanceFee(150000)`                                                                                  | `15만원`                                          |
| `sqmToPyeong` / `pyeongToSqm` (1평 = 3.305785㎡)                                                                | `25.7` / `112.4`                                  |
| `formatPyeong(112.4)` · `formatSqm(84.98)` · `formatArea(sqm, unit)` · `formatAreaBoth`                         | `34평` · `84.98㎡` · `84.98㎡ (25.7평)`           |
| `floorClassOf(20, 25)` · `formatFloor({ floorClass, totalFloors })`                                             | `HIGH` · `고/25층`, `3/4층`                       |
| `formatDateShort` · `formatDate` · `formatDateTime` · `formatDateKorean` · `formatMonthDay` · `formatYearMonth` | `26.11.22` · `2026.11.22` · … (always Asia/Seoul) |
| `formatRelativeTime(iso, now?)` · `formatDday(date)`                                                            | `12분 전`, `어제` · `D-3`                         |
| `formatCount` · `formatCompactCount` · `formatPercent` · `formatPhone`                                          | `1,284` · `1.2만` · `8.6%` · `010-1234-5678`      |

Money is integer 만원 (관리비 is 원), areas are ㎡ in the API. Labels for enums come from
`@house/shared` (`DEAL_TYPE_LABEL`, `ASSET_TYPE_LABEL`, `DIRECTION_LABEL` …).

## 9. Map

```tsx
'use client';
import { MapView, MapZoomControl, MapSelectedCard } from '@/components/map';
import { defineFilters, useMapUrlState, boundsToBboxParam, type MapMarker } from '@/lib/map';

const FILTERS = defineFilters({ deal: { type: 'csv' }, priceMin: { type: 'number' }, priceMax: { type: 'number' } });

const { view, selected, filters, setView, setSelected, setFilters, resetFilters } = useMapUrlState(FILTERS);
const [bbox, setBbox] = useState<string>();

<div style={{ height: '100%' }}>
  <MapView center={view.center} zoom={view.zoom} markers={markers} selectedId={selected}
           onViewChange={(c) => { setView(c); setBbox(boundsToBboxParam(c.bounds)); }}   // debounced → refetch
           onMarkerClick={(m) => (m.kind === 'cluster' ? setView({ center: m.position, zoom: view.zoom + 2 }) : setSelected(m.id))}
           onMapClick={() => setSelected(null)}>
    {/* overlay chrome, absolutely positioned */}
    <MapZoomControl onZoomIn={…} onZoomOut={…} />
  </MapView>
</div>
```

- One abstraction, two implementations with identical props: `NaverMapView` (Naver Maps JS v3,
  loaded with `ncpKeyId=NEXT_PUBLIC_NAVER_MAP_KEY_ID`, custom HTML marker overlays) and
  `StaticMapView` (the design's stylized Suncheon SVG, markers projected from lat/lng) used when no
  key is set and as an automatic fallback if the SDK fails. Both are code-split and client-only; give
  the parent an explicit height.
- Marker models (`MapMarker`): `cluster` (name + count, `outer`, `size`), `complex` (count badge +
  name + `areaLabel` + `priceLabel`, `presale`), `price` (deal dot + price), `pin` (count only).
  Build `priceLabel` with `formatPriceShort`.
- Zoom bands come from `@house/shared` (`MAP_ZOOM`, `mapResultKindForZoom`): region clusters →
  grid clusters → markers. Send `bbox` as `swLng,swLat,neLng,neLat` (`boundsToBboxParam`).
- **Map state lives in the URL** (`c=lat,lng&z=zoom&sel=id&<filters>`): pan/zoom use
  `history.replaceState`, selection/filters push history entries. `buildMapHref()` creates shareable
  links; `parseMapView/parseFilters` work on the server too.

## 10. SEO

```ts
export const metadata = buildMetadata({ title: '아파트·분양권 지도', path: '/map/apt' });
export async function generateMetadata({ params }) { … return buildMetadata({ title, description, path, image }); }
```

`@/lib/seo`: `buildMetadata` (title, description, canonical, Open Graph, Twitter, `noindex`),
`<JsonLd data={…} />` with builders `listingJsonLd`, `complexJsonLd`, `agencyJsonLd`,
`breadcrumbJsonLd`, `siteJsonLd`. SEO pages (home, listing, complex, agency, content) fetch on the
server with `revalidate`; render the above-the-fold content on the server; images lazy except the LCP
image (`priority`). My pages, forms and dev routes use `noindex: true`. `NEXT_PUBLIC_SITE_URL` is the
canonical origin.

## 11. Accessibility & quality bar

- Real `<button>`/`<a>`/`<label>`; icon-only controls need a label (`IconButton label`), decorative
  icons are `aria-hidden` (default for `<Icon>`).
- Visible focus (`--focus` ring is global), full keyboard operation, 44px touch targets (`--hit`),
  contrast AA (use the text tokens: `--text`, `--text-2`, `--text-3`, `--text-muted`; `--icon-muted`
  is for icons only).
- No layout shift: reserve sizes for images/skeletons/async header bits.
- TypeScript strict, no `any`, ESLint clean, small components, heavy widgets (map, charts, editors)
  code-split with `next/dynamic`.
- Tests: Vitest + Testing Library (`*.test.ts(x)` next to the code) for utils and key components.

## 12. Definition of done for a page

1. Matches the design draft at 1440 and 390 (screenshots compared side by side), no horizontal
   overflow, mobile layout per the Mobile\* drafts.
2. Uses `@house/ui` components and tokens only; brand via config; no Apple login, no SMS.
3. Data through the typed API client with zod schemas; mock resources mirror the real contract;
   assumed endpoints documented in `docs/frontend-integration/<item>.md`.
4. Loading skeleton, empty state and error state for every data view; forms validate inline and map
   server errors to fields.
5. Metadata (+ JSON-LD where relevant), sensible heading order, keyboard and screen-reader usable.
6. No private data rendered; redirects only to `safeReturnTo()` targets; no `dangerouslySetInnerHTML`
   with untrusted content.
7. `typecheck`, `lint`, `test`, `build` green for the app; dev server stopped.
