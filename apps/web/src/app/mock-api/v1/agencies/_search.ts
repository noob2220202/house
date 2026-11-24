import {
  agencySearchQuerySchema,
  type AgencySearchItem as WireAgencySearchItem,
} from '@house/shared';
import type { NextRequest } from 'next/server';
import { isOpenAt } from '@/features/w-agencies/lib/hours';
import type { AgencySummary } from '@/features/w-agencies/api/schemas';
import { mockDelay, mockError, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { AGENCY_SUMMARIES } from './_fixtures';

const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * Fixture office → `AgencySearchItem` of the agencies module (`AgencySummary` + 영업시간 +
 * 분양권 취급; the fixture's other display extras dropped).
 */
export function toAgencySummaryWire(a: AgencySummary): WireAgencySearchItem {
  return {
    id: a.id,
    name: a.name,
    representativeName: a.representativeName,
    registrationNumber: a.registrationNumber,
    phone: a.phone,
    roadAddress: a.roadAddress,
    addressDetail: a.addressDetail ?? null,
    emdCode: a.emdCode ?? null,
    lat: a.lat,
    lng: a.lng,
    specialties: a.specialties,
    logoUrl: a.logoUrl ?? null,
    activeListingCount: a.activeListingCount,
    businessHours: a.businessHours ?? null,
    handlesPresale: a.handlesPresale ?? false,
  };
}

/**
 * GET /api/v1/agencies?q&emdCode&bbox&specialties&openNow&handlesPresale&sort&page&pageSize —
 * public broker office search → Paginated<AgencySearchItem>. The query is validated with the
 * backend's own `agencySearchQuerySchema` (sort RELEVANCE|LISTINGS|NEWEST|NAME, default
 * RELEVANCE). `openNow` = open now by the 영업시간 (Asia/Seoul), `handlesPresale` = has a public
 * 분양권 listing — both applied by the backend too.
 */
export async function searchAgencies(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  if (sp.get('_fail') === '1')
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');

  const parsed = agencySearchQuerySchema.safeParse(Object.fromEntries(sp));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    );
  const { q, emdCode, bbox, specialties, sort, openNow, handlesPresale: presale } = parsed.data;
  const needle = q ? normalize(q) : '';
  const now = new Date();

  const items = AGENCY_SUMMARIES.filter((a: AgencySummary) => {
    if (
      needle &&
      ![a.name, a.representativeName, a.roadAddress, a.addressDetail ?? '', a.tagline ?? ''].some(
        (field) => normalize(field).includes(needle),
      )
    )
      return false;
    if (emdCode && !(a.emdCode ?? '').startsWith(emdCode)) return false;
    if (
      bbox &&
      (a.lng < bbox.swLng || a.lng > bbox.neLng || a.lat < bbox.swLat || a.lat > bbox.neLat)
    )
      return false;
    if (specialties?.length && !a.specialties.some((s) => specialties.includes(s))) return false;
    if (openNow && !isOpenAt(a.businessHours, now)) return false;
    if (presale && !a.handlesPresale) return false;
    return true;
  });

  const sorted = [...items].sort((a, b) => {
    if (sort === 'NAME') return a.name.localeCompare(b.name, 'ko');
    if (sort === 'NEWEST') return b.registrationNumber.localeCompare(a.registrationNumber);
    return b.activeListingCount - a.activeListingCount || a.name.localeCompare(b.name, 'ko');
  });
  const page = mockPaginate(sorted, req, { pageSize: 20 });
  return mockJson({ ...page, items: page.items.map(toAgencySummaryWire) });
}
