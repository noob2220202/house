import {
  agencySiteAvailabilityQuerySchema,
  normalizeSiteSlug,
  siteSlugProblem,
  type SiteSlugAvailability,
} from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockForbidden, mockJson } from '@/lib/mock';
import { MOCK_OWNER_OFFICE, slugTaken } from '../../../../sites/_state';
import { agencyContext, agencyNotFound, validationError } from '../../_store';

// GET /api/v1/agencies/mine/site/availability?slug= — `SiteSlugAvailability` (AGENCY_OWNER).
// Never a validation error for a bad slug: `reason` says why (INVALID / RESERVED / TAKEN).
// Fixture slugs taken by other offices: `hosu`, `seonwol` (approved), `yeonhyang-central` (open request).
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 220);
  if (!ctx.agency) return agencyNotFound();
  if (!ctx.isOwner || ctx.role === 'USER') return mockForbidden();
  if (ctx.agency.status !== 'APPROVED') {
    return mockError(403, 'AGENCY_NOT_APPROVED', '승인된 중개사무소만 이용할 수 있습니다.');
  }
  const parsed = agencySiteAvailabilityQuerySchema.safeParse({
    slug: req.nextUrl.searchParams.get('slug') ?? '',
  });
  if (!parsed.success) return validationError(parsed.error.issues);
  const slug = normalizeSiteSlug(parsed.data.slug);
  const problem = siteSlugProblem(slug);
  const taken = !problem && slugTaken(slug, MOCK_OWNER_OFFICE);
  const body: SiteSlugAvailability = {
    slug,
    available: !problem && !taken,
    reason: problem ?? (taken ? 'TAKEN' : null),
  };
  return mockJson(body);
}
