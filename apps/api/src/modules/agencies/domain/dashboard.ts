import {
  ASSET_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealType,
  floorLabel,
  sqmToPyeong,
  type AssetType,
  type FloorDisplay,
} from '@house/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST calendar day "YYYY-MM-DD" of an instant. */
export function kstDay(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" shifted by `days`. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export interface DailyViews {
  total7d: number;
  /** vs the previous 7 days (0.12 = +12%); null when there is nothing to compare with. */
  changeRatio: number | null;
  /** Oldest → newest, 7 entries ending today. */
  daily: { date: string; views: number }[];
}

/**
 * Views per day from cumulative snapshots (`day → total listing views`): views(D) =
 * snap(D) − snap(D−1), clamped at 0 (a listing leaving the agency lowers the sum). A day whose own
 * or previous snapshot is missing counts 0 — the all-time total never lands on one day.
 */
export function dailyViews(snapshots: ReadonlyMap<string, number>, today: string): DailyViews {
  const viewsOn = (day: string): number => {
    const cur = snapshots.get(day);
    const prev = snapshots.get(addDays(day, -1));
    return cur === undefined || prev === undefined ? 0 : Math.max(0, cur - prev);
  };
  const daily = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, views: viewsOn(date) };
  });
  const total7d = daily.reduce((sum, d) => sum + d.views, 0);
  // The previous week is only comparable when both of its ends were observed.
  const prevKnown = snapshots.has(addDays(today, -7)) && snapshots.has(addDays(today, -14));
  const prevTotal = Array.from({ length: 7 }, (_, i) => viewsOn(addDays(today, i - 13))).reduce(
    (a, b) => a + b,
    0,
  );
  const changeRatio =
    prevKnown && prevTotal > 0
      ? Math.round(((total7d - prevTotal) / prevTotal) * 1000) / 1000
      : null;
  return { total7d, changeRatio, daily };
}

export interface DashboardListingRow {
  id: string;
  title: string | null;
  assetType: AssetType;
  dealType: DealType;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  floorDisplay: FloorDisplay;
  expiresAt: Date | null;
  verifiedAt: Date | null;
  complex: { name: string } | null;
  property: {
    floor: number | null;
    totalFloors: number | null;
    exclusiveArea: number | null;
    supplyArea: number | null;
  };
}

/** Row of the dashboard's 광고 만료 임박 / 실매물 확인 lists (web `dashboardListingSchema`). */
export interface DashboardListing {
  id: string;
  title: string;
  summary: string | null;
  dealType: DealType;
  price: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  expiresAt: string | null;
  verifiedAt: string | null;
  verificationDueAt: string | null;
}

/** "34평 · 5/15층": 평 from 공급면적 (else 전용), floor as the agency may show it. */
export function listingSummaryText(r: DashboardListingRow): string | null {
  const area = r.property.supplyArea ?? r.property.exclusiveArea;
  const parts = [
    area ? `${Math.round(sqmToPyeong(area))}평` : null,
    floorLabel(r.property.floor, r.property.totalFloors, r.floorDisplay),
  ].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Price fields as the console shows them (만원): 매매 / 분양권 (분양가 + 프리미엄) → `price`,
 * 전세 → `deposit`, 월세 → `deposit` + `monthlyRent`.
 */
export function dashboardPrice(
  r: Pick<
    DashboardListingRow,
    'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice' | 'premium'
  >,
): Pick<DashboardListing, 'price' | 'deposit' | 'monthlyRent'> {
  switch (r.dealType) {
    case DealType.SALE:
      return { price: r.salePrice, deposit: null, monthlyRent: null };
    case DealType.PRESALE:
      return {
        price: r.presalePrice === null ? null : r.presalePrice + (r.premium ?? 0),
        deposit: null,
        monthlyRent: null,
      };
    case DealType.JEONSE:
      return { price: null, deposit: r.deposit, monthlyRent: null };
    case DealType.MONTHLY:
    default:
      return { price: null, deposit: r.deposit, monthlyRent: r.monthlyRent };
  }
}

/**
 * `verificationValidDays` after the last 실매물 확인 the badge (and, here, the ad period) lapses
 * unless the listing is verified again. KST date; null when never verified.
 */
export function toDashboardListing(
  r: DashboardListingRow,
  verificationValidDays: number,
): DashboardListing {
  return {
    id: r.id,
    title:
      r.title ??
      r.complex?.name ??
      `${ASSET_TYPE_LABEL[r.assetType]} ${DEAL_TYPE_LABEL[r.dealType]}`,
    summary: listingSummaryText(r),
    dealType: r.dealType,
    ...dashboardPrice(r),
    expiresAt: r.expiresAt?.toISOString() ?? null,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    verificationDueAt: r.verifiedAt ? addDays(kstDay(r.verifiedAt), verificationValidDays) : null,
  };
}
