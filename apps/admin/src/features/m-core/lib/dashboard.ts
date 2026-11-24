import {
  AGENCY_DOCUMENT_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestType,
  DealType,
  formatManwon,
  type ReportReason,
} from '@house/shared';
import type { StatusTone } from '@house/ui';
import {
  formatCount,
  formatMonthDay,
  kstParts,
  toKstDateString,
  type DateInput,
} from '@/lib/format';
import type {
  DashboardDealRequest,
  ExpiringAd,
  PendingAgency,
  Traffic,
  TrafficPoint,
  TrafficStats,
} from '../api/schemas';

// ---------- deltas ----------

export interface DeltaInfo {
  direction: 'up' | 'down' | 'flat';
  /** Absolute change. */
  diff: number;
  /** Relative change (0.086 = 8.6%); null when there is no baseline. */
  ratio: number | null;
}

/** Change of `current` against `previous`. */
export function deltaOf(current: number, previous: number): DeltaInfo {
  const diff = current - previous;
  return {
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
    diff: Math.abs(diff),
    ratio: previous > 0 ? Math.abs(diff) / previous : null,
  };
}

/** "8.6%" — one decimal, or "–" without a baseline. */
export function formatDeltaPercent(delta: DeltaInfo): string {
  return delta.ratio === null ? '–' : `${(delta.ratio * 100).toFixed(1)}%`;
}

// ---------- traffic ----------

export interface TrafficTotals {
  visitors: number;
  visitorsPrev: number;
  pageViews: number;
  pageViewsPrev: number;
}

const sum = (points: readonly TrafficPoint[], key: 'visitors' | 'pageViews') =>
  points.reduce((acc, p) => acc + p[key], 0);

export function trafficTotals(traffic: Pick<Traffic, 'points' | 'previous'>): TrafficTotals {
  return {
    visitors: sum(traffic.points, 'visitors'),
    visitorsPrev: sum(traffic.previous, 'visitors'),
    pageViews: sum(traffic.points, 'pageViews'),
    pageViewsPrev: sum(traffic.previous, 'pageViews'),
  };
}

/**
 * Splits a stats series (oldest → newest, ending today) into the last `range` days and the `range`
 * days before them. Sign-ups are counted from the selected period; the provider split keeps the
 * proportions the endpoint reports for the whole window.
 */
export function splitTraffic(stats: TrafficStats, range: number): Traffic {
  const points = stats.points.slice(-range);
  const previous = stats.points.slice(-range * 2, -range).slice(-points.length);
  const total = points.reduce((acc, p) => acc + p.signups, 0);
  const providerTotal = stats.signupsByProvider.reduce((acc, p) => acc + p.count, 0);
  return {
    points,
    previous: previous.length === points.length ? previous : [],
    signups: {
      total,
      byProvider:
        providerTotal > 0
          ? stats.signupsByProvider.map((p) => ({
              provider: p.provider,
              count: Math.round((p.count / providerTotal) * total),
            }))
          : [],
    },
  };
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];

/**
 * Y axis with three equal intervals starting at 0 (ticks like 0 · 1,500 · 3,000 · 4,500), leaving
 * at least 5% headroom above the highest value so the point label fits.
 */
export function chartScale(values: readonly number[]): { max: number; ticks: number[] } {
  const dataMax = Math.max(0, ...values);
  if (dataMax === 0) return { max: 3, ticks: [3, 2, 1, 0] };
  const raw = (dataMax * 1.05) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const nice = NICE_STEPS.find((s) => s * mag >= raw - 1e-9) ?? 10;
  // Counts are whole numbers: never print a fractional tick (7 → 0 · 3 · 6 · 9, not 2.5 steps).
  const step = Math.max(1, Math.ceil(Number((nice * mag).toFixed(6))));
  return { max: step * 3, ticks: [step * 3, step * 2, step, 0] };
}

/** Position of value `i` of `n` in percent of the plot box (x centred in its band, y from the top). */
export function plotPoint(
  value: number,
  i: number,
  n: number,
  max: number,
): { x: number; y: number } {
  return {
    x: n > 0 ? ((i + 0.5) / n) * 100 : 50,
    y: max > 0 ? (1 - Math.min(value, max) / max) * 100 : 100,
  };
}

/** Index of the highest value (first one on ties); -1 for an empty series. */
export function peakIndex(values: readonly number[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (best === -1 || v > values[best]!) best = i;
  });
  return best;
}

export function isWeekend(date: DateInput): boolean {
  const weekday = kstParts(date)?.weekday;
  return weekday === '토' || weekday === '일';
}

/** Which x labels to print: all for a week, every 5th counted back from today for a month. */
export function showXLabel(i: number, n: number): boolean {
  if (n <= 10) return true;
  return (n - 1 - i) % 5 === 0;
}

/** Screen-reader summary of the visitor series. */
export function trafficSummary(traffic: Pick<Traffic, 'points' | 'previous'>): string {
  const { points } = traffic;
  if (points.length === 0) return '방문자 데이터가 없습니다.';
  const values = points.map((p) => p.visitors);
  const peak = peakIndex(values);
  const totals = trafficTotals(traffic);
  const delta = deltaOf(totals.visitors, totals.visitorsPrev);
  const last = points[points.length - 1]!;
  const parts = [
    `최근 ${points.length}일 방문자 합계 ${formatCount(totals.visitors)}명`,
    `오늘 ${formatCount(last.visitors)}명`,
    `최고 ${formatMonthDay(points[peak]!.date, true)}요일 ${formatCount(values[peak]!)}명`,
  ];
  if (delta.ratio !== null && delta.direction !== 'flat')
    parts.push(
      `직전 ${points.length}일보다 ${formatDeltaPercent(delta)} ${delta.direction === 'up' ? '많습니다' : '적습니다'}`,
    );
  return `${parts.join(', ')}.`;
}

// ---------- queues ----------

/** Whole KST calendar days from `from` to `to` (0 = same day). */
export function kstDaysBetween(from: DateInput, to: DateInput): number {
  const a = Date.parse(`${toKstDateString(from)}T00:00:00+09:00`);
  const b = Date.parse(`${toKstDateString(to)}T00:00:00+09:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Applications waiting this many days (or more) are flagged. */
export const AGENCY_WAIT_WARN_DAYS = 3;

/**
 * KST calendar days an application has waited, flagged from {@link AGENCY_WAIT_WARN_DAYS}.
 * The text comes from the moderation queue's `waitingLabel(days)` so both read the same.
 */
export function waitingState(
  appliedAt: DateInput,
  now: DateInput = new Date(),
): { days: number; overdue: boolean } {
  const days = Math.max(0, kstDaysBetween(appliedAt, now));
  return { days, overdue: days >= AGENCY_WAIT_WARN_DAYS };
}

/** "3종 확인" when everything required is there, otherwise what is missing. */
export function documentsStatus(docs: PendingAgency['documents']): { ok: boolean; label: string } {
  const missingCount = Math.max(0, docs.required - docs.submitted);
  if (missingCount === 0 && docs.missing.length === 0 && !docs.missingLabel)
    return { ok: true, label: `${docs.required}종 확인` };
  if (docs.missingLabel) return { ok: false, label: `${docs.missingLabel} 누락` };
  if (docs.missing.length === 1)
    return { ok: false, label: `${AGENCY_DOCUMENT_TYPE_LABEL[docs.missing[0]!]} 누락` };
  return { ok: false, label: `서류 ${Math.max(missingCount, docs.missing.length)}종 누락` };
}

/** Deal request headline: "신대 레이크파크 1단지 · 34평 매매" (월세 requests already say so in the title). */
export function dealRequestTitle(item: Pick<DashboardDealRequest, 'title' | 'dealType'>): string {
  const label = DEAL_TYPE_LABEL[item.dealType];
  return item.title.includes(label) ? item.title : `${item.title} ${label}`;
}

/**
 * Price parts of a request line. Numbers are returned separately so the UI can emphasise them:
 * 내놓기 "희망가 [4억 5,000]" · 구하기 "[4억 5,000] 이하" · 월세 "보증금 [500] · 월 [40] 이하".
 */
export function dealRequestPrice(
  item: Pick<DashboardDealRequest, 'type' | 'dealType' | 'price' | 'deposit' | 'monthlyRent'>,
): { text: string; strong: boolean }[] {
  const wanted = item.type === DealRequestType.WANTED;
  const tail = wanted ? ' 이하' : '';
  if (item.dealType === DealType.MONTHLY) {
    if (item.monthlyRent === null) return [{ text: '가격 협의', strong: false }];
    return [
      { text: '보증금 ', strong: false },
      { text: formatManwon(item.deposit ?? 0), strong: true },
      { text: ' · 월 ', strong: false },
      { text: formatManwon(item.monthlyRent), strong: true },
      ...(tail ? [{ text: tail, strong: false }] : []),
    ];
  }
  const amount = item.price ?? item.deposit;
  if (amount === null) return [{ text: '가격 협의', strong: false }];
  return wanted
    ? [
        { text: formatManwon(amount), strong: true },
        { text: tail, strong: false },
      ]
    : [
        { text: '희망가 ', strong: false },
        { text: formatManwon(amount), strong: true },
      ];
}

/** Progress pill of a request: 배정 대기 → N곳 전달 → 상담 중 N곳. */
export function dealRequestStatus(
  item: Pick<DashboardDealRequest, 'deliveredAgencyCount' | 'activeProposalCount'>,
): { tone: StatusTone; label: string } {
  if (item.activeProposalCount > 0)
    return { tone: 'scheduled', label: `상담 중 ${formatCount(item.activeProposalCount)}곳` };
  if (item.deliveredAgencyCount > 0)
    return { tone: 'live', label: `${formatCount(item.deliveredAgencyCount)}곳 전달` };
  return { tone: 'review', label: '배정 대기' };
}

/** Short tags for the report list (the long labels live in @house/shared). */
export const REPORT_REASON_SHORT: Record<ReportReason, string> = {
  NOT_EXIST: '없는 매물',
  ALREADY_DEALT: '거래 완료',
  WRONG_PRICE: '허위 가격',
  WRONG_INFO: '정보 불일치',
  WRONG_PHOTO: '사진 불일치',
  DUPLICATE: '중복 매물',
  UNREACHABLE: '연락 불가',
  OTHER: '기타',
};

/** D-day chip of an expiring ad: ≤3 days danger, ≤5 warn, otherwise neutral. */
export function ddayInfo(
  endAt: DateInput,
  now: DateInput = new Date(),
): { label: string; tone: 'danger' | 'warn' | 'neutral'; days: number } {
  const days = kstDaysBetween(now, endAt);
  return {
    days,
    label: days < 0 ? '종료' : days === 0 ? 'D-DAY' : `D-${days}`,
    tone: days <= 3 ? 'danger' : days <= 5 ? 'warn' : 'neutral',
  };
}

/** "11.26 종료" */
export function adEndLabel(ad: Pick<ExpiringAd, 'endAt'>): string {
  return `${formatMonthDay(ad.endAt)} 종료`;
}

/** Topbar crumb of the dashboard: ["2026.11.23 (월)", "14:20 기준 · 5분마다 갱신"]. */
export function dashboardCrumb(generatedAt: DateInput): [string, string] | null {
  const p = kstParts(generatedAt);
  if (!p) return null;
  return [
    `${p.year}.${p.month}.${p.day} (${p.weekday})`,
    `${p.hour}:${p.minute} 기준 · 5분마다 갱신`,
  ];
}
