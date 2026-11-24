import type { NextRequest } from 'next/server';
import { isBlocked, matches, modGate } from '@/features/m-moderation/mock/handler';
import { mockJson, mockPaginate } from '@/lib/mock';
import { listingsDb, toListingListItem } from './_fixtures';

const priceOf = (l: {
  salePrice?: number | null;
  presalePrice?: number | null;
  deposit?: number | null;
}) => l.salePrice ?? l.presalePrice ?? l.deposit ?? 0;

// GET /api/v1/admin/listings?q&status&assetType&dealType&needsReview&agencyId&sort&page&pageSize
// (ASSUMED endpoint) — listing search for moderators. `needsReview=true` = the 검수 필요 queue
// (open reports, never verified, verification expired, price outlier). DRAFT listings are excluded.
export async function GET(req: NextRequest) {
  const gate = await modGate(req);
  if (isBlocked(gate)) return gate;
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const assetType = sp.get('assetType');
  const dealType = sp.get('dealType');
  const agencyId = sp.get('agencyId');
  const needsReview = sp.get('needsReview') === 'true';
  const sort = sp.get('sort') ?? 'LATEST';
  const q = sp.get('q') ?? '';
  const rows = listingsDb()
    .filter((l) => l.status !== 'DRAFT')
    .filter((l) => !status || l.status === status)
    .filter((l) => !assetType || l.assetType === assetType)
    .filter((l) => !dealType || l.dealType === dealType)
    .filter((l) => !agencyId || l.agencies.some((a) => a.agencyId === agencyId))
    .filter(
      (l) =>
        !needsReview ||
        (l.reviewFlags.length > 0 && l.status !== 'HIDDEN' && l.status !== 'CLOSED'),
    )
    .filter((l) =>
      matches(
        q,
        l.title,
        l.complexName,
        l.buildingName,
        l.emdName,
        l.roadAddress,
        l.primaryAgency.name,
        l.id,
      ),
    )
    .sort((a, b) =>
      sort === 'REPORTS'
        ? b.openReportCount - a.openReportCount || b.createdAt.localeCompare(a.createdAt)
        : sort === 'VIEWS'
          ? b.viewCount - a.viewCount
          : sort === 'PRICE_DESC'
            ? priceOf(b) - priceOf(a)
            : b.createdAt.localeCompare(a.createdAt),
    )
    .map(toListingListItem);
  return mockJson(mockPaginate(rows, req));
}
