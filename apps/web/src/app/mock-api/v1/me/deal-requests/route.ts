import type { NextRequest } from 'next/server';
import { mockCsv, mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { ownerGuard } from '../../deal-requests/_guard';
import { dealStore, requestDto } from '../../deal-requests/_store';

// GET /api/v1/me/deal-requests?type&status&page&pageSize — the caller's requests, newest first.
// `status` takes one value or several, comma separated (CLOSED,CANCELLED,EXPIRED for "종료").
export async function GET(req: NextRequest) {
  const blocked = ownerGuard(req);
  if (blocked) return blocked;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');
  const statuses = mockCsv(sp, 'status');
  const list = dealStore()
    .requests.filter(
      (r) => (!type || r.type === type) && (statuses.length === 0 || statuses.includes(r.status)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(requestDto);
  return mockJson(mockPaginate(list, req, { pageSize: 10 }));
}
