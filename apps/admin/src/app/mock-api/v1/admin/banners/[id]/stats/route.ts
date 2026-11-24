import { ERROR_MESSAGES } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { adminGuard } from '../../_guard';
import { dailySeries, findBanner } from '../../_store';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/v1/admin/banners/:id/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — daily impressions / clicks
// (banner_stat_daily, KST days). Without a range: the whole campaign.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req, 200);
  const banner = findBanner((await ctx.params).id);
  if (!banner) return mockError(404, 'BANNER_NOT_FOUND', ERROR_MESSAGES.BANNER_NOT_FOUND);
  const sp = req.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  if ((from && !DAY.test(from)) || (to && !DAY.test(to)) || (from && to && from > to))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: from && !DAY.test(from) ? 'from' : 'to', message: '올바른 기간이 아닙니다.' },
    ]);
  const daily = dailySeries(banner.id, banner.startAt, banner.endAt, banner.totals).filter(
    (d) => (!from || d.date >= from) && (!to || d.date <= to),
  );
  const impressions = daily.reduce((sum, d) => sum + d.impressions, 0);
  const clicks = daily.reduce((sum, d) => sum + d.clicks, 0);
  return mockJson({
    bannerId: banner.id,
    from: from ?? daily[0]?.date ?? null,
    to: to ?? daily[daily.length - 1]?.date ?? null,
    totals: { impressions, clicks, ctr: impressions > 0 ? clicks / impressions : 0 },
    daily,
  });
}
