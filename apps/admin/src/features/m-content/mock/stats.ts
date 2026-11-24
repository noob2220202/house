/**
 * Deterministic daily series for the 통계 mock: the same calendar day always yields the same
 * numbers (seeded by the date), with a weekly rhythm (weekend peak for traffic, weekday peak for
 * listings) and a gentle upward trend. "Today" is the real KST date so the charts always end now.
 */
import { mockUuid } from './ids';

const DAY = 86_400_000;

function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

function kstDate(offsetDays: number): { key: string; dow: number; index: number } {
  const t = new Date(Date.now() + 9 * 3600_000 - offsetDays * DAY);
  return {
    key: t.toISOString().slice(0, 10),
    dow: t.getUTCDay(),
    index: Math.floor(t.getTime() / DAY),
  };
}

/** Oldest → newest, `days` entries ending today. `skip` shifts the window back (previous period). */
function days(count: number, skip = 0) {
  return Array.from({ length: count }, (_, i) => kstDate(count - 1 - i + skip));
}

const trend = (index: number) => 1 + ((index % 365) / 365) * 0.18;
const WEEKEND = [1.12, 0.94, 0.92, 0.95, 0.98, 1.04, 1.18];
const WEEKDAY = [0.45, 1.1, 1.18, 1.12, 1.08, 1.02, 0.6];
const jitter = (key: string, salt: string, spread = 0.16) =>
  1 - spread / 2 + rand(key + salt) * spread;

function trafficDay(d: ReturnType<typeof kstDate>) {
  const visitors = Math.round(3050 * trend(d.index) * (WEEKEND[d.dow] ?? 1) * jitter(d.key, 'v'));
  return {
    date: d.key,
    visitors,
    pageViews: Math.round(visitors * (4.8 + rand(d.key + 'p') * 0.9)),
    signups: Math.round(22 * (WEEKEND[d.dow] ?? 1) * jitter(d.key, 's', 0.5)),
  };
}
function listingDay(d: ReturnType<typeof kstDate>) {
  const created = Math.round(
    41 * trend(d.index) * (WEEKDAY[d.dow] ?? 1) * jitter(d.key, 'lc', 0.3),
  );
  return {
    date: d.key,
    created,
    closed: Math.round(created * (0.62 + rand(d.key + 'lx') * 0.3)),
  };
}
function requestDay(d: ReturnType<typeof kstDate>) {
  const sell = Math.round(3.2 * (WEEKEND[d.dow] ?? 1) * jitter(d.key, 'rs', 0.9));
  const find = Math.round(2.4 * (WEEKEND[d.dow] ?? 1) * jitter(d.key, 'rf', 0.9));
  return {
    date: d.key,
    sell,
    find,
    proposals: Math.round((sell + find) * (2.1 + rand(d.key + 'rp'))),
  };
}
function adDay(d: ReturnType<typeof kstDate>) {
  const impressions = Math.round(
    6200 * trend(d.index) * (WEEKEND[d.dow] ?? 1) * jitter(d.key, 'ai'),
  );
  return {
    date: d.key,
    impressions,
    clicks: Math.round(impressions * (0.021 + rand(d.key + 'ac') * 0.008)),
  };
}

const total = <T extends Record<string, number | string>>(rows: T[], key: keyof T): number =>
  rows.reduce((acc, r) => acc + (typeof r[key] === 'number' ? r[key] : 0), 0);

export function trafficStats(count: number) {
  const points = days(count).map(trafficDay);
  const prev = days(count, count).map(trafficDay);
  const pv = total(points, 'pageViews');
  const signups = total(points, 'signups');
  return {
    days: count,
    points,
    previous: {
      visitors: total(prev, 'visitors'),
      pageViews: total(prev, 'pageViews'),
      signups: total(prev, 'signups'),
    },
    devices: { mobile: Math.round(pv * 0.71), desktop: pv - Math.round(pv * 0.71) },
    signupsByProvider: [
      { provider: 'KAKAO', count: Math.round(signups * 0.62) },
      { provider: 'NAVER', count: Math.round(signups * 0.27) },
      {
        provider: 'GOOGLE',
        count: signups - Math.round(signups * 0.62) - Math.round(signups * 0.27),
      },
    ],
    topPages: [
      { path: '/map/apt', label: '아파트·분양권 지도', pageViews: Math.round(pv * 0.31) },
      { path: '/', label: '메인', pageViews: Math.round(pv * 0.22) },
      { path: '/map/oneroom', label: '원룸·투룸 지도', pageViews: Math.round(pv * 0.17) },
      { path: '/complex/*', label: '단지 상세', pageViews: Math.round(pv * 0.12) },
      { path: '/listing/*', label: '매물 상세', pageViews: Math.round(pv * 0.09) },
      { path: '/agencies', label: '중개사무소 찾기', pageViews: Math.round(pv * 0.04) },
    ],
  };
}

export function listingStats(count: number) {
  const points = days(count).map(listingDay);
  const prev = days(count, count).map(listingDay);
  return {
    days: count,
    points,
    previous: { created: total(prev, 'created'), closed: total(prev, 'closed') },
    activeTotal: 3201,
    byAssetType: [
      { assetType: 'APT', count: 1284 },
      { assetType: 'ONEROOM', count: 936 },
      { assetType: 'LAND', count: 421 },
      { assetType: 'HOUSE', count: 312 },
      { assetType: 'COMMERCIAL', count: 248 },
    ],
    byDealType: [
      { dealType: 'SALE', count: 1562 },
      { dealType: 'MONTHLY', count: 918 },
      { dealType: 'JEONSE', count: 617 },
      { dealType: 'PRESALE', count: 104 },
    ],
    topComplexes: [
      {
        id: mockUuid('C09'),
        name: '연향들 더 퍼스트',
        views: Math.round(count * 701),
        listings: 58,
      },
      {
        id: mockUuid('C01'),
        name: '신대 레이크파크 1단지',
        views: Math.round(count * 614),
        listings: 56,
      },
      {
        id: mockUuid('C03'),
        name: '선월 하이츠 2차',
        views: Math.round(count * 510),
        listings: 53,
      },
      { id: mockUuid('C02'), name: '연향 센트럴', views: Math.round(count * 432), listings: 38 },
      {
        id: mockUuid('C06'),
        name: '신대 레이크파크 3단지',
        views: Math.round(count * 375),
        listings: 31,
      },
    ],
  };
}

export function dealRequestStats(count: number) {
  const points = days(count).map(requestDay);
  const prev = days(count, count).map(requestDay);
  const all = total(points, 'sell') + total(points, 'find');
  return {
    days: count,
    points,
    previous: {
      sell: total(prev, 'sell'),
      find: total(prev, 'find'),
      proposals: total(prev, 'proposals'),
    },
    responseRate: 0.87,
    avgFirstResponseMinutes: 42,
    byRegion: [
      { name: '신대지구', count: Math.round(all * 0.28) },
      { name: '연향동', count: Math.round(all * 0.22) },
      { name: '조례동', count: Math.round(all * 0.16) },
      { name: '오천지구', count: Math.round(all * 0.12) },
      { name: '석현동', count: Math.round(all * 0.09) },
      { name: '그 밖의 지역', count: Math.max(0, all - Math.round(all * 0.87)) },
    ],
  };
}

export function adStats(count: number) {
  const points = days(count).map(adDay);
  const prev = days(count, count).map(adDay);
  const imp = total(points, 'impressions');
  const clk = total(points, 'clicks');
  const share = (label: string, slot: string, i: number, c: number) => ({
    slot,
    label,
    impressions: Math.round(imp * i),
    clicks: Math.round(clk * c),
  });
  return {
    days: count,
    points,
    previous: { impressions: total(prev, 'impressions'), clicks: total(prev, 'clicks') },
    activeBanners: 7,
    bySlot: [
      share('메인 히어로 배너', 'MAIN_HERO', 0.38, 0.35),
      share('메인 띠배너', 'MAIN_STRIP', 0.2, 0.14),
      share('지도 광고 카드', 'MAP_AD', 0.18, 0.24),
      share('단지 전문 중개사', 'COMPLEX_FEATURED_AGENCY', 0.14, 0.19),
      share('매물 상세 사이드', 'LISTING_SIDE', 0.1, 0.08),
    ],
  };
}
