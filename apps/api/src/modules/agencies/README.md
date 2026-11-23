# Agencies module (`apps/api/src/modules/agencies`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- 중개사무소 registration by a logged-in user (→ PENDING), with private documents (등록증, 사업자등록증 …; Media `PRIVATE`), edit profile (intro, hours, specialties, logo).
- Admin decisions APPROVED / REJECTED / SUSPENDED with `AgencyStatusHistory` (who, reason) + audit log; on approval the owner's role becomes `AGENCY_OWNER` and their sessions' `agencyId` is updated (`SessionService.update` / re-login).
- Staff: AGENT members (invite, remove), membership status checks used by other modules (`AgenciesService.assertActiveMember(userId, agencyId)` — export it).
- Public broker office search: name (trigram), 읍면동, bbox (`common/geo`), specialties; agency detail with active listings count; warnings (from reports).
- Optional registry lookup (국가공간정보 중개업소 조회) behind an interface with a fake in tests.

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method          | Path                                                                                                    | Auth         |
| --------------- | ------------------------------------------------------------------------------------------------------- | ------------ |
| GET             | `/api/v1/agencies?q&emdCode&bbox&specialties&page` · `/api/v1/agencies/:id`                             | Public       |
| POST            | `/api/v1/agencies` (register) · POST `/api/v1/agencies/mine/documents`                                  | User         |
| GET/PATCH       | `/api/v1/agencies/mine`                                                                                 | AGENCY_OWNER |
| GET/POST/DELETE | `/api/v1/agencies/mine/members[/:memberId]`                                                             | AGENCY_OWNER |
| GET             | `/api/v1/admin/agencies?status` · `/api/v1/admin/agencies/:id` · `/:id/documents/:docId` (private file) | Admin        |
| POST            | `/api/v1/admin/agencies/:id/decision`                                                                   | Admin        |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/agencies/**`
- `apps/api/test/e2e/agencies/**` (+ your own factories there)
- Prisma: `agencies.prisma` (Agency, AgencyMember, AgencyDocument, AgencyStatusHistory, AgencyWarning) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/agencies.ts`, `packages/shared/src/enums/agency.ts`, `packages/shared/src/errors/agencies.ts`
- Queues: `notifications` (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/agencies.env` → database `house_test_agencies`, Redis DB index 4.
- Run: `pnpm --filter @house/api test:e2e agencies` (migrates `house_test_agencies` first). Unit: `pnpm --filter @house/api test -- src/modules/agencies`.
