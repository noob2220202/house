import { ADS_LIMITS, ERROR_MESSAGES } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { adminGuard } from '../../_guard';
import { addDays, dayDiff, kstDay } from '../../_ids';
import { dailySeries, findBanner } from '../../_store';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/v1/admin/banners/:id/stats?from=YYYY-MM-DD&to=YYYY-MM-DD — daily impressions / clicks
// (banner_stat_daily, KST days) → shared `BannerStatsView`. Like the API: without a range the last
// 30 days, at most 366 days, CTR in percent (two decimals).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req, 200);
  const banner = findBanner((await ctx.params).id);
  if (!banner) return mockError(404, 'BANNER_NOT_FOUND', ERROR_MESSAGES.BANNER_NOT_FOUND);
  const sp = req.nextUrl.searchParams;
  const qFrom = sp.get('from');
  const qTo = sp.get('to');
  if ((qFrom && !DAY.test(qFrom)) || (qTo && !DAY.test(qTo)) || (qFrom && qTo && qFrom > qTo))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: qFrom && !DAY.test(qFrom) ? 'from' : 'to', message: '올바른 기간이 아닙니다.' },
    ]);
  const to = qTo ?? kstDay(0);
  const from = qFrom ?? addDays(to, -29);
  if (dayDiff(from, to) + 1 > ADS_LIMITS.STATS_MAX_DAYS)
    return mockError(400, 'VALIDATION_FAILED', '조회 기간은 최대 366일입니다.', [
      { path: 'from', message: '조회 기간은 최대 366일입니다.' },
    ]);
  const ctr = (clicks: number, impressions: number) =>
    impressions > 0 ? Math.round((clicks / impressions) * 10_000) / 100 : 0;
  const daily = dailySeries(banner.id, banner.startAt, banner.endAt, banner.totals)
    .filter((d) => d.date >= from && d.date <= to)
    .map((d) => ({ ...d, ctr: ctr(d.clicks, d.impressions) }));
  const impressions = daily.reduce((sum, d) => sum + d.impressions, 0);
  const clicks = daily.reduce((sum, d) => sum + d.clicks, 0);
  return mockJson({
    bannerId: banner.id,
    from,
    to,
    totals: { impressions, clicks, ctr: ctr(clicks, impressions) },
    daily,
  });
}
