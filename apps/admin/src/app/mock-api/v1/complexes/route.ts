import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { COMPLEXES } from './_fixtures';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * GET /api/v1/complexes?q=&page=&pageSize= (complexes README, public) — name / address search.
 * Added by m-ads for the banner complex-targeting picker; rows carry only the fields a picker reads
 * (id, name, emdName, roadAddress, households, builtYear).
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 150);
  const q = squash(req.nextUrl.searchParams.get('q') ?? '');
  const rows = COMPLEXES.filter(
    (c) => !q || squash(c.name).includes(q) || squash(c.emdName).includes(q),
  ).map(({ code: _code, ...rest }) => rest);
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
