# Mock API (`/mock-api/v1/**`) — admin

Route handlers that stand in for the NestJS backend while `NEXT_PUBLIC_API_MOCK=1` (404 otherwise).
Paths and payloads mirror `/api/v1/**` exactly (admin endpoints live under `admin/…`).

- One folder per backend resource; the page group that needs it owns it. Fixtures in `_fixtures.ts`.
- Helpers: `@/lib/mock` (`mockGuard`, `mockJson`, `mockError`, `mockPaginate`, `mockDelay`,
  `mockRequireAdmin`, `mockCsrfOk`).
- Foundation-owned: `auth/csrf`, `admin/auth/me`, `admin/auth/logout`, `admin/auth/dev-login`
  (mock-only shortcut that signs a fake admin in; not a backend endpoint).
- Conventions: `docs/FRONTEND.md` → "Data & mocks".
