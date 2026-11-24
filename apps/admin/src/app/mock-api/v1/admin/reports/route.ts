import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate } from '@/features/m-moderation/mock/handler';
import { mockCsv, mockJson, mockPaginate } from '@/lib/mock';
import { reportsDb, toReportListItem } from './_fixtures';

// GET /api/v1/admin/reports?status&targetType&q&page&pageSize — reportListQuerySchema (+ `q`,
// and `status` also accepts a CSV like RECEIVED,IN_REVIEW for the "처리 대기" tab — ASSUMED).
// Open reports are ordered oldest first (queue), handled ones newest first.
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const statuses = mockCsv(sp, 'status');
  const targetType = sp.get('targetType');
  const q = sp.get('q') ?? '';
  const queue = statuses.length > 0 && statuses.every((s) => s === 'RECEIVED' || s === 'IN_REVIEW');
  const rows = reportsDb()
    .filter((r) => statuses.length === 0 || statuses.includes(r.status))
    .filter((r) => !targetType || r.targetType === targetType)
    .sort((a, b) =>
      queue ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt),
    )
    .map(toReportListItem)
    .filter((r) =>
      matches(
        q,
        r.listing?.title,
        r.listing?.complexName,
        r.listing?.buildingName,
        r.agency?.name,
        r.detail,
      ),
    );
  return mockJson(mockPaginate(rows, req));
}
