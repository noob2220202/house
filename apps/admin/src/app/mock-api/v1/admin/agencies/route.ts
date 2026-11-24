import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockPaginate } from '@/lib/mock';
import { agenciesDb, toAgencyListItem } from './_fixtures';

// GET /api/v1/admin/agencies?status&q&page&pageSize → Paginated<AdminAgencyListItem> (shared).
// PENDING is ordered oldest first (the queue); everything else newest first.
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const q = sp.get('q') ?? '';
  const rows = agenciesDb()
    .filter((a) => !status || a.status === status)
    .filter((a) =>
      matches(q, a.name, a.representativeName, a.registrationNumber, a.roadAddress, a.emdName),
    )
    .sort((a, b) =>
      status === 'PENDING'
        ? a.createdAt.localeCompare(b.createdAt)
        : b.createdAt.localeCompare(a.createdAt),
    )
    .map(toAgencyListItem);
  return mockJson(mockPaginate(rows, req));
}
