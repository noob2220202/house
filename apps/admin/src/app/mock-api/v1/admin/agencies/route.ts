import { AdminAgencySort } from '@house/shared';
import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockPaginate } from '@/lib/mock';
import { agenciesDb, toAgencyListItem } from './_fixtures';

// GET /api/v1/admin/agencies?status&q&sort&page&pageSize → Paginated<AdminAgencyListItem> (shared).
// `sort` follows `adminAgencyListQuerySchema`: OLDEST (the API default — the review queue),
// NEWEST or NAME. The list screen sends OLDEST for 승인 대기 and NEWEST for every other tab.
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const q = sp.get('q') ?? '';
  const sort = sp.get('sort') ?? AdminAgencySort.OLDEST;
  const rows = agenciesDb()
    .filter((a) => !status || status.split(',').includes(a.status))
    .filter((a) =>
      matches(q, a.name, a.representativeName, a.registrationNumber, a.roadAddress, a.emdName),
    )
    .sort((a, b) =>
      sort === AdminAgencySort.NAME
        ? a.name.localeCompare(b.name, 'ko')
        : sort === AdminAgencySort.NEWEST
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt),
    )
    .map(toAgencyListItem);
  return mockJson(mockPaginate(rows, req));
}
