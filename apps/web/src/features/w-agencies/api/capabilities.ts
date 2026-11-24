import { env } from '@/config/env';

/**
 * Office-search filters the backend does not apply (see docs/frontend-integration/w-agencies.md):
 * `GET /agencies` params `openNow` and `handlesPresale` are not in `agencySearchQuerySchema`, so
 * zod strips them and the list would look filtered while it is not.
 *
 * While this is false the UI hides the 지금 영업 중 / 분양권 취급 toggles and never sends those
 * params. The mock implements them, so they stay on in mock mode. Sorting (`sort=LISTINGS|NEWEST|
 * NAME`) and 관심 사무소 (`/me/favorites/agencies`) are backend features and always on.
 */
export const AGENCY_API_EXTRAS: boolean = env.apiMock;
