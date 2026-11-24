import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { COMPLEX_SPECS } from './_fixtures';
import { toComplexSummaryOf } from './_wire';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * GET /api/v1/complexes?q=&emdCode=&page=&pageSize= (complexes README) — name / address search.
 * Added by a-listings for the complex picker of the listing wizard; rows are `ComplexSummary`
 * (the picker reads id, name, roadAddress, emdName, households, builtYear).
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 200);
  const sp = req.nextUrl.searchParams;
  const q = squash(sp.get('q') ?? '');
  const emdCode = sp.get('emdCode');
  const rows = COMPLEX_SPECS.filter((c) => !emdCode || c.emdCode === emdCode).filter(
    (c) =>
      !q ||
      squash(c.name).includes(q) ||
      squash(c.road).includes(q) ||
      squash(c.jibun).includes(q) ||
      squash(c.emdName).includes(q) ||
      squash(c.districtName ?? '').includes(q),
  );
  const page = mockPaginate(rows, req, { pageSize: 20 });
  return mockJson({ ...page, items: page.items.map(toComplexSummaryOf) });
}
