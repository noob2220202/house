export const meta = {
  name: 'house-frontend',
  whenToUse: 'Run on the developer PC to build apps/web (user site + broker console) and apps/admin from the approved design drafts in design/drafts, in API mock mode',
  description: 'Production frontends (user site, broker console, admin) built from the approved design drafts: UI foundation, 16 page groups with build/visual-review/fix, cross-app consistency critic',
  phases: [
    { title: 'Foundation', detail: 'packages/ui, web + admin app shells, api client, mock API, map abstraction' },
    { title: 'Pages', detail: '16 page groups: build -> independent review + fix (as many agents at once as the machine allows by default)' },
    { title: 'Consistency', detail: 'code-first cross-app critic, ui -> web/admin fixes, green build' },
  ],
}

const REPO = 'the repository root (your current working directory)'
const DESIGN = 'design/drafts'
const SHOTS = 'design/shots'
const FE_SHOTS = '.tmp/fe-shots'
const SHOT_TOOL = 'node tools/design-shot.mjs'

// Concurrency cap: at most this many agents run at the same time.
// Change the default here, or pass { maxConcurrent: N } as the workflow args.
// The Workflow runtime itself never runs more than min(16, CPUs - 2) agents at once,
// so 16 means "as many as this machine allows" (10 on a 12-thread PC). 10 at once
// uses all CPU and memory of a 16 GB PC (each agent runs its own Next dev server);
// pass a lower number if the machine has to stay usable.
const MAX_CONCURRENT = Math.max(1, Math.floor(Number(args && args.maxConcurrent) || 16))

const CONTEXT = `
# PRODUCT
Production-grade local real-estate co-brokerage platform for 순천시 (Suncheon, Korea); goal: the best real-estate site in Korea. Users browse 아파트·분양권 / 원룸·투룸 / 주택 / 상업·업무 / 토지 listings on a map, many broker offices (중개사무소) co-broker the same listing, owners 내놓기 and seekers 구하기 and local brokers respond, broker office search, and an admin back-office that manages everything — every banner/popup is admin-configured (slot, schedule, targeting, stats). Social login: 카카오, 네이버, Google ONLY (no Apple, no SMS/phone verification anywhere — phone numbers are plain validated fields). Brand name undecided: placeholder wordmark "BRAND" + abstract mark, swappable from ONE config (apps/*/src/config/brand.ts + one SVG component).

# REPO / ENV
Monorepo at ${REPO}: pnpm workspaces + Turborepo, Node 22, TypeScript strict. NO Docker. apps/api = NestJS backend (built by another team on another machine and merged via git — do NOT edit apps/api/** or packages/shared/**; read them freely), apps/web = user site + broker console (Next.js 15 App Router, React 19), apps/admin = admin back-office (Next.js 15), packages/shared = zod schemas/enums shared with the backend, packages/config = presets. This runs on the owner's Windows PC (Claude Code on Windows; shell is Git Bash — use POSIX syntax, forward slashes, and cross-platform node scripts; no flock, no Linux-only tools). No Postgres/Redis are needed: the frontend runs in API MOCK MODE. Do NOT git commit/push (the lead does), NEVER run git clean / git checkout -- / git reset / rm -rf on paths you don't own; other agents edit other paths concurrently.
Dependencies: ONLY the foundation agent adds npm dependencies. Page agents must not run pnpm add/install; if a dependency is truly needed, implement without it or list it in openIssues.

# APPROVED DESIGN (source of truth for look & feel)
Design drafts (static HTML artboards, copied into the repo, direction "B · Crisp Blue": white, cobalt primary, big bold Inter numerals, pill chips, micro-shadows): ${DESIGN}/project/*.dc.html — Main, MapApt, Complex, Listing, OneRoom, DealRequest, Agents, Login, AdminDashboard, AdminBanners, MobileHome, MobileMap, MobileListing, DesignSystem. Design system sources: ${DESIGN}/system/system.css (tokens + component classes), snippets.html (header/footer/admin shell/mobile bar/icons/photo stand-ins/map), mockdata.md (fictional sample data — use it for mock/dev fixtures), fonts-link.html. Rendered screenshots of the designs exist in ${SHOTS}/ (e.g. Main.dc.html.1440.png, *.390.png); render any design yourself with: ${SHOT_TOOL} <file.dc.html> <width> <out.png> [height] (requires 'pnpm exec playwright install chromium' once — the foundation agent ensures it).
Rules: reproduce the designs faithfully (spacing, type scale, colors, radii, shadows, component anatomy), but as real responsive, accessible React. The Login design shows an Apple button — DROP it (Kakao, Naver, Google only). Where a screen has no design, extrapolate from the design system + nearest designed screen so it looks like it was designed by the same team. Real photos replace the SVG photo stand-ins (use next/image with the backend media URLs; show a tasteful branded placeholder when a listing has no photo).

# FRONTEND ARCHITECTURE (decided)
- packages/ui: shared React component library + tokens (CSS custom properties ported from system.css) used by web and admin. Plain CSS Modules + global tokens.css (no Tailwind, no CSS-in-JS runtime). Components are accessible (real buttons/inputs/labels, focus rings, aria), typed, tree-shakeable.
- Data: server components fetch on the server for SEO pages (home, listing detail, complex, agency, content) with revalidate; client interactivity via TanStack Query. One typed API client (apps/*/src/lib/api) — fetch with credentials, JSON, zod-parsed responses using packages/shared schemas when they exist, CSRF token header on mutations (GET /api/v1/auth/csrf then header), consistent error type {code,message}. Base URL: server-side INTERNAL_API_URL (http://127.0.0.1:4000), browser same-origin /api/v1 (nginx proxies in prod; next.config rewrites in dev).
- MOCK MODE for parallel development (backend not finished): when NEXT_PUBLIC_API_MOCK=1, the API client targets /mock-api/v1 which is served by Next route handlers under apps/<app>/src/app/mock-api/v1/** — one folder per resource, each page group owns its own resource folders (no shared registry file → no merge conflicts). Route handlers return 404 unless mock mode is on; fixtures come from mockdata.md. Endpoint paths and payload shapes MUST mirror the real backend: read apps/api/src/modules/<module>/** (controllers, dto) and packages/shared to match exactly; if an endpoint does not exist yet, use the path convention /api/v1/<resource> and record it in docs/frontend-integration/<your-item>.md (your own file) under "Assumed endpoints" so the integrator can reconcile.
- Map: a MapView abstraction with two implementations: NaverMapView (Naver Maps JS v3, script loaded with ncpKeyId=NEXT_PUBLIC_NAVER_MAP_KEY_ID, custom HTML marker overlays for clusters / complex markers with count badges / price markers, bounds-change → refetch with debounce) and StaticMapView (fallback when no key: the stylized Suncheon SVG map from the design with markers projected from lat/lng onto its bbox) so dev/tests work without keys. Map state (center, zoom, filters, selected) lives in the URL query string (shareable, back-button friendly).
- Forms: react-hook-form + zod resolvers (schemas from packages/shared where available). Formatting utils: 억/만 price format ("4억 4,500", "월세 500/45", "전세 2억 1,000"), 평 ↔ ㎡ (1평 = 3.305785㎡), 층 (저/중/고), dates (Asia/Seoul).
- Auth UX: login page starts OAuth via full-page navigation to /api/v1/auth/oauth/{kakao|naver|google}/start?redirect=<path>; session cookie is httpOnly (never read in JS); current user via GET /api/v1/auth/me (or the backend's actual path) in a session provider; route protection via Next middleware (cookie presence) + server-side check; broker console requires AGENT/AGENCY_OWNER; admin app has its own email+password+TOTP login.
- SEO: metadata per page, Open Graph, canonical, sitemap.xml, robots.txt, JSON-LD on listing/complex/agency pages, Korean lang, fast LCP (server-rendered above the fold, next/font for Pretendard-like stack: use the design's fonts via next/font/google — the design's Korean + Inter fonts).
- Quality: TypeScript strict, no any, ESLint clean, components small, loading skeletons + empty states + error states for every data view, mobile-first responsive matching MobileHome/MobileMap/MobileListing designs (bottom tab bar on mobile), keyboard accessible, color contrast AA, no layout shift, images lazy, code-split heavy widgets (map, charts). Unit tests (Vitest + Testing Library) for utils and key components.
- Parallel dev servers: next.config must read process.env.NEXT_DIST_DIR (default '.next') so concurrent agents use separate build dirs; run your dev server as: cd apps/<app> && NEXT_DIST_DIR=.next-<item> NEXT_PUBLIC_API_MOCK=1 pnpm exec next dev --port <your port> . Kill your server when done. Screenshot with ${SHOT_TOOL} http://localhost:<port>/<route> <width> <out.png> (or a small Playwright script) at 1440 and 390 widths into ${FE_SHOTS}/<item>-*.png and LOOK at them with the Read tool; compare side by side with the design screenshots.
`

const ITEM_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    routes: { type: 'array', items: { type: 'string' } },
    filesTouched: { type: 'array', items: { type: 'string' } },
    screenshots: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string', description: 'typecheck/lint/test results' },
    assumedEndpoints: { type: 'array', items: { type: 'string' } },
    openIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'routes', 'filesTouched', 'checks', 'openIssues'],
}


// ---------------- Foundation ----------------
phase('Foundation')
const foundation = await agent(`${CONTEXT}

# YOUR TASK: FRONTEND FOUNDATION (you own packages/ui/**, apps/web and apps/admin app shells, shared libs). Other page teams start after you; make their job easy and consistent.
1. Read the design system (system.css, snippets.html, DesignSystem.dc.html + its screenshot) and the 13 designs' screenshots to extract the full component inventory.
2. packages/ui (@house/ui): tokens.css (all tokens: colors incl. deal-type colors 분양/매매/전세/월세, type scale, spacing, radii, shadows, z-index, breakpoints), fonts guidance, and components: Button (variants/sizes/loading/icon), IconButton, Icon set (port the inline SVG icons from snippets.html as React components; plus Kakao/Naver/Google brand marks), Input, Textarea, Select, Combobox/Autocomplete, Checkbox, Radio, Switch/Toggle, SegmentedControl, Chip/FilterChip, FilterDropdown (popover with apply/reset), RangeSlider (price/area), Tabs, Badge (deal type, AD, 실매물확인, premium P+/P-), Tag, Card, ListingCard, ComplexRow, BrokerCard, StatTile/KPI, Table (sortable, selectable, sticky header, pagination), Pagination, Modal/Dialog, Drawer/Sheet (incl. mobile bottom sheet), Popover, Tooltip, Toast system, Skeleton, EmptyState, ErrorState, Breadcrumb, Stepper, Dropzone (upload UI only), Avatar, Sparkline + simple LineChart/BarChart (SVG), PhotoPlaceholder, Logo/Brand component from brand config. Accessible and typed. A dev-only gallery route in apps/web at /dev/ui showing every component (404 in production) for visual QA against DesignSystem.dc.html.
3. apps/web shell: next.config (NEXT_DIST_DIR support, rewrites /api/v1 → API in dev, images config for media host, security headers), root layout (fonts via next/font, tokens, metadata defaults, Korean), header/footer exactly per design, mobile header + bottom tab bar, providers (QueryClient, Session, Toast), API client + error handling + CSRF, mock-mode plumbing (src/app/mock-api/v1/ with a shared tiny helper for fixtures + one example resource 'site' with site settings/business info), auth session provider & middleware skeleton, formatting utils with unit tests, MapView abstraction with StaticMapView (port the stylized Suncheon SVG from the designs) and NaverMapView implementations + marker components (cluster bubble, complex marker with count badge + price, price marker, selected card), URL-state helpers for map filters, SEO helpers (metadata builder, JSON-LD), error/not-found/loading pages, brand config.
4. apps/admin shell: same foundation (tokens via @house/ui, API client, mock mode) + admin layout per AdminDashboard design (sidebar groups, topbar, breadcrumbs), admin auth provider skeleton.
5. Vitest + Testing Library set up for packages/ui and apps/web utils; tests passing. pnpm --filter @house/ui --filter web --filter admin typecheck, lint, test, build all green (use NEXT_DIST_DIR=.next-foundation for builds).
6. Write docs/FRONTEND.md (English): structure, component catalog with import paths, data/mocks conventions (how a page group adds its own mock-api resource folder and fixtures), map usage, forms, formatting utils, how to run a dev server on your own port + NEXT_DIST_DIR, screenshot procedure, definition of done for a page.
Screenshot /dev/ui and the shell (header/footer, mobile bar) and compare with the design; iterate until faithful. Also: ensure playwright is a root devDependency and run 'pnpm exec playwright install chromium'; add .tmp/ and .next-*/ to .gitignore.\nReturn summary, routes, files, screenshots, checks, openIssues.`,
  { label: 'foundation', phase: 'Foundation', schema: ITEM_SCHEMA })
const feConv = foundation ? foundation.summary : 'see docs/FRONTEND.md'

// ---------------- Pages ----------------
phase('Pages')
const ITEMS = [
  { key: 'w-home', app: 'web', port: 3101, design: 'Main.dc.html, MobileHome.dc.html', spec: 'Home page: hero search with autocomplete (지역/단지명) + quick chips, category entries, admin-managed banner slots (MAIN_HERO carousel, MAIN_STRIP) rendered from the ads serve API with impression beacons and click-through via the click-redirect endpoint, popular complexes ranking with asset-type tabs and deal-type counts, new verified listings row, local videos, 내놓기/구하기 band, partner agencies strip, app strip only if configured, footer business info from site settings, admin-managed notice POPUP layer with "N일 동안 보지 않기" (localStorage per popup id+version) — popup also shown on other pages per its target pages. Fully responsive to MobileHome.' },
  { key: 'w-map', app: 'web', port: 3102, design: 'MapApt.dc.html, OneRoom.dc.html, MobileMap.dc.html', spec: 'Map search for ALL asset types at /map/[assetType] (apt=아파트·분양권, oneroom=원룸·투룸, house=주택, commercial=상업·업무, land=토지): filter bar with per-asset-type filters (deal type, price ranges with 만원 units, area 평/㎡ toggle, rooms, baths, direction, floor class, built year, options; oneroom: 보증금/월세 ranges, room type, options; land: 용도지역/지목), left panel (tabs 자주 찾는 단지/최근 본/관심; list of complexes or listings with sorts 최신/실매물확인/가격/면적/준공년/사진), MapView with clusters → complex/listing markers by zoom from the map search API, breadcrumb chip (시/구/동/단지), MAP_AD banner card (closable, per session), my-location, URL state, debounce, loading/empty states, mobile layout = MobileMap (bottom sheet + chips + list toggle).' },
  { key: 'w-complex', app: 'web', port: 3103, design: 'Complex.dc.html', spec: 'Complex detail: (a) the left panel within the map (/map/apt?complex=ID) exactly per design: header actions (단지 정보, 관심 단지 toggle, 공유), facts, trade sparkline, filters, counts + 평/㎡ + sort, COMPLEX_FEATURED_AGENCY slot card, listing rows with premium chips and "중개사무소 N곳" popover (call/문의), infinite list; (b) a full SEO page /complex/[id] (단지 개요, 평형 정보, 실거래가 chart by 평형 with period toggle, 매물 summary, location mini-map, nearby, JSON-LD).' },
  { key: 'w-listing', app: 'web', port: 3104, design: 'Listing.dc.html, MobileListing.dc.html', spec: 'Listing detail /listing/[id] (SSR + JSON-LD): gallery with lightbox (keyboard + swipe), title/price/badges, key facts grid incl. ALL 공인중개사법 표시·광고 명시사항 fields, 실매물 확인 badge, description, options, mini-map, complex price chart, nearby, co-brokering agencies card list (each agency disclosure: 명칭, 소재지, 연락처, 등록번호, 대표 성명; call/문의 buttons), 관심매물 toggle (auth-gated with login redirect), share (copy link / Kakao share placeholder), 허위매물 신고 modal (reason enum + detail; auth required), calculators entry (중개보수/대출 inline sheet), similar listings, LISTING_SIDE ad slot, recent-view tracking; mobile per MobileListing with sticky CTA bar.' },
  { key: 'w-agencies', app: 'web', port: 3105, design: 'Agents.dc.html', spec: 'Broker office search /agencies (search by name/대표/address, specialty + region chips, list + map markers with clustering, profile drawer per design) and agency public page /agency/[id] (SEO: cover, 상호, 대표, 소개, 영업시간, 등록번호/주소/연락처, listings by type with filters, representative listings, map, JSON-LD RealEstateAgent).' },
  { key: 'w-deal', app: 'web', port: 3106, design: 'DealRequest.dc.html', spec: '내놓기/구하기: intro page per design, multi-step 내놓기 form (매물 유형 → 주소 search (Daum postcode script for address) + 동/호 (private) → 거래 유형/희망가/면적/입주가능일/설명 → 사진 upload via media API → 연락처 (plain phone field, validated, prefilled from profile) + 공개 범위 (전체 지역 중개사 / 선택 중개사 with agency picker) + 개인정보 수집 동의 → review & submit), multi-step 구하기 form (wanted conditions: asset type, deal type, regions multi-select, budget ranges, area, rooms, move-in date, notes, contact, consent), completion page, and 내 요청 관리 /me/requests (list, detail with received proposals from agencies, compare proposals, accept/decline, consent to reveal contact per agency, close request). Login required; drafts autosaved to localStorage.' },
  { key: 'w-auth', app: 'web', port: 3107, design: 'Login.dc.html', spec: 'Login page per design WITHOUT Apple: 카카오/네이버/Google buttons (official brand colors/marks) starting OAuth with redirect param, 일반/중개사 segmented (중개사 → after login go to agency application), OAuth callback landing/error page (/auth/callback handling error codes in Korean), signup completion /signup (terms consents with versions: 전체 동의, [필수] 이용약관, [필수] 개인정보 수집·이용, [필수] 위치기반서비스 이용약관, [선택] 마케팅 수신; nickname; 관심 지역 chips), session provider wiring + middleware protecting /me/** and /agent/**, logout, linked accounts management in settings, account withdrawal flow with confirmation.' },
  { key: 'w-me', app: 'web', port: 3108, design: 'none — extrapolate from Listing/Main', spec: 'My page /me: overview, 관심 매물 & 관심 단지 (tabs, remove), 최근 본 매물, 알림 center (in-app notifications list, mark read), 내 정보 (nickname, contact phone field, marketing consent toggle with timestamp), 연결된 계정 (from w-auth components), 회원 탈퇴 entry. Mobile layouts with bottom tab bar active state (관심, MY).' },
  { key: 'w-content', app: 'web', port: 3109, design: 'none — extrapolate from Main', spec: 'Content & utilities: 공지사항 list/detail, FAQ (accordion, categories, search), 동네TV videos (grid + YouTube embed lite), terms pages /terms/[type] with version selector (이용약관, 개인정보처리방침, 위치기반서비스 이용약관), calculators page /tools (중개보수 by deal type per Korean fee schedule as configurable table, 취득세 basic, 대출 이자/원리금 균등·원금 균등, 평↔㎡ 환산) with unit tests for the math, unified search results /search?q= (지역, 단지, 중개사무소 sections) + header autocomplete integration, 404/500/maintenance pages, sitemap.xml + robots.txt generation.' },
  { key: 'a-agency', app: 'web', port: 3110, design: 'none — extrapolate from AdminDashboard (calmer) + Agents', spec: 'Broker console under /agent (role AGENT/AGENCY_OWNER; separate layout with sidebar like admin but lighter): agency registration application /agent/apply (사무소 정보, 등록번호, 사업자번호, 대표 공인중개사, 주소 search + map pin, 중개사무소 등록증 & 사업자등록증 upload as private docs, status tracking PENDING/APPROVED/REJECTED with reason, resubmit), /agent dashboard (my listings stats, new deal requests, inquiries, expiring listings, verification reminders), /agent/profile (agency public profile edit: logo, cover, intro, hours, specialties, preview link), /agent/staff (invite code, members, remove; owner only).' },
  { key: 'a-listings', app: 'web', port: 3111, design: 'none — extrapolate from Listing + Complex + DealRequest form', spec: 'Broker listing management: /agent/listings table (status filters, search, bulk actions, 실매물 확인 due), listing create/edit WIZARD /agent/listings/new and /[id]/edit: asset type → property (complex search & select with 동/층 or address search + map pin for non-complex) → deal & price (매매/전세/월세/분양권 with premium) → 면적 (전용/공급 ㎡ with 평 helper) & rooms/baths/direction(+기준)/사용승인일/주차/관리비/입주가능일 — ALL 공인중개사법 표시·광고 명시사항 required with inline legal hints → photos (multi upload, reorder drag, cover) → description/options → 실매물 확인 record (method/date) → preview exactly as public listing page with agency disclosure → publish (server publish-validator errors mapped to fields). Co-brokerage: search existing listings in a complex and join as co-broker / leave; status transitions (거래중/계약완료/숨김).' },
  { key: 'a-inbox', app: 'web', port: 3112, design: 'none — extrapolate', spec: 'Broker inbox: /agent/requests — 내놓기/구하기 requests visible to the agency (filters by type/region/status, detail view with requester info masked until consent), send proposal form (message, suggested listings picker, price), proposal status; /agent/inquiries (listing inquiries list & reply if backend supports; otherwise call log); notifications.' },
  { key: 'm-core', app: 'admin', port: 3201, design: 'AdminDashboard.dc.html', spec: 'Admin app core: login (email + password) + TOTP enrollment (QR via otpauth URI rendered as QR — use a small QR lib) and verification, session handling, layout per design, dashboard per design (KPIs, traffic chart 7/30 days, pending agencies, recent deal requests, reports, ads ending soon) wired to admin stats endpoints, global search, notifications, permission-aware sidebar (OPERATOR/ADMIN/SUPER_ADMIN).' },
  { key: 'm-ads', app: 'admin', port: 3202, design: 'AdminBanners.dc.html', spec: 'Banners & popups management exactly per design: slot overview cards with active/limit, banner table with drag reorder (dnd-kit) within slot, status toggles (노출/중지/예약 computed), stats columns, filters, pagination; edit drawer: slot select with spec sizes, title, advertiser agency search, PC + mobile image upload (media API, dimension/size validation per slot), link URL (https/relative validation) + new window, date range, targeting (전체/특정 지역/특정 단지 with pickers), order, status; LIVE desktop + mobile preview; create/duplicate/delete with confirm; stats view per banner (daily impressions/clicks/CTR chart, date range); popups tab (title, image, link, target pages, period, dismiss days, order, preview).' },
  { key: 'm-moderation', app: 'admin', port: 3203, design: 'none — extrapolate from AdminDashboard/AdminBanners', spec: 'Moderation: 중개사무소 승인 queue + detail (application data, private document viewer via authorized endpoint, registry check result, approve/reject with reason, suspend), 매물 검수 (listing search, detail, hide/unhide, force close, history), 허위매물 신고 queue (detail, evidence, resolve actions → hide listing / warn agency / dismiss, notes), 내놓기·구하기 모니터링 (list/detail, spam flag, close), 회원 관리 (search, detail with consents & linked identities, suspend/unsuspend; personal-data views are audit-logged — show a notice).' },
  { key: 'm-content', app: 'admin', port: 3204, design: 'none — extrapolate', spec: 'Admin content & config: 공지/FAQ/동네TV CRUD (rich text with safe subset, preview), 메인 화면 편집 (section order/visibility for the home page if backend supports, else stub), 단지 관리 (list/detail/edit facts, area types, photos; 실거래가 sync status + manual trigger), 사이트 설정 (business info 상호/대표/사업자등록번호/통신판매업 신고번호/주소/개인정보보호책임자/연락처 used by the footer), 약관 관리 (versions, publish new version → re-consent), 관리자 계정·권한 (SUPER_ADMIN), 작업 기록 (audit log viewer with filters, before/after diff), 통계 (traffic, listings, requests, ads over time).' },
]

const buildItem = it => agent(`${CONTEXT}
Foundation conventions (read docs/FRONTEND.md too): ${feConv}

# YOUR TASK: implement page group '${it.key}' in apps/${it.app}.
Design reference: ${it.design}
Scope: ${it.spec}
You own: the routes of this group under apps/${it.app}/src/app/**, their page-specific components under apps/${it.app}/src/features/${it.key}/**, your mock resources under apps/${it.app}/src/app/mock-api/v1/<resources you need>/** (check first whether another group already created a resource folder; if so, extend only by adding new sub-route files, never rewrite theirs), and docs/frontend-integration/${it.key}.md. Use @house/ui components; do not edit packages/ui (if a generic component is missing, build it in your features folder and list it in openIssues for promotion). Use your dev server port ${it.port} and NEXT_DIST_DIR=.next-${it.key}.
Definition of done: every route works in mock mode with realistic Suncheon fixtures, loading/empty/error states, responsive at 390 and 1440 (screenshots compared with the design, iterate until faithful and polished), accessible, SEO metadata where public, typecheck + lint clean for the app, unit tests for non-trivial logic. Return summary, routes, files, screenshots, checks, assumedEndpoints, openIssues.`,
    { label: `build:${it.key}`, phase: 'Pages', schema: ITEM_SCHEMA })

// Shared by the prompts below (not by buildItem/CONTEXT: changing those would throw away
// the cached build results on resume).
const ECONOMY = `Token economy (quality first, but no waste): look at existing screenshots in ${FE_SHOTS}/ before taking new ones; screenshot only what you need to judge and re-shoot only routes you changed; locate code with grep instead of reading whole folders; check non-visual things (links, status codes, headings, aria, console errors, hydration warnings) with a small Playwright/DOM or HTTP script rather than screenshots. Kill every dev server you start before you return.`

const REVIEW_FIX_SCHEMA = {
  type: 'object',
  properties: {
    ...ITEM_SCHEMA.properties,
    issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['high', 'medium', 'low'] }, where: { type: 'string' }, problem: { type: 'string' }, status: { type: 'string', enum: ['fixed', 'not-fixed'] }, note: { type: 'string' } }, required: ['severity', 'where', 'problem', 'status'] } },
  },
  required: [...ITEM_SCHEMA.required, 'issues'],
}

// One agent reviews AND fixes (instead of a review agent + a fix agent that has to
// re-learn the same code, restart the same server and re-shoot the same pages).
// It is still a different agent from the builder, so the review stays independent.
const reviewFixItem = (b, it) => agent(`${CONTEXT}

# YOUR TASK: demanding review of page group '${it.key}' (apps/${it.app}) as a senior product designer + senior frontend engineer, then fix what you find.
Another agent built this group; you are its independent reviewer. Judge it as if you had to sign off on it for production, not as its author.
Design reference: ${it.design}. Scope it was built to: ${it.spec}
Builder report: ${JSON.stringify(b || {}).slice(0, 3000)}
1. Review. The builder's screenshots are ${FE_SHOTS}/${it.key}-*.png: look at them first and compare with the design screenshots in ${SHOTS}. Run the dev server (port ${it.port + 50}, NEXT_DIST_DIR=.next-${it.key}-review, mock mode) for whatever they do not settle (interactions, states, 390 layout, anything that looks stale). Read the code. Find: visual deviations from the design/system, broken/clipped layouts, missing states, missing spec items, UX problems in Korean real-estate context, accessibility (labels, focus, contrast, keyboard), performance (client bundles, unnecessary client components, images), SEO gaps, security (XSS via dangerouslySetInnerHTML, open redirects in redirect params, leaking private fields like 호수 or phone before consent), API contract mismatches vs apps/api code.
2. Fix every high and medium issue (or justify precisely why not), plus low ones that are quick. Same ownership rules as the builder: the group's routes under apps/${it.app}/src/app/**, apps/${it.app}/src/features/${it.key}/**, its mock resources, docs/frontend-integration/${it.key}.md; no packages/ui edits (list promotion candidates in openIssues), no pnpm add/install.
3. Verify: re-screenshot every route you changed at 1440 and 390 into ${FE_SHOTS}/${it.key}-fix-*.png and LOOK; typecheck + lint + tests for the app green.
${ECONOMY}
Return summary, routes, files, screenshots, checks, assumedEndpoints, openIssues, and issues: every finding with severity and whether you fixed it.`,
  { label: `review-fix:${it.key}`, phase: 'Pages', schema: REVIEW_FIX_SCHEMA })

// Groups reviewed by an earlier run (separate review agent): their high/medium findings were
// saved to .tmp/reviews/<key>.json, and args.reviewed = { <key>: <number of findings> }.
// They only get a fix agent.
const REVIEWED = (args && args.reviewed) || {}
const fixItem = it => agent(`${CONTEXT}

# YOUR TASK: fix the findings of an independent review of page group '${it.key}' (apps/${it.app}).
Design reference: ${it.design}. Scope: ${it.spec}
Findings: read .tmp/reviews/${it.key}.json (${REVIEWED[it.key]} high/medium issues, each with where / problem / suggested fix). The review was done before any fixes; check each against the current code first.
Fix each (or justify precisely why not). Same ownership rules as the builder: the group's routes under apps/${it.app}/src/app/**, apps/${it.app}/src/features/${it.key}/**, its mock resources, docs/frontend-integration/${it.key}.md; no packages/ui edits, no pnpm add/install. Dev server port ${it.port}, NEXT_DIST_DIR=.next-${it.key}, mock mode.
Verify: re-screenshot every route you changed at 1440 and 390 into ${FE_SHOTS}/${it.key}-fix-*.png and LOOK; typecheck + lint + tests for the app green.
${ECONOMY}
Return summary, routes, files, screenshots, checks, assumedEndpoints, openIssues.`,
  { label: `fix:${it.key}`, phase: 'Pages', schema: ITEM_SCHEMA })

// FIFO gate instead of pipeline(): every Pages agent() call waits here for a free
// slot, so no more than MAX_CONCURRENT agents are ever running.
// Resume note: cached results are only reused until the first agent() call that has none,
// so every call that may be cached (the builds) is issued before any new one — hence the
// barrier between builds and review/fix. Builds are 80-95 min each, so on a fresh run the
// barrier costs little against keeping finished work across resumes.
// A group whose stage throws stays null.
let active = 0
const waiting = []
const gated = async fn => {
  if (active >= MAX_CONCURRENT) await new Promise(res => waiting.push(res))
  else active++
  try {
    return await fn()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else active--
  }
}
const results = ITEMS.map(() => null)
log(`Pages: ${ITEMS.length} groups, at most ${MAX_CONCURRENT} agents at once`)
const built = await parallel(ITEMS.map(it => () => gated(() => buildItem(it))))
built.forEach((b, idx) => { if (!b) log(`Page group ${ITEMS[idx].key}: build failed`) })
await parallel(ITEMS.map((it, idx) => async () => {
  if (!built[idx]) return
  try {
    if (REVIEWED[it.key] !== undefined) {
      const x = REVIEWED[it.key] ? await gated(() => fixItem(it)) : null
      results[idx] = { key: it.key, fixed: REVIEWED[it.key], result: x }
    } else {
      const x = await gated(() => reviewFixItem(built[idx], it))
      results[idx] = { key: it.key, fixed: ((x && x.issues) || []).filter(i => i.status === 'fixed').length, result: x }
    }
  } catch (e) {
    log(`Page group ${it.key} failed: ${(e && e.message) || e}`)
  }
}))
log('Pages done: ' + results.filter(Boolean).length + '/' + ITEMS.length)

// ---------------- Consistency ----------------
phase('Consistency')
const AREAS = ['packages/ui', 'apps/web', 'apps/admin']
const CONS_SCHEMA = {
  type: 'object',
  properties: { perArea: { type: 'array', items: { type: 'object', properties: { area: { type: 'string', enum: AREAS }, fixes: { type: 'array', items: { type: 'string' } } }, required: ['area', 'fixes'] } }, promote: { type: 'array', items: { type: 'string' } }, overall: { type: 'string' } },
  required: ['perArea', 'overall'],
}
const pageSummary = results.filter(Boolean).map(x => ({ key: x.key, open: x.result && x.result.openIssues })).filter(x => x.open && x.open.length)
const cons = await agent(`${CONTEXT}

# YOUR TASK: cross-app consistency & completeness critic for apps/web (user site + /agent console) and apps/admin. 16 page groups were built and reviewed separately; your job is what no single group could see: the seams between them.
Work code-first, then confirm live:
1. Code sweep across apps/web, apps/admin, packages/ui: components duplicated across features/* that should be promoted to @house/ui; prices/areas/dates formatted by hand instead of the shared format utils; hard-coded colors/sizes instead of tokens; the same mock-api resource shaped differently by different groups (compare the mock route handlers and the zod types the features use); every link target (href, router.push, redirects) checked against the real route tree; pages missing loading/empty/error states; auth gating and toasts wired differently between groups.
2. Live: run both apps in mock mode (web port 3190 NEXT_DIST_DIR=.next-cons, admin port 3290 NEXT_DIST_DIR=.next-cons). With an HTTP/Playwright script, request every route and record status codes, console errors and hydration warnings (no screenshots needed for that). Then screenshot ONE representative page per page group at 1440 and 390 into ${FE_SHOTS}/cons-*.png and LOOK at them side by side for visual seams (header, spacing rhythm, type scale, buttons, chips, cards, empty states). The groups' own screenshots for other states are already in ${FE_SHOTS}/.
Open issues the page groups left (promotion candidates etc.): ${JSON.stringify(pageSummary).slice(0, 6000)}
${ECONOMY}
Return fixes grouped into exactly these areas: packages/ui (new/changed shared components only), apps/web (user site and /agent console, incl. replacing local copies with promoted components), apps/admin (same for admin). Each fix must name the exact files and the exact change. Also return the list of components to promote.`,
  { label: 'consistency-critic', phase: 'Consistency', schema: CONS_SCHEMA })

// Three fix agents instead of one per path prefix: packages/ui first (new shared
// components), then apps/web and apps/admin in parallel (disjoint folders).
const fixesFor = a => ((cons && cons.perArea) || []).filter(p => p.area === a).flatMap(p => p.fixes || [])
const promote = (cons && cons.promote) || []
const consFix = []
let uiReport = null
if (fixesFor('packages/ui').length || promote.length) {
  uiReport = await agent(`${CONTEXT}

# YOUR TASK: consistency fixes in packages/ui only. Promote these components into @house/ui (generalize the best of the duplicated copies, accessible, typed, CSS Modules + tokens, exported from the package index, with a /dev/ui gallery entry and tests where logic exists): ${JSON.stringify(promote)}
Other packages/ui fixes: ${JSON.stringify(fixesFor('packages/ui'))}
Do NOT edit apps/** feature code: the app agents that run after you replace their local copies with your components, using your report. Keep @house/ui typecheck/lint/tests green and do not change existing component APIs in breaking ways.
${ECONOMY}
Return summary (with the exact import names and props of every promoted component), files, checks, openIssues.`,
    { label: 'cons-fix:ui', phase: 'Consistency', schema: ITEM_SCHEMA })
  consFix.push(uiReport)
}
const appFixes = await parallel(['apps/web', 'apps/admin'].filter(a => fixesFor(a).length || (uiReport && promote.length)).map(a => () => agent(`${CONTEXT}

# YOUR TASK: consistency fixes in ${a} only (other agents edit packages/ui and the other app; do not touch them). Fixes: ${JSON.stringify(fixesFor(a))}
Promoted @house/ui components to adopt in place of local copies (report of the packages/ui agent): ${JSON.stringify(uiReport ? uiReport.summary : 'none').slice(0, 4000)}
Verify each fixed page live (dev server port ${a === 'apps/web' ? 3191 : 3291}, NEXT_DIST_DIR=.next-cons-fix, mock mode) at 1440 and 390; keep typecheck/lint/tests for the app green.
${ECONOMY}
Return summary, routes, files, screenshots, checks, openIssues.`,
  { label: `cons-fix:${a.split('/')[1]}`, phase: 'Consistency', schema: ITEM_SCHEMA })))
consFix.push(...appFixes)

const gate = await agent(`${CONTEXT}

# YOUR TASK: frontend final gate. Run pnpm install; then for @house/ui, web, admin: typecheck, lint, unit tests, production build (NEXT_DIST_DIR=.next default is fine now). Fix remaining failures minimally. Merge all docs/frontend-integration/*.md into docs/frontend-integration/INDEX.md listing every assumed endpoint / contract mismatch the backend integrator must reconcile. Return summary, checks (exact counts), openIssues.`,
  { label: 'frontend-gate', phase: 'Consistency', schema: ITEM_SCHEMA })

return {
  foundation: foundation && { checks: foundation.checks, open: foundation.openIssues },
  pages: results.filter(Boolean).map(x => ({ key: x.key, fixed: x.fixed, checks: x.result && x.result.checks, open: x.result && x.result.openIssues })),
  consistency: cons && cons.overall,
  consistencyFixes: consFix.filter(Boolean).map(x => ({ summary: x.summary, checks: x.checks, open: x.openIssues })),
  gate,
}
