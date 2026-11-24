import type { DealCounts } from '@house/ui';
import { BRAND } from '@/config/brand';
import { ROUTES, type MapAssetSlug } from '@/config/nav';
import { formatCount, formatHouseholds } from '@/lib/format/number';
import { formatManwon, formatPerPyeong, formatPriceRange } from '@/lib/format/price';
import type { PopularComplex, PopularRegion } from '../api/schemas';
import { mapHref } from './links';
import { formatBuiltYear } from '@/lib/format';

export type RankMode = 'complex' | 'region';

/** One ranking row, shared by the desktop table, the mobile list and the #1 feature card. */
export interface RankRow {
  key: string;
  rank: number;
  /** Positions moved: number, or 'new' for a new entry. */
  delta: number | 'new';
  name: string;
  /** Detail link of the row (complex page / map on the district). */
  href: string;
  /** "연향동" */
  place: string;
  /** Desktop-only suffix after the place: "980세대" · "매물 412건". */
  placeExtra?: string;
  /** Mobile caption: "연향동 · 1,090만/평". */
  mobileCaption: string;
  counts: DealCounts;
  total: number;
  /** Right column: "3억 6,000" + "32평". */
  value?: { main: string; caption?: string };
  feature: {
    /** "3주 연속 1위" */
    kicker?: string;
    weeklyViews?: number;
    /** "해룡면 신대리 · 1,412세대 · 2019년" */
    meta: string;
    /** "34평 매매 호가" */
    priceCaption: string;
    /** "3억 9,000 ~ 4억 8,500" */
    priceText: string;
    /** Mobile: "매매" + "3억 9,000 ~" */
    mobilePriceLabel: string;
    mobilePriceText: string;
    /** "순위 유지" · "▲2" … for the mobile card. */
    statusLabel: string;
    ctaLabel: string;
    ctaHref: string;
  };
}

function deltaOf(rankDelta: number | null | undefined, isNew: boolean): number | 'new' {
  if (isNew) return 'new';
  return rankDelta ?? 0;
}

export function rankStatusLabel(delta: number | 'new'): string {
  if (delta === 'new') return '새로 진입';
  if (delta === 0) return '순위 유지';
  return delta > 0 ? `${delta}계단 상승` : `${Math.abs(delta)}계단 하락`;
}

const builtLabel = (year: number | null | undefined, now: Date): string | undefined =>
  year ? formatBuiltYear(year, now) : undefined;

const sum = (c: DealCounts) => c.presale + c.sale + c.jeonse + c.monthly;
const join = (parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(' · ');

/** `GET /complexes/popular` item → row. `index` is the fallback rank (0-based position). */
export function complexRankRow(c: PopularComplex, index: number, now = new Date()): RankRow {
  const rank = c.rank ?? index + 1;
  const delta = deltaOf(c.rankDelta, c.rankDelta === null);
  const total = c.activeListingCount ?? sum(c.dealCounts);
  const area = c.representativeAreaLabel ?? undefined;
  const hasSale = c.salePriceMin !== null && c.salePriceMin !== undefined;
  const trade = c.latestTrade ?? undefined;
  const priceCaption = hasSale
    ? join([area && `${area} 매매 호가`]) || '매매 호가'
    : trade
      ? `${trade.areaLabel ?? ''} ${trade.note ?? '최근 거래'}`.trim()
      : '가격 정보';
  const priceText = hasSale
    ? formatPriceRange(c.salePriceMin, c.salePriceMax)
    : trade
      ? formatManwon(trade.price)
      : '매물 문의';
  const center =
    typeof c.lat === 'number' && typeof c.lng === 'number' ? { lat: c.lat, lng: c.lng } : null;
  return {
    key: c.id,
    rank,
    delta,
    name: c.name,
    href: ROUTES.complex(c.id),
    place: c.emdName ?? '',
    placeExtra: c.households ? formatHouseholds(c.households) : undefined,
    mobileCaption: join([c.emdName, c.pricePerPyeong ? formatPerPyeong(c.pricePerPyeong) : null]),
    counts: c.dealCounts,
    total,
    value: trade
      ? {
          main: formatManwon(trade.price),
          caption: join([trade.areaLabel, trade.note]).replace(' · ', ' ') || undefined,
        }
      : undefined,
    feature: {
      kicker:
        rank === 1 && c.rankStreakWeeks && c.rankStreakWeeks > 1
          ? `${c.rankStreakWeeks}주 연속 1위`
          : undefined,
      weeklyViews: c.weeklyViewCount ?? undefined,
      meta: join([
        c.emdName,
        c.households ? formatHouseholds(c.households) : undefined,
        builtLabel(c.builtYear, now),
      ]),
      priceCaption,
      priceText,
      mobilePriceLabel: hasSale ? '매매' : (trade?.note ?? '최근 거래'),
      mobilePriceText: hasSale ? `${formatManwon(c.salePriceMin ?? 0)} ~` : priceText,
      statusLabel: rankStatusLabel(delta),
      ctaLabel: `매물 ${formatCount(total)}건 보기`,
      ctaHref: mapHref('apt', { center, complexId: c.id }),
    },
  };
}

/** `GET /home/popular-regions` item → row for the given category. */
export function regionRankRow(r: PopularRegion, index: number, asset: MapAssetSlug): RankRow {
  const rank = r.rank ?? index + 1;
  const delta = deltaOf(r.rankDelta, r.rankDelta === null);
  const href = mapHref(asset, { center: { lat: r.lat, lng: r.lng } });
  const perPyeong = r.avgPricePerPyeong ? formatPerPyeong(r.avgPricePerPyeong) : undefined;
  const total = r.listingCount || sum(r.dealCounts);
  const place = r.emdName && r.emdName !== r.name ? r.emdName : BRAND.region;
  return {
    key: r.code,
    rank,
    delta,
    name: r.name,
    href,
    place,
    placeExtra: `매물 ${formatCount(total)}건`,
    mobileCaption: join([place, perPyeong ?? `매물 ${formatCount(total)}건`]),
    counts: r.dealCounts,
    total,
    value: perPyeong ? { main: perPyeong } : undefined,
    feature: {
      kicker: undefined,
      weeklyViews: r.weeklyViewCount ?? undefined,
      meta: join([place, `매물 ${formatCount(total)}건`]),
      priceCaption: perPyeong ? '평균 평당가' : '등록 매물',
      priceText: perPyeong ?? `${formatCount(total)}건`,
      mobilePriceLabel: perPyeong ? '평균 평당가' : '등록 매물',
      mobilePriceText: perPyeong ?? `${formatCount(total)}건`,
      statusLabel: rankStatusLabel(delta),
      ctaLabel: `매물 ${formatCount(total)}건 보기`,
      ctaHref: href,
    },
  };
}
