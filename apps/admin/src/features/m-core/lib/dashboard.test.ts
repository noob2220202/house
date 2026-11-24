import { AgencyDocumentType, AuthProvider, DealRequestType, DealType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { TrafficPoint, TrafficStats } from '../api/schemas';
import {
  adEndLabel,
  chartScale,
  dashboardCrumb,
  ddayInfo,
  dealRequestPrice,
  dealRequestStatus,
  dealRequestTitle,
  deltaOf,
  documentsStatus,
  formatDeltaPercent,
  isWeekend,
  kstDaysBetween,
  peakIndex,
  plotPoint,
  showXLabel,
  splitTraffic,
  trafficSummary,
  trafficTotals,
  waitingState,
} from './dashboard';

/** `n` consecutive KST days ending 2026-11-23 (월), oldest first. */
function series(visitors: readonly number[]): TrafficPoint[] {
  const end = Date.parse('2026-11-23T00:00:00+09:00');
  return visitors.map((v, i) => ({
    date: new Date(end - (visitors.length - 1 - i) * 86_400_000 + 9 * 3_600_000)
      .toISOString()
      .slice(0, 10),
    visitors: v,
    pageViews: v * 5,
    signups: 10,
  }));
}

describe('dashboard · deltas', () => {
  it('describes a change against the previous value', () => {
    expect(deltaOf(3482, 3206)).toMatchObject({ direction: 'up', diff: 276 });
    expect(formatDeltaPercent(deltaOf(3482, 3206))).toBe('8.6%');
    expect(deltaOf(35, 47)).toMatchObject({ direction: 'down', diff: 12 });
    expect(deltaOf(5, 5)).toEqual({ direction: 'flat', diff: 0, ratio: 0 });
  });

  it('has no ratio without a baseline', () => {
    const delta = deltaOf(12, 0);
    expect(delta.ratio).toBeNull();
    expect(formatDeltaPercent(delta)).toBe('–');
  });
});

describe('dashboard · traffic', () => {
  const week = series([3105, 3260, 3040, 3390, 3890, 3310, 3482]);

  it('splits a stats window into the selected period and the one before it', () => {
    const stats: TrafficStats = {
      days: 30,
      points: series(Array.from({ length: 30 }, (_, i) => 1000 + i)),
      signupsByProvider: [
        { provider: AuthProvider.KAKAO, count: 186 },
        { provider: AuthProvider.NAVER, count: 81 },
        { provider: AuthProvider.GOOGLE, count: 33 },
      ],
    };
    const traffic = splitTraffic(stats, 7);
    expect(traffic.points.map((p) => p.visitors)).toEqual([
      1023, 1024, 1025, 1026, 1027, 1028, 1029,
    ]);
    expect(traffic.previous.map((p) => p.visitors)).toEqual([
      1016, 1017, 1018, 1019, 1020, 1021, 1022,
    ]);
    expect(traffic.signups.total).toBe(70);
    // provider split keeps the proportions of the whole window (62% · 27% · 11%)
    expect(traffic.signups.byProvider).toEqual([
      { provider: AuthProvider.KAKAO, count: 43 },
      { provider: AuthProvider.NAVER, count: 19 },
      { provider: AuthProvider.GOOGLE, count: 8 },
    ]);
  });

  it('drops the comparison period when the window is too short for it', () => {
    const traffic = splitTraffic(
      { days: 7, points: series([1, 2, 3, 4, 5, 6, 7, 8, 9]), signupsByProvider: [] },
      7,
    );
    expect(traffic.points).toHaveLength(7);
    expect(traffic.previous).toEqual([]);
    expect(traffic.signups.byProvider).toEqual([]);
  });

  it('handles an empty series', () => {
    const traffic = splitTraffic({ days: 7, points: [], signupsByProvider: [] }, 7);
    expect(traffic).toEqual({ points: [], previous: [], signups: { total: 0, byProvider: [] } });
    expect(trafficSummary(traffic)).toBe('방문자 데이터가 없습니다.');
  });

  it('sums visitors and page views of both periods', () => {
    expect(
      trafficTotals({ points: week, previous: series([3000, 3000, 3000, 3000, 3000, 3000, 3000]) }),
    ).toEqual({
      visitors: 23477,
      visitorsPrev: 21000,
      pageViews: 117385,
      pageViewsPrev: 105000,
    });
  });

  it('builds a 0-based axis with three equal, round intervals and headroom', () => {
    expect(chartScale([3105, 3890, 3482])).toEqual({ max: 4500, ticks: [4500, 3000, 1500, 0] });
    expect(chartScale([0, 0])).toEqual({ max: 3, ticks: [3, 2, 1, 0] });
    expect(chartScale([])).toEqual({ max: 3, ticks: [3, 2, 1, 0] });
    // whole-number ticks even for tiny counts (never 2.5 visitors)
    expect(chartScale([7])).toEqual({ max: 9, ticks: [9, 6, 3, 0] });
    for (const values of [[1], [7], [42], [999], [12_345], [987_654]]) {
      const { max, ticks } = chartScale(values);
      expect(max).toBeGreaterThanOrEqual(values[0]! * 1.05);
      expect(ticks).toEqual([max, (max / 3) * 2, max / 3, 0]);
      expect(Number.isInteger(max / 3)).toBe(true);
    }
  });

  it('positions points in percent of the plot box', () => {
    expect(plotPoint(4500, 0, 7, 4500)).toEqual({ x: (0.5 / 7) * 100, y: 0 });
    expect(plotPoint(0, 6, 7, 4500)).toEqual({ x: (6.5 / 7) * 100, y: 100 });
    expect(plotPoint(9999, 3, 7, 4500).y).toBe(0); // clamped to the top
    expect(plotPoint(10, 0, 0, 0)).toEqual({ x: 50, y: 100 });
  });

  it('finds the peak (first one on ties)', () => {
    expect(peakIndex(week.map((p) => p.visitors))).toBe(4);
    expect(peakIndex([5, 9, 9, 1])).toBe(1);
    expect(peakIndex([])).toBe(-1);
  });

  it('knows KST weekends', () => {
    expect(isWeekend('2026-11-21')).toBe(true); // 토
    expect(isWeekend('2026-11-22')).toBe(true); // 일
    expect(isWeekend('2026-11-23')).toBe(false); // 월
    // Saturday 23:30 UTC is already Sunday in Seoul; Sunday 16:00 UTC is Monday.
    expect(isWeekend('2026-11-21T23:30:00Z')).toBe(true);
    expect(isWeekend('2026-11-22T16:00:00Z')).toBe(false);
  });

  it('prints every x label for a week and every fifth (counted from today) for a month', () => {
    expect(Array.from({ length: 7 }, (_, i) => showXLabel(i, 7))).toEqual(Array(7).fill(true));
    const shown = Array.from({ length: 30 }, (_, i) => i).filter((i) => showXLabel(i, 30));
    expect(shown).toEqual([4, 9, 14, 19, 24, 29]);
  });

  it('summarises the series for screen readers', () => {
    const summary = trafficSummary({
      points: week,
      previous: series([3000, 3000, 3000, 3000, 3000, 3000, 3000]),
    });
    expect(summary).toBe(
      '최근 7일 방문자 합계 23,477명, 오늘 3,482명, 최고 11.21 토요일 3,890명, 직전 7일보다 11.8% 많습니다.',
    );
  });
});

describe('dashboard · queues', () => {
  const now = '2026-11-23T05:20:00Z'; // 14:20 KST

  it('counts whole KST calendar days', () => {
    expect(kstDaysBetween('2026-11-20T00:30:00Z', now)).toBe(3);
    // 23:50 KST the day before vs 00:10 KST today → one calendar day, 20 minutes apart
    expect(kstDaysBetween('2026-11-22T14:50:00Z', '2026-11-22T15:10:00Z')).toBe(1);
    expect(kstDaysBetween('2026-11-23T01:00:00Z', now)).toBe(0);
    expect(kstDaysBetween('not a date', now)).toBe(0);
  });

  it('counts how long an application has been waiting and flags old ones', () => {
    expect(waitingState('2026-11-23T00:30:00Z', now)).toEqual({ days: 0, overdue: false });
    expect(waitingState('2026-11-21T02:00:00Z', now)).toEqual({ days: 2, overdue: false });
    expect(waitingState('2026-11-20T02:00:00Z', now)).toEqual({ days: 3, overdue: true });
    // a clock-skewed future date never shows a negative wait
    expect(waitingState('2026-11-25T02:00:00Z', now).days).toBe(0);
  });

  it('describes the submitted documents', () => {
    expect(documentsStatus({ submitted: 3, required: 3, missing: [], missingLabel: null })).toEqual(
      {
        ok: true,
        label: '3종 확인',
      },
    );
    expect(
      documentsStatus({ submitted: 2, required: 3, missing: [], missingLabel: '공제증서' }),
    ).toEqual({ ok: false, label: '공제증서 누락' });
    expect(
      documentsStatus({
        submitted: 2,
        required: 3,
        missing: [AgencyDocumentType.BUSINESS_REG_CERT],
        missingLabel: null,
      }),
    ).toEqual({ ok: false, label: '사업자등록증 누락' });
    expect(
      documentsStatus({
        submitted: 1,
        required: 3,
        missing: [AgencyDocumentType.BUSINESS_REG_CERT, AgencyDocumentType.REGISTRATION_CERT],
        missingLabel: null,
      }),
    ).toEqual({ ok: false, label: '서류 2종 누락' });
    expect(documentsStatus({ submitted: 0, required: 3, missing: [], missingLabel: null })).toEqual(
      {
        ok: false,
        label: '서류 3종 누락',
      },
    );
  });

  it('appends the deal type to a request title once', () => {
    expect(
      dealRequestTitle({ title: '신대 레이크파크 1단지 · 34평', dealType: DealType.SALE }),
    ).toBe('신대 레이크파크 1단지 · 34평 매매');
    expect(dealRequestTitle({ title: '석현동 원룸·투룸 · 월세', dealType: DealType.MONTHLY })).toBe(
      '석현동 원룸·투룸 · 월세',
    );
  });

  it('formats the price line of 내놓기 / 구하기 requests', () => {
    const text = (parts: { text: string }[]) => parts.map((p) => p.text).join('');
    const sell = dealRequestPrice({
      type: DealRequestType.SELL_OR_LEASE,
      dealType: DealType.SALE,
      price: 45000,
      deposit: null,
      monthlyRent: null,
    });
    expect(text(sell)).toBe('희망가 4억 5,000');
    expect(sell.filter((p) => p.strong).map((p) => p.text)).toEqual(['4억 5,000']);

    expect(
      text(
        dealRequestPrice({
          type: DealRequestType.WANTED,
          dealType: DealType.SALE,
          price: 45000,
          deposit: null,
          monthlyRent: null,
        }),
      ),
    ).toBe('4억 5,000 이하');
    expect(
      text(
        dealRequestPrice({
          type: DealRequestType.SELL_OR_LEASE,
          dealType: DealType.JEONSE,
          price: null,
          deposit: 19000,
          monthlyRent: null,
        }),
      ),
    ).toBe('희망가 1억 9,000');
    expect(
      text(
        dealRequestPrice({
          type: DealRequestType.WANTED,
          dealType: DealType.MONTHLY,
          price: null,
          deposit: 500,
          monthlyRent: 40,
        }),
      ),
    ).toBe('보증금 500 · 월 40 이하');
    expect(
      text(
        dealRequestPrice({
          type: DealRequestType.SELL_OR_LEASE,
          dealType: DealType.MONTHLY,
          price: null,
          deposit: null,
          monthlyRent: 45,
        }),
      ),
    ).toBe('보증금 0 · 월 45');
    for (const dealType of [DealType.SALE, DealType.MONTHLY]) {
      expect(
        dealRequestPrice({
          type: DealRequestType.WANTED,
          dealType,
          price: null,
          deposit: null,
          monthlyRent: null,
        }),
      ).toEqual([{ text: '가격 협의', strong: false }]);
    }
  });

  it('shows the furthest progress of a request', () => {
    expect(dealRequestStatus({ deliveredAgencyCount: 0, activeProposalCount: 0 })).toEqual({
      tone: 'review',
      label: '배정 대기',
    });
    expect(dealRequestStatus({ deliveredAgencyCount: 12, activeProposalCount: 0 })).toEqual({
      tone: 'live',
      label: '12곳 전달',
    });
    expect(dealRequestStatus({ deliveredAgencyCount: 12, activeProposalCount: 2 })).toEqual({
      tone: 'scheduled',
      label: '상담 중 2곳',
    });
  });

  it('colours the D-day chip of an expiring ad', () => {
    expect(ddayInfo('2026-11-26T14:59:00Z', now)).toEqual({
      label: 'D-3',
      tone: 'danger',
      days: 3,
    });
    expect(ddayInfo('2026-11-28T03:00:00Z', now)).toEqual({ label: 'D-5', tone: 'warn', days: 5 });
    expect(ddayInfo('2026-11-30T03:00:00Z', now)).toEqual({
      label: 'D-7',
      tone: 'neutral',
      days: 7,
    });
    expect(ddayInfo('2026-11-23T14:00:00Z', now)).toMatchObject({ label: 'D-DAY', tone: 'danger' });
    expect(ddayInfo('2026-11-21T03:00:00Z', now)).toMatchObject({ label: '종료', tone: 'danger' });
    expect(adEndLabel({ endAt: '2026-11-26T14:59:00Z' })).toBe('11.26 종료');
  });

  it('builds the topbar crumb in KST', () => {
    expect(dashboardCrumb(now)).toEqual(['2026.11.23 (월)', '14:20 기준 · 5분마다 갱신']);
    expect(dashboardCrumb('2026-11-22T15:05:00Z')).toEqual([
      '2026.11.23 (월)',
      '00:05 기준 · 5분마다 갱신',
    ]);
    expect(dashboardCrumb('nope')).toBeNull();
  });
});
