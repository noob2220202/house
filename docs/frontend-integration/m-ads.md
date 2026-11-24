# Frontend integration notes — m-ads (admin: banners & popups)

Scope: `apps/admin/src/app/(console)/banners/**`, `apps/admin/src/features/m-ads/**` and the mock
resources listed below. See `docs/FRONTEND.md` for conventions.

The ads controllers do not exist yet (`apps/api/src/modules/ads/README.md` + the shared input
schemas / enums / constants only). **Request bodies** follow `packages/shared/src/schemas/ads.ts`
exactly; every **response shape** below is an assumption. Each response is parsed by exactly one zod
schema in `apps/admin/src/features/m-ads/api/schemas.ts` — reconcile the schema and the mock
fixture together.

## Routes

| Route                 | What                                                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/banners`            | 배너 tab: slot overview cards (live / limit), banner list (filters, reorder, status toggles, stats columns, pagination), 공지 팝업 quick settings, 슬롯 규격표 modal, editor |
| `/banners/popups`     | 팝업 tab: popup list (status filter, reorder, toggles, stats columns), editor                                                                                                |
| `/banners/[id]/stats` | Per-banner statistics: range (7 / 14 / 30일 · 전체 기간 · 직접 선택), KPI tiles, daily chart (노출 / 클릭 / CTR), daily table                                                |

State lives in the query string (shareable, back-button friendly; written with the History API, no
server round-trip):

- `/banners?slot=<BannerSlot>&status=<BannerStatus>&q=<text>&page=<n>` — list filters / search / page
- `?edit=<id>` · `?new=1` · `?copy=<id>` — the editor (create / edit / duplicate) on both tabs.
  `/banners?new=1&slot=MAP_AD` preselects the slot.
- `/banners/[id]/stats?range=7|14|30|all` or `?from=YYYY-MM-DD&to=YYYY-MM-DD`

The editor is a docked right column from 1181px (full height from 1440px like the design, under the
topbar between 1181 and 1439px) and a modal sheet below. Sidebar entry: `ADMIN_ROUTES.banners`
(`배너·팝업 관리`); `ADMIN_ROUTES.popups` = `/banners/popups`.

## Endpoints used

| Method | Path                                                    | Used by                                                          | Backend status                                             |
| ------ | ------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/v1/admin/banners?slot&status&q&page&pageSize`     | list, order select of the editor (`slot` + `pageSize=100`)       | README — query params + response assumed (1, 2)            |
| GET    | `/api/v1/admin/banners/:id`                             | editor, stats header                                             | README — response assumed (1)                              |
| POST   | `/api/v1/admin/banners`                                 | create / duplicate (`bannerInputSchema`)                         | README + shared schema                                     |
| PATCH  | `/api/v1/admin/banners/:id`                             | save, status toggle (`{ paused }` only)                          | README — partial body + `null` clears assumed (3)          |
| DELETE | `/api/v1/admin/banners/:id`                             | delete (204)                                                     | README                                                     |
| PUT    | `/api/v1/admin/banners/reorder`                         | drag / keyboard reorder, order select (`reorderSchema: { ids }`) | README + shared schema — semantics assumed (4)             |
| GET    | `/api/v1/admin/banners/:id/stats?from&to`               | stats page                                                       | README — query + response assumed (5)                      |
| GET    | `/api/v1/admin/banner-slots`                            | slot cards, spec sheet, editor                                   | README (ADMIN+) — response + OPERATOR read assumed (6)     |
| PATCH  | `/api/v1/admin/banner-slots/:slot`                      | 동시 노출 수 in the spec sheet (`{ maxActive }`, ADMIN+)         | README — body assumed (6)                                  |
| GET    | `/api/v1/admin/popups?status&page&pageSize`             | popup list, quick panel, tab count                               | README — response assumed (7)                              |
| GET    | `/api/v1/admin/popups/:id`                              | popup editor                                                     | README — response assumed (7)                              |
| POST   | `/api/v1/admin/popups`                                  | create / duplicate (`popupInputSchema`)                          | README + shared schema                                     |
| PATCH  | `/api/v1/admin/popups/:id`                              | save, toggle, quick panel (period / pages / dismiss)             | README — partial body assumed (3)                          |
| DELETE | `/api/v1/admin/popups/:id`                              | delete (204)                                                     | README                                                     |
| PUT    | `/api/v1/admin/popups/reorder`                          | reorder (`{ ids }`)                                              | README — semantics assumed (4)                             |
| POST   | `/api/v1/admin/media?purpose=BANNER\|POPUP` (multipart) | image upload (field `file`) → `MediaDto`                         | media README                                               |
| GET    | `/api/v1/media/:id`                                     | polled after an upload until a variant URL exists                | media README — readable by the uploading admin assumed (8) |
| GET    | `/api/v1/agencies?q&page&pageSize`                      | advertiser picker (public search)                                | agencies README — fields read: 9                           |
| GET    | `/api/v1/complexes?q&page&pageSize`                     | complex targeting picker (public search)                         | complexes README — fields read: 9                          |

## Assumed endpoints (not in any backend README — please confirm or rename)

| Method | Path                       | Purpose                                                                                                                                                                                                                                 |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/regions?sggCode=` | 읍면동 / 지구 list of the city for the region-targeting picker: `{ items: [{ code, name, parentName?, lat?, lng? }] }` (`code` must satisfy `regionCodeSchema`). First assumed by w-map; m-ads only reads `code`, `name`, `parentName`. |

There is no popup statistics endpoint in the README (`/admin/banners/:id/stats` only). The popup
list shows `impressions` / `clicks` totals **if** the popup payload carries them (see 7); there is no
per-popup stats page. If popups are tracked like banners, `GET /api/v1/admin/popups/:id/stats` with
the shape of (5) would let the stats screen be reused as is.

## Assumed payload shapes

1. **Admin banner** (`adminBannerSchema`) — list items and detail:

   ```
   { id, code?, slot, title, advertiserName|null, agencyId|null,
     agency?: { id, name, representativeName? } | null,
     pcMedia: MediaDto|null, mobileMedia: MediaDto|null,
     linkUrl|null, newWindow, startAt, endAt, paused, priority, sortOrder,
     targeting, targetRegionCodes: string[], targetComplexIds: string[],
     targetRegions: [{ code, name }], targetComplexes: [{ id, name }],
     memo?, status: BannerStatus, impressions, clicks, createdAt?, updatedAt? }
   ```

   - `status` is the computed `computeScheduleStatus` value; the UI recomputes it locally from
     `paused` / `startAt` / `endAt` for optimistic toggles, so both must agree.
   - `sortOrder` is **1-based and dense inside a slot** (shown as "메인 상단 대형 2").
   - `impressions` / `clicks` are lifetime totals (flushed counters + today's Redis counters if cheap).
   - `targetRegions` / `targetComplexes` carry display names; without them chips fall back to the
     raw code / "단지".
   - `agency` is needed for the "대표 ○○○" line of office banners; `code` ("AD-03") is optional —
     the UI falls back to `#` + the first 8 characters of `id`.
   - `MediaDto` = `packages/shared/src/schemas/media.ts`; the UI shows `variants.large ?? medium ??
thumb` (the `thumb` variant is a 320×240 cover crop and unusable for wide banners, so `large`
     / `medium` must exist for `BANNER` / `POPUP` media).

2. **List** — pagination envelope `{ items, page, pageSize, total, totalPages }`, ordered by slot
   (enum order) then `sortOrder`. `slot` and `status` (computed) filter, `q` (the list's "광고주, 배너 ID 검색" field)
   matches title / advertiser name / code, whitespace- and case-insensitive. The editor's order
   select and the reorder flow read one whole slot with `?slot=X&page=1&pageSize=100`, so
   `pageSize` must allow at least the largest slot.

3. **PATCH semantics** — partial body; the merged record is validated with `bannerInputSchema` /
   `popupInputSchema`. `null` clears an optional field (`agencyId`, `advertiserName`,
   `mobileMediaId`, `linkUrl`, `memo`). The list toggle sends only `{ paused }`. Changing `slot`
   appends the banner to the new slot and renumbers the old one.
   Errors mapped by the UI: `400 VALIDATION_FAILED` (`details[].path` = field name → inline error),
   `409 BANNER_SLOT_FULL` (activating beyond `maxActive`; shown under the status control),
   `BANNER_INVALID_LINK` (link field), `404 BANNER_NOT_FOUND` / `POPUP_NOT_FOUND`.
   The form sends KST calendar days as `startAt = <day>T00:00:00+09:00`,
   `endAt = <day>T23:59:59+09:00` (both days inclusive).

4. **Reorder** — `PUT …/reorder` with `{ ids }` = **all** banner ids of **one** slot (all popup ids)
   in the new display order; `sortOrder` becomes 1..n. The UI always fetches the slot fresh, applies
   the move and sends the complete list (moves on a filtered / paged list keep hidden rows in place).
   Ids of different slots → `400`. Response is ignored (mock: `{ items: [{ id, sortOrder }] }`).
   New banners / popups are expected to be **appended** (`sortOrder = count + 1`) by `POST` (and a
   banner moved to another slot by `PATCH`); when the editor's order select asks for another position
   the UI follows up with one reorder call. A new / copied item that should stay last sends no reorder
   at all, so its default place never depends on counts that are still loading.

5. **Banner stats** (`bannerStatsSchema`) — `GET …/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` (KST days,
   inclusive; both optional = whole campaign):

   ```
   { bannerId, from|null, to|null,
     totals: { impressions, clicks, ctr },          // ctr = ratio 0–1
     daily: [{ date: 'YYYY-MM-DD', impressions, clicks }] }
   ```

   Days without a stat row may be omitted — the UI fills the gaps with zeros.

6. **Banner slots** (`bannerSlotSchema`) — `GET /admin/banner-slots` → `{ items: [...] }`,
   `PATCH /admin/banner-slots/:slot` body `{ maxActive }` (1–50) → one row:

   ```
   { slot, label, maxActive, defaultMaxActive?, pc: { width, height },
     mobile: { width, height } | null,
     activeCount, scheduledCount, pausedCount, totalCount }
   ```

   `label` / sizes come from `BANNER_SLOT_SPECS`, `maxActive` from `banner_slot_configs`. The counts
   drive the cards ("3 / 4", "1자리 남음", "가득 참 · 대기 1"), the 배너 tab count and the default order
   of a new banner. The README lists this resource as ADMIN+; the list page needs the limits for
   every role, so the UI **assumes OPERATOR may GET** (PATCH stays ADMIN+). If GET answers `403` the
   UI falls back to the shared defaults without counts (cards show "–").

7. **Admin popup** (`adminPopupSchema`):

   ```
   { id, code?, title, media: MediaDto|null, linkUrl|null, newWindow,
     targetPages: PopupPage[], startAt, endAt, paused, dismissDays, sortOrder,
     status: BannerStatus, impressions?, clicks?, createdAt?, updatedAt? }
   ```

   `sortOrder` is 1-based and global (popups are one ordered list). `impressions` / `clicks`
   default to 0 when absent. `targetPages: ['ALL']` is exclusive in the UI.

8. **Uploads** — `POST /admin/media?purpose=BANNER|POPUP`, multipart field `file`, response
   `MediaDto`. Because the variants are produced by the `media-processing` job, the response may have
   no variant URL yet; the UI then polls `GET /api/v1/media/:id` (every 750ms, up to 12 times) until
   `variants.large|medium|thumb` exists and otherwise asks the user to retry. That needs the
   metadata endpoint to be readable by the admin session that uploaded the file (or public for
   `BANNER` / `POPUP`). If the admin upload could answer synchronously with the variants (or expose
   `status`), the polling can go.
   Client-side checks before the upload (`lib/image-rules.ts`): JPG / PNG / WebP only (no HEIC for
   ads), ≤ 2MB, at least the slot's pixel size (`BANNER_SLOT_SPECS[slot].pc|mobile`, popups 760×600)
   and the same aspect ratio within 2% (2× uploads are fine). The backend should enforce at least
   type and size for these purposes.

9. **Pickers** — only these fields are read from the public searches:
   `GET /agencies?q=` → `{ items: [{ id, name, representativeName?, roadAddress? }] }`,
   `GET /complexes?q=` → `{ items: [{ id, name, emdName?, households? }] }`.
   A banner whose advertiser is picked from the search is saved with `agencyId` + `advertiserName`
   (office name); free text is saved as `advertiserName` only ("업체").

## Behaviour worth knowing

- **Status control** (노출 / 중지 / 예약) edits `paused` and the period — status itself is never sent:
  노출 un-pauses and pulls a future start to today, 예약 moves the start to tomorrow (keeping the
  length), 중지 sets `paused`.
- **Link URL**: the UI only accepts `https://…` or a site-relative `/path` (stricter than
  `linkUrlSchema`, which the backend keeps as the authority), and refuses backslashes, whitespace and
  control characters anywhere — browsers read `/evil.com` as the protocol-relative `//evil.com`,
  which the shared `isSafeLinkUrl` currently accepts as a relative path (see open issues). The click
  redirect (`GET /banners/:id/click`) should apply the same rule.
- **Mobile-only slot** (`MOBILE_MAIN`, pc spec = mobile spec): one image, sent as `pcMediaId`.
  `LISTING_SIDE` has no mobile placement: `mobileMediaId` is never sent.
- **Duplicate** creates a new banner / popup from the source as **paused** (so the slot limit is
  not hit) with " 복사본" appended to the title; images are reused by media id.
- **Drag reorder** is implemented with pointer events + arrow keys in
  `features/m-ads/hooks/useRowDrag.ts` (see open issues: dnd-kit is not installed). Rows never leave
  their slot.

## Mock resources (apps/admin/src/app/mock-api/v1)

| Folder                                | Notes                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin/banners/**`                    | In-memory store (`_store.ts`, reset on restart): 19 banners over the 7 slots with windows relative to today (live / scheduled / paused / ended), slot limit check, daily stats, `creative/[name]` SVG stand-ins (mock only) |
| `admin/banner-slots/**`               | Limits (`BANNER_SLOT_SPECS` + in-memory overrides) and live counts                                                                                                                                                          |
| `admin/popups/**`                     | Two popups (live + scheduled), reorder, `creative/[name]` stand-ins (mock only)                                                                                                                                             |
| `admin/media/**`                      | `POST` stores the upload in memory and reads its pixel size; `[id]/file` serves it (mock only — real files come from `/media/*`). Also used by m-content                                                                    |
| `media/[id]`                          | Public media metadata (polled after uploads)                                                                                                                                                                                |
| `agencies/`, `complexes/`, `regions/` | Public pickers; same ids / codes as the user-site mocks. Other admin groups read these fixtures too                                                                                                                         |

Sign in for manual checks: `/mock-api/v1/admin/auth/dev-login?as=super|admin|operator&returnTo=/banners`.

## Open issues

- **dnd-kit** is not installed (only the foundation agent adds dependencies); reorder uses the
  dependency-free `useRowDrag` (pointer drag + ↑/↓ on the handle). Swap it for dnd-kit if the
  workspace adopts it.
- **`isSafeLinkUrl`** (`packages/shared/src/utils/url.ts`, owned by the backend) accepts `/\host` as
  a relative path; browsers resolve it to `//host`. The ads UI refuses it, but the backend validation
  and the click redirect rely on the shared helper — it should reject `\` (and control characters).
- Unsaved editor changes are guarded for row switches, closing and the footer "통계" link, but not for
  the 배너 / 팝업 tab links or the browser back button.
