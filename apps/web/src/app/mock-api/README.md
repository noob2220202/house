# Mock API (`/mock-api/v1/**`)

Route handlers that stand in for the NestJS backend while `NEXT_PUBLIC_API_MOCK=1`.
They return **404 unless mock mode is on**. Paths and payloads mirror `/api/v1/**` exactly.

- One folder per backend resource (`listings/`, `complexes/`, `site-settings/` …). The page group
  that needs a resource owns its folder. No shared registry file → no merge conflicts.
- Fixtures live next to the handlers in `_fixtures.ts` (underscore = not a route) and come from
  `design/drafts/system/mockdata.md`.
- Helpers: `@/lib/mock` (`mockGuard`, `mockJson`, `mockError`, `mockPaginate`, `mockDelay`,
  `mockSessionRole`, `mockCsrfOk`, `mockUuid`).
- Full conventions: `docs/FRONTEND.md` → "Data & mocks".

Foundation-owned resources: `site-settings/` (example resource) and `auth/` (csrf, me, logout,
oauth start — a fake login so protected pages can be developed without the backend).
