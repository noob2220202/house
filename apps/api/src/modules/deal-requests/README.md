# Deal requests (내놓기 / 구하기) module (`apps/api/src/modules/deal-requests`)

Registered in `AppModule` already — do not edit `app.module.ts`. Read `docs/CONVENTIONS.md` first.

## Responsibilities

- `SELL_OR_LEASE` (owner 내놓기: property info, desired price) and `WANTED` (seeker 구하기: regions/complexes, price/area ranges).
- Login required. Contact name + phone typed by the requester — `phoneSchema` validates/normalizes it; it is **never verified** (no SMS). Abuse control: `@Throttle(THROTTLE.DEAL_REQUEST)`, `DailyCapService.consume('DEAL_REQUEST_CREATE', userId)`, admin moderation, reports.
- Visibility `ALL_AGENCIES_IN_REGION` (approved agencies whose sgg/emd matches) or `SELECTED_AGENCIES` (`DealRequestTarget`).
- Agencies list requests visible to them (no contact info) and send Proposals (message + optional listings; one per agency per request).
- Requester grants contact to a specific agency (`DealRequestContactGrant`) — only then can that agency read contactName/contactPhone. Revocable.
- Status lifecycle OPEN → MATCHED/CLOSED/CANCELLED, EXPIRED via the `cleanup` job; notifications (`Notification` rows via the `notifications` queue).

## Endpoints to build

All paths are under the global prefix `/api/v1`. Default is authenticated; mark public routes with `@Public()`.

| Method      | Path                                                                                        | Auth                 |
| ----------- | ------------------------------------------------------------------------------------------- | -------------------- |
| POST        | `/api/v1/deal-requests`                                                                     | User                 |
| GET         | `/api/v1/me/deal-requests` · `/api/v1/me/deal-requests/:id` (+ proposals)                   | User (owner)         |
| POST        | `/api/v1/me/deal-requests/:id/cancel` · `/close`                                            | User (owner)         |
| POST/DELETE | `/api/v1/me/deal-requests/:id/contact-grants[/:agencyId]`                                   | User (owner)         |
| POST        | `/api/v1/me/proposals/:id/accept` · `/decline`                                              | User (owner)         |
| GET         | `/api/v1/agency/deal-requests?type&page` · `/:id` (contact only if granted)                 | AGENT / AGENCY_OWNER |
| POST        | `/api/v1/agency/deal-requests/:id/proposals` · POST `/api/v1/agency/proposals/:id/withdraw` | AGENT / AGENCY_OWNER |
| GET         | `/api/v1/me/notifications` (cursor) · POST `/api/v1/me/notifications/read`                  | User                 |

Every endpoint needs e2e coverage: happy path + authz failure (401/403/404-for-not-owner) + validation failure (400).

## Files you own

- `apps/api/src/modules/deal-requests/**`
- `apps/api/test/e2e/deal-requests/**` (+ your own factories there)
- Prisma: `deal-requests.prisma` (DealRequest, DealRequestTarget, DealRequestPhoto, Proposal, ProposalListing, DealRequestContactGrant) and `Notification` in `core.prisma` (lead-owned; ask before changing) — additive edits only, then a new migration (see CONVENTIONS "Schema changes")
- Shared: `packages/shared/src/schemas/deal-requests.ts`, `packages/shared/src/enums/deal-request.ts`, `packages/shared/src/errors/deal-requests.ts`
- Queues: `notifications`, `cleanup` (expiry) (names in `src/queue/queue.constants.ts`)

## Tests

- e2e env: `apps/api/test/env/deal-requests.env` → database `house_test_deal_requests`, Redis DB index 5.
- Run: `pnpm --filter @house/api test:e2e deal-requests` (migrates `house_test_deal_requests` first). Unit: `pnpm --filter @house/api test -- src/modules/deal-requests`.
