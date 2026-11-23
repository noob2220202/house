# Media module (`apps/api/src/modules/media`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## What it does

- **Upload** (multipart field `file`, one file per request): guards first (auth, CSRF, throttle), then
  `?purpose=` and the caller's right to it are checked _before_ the body is read; multer memory
  storage with the purpose's byte limit (`MEDIA_PURPOSE_RULES[p].maxBytes`, capped by `MAX_UPLOAD_MB`).
- **Magic-byte sniffing** (`sniffMime` in `@house/shared`): jpeg / png / webp / heic / heif (+ pdf for
  documents). Client MIME type and extension are ignored. Everything else is 415.
- **sharp pipeline** (`ImageProcessor`): header probe (format must match the sniff, ≤ 100 MP),
  auto-rotate, sRGB, all metadata stripped (EXIF/GPS/XMP/ICC), webp full-size image + variants
  `IMAGE_VARIANTS` (thumb 320×240 cover, medium 960×720 inside, large 1920×1440 inside, never enlarged).
  Real dimensions are stored per variant.
- **Sync vs background**: images ≤ 6 MB and ≤ 24 MP are processed inline → `201 READY`. Larger images and
  all HEIC go to the `media-processing` queue → `202 PENDING` (raw bytes in private staging until done;
  poll `GET /media/:id`). Invalid images end `FAILED` with a Korean `error`; I/O errors are retried.
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
  Images are re-encoded to JPEG/PNG without metadata, and HEIC is converted to JPEG.
- **Quotas** (`MEDIA_USER_QUOTA`): 2 GiB and 5000 live files per user, plus at most 20 PENDING. The quota
  is checked under a per-user advisory lock. The daily cap is `DAILY_CAPS.MEDIA_UPLOAD` (300). Admins are
  not limited.
- **Orphan cleanup** (`MediaCleanupService`): runs hourly on the module's own `media-processing` queue
  when `JOBS_ENABLED`, or on demand via `POST /admin/media/cleanup`. It runs these steps in order:
  1. PENDING for more than 24 h → FAILED.
  2. Unattached for more than 24 h since the last attach/detach → soft-deleted. `PROFILE` and `CONTENT`
     are exempt because they have no FK reference yet.
  3. Soft-deleted for more than 24 h → files removed and row purged.

## Purposes

| purpose            | kind     | visibility | who uploads                  | max   |
| ------------------ | -------- | ---------- | ---------------------------- | ----- |
| LISTING_PHOTO      | image    | PUBLIC     | AGENT / AGENCY_OWNER         | 15 MB |
| DEAL_REQUEST_PHOTO | image    | PUBLIC     | any user                     | 15 MB |
| AGENCY_LOGO        | image    | PUBLIC     | any user (agency applicants) | 5 MB  |
| PROFILE            | image    | PUBLIC     | any user                     | 5 MB  |
| AGENCY_DOCUMENT    | document | PRIVATE    | any user (agency applicants) | 10 MB |
| COMPLEX_PHOTO      | image    | PUBLIC     | admin                        | 15 MB |
| BANNER / POPUP     | image    | PUBLIC     | admin                        | 10 MB |
| CONTENT            | image    | PUBLIC     | admin                        | 15 MB |

## Endpoints (prefix `/api/v1`)

| Method | Path                    | Auth                                                           | Notes                                                                 |
| ------ | ----------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/media?purpose=`       | user (throttle WRITE, daily cap, quota)                        | 201 READY / 202 PENDING → `OwnMediaView`                              |
| GET    | `/media`                | user                                                           | own uploads, `purpose`, `status` csv filters, paginated               |
| GET    | `/media/:id`            | public                                                         | owner: `OwnMediaView` (any state); others: READY PUBLIC only          |
| GET    | `/media/:id/private`    | uploader, or AGENT/AGENCY_OWNER of the agency it's attached to | stream, `Cache-Control: private, no-store`                            |
| DELETE | `/media/:id`            | owner                                                          | 204; 409 `MEDIA_IN_USE` while referenced                              |
| POST   | `/admin/media?purpose=` | OPERATOR+                                                      | audited                                                               |
| GET    | `/admin/media`          | OPERATOR+                                                      | filters: purpose, status, visibility, owner, orphaned, includeDeleted |
| GET    | `/admin/media/:id`      | OPERATOR+                                                      | `AdminMediaView` with reference counts                                |
| GET    | `/admin/media/:id/file` | OPERATOR+                                                      | stream any file; every view is audited                                |
| DELETE | `/admin/media/:id`      | ADMIN+                                                         | moderation of unattached uploads; audited                             |
| POST   | `/admin/media/cleanup`  | ADMIN+                                                         | runs the orphan cleanup now; audited                                  |

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

  Pass your transaction client: the rows are then locked `FOR SHARE`, so a concurrent delete or cleanup
  cannot remove them before your FK row commits.

- **Attach**: inside your transaction, call `assertUsable(..., tx)` and then create your FK row.
  **Detach**: remove the FK row, then call `released(ids, tx)` (this restarts the 24 h grace period).
  "Attached" is always derived from the FK relations (`media.selects.ts` → `MEDIA_REFERENCE_RELATIONS`).
- `url(ref, variant?)`, `variantUrls(ref)`, `views(ids)`, `privateFilePath(storageKey)`. Select
  `mediaRefSelect` columns when you embed media.

## Tests

- Unit: `pnpm --filter @house/api test -- src/modules/media` (processor, storage, mapper).
- e2e: `pnpm --filter @house/api test:e2e media`. It uses database `house_test_media` and Redis DB 7,
  writes files under `$TMPDIR/house-test/media/`, and replaces `HEIC_DECODER` with a fake.
