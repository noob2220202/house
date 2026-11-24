# Media module (`apps/api/src/modules/media`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## What it does

- **Upload** (multipart field `file`, one file per request): guards first (auth, CSRF, throttle), then
  `?purpose=` and the caller's right to it are checked _before_ the body is read; multer memory
  storage with the purpose's byte limit (`MEDIA_PURPOSE_RULES[p].maxBytes`, capped by `MAX_UPLOAD_MB`).
- **Magic-byte sniffing** (`sniffMime` in `@house/shared`): jpeg / png / webp / heic / heif (+ pdf for
  documents). Client MIME type and extension are ignored. Everything else is 415.
- **sharp pipeline** (`ImageProcessor`): header probe (format must match the sniff, ≤ 50 MP
  `MEDIA_MAX_INPUT_PIXELS`), then ONE decode (auto-rotate, sRGB, shrink-on-load, longest edge capped at
  `MAX_STORED_EDGE` 4096) into a pixel buffer from which every output is encoded one after another. All
  metadata is stripped (EXIF/GPS/XMP/ICC). Outputs: webp "original" (≤ 4096 px) + variants
  `IMAGE_VARIANTS` (thumb 320×240 cover, medium 960×720 inside, large 1920×1440 inside, never enlarged).
  Real dimensions are stored per variant. sharp runs with 2 libvips threads and no cache; the worker
  processes one job at a time (`MEDIA_WORKER_CONCURRENCY`).
- **Process isolation (SEC-01)**: the HTTP API never decodes images — no libvips/sharp call on untrusted
  bytes runs in the process that holds sessions, the DB pool and the secrets. The API only checks the
  header with a pure-TypeScript reader (`image-header.ts`: JPEG SOF, PNG IHDR, WebP VP8/VP8L/VP8X), so a
  malformed header is still `415` and more than 50 MP is still `400 MEDIA_DIMENSIONS_INVALID` up front.
  Every image and image document is staged and processed by the worker process (`dist/worker.js`, the
  `media-processing` queue) → `202 PENDING` (raw bytes in private staging until done; poll
  `GET /media/:id`). PDFs are not decoded and are stored inline → `201 READY`. Images the worker cannot
  decode end `FAILED` with a Korean `error`; I/O errors are retried. sharp is pinned to ≥ 0.35.5
  (libvips/libheif CVE fixes; a unit test guards the version).
- **HEIC**: decoded through the `HEIC_DECODER` port. Prebuilt sharp lacks the HEVC decoder, so the default
  `SharpHeicDecoder` reports `supported=false` and HEIC uploads are refused up front with
  `415 MEDIA_HEIC_UNSUPPORTED`. A system libvips built with libde265, or another decoder bound to the
  port, enables conversion.
- **Storage** (`MediaStorage`): random keys only.
  - PUBLIC → `UPLOAD_DIR/img/YYYY/MM/xx/<32hex>.webp` (+ `_thumb|_medium|_large.webp`), which nginx
    serves at `MEDIA_BASE_URL`.
  - PRIVATE → `PRIVATE_UPLOAD_DIR/doc/YYYY/MM/<32hex>.(pdf|jpg|png)` (mode 0600), plus
    `PRIVATE_UPLOAD_DIR/staging/<id>`. This directory must **not** be served by nginx.
  - Writes are atomic (tmp + rename).
- **Documents** (`AGENCY_DOCUMENT`): a PDF is stored as uploaded, and truncated PDFs are rejected.
  Images are re-encoded to JPEG/PNG without metadata (transparency flattened onto white for JPEG), and
  HEIC is converted to JPEG. Both private-stream endpoints send `Content-Security-Policy: … sandbox`,
  `nosniff`, `Cross-Origin-Resource-Policy: same-origin`, and PDFs as `attachment` (never inline on the
  site's origin).
- **Roots**: `MediaStorage` refuses to start when `UPLOAD_DIR` and `PRIVATE_UPLOAD_DIR` contain each
  other (private files would become servable by nginx).
- **Quotas** (`MEDIA_USER_QUOTA`): 2 GiB and 5000 live files per user, plus at most 40 PENDING (a full
  listing's 30 photos uploaded at once must fit). The quota
  is checked under a per-user advisory lock. The daily cap is `DAILY_CAPS.MEDIA_UPLOAD` (300). Admins are
  not limited.
- **Orphan cleanup** (`MediaCleanupService`): runs hourly on the module's own `media-processing` queue
  when `JOBS_ENABLED`, or on demand via `POST /admin/media/cleanup`. It runs these steps in order:
  1. PENDING for more than 24 h → FAILED.
  2. Unattached for more than 24 h since the last attach/detach → soft-deleted. `CONTENT` is exempt
     because it has no FK reference yet.
  3. Soft-deleted for more than 24 h → files removed and row purged. A soft-deleted row that is still
     referenced is never purged and is logged as a warning.
- **Reference guard (DB trigger `media_assert_live_reference`)**: every table that references media
  (`listing_photos`, `complex_photos`, `deal_request_photos`, `agency_documents`, `popups`,
  `agencies.logo_media_id` / `cover_media_id`, `banners.pc/mobile_media_id`) refuses a new or changed reference to a
  soft-deleted media row (`foreign_key_violation`, Prisma `P2003`), taking `FOR SHARE` on the row. This
  closes the attach-vs-delete race even for callers that do not use `assertUsable` in their transaction.
- **Indexes**: `media(deleted_at, updated_at)` serves cleanup phase 2 and the purge. The referencing
  tables' `media_id` columns need their own indexes (owned by their modules, see open issues).

## Purposes

| purpose            | kind     | visibility | who uploads                  | max   |
| ------------------ | -------- | ---------- | ---------------------------- | ----- |
| LISTING_PHOTO      | image    | PUBLIC     | AGENT / AGENCY_OWNER         | 15 MB |
| DEAL_REQUEST_PHOTO | image    | PUBLIC     | any user                     | 15 MB |
| AGENCY_LOGO        | image    | PUBLIC     | any user (agency applicants) | 5 MB  |
| AGENCY_COVER       | image    | PUBLIC     | any user (agency owners)     | 10 MB |
| PROFILE            | image    | PUBLIC     | nobody (until an FK exists)  | 5 MB  |
| AGENCY_DOCUMENT    | document | PRIVATE    | any user (agency applicants) | 10 MB |
| COMPLEX_PHOTO      | image    | PUBLIC     | admin                        | 15 MB |
| BANNER / POPUP     | image    | PUBLIC     | admin                        | 10 MB |
| CONTENT            | image    | PUBLIC     | admin                        | 15 MB |

## Endpoints (prefix `/api/v1`)

| Method | Path                    | Auth                                                           | Notes                                                                           |
| ------ | ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| POST   | `/media?purpose=`       | user (throttle WRITE, daily cap, quota)                        | 202 PENDING (images) / 201 READY (PDF) → `OwnMediaView`                         |
| GET    | `/media`                | user                                                           | own uploads, `purpose`, `status` csv filters, paginated                         |
| GET    | `/media/:id`            | public                                                         | owner: `OwnMediaView` (any state); others: READY PUBLIC, not DEAL_REQUEST_PHOTO |
| GET    | `/media/:id/private`    | uploader, or AGENT/AGENCY_OWNER of the agency it's attached to | stream, `Cache-Control: private, no-store`                                      |
| DELETE | `/media/:id`            | owner                                                          | 204; 409 `MEDIA_IN_USE` while referenced                                        |
| POST   | `/admin/media?purpose=` | OPERATOR+                                                      | audited                                                                         |
| GET    | `/admin/media`          | OPERATOR+                                                      | filters: purpose, status, visibility, owner, orphaned, includeDeleted           |
| GET    | `/admin/media/:id`      | OPERATOR+                                                      | `AdminMediaView` with reference counts                                          |
| GET    | `/admin/media/:id/file` | OPERATOR+                                                      | stream any file; every view is audited                                          |
| DELETE | `/admin/media/:id`      | ADMIN+                                                         | moderation of unattached uploads; audited                                       |
| POST   | `/admin/media/cleanup`  | ADMIN+                                                         | runs the orphan cleanup now; audited                                            |

## For other modules: `MediaService` (exported)

Add `imports: [MediaModule]` and inject `MediaService`. The calls are:

- `assertUsable(ids, rule, tx?)` → `MediaRef[]` (input order). It throws 400 `rule.errorCode`
  (default `MEDIA_INVALID`) unless every id is a live READY upload matching the rule. The rule has these
  fields:
  - `purpose` (one or several)
  - `ownerUserId?`
  - `unattached?`, for one-shot attachments
  - `orWhere?`: for example, accept photos already on this listing with
    `{ listingPhotos: { some: { listingId } } }`
  - `errorCode?`

  Pass your transaction client: the rows are then locked (in id order) `FOR SHARE`, or `FOR UPDATE`
  with `unattached` so two transactions cannot both claim a one-shot upload. A concurrent delete or
  cleanup cannot remove them before your FK row commits. `unattached` without a transaction throws.
  Create the FK row with the SAME `tx`.

- **Attach**: inside your transaction, call `assertUsable(..., tx)` and then create your FK row.
  **Detach**: remove the FK row, then call `released(ids, tx)` (this restarts the 24 h grace period).
  "Attached" is always derived from the FK relations (`media.selects.ts` → `MEDIA_REFERENCE_RELATIONS`).
- `scrubOwner(userId, tx)` (member withdrawal / PII scrub job): clears `originalFilename` on all of the
  user's uploads and soft-deletes the unattached ones (files go with the next purge). Attached uploads
  stay with their listing/agency.
- `url(ref, variant?)`, `variantUrls(ref)`, `views(ids)`, `privateFilePath(storageKey)`. Select
  `mediaRefSelect` columns when you embed media.

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/media` (processor, header reader, storage, mapper).
- e2e: `pnpm --filter @house/api test:e2e media`. It uses database `house_test_media` and Redis DB 7,
  writes files under `$TMPDIR/house-test/media/`, and replaces `HEIC_DECODER` with a fake.
