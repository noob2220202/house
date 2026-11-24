import type { NextRequest } from 'next/server';
import type { ComplexAgency } from '@/features/w-complex/api/schemas';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findComplexSpec } from '../../_fixtures';
import { complexListingCountOf, findMockAgency, listingsOfComplex } from '../../_listings';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/complexes/:id/agencies?limit — ASSUMED endpoint (see docs/frontend-integration/w-complex.md):
// offices with active listings in the complex, most listings first.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');

  const codes = new Set(listingsOfComplex(spec).flatMap((l) => l.agencies.map((a) => a.code)));
  const items: ComplexAgency[] = [...codes]
    .flatMap((code) => {
      const a = findMockAgency(code);
      if (!a) return [];
      return [
        {
          agencyId: a.id,
          name: a.name,
          representativeName: a.representativeName,
          phone: a.phone,
          logoUrl: null,
          specialtyLabel: a.specialtyLabel,
          complexListingCount: complexListingCountOf(spec, code),
          avgResponseMinutes: a.avgResponseMinutes,
        },
      ];
    })
    .sort((a, b) => b.complexListingCount - a.complexListingCount);
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));
  return mockJson({ items: items.slice(0, limit) });
}
