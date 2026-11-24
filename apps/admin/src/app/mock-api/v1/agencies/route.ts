import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { AGENCIES } from './_fixtures';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * GET /api/v1/agencies?q=&page=&pageSize= (agencies README, public) — 중개사무소 search.
 * Added by m-ads for the banner advertiser picker; rows carry only the summary fields a picker reads
 * (id, name, representativeName, roadAddress, emdName, phone). Only APPROVED offices are public.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 150);
  const q = squash(req.nextUrl.searchParams.get('q') ?? '');
  const rows = AGENCIES.filter(
    (a) => !q || squash(a.name).includes(q) || squash(a.representativeName).includes(q),
  ).map(({ key: _key, ...rest }) => rest);
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
