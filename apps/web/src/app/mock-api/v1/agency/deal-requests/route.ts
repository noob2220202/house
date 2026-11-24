import type { NextRequest } from 'next/server';
import { INBOX_STAGES, type InboxStage, type StageCounts } from '@/features/a-inbox/api/schemas';
import { mockCsv, mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { agencyGuard, agencyRequestDto, forcedFailure, inboxRequests, stageOf } from './_store';

/**
 * GET /api/v1/agency/deal-requests?type&stage&regionCodes&assetTypes&sort&page&pageSize
 * Requests visible to the caller's agency (README: `?type&page`; the other filters, the derived
 * `stage` and `stageCounts` are ASSUMED — docs/frontend-integration/a-inbox.md).
 * Never contains contact data or the private address.
 * Dev: `?_empty=1` → no requests, `?_fail=1` → 500.
 */
export async function GET(req: NextRequest) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const forced = forcedFailure(req);
  if (forced) return forced;

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type');
  const stage = sp.get('stage') as InboxStage | null;
  const regions = mockCsv(sp, 'regionCodes');
  const assets = mockCsv(sp, 'assetTypes');
  const all = sp.get('_empty') === '1' ? [] : inboxRequests();

  const faceted = all.filter(
    (r) =>
      (!type || r.type === type) &&
      (assets.length === 0 || assets.includes(r.assetType)) &&
      (regions.length === 0 ||
        (r.emdCode !== null && regions.includes(r.emdCode)) ||
        r.regionCodes.some((c) => regions.includes(c))),
  );
  const stageCounts: StageCounts = { NEW: 0, PROPOSED: 0, ACCEPTED: 0, ENDED: 0 };
  for (const r of faceted) stageCounts[stageOf(r)] += 1;

  const rows = faceted.filter(
    (r) => !stage || !INBOX_STAGES.includes(stage) || stageOf(r) === stage,
  );
  if (sp.get('sort') === 'EXPIRING') {
    // Soonest deadline first; ended requests sink to the bottom.
    const key = (expiresAt: string | null, status: string) =>
      status === 'OPEN' || status === 'MATCHED'
        ? Date.parse(expiresAt ?? '9999-12-31')
        : Number.MAX_SAFE_INTEGER;
    rows.sort((a, b) => key(a.expiresAt, a.status) - key(b.expiresAt, b.status));
  }
  return mockJson({
    ...mockPaginate(
      rows.map((r) => agencyRequestDto(r)),
      req,
      { pageSize: 10 },
    ),
    stageCounts,
  });
}
