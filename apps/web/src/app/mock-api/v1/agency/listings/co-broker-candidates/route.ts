import { PUBLIC_LISTING_STATUSES } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { mockDelay, mockError, mockJson, mockPaginate } from '@/lib/mock';
import { findComplexSpec, complexIdOf } from '../../../complexes/_fixtures';
import { isPrimaryMine, listingsContext, toCandidate } from '../_store';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * GET /api/v1/agency/listings/co-broker-candidates?complexId=&dong=&q= (ASSUMED) — public listings
 * of OTHER offices in a complex that the caller's agency may join (`joined` = already co-brokering).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = listingsContext(req);
  if ('status' in ctx) return ctx;
  await mockDelay(req, 250);
  const sp = req.nextUrl.searchParams;
  const spec = findComplexSpec(sp.get('complexId') ?? '');
  if (!spec) {
    return mockError(400, 'VALIDATION_FAILED', '입력 내용을 확인해 주세요.', [
      { path: 'complexId', message: '단지를 선택해 주세요.' },
    ]);
  }
  const complexId = complexIdOf(spec.code);
  const dong = squash(sp.get('dong') ?? '').replace(/동$/, '');
  const q = squash(sp.get('q') ?? '');
  const rows = ctx.state.listings
    .filter((l) => l.property.complexId === complexId && !isPrimaryMine(l))
    .filter((l) => PUBLIC_LISTING_STATUSES.includes(l.status))
    .filter((l) => !dong || squash(l.property.dong ?? '').replace(/동$/, '') === dong)
    .filter((l) => !q || squash(`${l.property.dong ?? ''} ${l.listingNo ?? ''}`).includes(q));
  const page = mockPaginate(rows, req, { pageSize: 20 });
  return mockJson({ ...page, items: page.items.map(toCandidate) });
}
