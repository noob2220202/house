# Media module (`apps/api/src/modules/media`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- Multipart upload (multer memory storage, `MAX_UPLOAD_MB`), magic-byte MIME sniffing (never trust the client type/extension), allow-lists `ALLOWED_IMAGE_MIME` / `ALLOWED_DOCUMENT_MIME`, sha256, random storage keys (no user-controlled path parts).
- Public files under `UPLOAD_DIR` (nginx serves `/media/*` → `MEDIA_BASE_URL`); private files (agency documents) under `PRIVATE_UPLOAD_DIR`, served only by an authorized streaming endpoint (owner agency members + admins).
- `media-processing` queue: sharp → webp variants `IMAGE_VARIANTS` (thumb/medium/large), EXIF stripped (rotate first), status PENDING → READY/FAILED.
- `MediaService` exported for other modules: `assertUsable(mediaId, principal, purpose)` (ownership + READY), `toDto(media)` (variant URLs).
- Orphan cleanup (unreferenced media older than N days) in the `cleanup` queue.

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method | Path                                          | Auth                                          |
| ------ | --------------------------------------------- | --------------------------------------------- |
| POST   | `/api/v1/media?purpose=` (multipart `file`)   | User (rate limited, daily cap `MEDIA_UPLOAD`) |
| POST   | `/api/v1/admin/media?purpose=`                | Admin                                         |
| GET    | `/api/v1/media/:id` (metadata + variant URLs) | Owner / Public for PUBLIC                     |
| GET    | `/api/v1/media/:id/private` (stream)          | Authorized only                               |
| DELETE | `/api/v1/media/:id`                           | Owner                                         |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/media/**`
- `apps/api/test/e2e/media/**` (+ your own factories there)
- Prisma: `media.prisma` (Media) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/media.ts`, `packages/shared/src/enums/media.ts`, `packages/shared/src/constants/media.ts`, `packages/shared/src/errors/media.ts`
- Queues: `media-processing`, `cleanup` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/media.env` → database `house_test_media`, Redis DB index 7.
- Run: `pnpm --filter @house/api test:e2e media` (migrates `house_test_media` first). Unit: `pnpm --filter @house/api test -- src/modules/media`.
