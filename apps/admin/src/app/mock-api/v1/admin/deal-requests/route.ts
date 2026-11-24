import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockPaginate } from '@/lib/mock';
import { dealRequestsDb, toDealRequestListItem } from './_fixtures';

// GET /api/v1/admin/deal-requests?type&status&spam&q&page&pageSize (ASSUMED endpoint) — 내놓기·구하기
// monitoring, newest first. `spam=flagged` = flagged requests, `spam=suspected` = unflagged requests
// with automatic abuse signals.
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');
  const status = sp.get('status');
  const spam = sp.get('spam');
  const q = sp.get('q') ?? '';
  const rows = dealRequestsDb()
    .filter((r) => !type || r.type === type)
    .filter((r) => !status || r.status === status)
    .filter((r) =>
      spam === 'flagged'
        ? !!r.spamFlaggedAt
        : spam === 'suspected'
          ? !r.spamFlaggedAt && r.spamSignals.length > 0 && r.status === 'OPEN'
          : true,
    )
    .filter((r) =>
      matches(
        q,
        r.complexName,
        r.emdName,
        r.regionNames.join(' '),
        r.requester?.nickname,
        r.contactName,
        r.description,
      ),
    )
    .map(toDealRequestListItem);
  return mockJson(mockPaginate(rows, req));
}
