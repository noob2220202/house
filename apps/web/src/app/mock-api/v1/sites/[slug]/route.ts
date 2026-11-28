import { normalizeSiteSlug, type PublicAgencySite } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findAgencyDetail, toAgencyProfileWire } from '../../agencies/_fixtures';
import { findServableSite, mockSiteUrl, officeAgencyId } from '../_state';

type Ctx = { params: Promise<{ slug: string }> };

const notFound = () => mockNotFound('AGENCY_SITE_NOT_FOUND', '사무소 홈페이지를 찾을 수 없습니다.');

// GET /api/v1/sites/:slug — public 사무소 홈페이지 (agencies module) → `PublicAgencySite`. 404 unless
// the site is servable (ACTIVE + subscription gate); fixture slugs: `sindae` (B01), `hosu` (B02).
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const { slug } = await ctx.params;
  const site = findServableSite(normalizeSiteSlug(slug));
  if (!site?.slug) return notFound();
  const agency = findAgencyDetail(officeAgencyId(site.officeKey));
  if (!agency) return notFound();
  const body: PublicAgencySite = {
    slug: site.slug,
    color: site.color,
    tagline: site.tagline,
    url: mockSiteUrl(site.slug),
    agency: toAgencyProfileWire(agency),
  };
  return mockJson(body);
}
