# Frontend integration notes — w-content (apps/web)

Scope: 공지사항, FAQ, 동네TV, 약관·정책 (`/terms/[type]`), 부동산 계산기 (`/tools`), 통합 검색
(`/search`) + the autocomplete search field, 커뮤니티 hub (`/community`), 고객센터 (`/support`),
404 / 500 / 점검 pages, `sitemap.xml`, `robots.txt`.
Code: `apps/web/src/features/w-content/**`, routes in their own route group
`apps/web/src/app/(content)/{notices,faq,videos,terms,tools,search,community,support}` (layout,
`error.tsx`, `not-found.tsx` — and deliberately **no group-level `loading.tsx`**, see "Status codes"),
`app/{not-found,error,sitemap,robots}.ts(x)`, `app/maintenance`, `app/(site)/{error,not-found}.tsx`.

None of the backend controllers exist yet (only module READMEs + Prisma models), so every **payload
shape** below is an assumption. Each one is parsed by exactly one zod schema in
`src/features/w-content/api/schemas.ts` — reconcile by editing that schema and the mock fixture
together. The schemas are lenient: unknown keys are ignored, display extras are optional, and list
endpoints may answer with the pagination envelope, `{ items }` or a bare array (`pageOf()`).

## Endpoints that are listed in the backend READMEs

| Method | Path                                                             | Module                          | Used by                      | Assumed response                                                                                            |
| ------ | ---------------------------------------------------------------- | ------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/notices?page&pageSize`                                  | admin                           | `/notices`, sitemap          | envelope of `{ id, title, isPinned, publishedAt, viewCount }` — published only, pinned first then newest    |
| GET    | `/api/v1/notices/:id`                                            | admin                           | `/notices/[id]`              | summary + `content` (+ optional `prev` / `next`, see below); `404` when missing/unpublished                 |
| GET    | `/api/v1/faqs`                                                   | admin                           | `/faq`                       | list of `{ id, category: FaqCategory, question, answer, sortOrder }` (all published, small set)             |
| GET    | `/api/v1/videos?page&pageSize`                                   | admin                           | `/videos`                    | envelope of the `local_videos` columns (mock owned by **w-home**: `mock-api/v1/videos`)                     |
| GET    | `/api/v1/terms/:type`                                            | auth                            | `/terms/[type]`              | current `{ id, type, version, title, content, isRequired, effectiveAt }` (mock owned by **w-auth**)         |
| GET    | `/api/v1/listings`, `/complexes`, `/agencies` (`?page&pageSize`) | listings / complexes / agencies | `sitemap.xml`                | only `items[].id` (+ optional `updatedAt`) is read; see "sitemap.xml" for the failure policy                |
| GET    | `/api/v1/complexes?q&page&pageSize`                              | complexes                       | `/search` 단지 section       | envelope of complex items parsed with **w-complex `complexDetailSchema`**; `total` = tab count              |
| GET    | `/api/v1/agencies?q&page&pageSize`                               | agencies                        | `/search` 중개사무소 section | envelope of **w-agencies `agencySummarySchema`** items; `total` = tab count                                 |
| GET    | `/api/v1/regions?sggCode`                                        | (ASSUMED by w-map)              | `/search` 지역 section       | w-map `regionSchema` list; matched by name on the web server (`matchRegions`)                               |
| GET    | `/api/v1/site-settings/public`                                   | admin                           | `/maintenance`, `/support`   | `CONTACT { phone, email, hours, kakaoChannelUrl }` (+ `BUSINESS_INFO` fallback); `[…]` placeholders ignored |

Notes on these:

- **Content format.** `notices.content`, `faqs.answer` and `terms.content` are treated as **plain
  text** and rendered by `<RichText>` (`features/w-content/lib/rich-text.ts`) — never as HTML. Light
  markup is understood: `## 제목`, `- 항목`, `1. 항목`, blank line = paragraph, `제1조 (목적)` / `부칙`
  lines become headings, bare `http(s)://` URLs are linked. If the admin editor ends up emitting
  HTML, a server-side sanitizer + a different renderer is needed (do not switch to
  `dangerouslySetInnerHTML` without one).
- **Notice `viewCount`.** The page only displays it; the backend is expected to count views on
  `GET /notices/:id` (ISR caches the page for 120 s, so counting cannot happen in the frontend).
- **Notice neighbours.** `prev` (older) / `next` (newer) `{ id, title, publishedAt } | null` on the
  detail response are optional extras; without them the 이전 글 / 다음 글 block is hidden.
- **Videos.** `durationSeconds`, `viewCount`, `channelName` are not columns of `local_videos`; the UI
  hides them when absent. `thumbnailUrl` falls back to `https://i.ytimg.com/vi/<id>/hqdefault.jpg`.
  Thumbnails are rendered with `next/image unoptimized` (remote YouTube stills are already sized), so
  no `images.remotePatterns` entry is required. The player is a lite embed: the
  `https://www.youtube-nocookie.com/embed/<id>` iframe is only created when the visitor presses play
  — a future full CSP must allow `frame-src https://www.youtube-nocookie.com` and
  `img-src https://i.ytimg.com`.
- **Terms `:type`.** Sent as the `TermsType` enum value (`SERVICE`, `PRIVACY`, `LOCATION`,
  `MARKETING`). URL slugs are lowercase: `/terms/service|privacy|location|marketing`.

## Assumed endpoints (not in any README yet)

| Method | Path                                    | Used by                             | Request                                 | Response                                                                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------- | ----------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/v1/terms/:type/versions`          | version selector on `/terms/[type]` | —                                       | list (newest first) of `{ id, type, version, title, isRequired, effectiveAt, isCurrent }` — published versions only, no content                                                                                                                                                                                    |
| GET    | `/api/v1/terms/:type/versions/:version` | `/terms/[type]?version=<v>`         | —                                       | one document `{ …, content }`; `404 TERMS_NOT_FOUND`                                                                                                                                                                                                                                                               |
| GET    | `/api/v1/policies/:slug`                | `/terms/false-listing`              | —                                       | `{ slug, title, version?, effectiveAt?, content }` (content = RichText plain text); `404` until the operator publishes it → the page shows "준비하고 있어요". Proposed: an admin content type "운영 정책" next to notices/FAQ (or a non-consent `TermsType`, e.g. `LISTING_POLICY`, served by the terms endpoints) |
| GET    | `/api/v1/search/suggest`                | autocomplete (`<SiteSearch>`)       | `q` (may be empty), `limit` (default 8) | `{ items: [{ type: 'REGION' \| 'COMPLEX' \| 'AGENCY', id, label, description?, lat?, lng? }], popular?: string[] }`                                                                                                                                                                                                |

- If the version endpoints are not built, the page still works: it shows the current document from
  `GET /terms/:type` and hides the selector (the version list request failing is tolerated).
- **Unified search (`/search?q=`) has no endpoint of its own any more.** `getSearchResults`
  (`features/w-content/api/server.ts`) fans out over `GET /complexes?q`, `GET /agencies?q` (both in
  the module READMEs, query = `complexSearchQuerySchema` / `agencySearchQuerySchema`) and
  `GET /regions`, with the item schemas of w-complex / w-agencies / w-map. Each section fails on its own
  (inline "일부 결과를 불러오지 못했어요"); on a single-section tab the other two are requested with
  `pageSize=1` just for their totals. 준공연도 / 평형 labels are formatted in the UI
  (`search/format.ts`), not expected from the backend.
- **`GET /search/suggest` still needs a backend owner** — the complexes module is the natural one (it
  already has the trigram indexes on complex name/address; regions and agency names can be unioned in).
  Its contract is defined once in `features/w-content/api/schemas.ts` (`searchSuggestSchema`);
  w-home (`api/schemas.ts#suggestResponseSchema`) and w-map (`api/schemas.ts#suggestResponseSchema`)
  still keep identical local copies and should import the w-content one (their files, not ours).
  Region items need `lat`/`lng` (map link `/map/apt?c=<lat>,<lng>&z=15`).
- The suggest mock is built from the same mock records as `/regions`, `/complexes` and `/agencies`, so
  a suggestion opens the same record the results list.

## Mock resources owned by this group

`apps/web/src/app/mock-api/v1/`: `notices/` (+ `[id]`), `faqs/`, `search/suggest/`, `policies/[slug]/`,
`terms/[type]/versions/` (+ `[version]`, own `_fixtures.ts` that builds on the w-auth `terms/_fixtures.ts`:
the current version always comes from w-auth, this group only adds superseded versions).

Dev switches (mock mode only, handled in `features/w-content/lib/dev.ts`): `?_empty=1` (empty
state), `?_error=1` (error state), `?_delay=<ms>` (loading skeleton) on `/notices`, `/faq`, `/videos`,
`/search?q=…`, `/terms/<slug>`.

## Routes added / behaviour worth knowing

- `/terms/brokerage-fee` is a **static page** rendered from the statutory fee table the calculator
  uses. `/terms/false-listing` (허위매물 신고 정책) is **served by the back-office**
  (`GET /policies/false-listing`, assumed): nothing of the policy (criteria, sanctions, response times)
  ships in the bundle any more; the mock serves a clearly labelled example. The FAQ / policy CTAs no
  longer promise response times (영업일 1일 / 2일) — put such sentences in the operator's content.
- Every `/terms/*` page has the document name as its `h1` (eyebrow "약관 · 정책"); 조 headings are
  `h2`. `<RichText headingLevel={3}>` renders the headings one level deeper where the text sits under
  an `h2` (FAQ answers, whose questions are `h2`).
- `/community` (GNB "커뮤니티") is a hub: latest 3 동네TV videos + latest 5 공지사항 + links.
- `/support` (고객센터): contact channels from `site-settings/public` CONTACT (tel: / mailto: / 카카오톡
  채널 links only for real, non-placeholder values), FAQ category shortcuts, `#report` (how to report a
  false listing — a report needs the listing, `reportCreateSchema` targetType + targetId, so it is filed
  from the listing page) and `#ads` (광고·제휴 문의 by e-mail). `/support/report` and `/support/ads`
  answer **307** to those anchors. Suggest to foundation: point `ROUTES.report` / `ROUTES.adInquiry` at
  `/support#report` / `/support#ads` directly.
- Header search: `features/w-content/search/HeaderSearchLink.tsx` is a ready 44px 검색 button for
  foundation's `SiteHeader` (first child of `.act`; hidden on `/` and `/search`). A 280px pill does
  not fit the GNB at 1440px (≈200px free between the menu and the CTAs).
- `/search` without `q` is the search landing (the mobile header's 검색 icon links there; the field is
  focused but the suggestion list opens only on typing — `<SiteSearch showPopular={false}>`); result
  pages are `noindex`. `<SiteSearch variant="hero" | "pill" />`
  (`features/w-content/search/SiteSearch.tsx`) is the reusable autocomplete field.
- **Calculators** are pure functions with data-driven rule tables in
  `features/w-content/tools/lib/*` (`BROKERAGE_FEE_SCHEDULE`, `ACQUISITION_TAX_RULES`,
  `TRANSFER_TAX_RULES`). Every function takes the table as an optional last argument, so the tables
  can later be served by the back-office (e.g. a `SiteSettingKey.FEE_SCHEDULE`) without touching the
  math. Rates as implemented: 중개보수 = 공인중개사법 시행규칙 별표 1 (2021-10-19), 취득세 = 지방세법
  §11/§13의2 for a non-조정대상지역, 양도소득세 = 2023+ general progressive rates (simplified) plus 분양권 at the flat §104① rates (1년 미만 70%, 이후 60%, no 장기보유특별공제 / 1주택 비과세). **Have a
  licensed broker / tax professional review the tables before launch.**
- **Status codes.** The w-content routes live in `app/(content)` with **no loading boundary above the
  pages that can fail** (no group `loading.tsx`, none on `notices/[id]` or `terms/[type]`; the
  notices list keeps its skeleton in `notices/(list)/loading.tsx`, outside `[id]`). So
  `notFound()` / `redirect()` run before the first byte: `/notices/<unknown id>`,
  `/notices/not-a-uuid` and `/terms/<unknown>` answer a real **404**, `/terms/<type>?version=<unknown>`
  a **307** to the current document. (Under `(site)`, which has a group `loading.tsx`, the same calls
  answer 200 + client-side 404 / meta refresh — relevant for the other groups still there.)
  `app/not-found.tsx` (root, unmatched URLs) and `app/(content)/not-found.tsx` /
  `app/(site)/not-found.tsx` share `NotFoundBody`.
  `features/w-content/system/ChromeCssAnchor.tsx` works around a Next 15.5 quirk: the root
  not-found entry only links CSS reachable through client components, so the chrome's
  server-component CSS Modules (SiteShell, SiteFooter, ui Logo) are re-imported there.
- **500.** `app/error.tsx` (root, with its own logo bar) and `app/(site)/error.tsx` render
  `features/w-content/system/ErrorPage` (retry, home, request id / digest). `app/global-error.tsx` is
  unchanged. Other groups' boundaries can keep using `@/components/system/RouteError`.
- **Maintenance.** `/maintenance` is a stand-alone dynamic page (no site chrome, tolerates the API
  being down). Nothing redirects to it from inside Next: the reverse proxy should serve it while the
  API is being maintained, with a 503, e.g.

  ```nginx
  # when /etc/nginx/maintenance.on exists
  if (-f /etc/nginx/maintenance.on) { set $maint 1; }
  if ($uri ~ ^/(maintenance|_next/|favicon)) { set $maint 0; }
  if ($maint) { return 503; }
  error_page 503 /maintenance;
  ```

  Optional env on the web app: `MAINTENANCE_WINDOW` ("11월 26일(목) 02:00 ~ 05:00"),
  `MAINTENANCE_MESSAGE`.

- **robots.txt** disallows `/api/`, `/mock-api/`, `/dev/`, `/me`, `/agent`, `/login`, `/signup`,
  `/deal/sell`, `/deal/find`, `/search`, `/maintenance` and points at `/sitemap.xml`. A build with
  `NEXT_PUBLIC_API_MOCK=1` answers `Disallow: /` (previews must never be indexed).
  `NEXT_PUBLIC_SITE_URL` must be the public origin (it is used for every `<loc>` and canonical).
- **sitemap.xml** is regenerated hourly (`revalidate = 3600`): static pages (no `lastModified` — we do
  not know it) + every id returned by the public list endpoints (100 per page, max 50 pages per
  resource). Failure policy: during `next build` (no API) a failing resource contributes 0 URLs with a
  warning; **at runtime any API error fails the regeneration**, so Next keeps serving the last complete
  sitemap and retries later instead of caching a truncated one for an hour. If the listing count grows
  beyond ~5,000 per resource, switch to `generateSitemaps()` (sitemap index) or expose a slim
  `GET /sitemap/ids` endpoint.
