import { env } from '@/config/env';

/**
 * Parts of the office search that the backend has not confirmed yet (see
 * docs/frontend-integration/w-agencies.md, "Blocking integration items"):
 *  - `GET /agencies` params `openNow`, `handlesPresale`, `sort` — not in `agencySearchQuerySchema`,
 *    so zod would strip them and the list would look filtered while it is not;
 *  - `GET|PUT|DELETE /me/favorites/agencies` — not in the agencies README.
 *
 * While this is false the UI hides the 지금 영업 중 / 분양권 취급 toggles, the non-default sorts and
 * the 관심 button, and never sends those params, so it never shows a filter that is not applied.
 * The mock implements all of them, so they stay on in mock mode. Flip to `true` (one line) once the
 * backend ships them.
 */
export const AGENCY_API_EXTRAS: boolean = env.apiMock;
