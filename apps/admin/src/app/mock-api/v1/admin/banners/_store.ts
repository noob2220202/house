import {
  BANNER_SLOT_SPECS,
  BannerSlot,
  BannerStatus,
  BannerTargeting,
  computeScheduleStatus,
  type BannerSlot as Slot,
  type BannerTargeting as Targeting,
} from '@house/shared';
import { agencyById, agencyByKey } from '../../agencies/_fixtures';
import { COMPLEXES, complexByCode } from '../../complexes/_fixtures';
import { regionCodeOf } from '../../regions/_fixtures';
import { adMediaView, registerFixtureMedia } from '../media/_store';
import type { CreativeSpec } from './_creatives';
import { addDays, dayDiff, endOfKstDay, kstDay, mockUuid, startOfKstDay } from './_ids';

/**
 * Mutable in-memory banner state of the admin mock (globalThis → shared by all route bundles, reset
 * on restart). Mirrors the `banners` / `banner_slot_configs` / `banner_stat_daily` tables of the ads
 * module. Windows are relative to "today" so the list always shows live / scheduled / paused / ended
 * rows (mockdata.md §5 — AD-01 has 7 days left, AD-03 starts in a week …).
 */
export interface MockBanner {
  id: string;
  code: string;
  slot: Slot;
  title: string;
  advertiserName: string | null;
  agencyId: string | null;
  pcMediaId: string;
  mobileMediaId: string | null;
  linkUrl: string | null;
  newWindow: boolean;
  startAt: string;
  endAt: string;
  paused: boolean;
  priority: number;
  sortOrder: number;
  targeting: Targeting;
  targetRegionCodes: string[];
  targetComplexIds: string[];
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  /** Lifetime totals the daily series adds up to (0 for banners created in this session). */
  totals: { impressions: number; clicks: number };
  /** Stand-in creative of fixture rows (mock creative route). */
  creative?: CreativeSpec;
}

interface BannerState {
  banners: MockBanner[];
  maxActive: Record<Slot, number>;
  seq: number;
}

const KEY = '__houseAdminMockBanners' as const;
type GlobalWithBanners = typeof globalThis & { [KEY]?: BannerState };

export const SLOT_ORDER = Object.values(BannerSlot) as Slot[];

interface Seed {
  code: string;
  slot: Slot;
  title: string;
  advertiserName?: string;
  agencyKey?: string;
  /** Window in days relative to today: [start, end]. */
  window: [number, number];
  paused?: boolean;
  memo?: string;
  linkUrl?: string;
  newWindow?: boolean;
  regions?: string[];
  complexes?: string[];
  totals?: [number, number];
  noMobile?: boolean;
  creative: CreativeSpec;
}

const HOUSE = { ground: '#0F1B3A', accent: '#E9D7A8' };
const BLUE = { ground: '#1D4FF2', accent: '#DCE6FF' };

const SEEDS: readonly Seed[] = [
  // ---- MAIN_HERO ---------------------------------------------------------------------------------
  {
    code: 'AD-01',
    slot: BannerSlot.MAIN_HERO,
    title: '연향들 더 퍼스트 견본주택 오픈',
    advertiserName: '분양 광고주 A',
    window: [-23, 7],
    linkUrl: '/map/apt?q=%EC%97%B0%ED%96%A5%EB%93%A4',
    totals: [48210, 1126],
    creative: {
      ...HOUSE,
      kicker: '연향들 도시개발구역 · 민간분양',
      headline: ['연향들 더 퍼스트', '12월 견본주택 오픈'],
      short: '연향들 더 퍼스트 견본주택 오픈',
      motif: 'skyline',
    },
  },
  {
    code: 'AD-03',
    slot: BannerSlot.MAIN_HERO,
    title: '순천 이사·입주청소 한 번에 예약',
    advertiserName: '늘봄 이사·청소',
    window: [7, 37],
    linkUrl: 'https://example.com/nulbom?utm_source=brand',
    newWindow: true,
    regions: ['신대지구', '선월지구', '연향동'],
    noMobile: true,
    creative: {
      ground: '#1C2B22',
      accent: '#F2C78B',
      kicker: '늘봄 이사·청소',
      headline: ['순천 이사·입주청소', '한 번에 예약'],
      short: '이사·청소 예약',
      motif: 'box',
    },
  },
  {
    code: 'AD-05',
    slot: BannerSlot.MAIN_HERO,
    title: '신대지구 입주 박람회 사전등록',
    advertiserName: '순천 리빙페어 사무국',
    window: [-10, 20],
    linkUrl: 'https://example.com/living-fair',
    newWindow: true,
    totals: [19870, 512],
    creative: {
      ground: '#3B1D5E',
      accent: '#F1D9FF',
      kicker: '순천 리빙페어 · 사전등록 무료',
      headline: ['신대지구 입주 박람회', '가구·가전·인테리어 한자리'],
      short: '신대지구 입주 박람회',
      motif: 'pin',
    },
  },
  // ---- MAIN_STRIP --------------------------------------------------------------------------------
  {
    code: 'AD-07',
    slot: BannerSlot.MAIN_STRIP,
    title: '관심 단지 새 매물 알림 받기',
    advertiserName: '운영사 캠페인',
    window: [-14, 38],
    linkUrl: '/me/alerts',
    totals: [31402, 408],
    creative: {
      ...BLUE,
      kicker: '알림 설정',
      headline: ['관심 단지 새 매물 알림 받기'],
      motif: 'bell',
    },
  },
  {
    code: 'AD-06',
    slot: BannerSlot.MAIN_STRIP,
    title: '가을 이사철 중개보수 안내',
    advertiserName: '운영사 캠페인',
    window: [-52, -5],
    linkUrl: '/tools',
    totals: [27950, 356],
    creative: {
      ...HOUSE,
      kicker: '중개보수 계산기',
      headline: ['가을 이사철, 중개보수 미리 계산해 보세요'],
      motif: 'none',
    },
  },
  // ---- MAP_AD ------------------------------------------------------------------------------------
  {
    code: 'AD-02',
    slot: BannerSlot.MAP_AD,
    title: '호수공원 공인중개사사무소',
    agencyKey: 'B02',
    window: [-9, 21],
    regions: ['조례동', '연향동'],
    totals: [12880, 341],
    creative: {
      ground: '#0A1222',
      accent: '#E9D7A8',
      kicker: '연향·조례 아파트 전문',
      headline: ['호수공원', '공인중개사사무소'],
      motif: 'office',
    },
  },
  {
    code: 'AD-09',
    slot: BannerSlot.MAP_AD,
    title: '신대중앙 공인중개사사무소',
    agencyKey: 'B01',
    window: [-23, 37],
    paused: true,
    memo: '광고주 요청',
    regions: ['신대지구'],
    totals: [8214, 197],
    creative: {
      ground: '#0A1222',
      accent: '#E9D7A8',
      kicker: '신대 레이크파크 단지 전문',
      headline: ['신대중앙', '공인중개사사무소'],
      motif: 'office',
    },
  },
  {
    code: 'AD-10',
    slot: BannerSlot.MAP_AD,
    title: '선월 분양권 공인중개사사무소',
    agencyKey: 'B05',
    window: [-5, 25],
    regions: ['선월지구'],
    totals: [4120, 131],
    creative: {
      ground: '#2B1F4D',
      accent: '#D9CCFF',
      kicker: '분양권 전문',
      headline: ['선월 분양권', '공인중개사사무소'],
      motif: 'skyline',
    },
  },
  {
    code: 'AD-11',
    slot: BannerSlot.MAP_AD,
    title: '순천대정문 공인중개사사무소',
    agencyKey: 'B06',
    window: [-12, 18],
    regions: ['석현동'],
    totals: [9304, 402],
    creative: {
      ground: '#123A2E',
      accent: '#BFEBD6',
      kicker: '원룸·투룸 전문',
      headline: ['순천대정문', '공인중개사사무소'],
      motif: 'pin',
    },
  },
  // ---- COMPLEX_FEATURED_AGENCY -------------------------------------------------------------------
  {
    code: 'AD-12',
    slot: BannerSlot.COMPLEX_FEATURED_AGENCY,
    title: '신대 레이크파크 전문 · 신대중앙',
    agencyKey: 'B01',
    window: [-20, 40],
    complexes: ['C01', 'C06'],
    totals: [6518, 289],
    creative: {
      ground: '#0A1222',
      accent: '#E9D7A8',
      kicker: '레이크파크 거래 14건 · 최근 30일',
      headline: ['신대중앙 공인중개사사무소'],
      motif: 'office',
    },
  },
  {
    code: 'AD-13',
    slot: BannerSlot.COMPLEX_FEATURED_AGENCY,
    title: '연향 센트럴 전문 · 연향센트럴',
    agencyKey: 'B03',
    window: [-15, 15],
    complexes: ['C02'],
    totals: [3902, 144],
    creative: {
      ground: '#10294D',
      accent: '#C9DCF5',
      kicker: '연향 센트럴 단지 전문',
      headline: ['연향센트럴 공인중개사사무소'],
      motif: 'office',
    },
  },
  {
    code: 'AD-14',
    slot: BannerSlot.COMPLEX_FEATURED_AGENCY,
    title: '오천 그린빌 전문 · 오천그린',
    agencyKey: 'B04',
    window: [-3, 27],
    complexes: ['C05'],
    totals: [1204, 38],
    creative: {
      ground: '#123A2E',
      accent: '#BFEBD6',
      kicker: '오천지구 전문',
      headline: ['오천그린 공인중개사사무소'],
      motif: 'office',
    },
  },
  {
    code: 'AD-15',
    slot: BannerSlot.COMPLEX_FEATURED_AGENCY,
    title: '왕지 숲속마을 전문 · 왕지숲',
    agencyKey: 'B08',
    window: [10, 40],
    complexes: ['C08'],
    creative: {
      ground: '#2A2416',
      accent: '#E9D7A8',
      kicker: '왕지·조례 전문',
      headline: ['왕지숲 공인중개사사무소'],
      motif: 'office',
    },
  },
  // ---- LISTING_SIDE ------------------------------------------------------------------------------
  {
    code: 'AD-16',
    slot: BannerSlot.LISTING_SIDE,
    title: '순천 인테리어 견적 비교',
    advertiserName: '모아 인테리어',
    window: [-8, 22],
    linkUrl: 'https://example.com/moa-interior',
    newWindow: true,
    totals: [7731, 118],
    creative: {
      ground: '#4A2A12',
      accent: '#FFD9B0',
      kicker: '모아 인테리어',
      headline: ['입주 전 인테리어', '견적 3곳 비교'],
      motif: 'box',
    },
  },
  {
    code: 'AD-17',
    slot: BannerSlot.LISTING_SIDE,
    title: '전월세 보증보험 한눈에 보기',
    advertiserName: '운영사 캠페인',
    window: [-30, 60],
    linkUrl: '/tools',
    totals: [15266, 274],
    creative: {
      ...HOUSE,
      kicker: '전월세 계약 전 확인',
      headline: ['보증보험 가입 조건', '한눈에 보기'],
      motif: 'check',
    },
  },
  // ---- AGENCY_SEARCH_TOP -------------------------------------------------------------------------
  {
    code: 'AD-18',
    slot: BannerSlot.AGENCY_SEARCH_TOP,
    title: '중개사무소 회원 모집 · 첫 3개월 무료',
    advertiserName: '운영사 캠페인',
    window: [-40, 50],
    linkUrl: '/agent/apply',
    totals: [11480, 630],
    creative: {
      ...BLUE,
      kicker: '순천 공동중개 네트워크',
      headline: ['중개사무소 회원 모집 · 첫 3개월 무료'],
      motif: 'office',
    },
  },
  {
    code: 'AD-19',
    slot: BannerSlot.AGENCY_SEARCH_TOP,
    title: '금당리버 공인중개사사무소 개업 10주년',
    agencyKey: 'B07',
    window: [3, 33],
    creative: {
      ground: '#10294D',
      accent: '#C9DCF5',
      kicker: '금당지구 전문 · 개업 10주년',
      headline: ['금당리버 공인중개사사무소'],
      motif: 'office',
    },
  },
  // ---- MOBILE_MAIN -------------------------------------------------------------------------------
  {
    code: 'AD-20',
    slot: BannerSlot.MOBILE_MAIN,
    title: '홈 화면에 추가하고 앱처럼 쓰기',
    advertiserName: '운영사 캠페인',
    window: [-20, 40],
    linkUrl: '/notices',
    totals: [22104, 911],
    creative: {
      ...BLUE,
      kicker: '설치 없이 바로',
      headline: ['홈 화면에 추가하고', '앱처럼 쓰기'],
      motif: 'bell',
    },
  },
  {
    code: 'AD-21',
    slot: BannerSlot.MOBILE_MAIN,
    title: '연향들 더 퍼스트 관심고객 등록',
    advertiserName: '분양 광고주 A',
    window: [-23, 7],
    linkUrl: '/map/apt?q=%EC%97%B0%ED%96%A5%EB%93%A4',
    totals: [17640, 604],
    creative: {
      ...HOUSE,
      kicker: '전용 84㎡ · 612세대',
      headline: ['연향들 더 퍼스트', '관심고객 등록'],
      motif: 'skyline',
    },
  },
];

/** Creative image URL of a fixture banner (mock-only route). */
const creativeUrl = (code: string, kind: 'pc' | 'mobile') =>
  `/mock-api/v1/admin/banners/creative/${code}-${kind}.svg`;

function seedBanners(): MockBanner[] {
  const order = new Map<Slot, number>();
  return SEEDS.map((s) => {
    const spec = BANNER_SLOT_SPECS[s.slot];
    const sortOrder = (order.get(s.slot) ?? 0) + 1;
    order.set(s.slot, sortOrder);
    const pcMediaId = registerFixtureMedia({
      id: mockUuid(`${s.code}-pc`),
      purpose: 'BANNER',
      mimeType: 'image/svg+xml',
      width: spec.pc.width,
      height: spec.pc.height,
      url: creativeUrl(s.code, 'pc'),
    });
    const mobileMediaId =
      spec.mobile && !s.noMobile
        ? registerFixtureMedia({
            id: mockUuid(`${s.code}-mobile`),
            purpose: 'BANNER',
            mimeType: 'image/svg+xml',
            width: spec.mobile.width,
            height: spec.mobile.height,
            url: creativeUrl(s.code, 'mobile'),
          })
        : null;
    const agency = s.agencyKey ? agencyByKey(s.agencyKey) : null;
    const created = startOfKstDay(kstDay(Math.min(s.window[0], 0) - 3));
    return {
      id: mockUuid(s.code),
      code: s.code,
      slot: s.slot,
      title: s.title,
      advertiserName: agency ? agency.name : (s.advertiserName ?? null),
      agencyId: agency?.id ?? null,
      pcMediaId,
      mobileMediaId,
      linkUrl: s.linkUrl ?? (agency ? `/agency/${agency.id}` : null),
      newWindow: s.newWindow ?? false,
      startAt: startOfKstDay(kstDay(s.window[0])),
      endAt: endOfKstDay(kstDay(s.window[1])),
      paused: s.paused ?? false,
      priority: 0,
      sortOrder,
      targeting: s.regions
        ? BannerTargeting.REGIONS
        : s.complexes
          ? BannerTargeting.COMPLEXES
          : BannerTargeting.ALL,
      targetRegionCodes: (s.regions ?? []).map(regionCodeOf),
      targetComplexIds: (s.complexes ?? []).map((code) => complexByCode(code).id),
      memo: s.memo ?? null,
      createdAt: created,
      updatedAt: created,
      totals: { impressions: s.totals?.[0] ?? 0, clicks: s.totals?.[1] ?? 0 },
      creative: s.creative,
    };
  });
}

export function bannerState(): BannerState {
  const g = globalThis as GlobalWithBanners;
  g[KEY] ??= {
    banners: seedBanners(),
    maxActive: Object.fromEntries(
      SLOT_ORDER.map((slot) => [slot, BANNER_SLOT_SPECS[slot].maxActive]),
    ) as Record<Slot, number>,
    seq: 30,
  };
  return g[KEY];
}

export const statusOf = (b: Pick<MockBanner, 'paused' | 'startAt' | 'endAt'>, now = new Date()) =>
  computeScheduleStatus(
    { paused: b.paused, startAt: new Date(b.startAt), endAt: new Date(b.endAt) },
    now,
  );

export function findBanner(id: string): MockBanner | undefined {
  return bannerState().banners.find((b) => b.id === id);
}

/** Banners of a slot in display order. */
export function slotBanners(slot: Slot): MockBanner[] {
  return bannerState()
    .banners.filter((b) => b.slot === slot)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Renumbers a slot 1..n keeping the current order. */
export function renumberSlot(slot: Slot): void {
  slotBanners(slot).forEach((b, i) => {
    b.sortOrder = i + 1;
  });
}

export function activeCount(slot: Slot, exceptId?: string): number {
  return bannerState().banners.filter(
    (b) => b.slot === slot && b.id !== exceptId && statusOf(b) === BannerStatus.ACTIVE,
  ).length;
}

/** Shared `AdminBannerView` — what GET/POST/PATCH /admin/banners return. */
export function toAdminBanner(b: MockBanner) {
  const agency = agencyById(b.agencyId);
  return {
    id: b.id,
    slot: b.slot,
    title: b.title,
    advertiserName: b.advertiserName,
    agency: agency ? { id: agency.id, name: agency.name } : null,
    pcImage: adMediaView(b.pcMediaId) ?? { id: b.pcMediaId, url: '', width: null, height: null },
    mobileImage: adMediaView(b.mobileMediaId),
    linkUrl: b.linkUrl,
    newWindow: b.newWindow,
    startAt: b.startAt,
    endAt: b.endAt,
    paused: b.paused,
    status: statusOf(b),
    priority: b.priority,
    sortOrder: b.sortOrder,
    targeting: b.targeting,
    targetRegionCodes: b.targetRegionCodes,
    targetComplexes: b.targetComplexIds.map((id) => ({
      id,
      name: COMPLEXES.find((c) => c.id === id)?.name ?? '삭제된 단지',
    })),
    memo: b.memo,
    createdByAdminId: null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

// ---- daily stats (banner_stat_daily) ---------------------------------------------------------------

function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return (h >>> 8) / 0x1000000;
  };
}

function spread(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const out = weights.map((w) => Math.floor((total * w) / sum));
  let rest = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0 && out.length > 0; i = (i + 1) % out.length, rest -= 1) {
    out[i] = (out[i] ?? 0) + 1;
  }
  return out;
}

export interface DailyStat {
  date: string;
  impressions: number;
  clicks: number;
}

/** Deterministic daily series of a banner / popup from its start to today (or its end) that adds up to the totals. */
export function dailySeries(
  seed: string,
  startAt: string,
  endAt: string,
  totals: { impressions: number; clicks: number },
): DailyStat[] {
  const first = kstDay(0, new Date(startAt));
  const today = kstDay(0);
  const lastDay = kstDay(0, new Date(endAt));
  const last = dayDiff(today, lastDay) < 0 ? lastDay : today;
  const days = dayDiff(first, last) + 1;
  if (days <= 0) return [];
  const rnd = seeded(seed);
  const impressionWeights: number[] = [];
  const clickWeights: number[] = [];
  for (let i = 0; i < days; i += 1) {
    const weekday = new Date(`${addDays(first, i)}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 1.22 : 1;
    const ramp = Math.min(1, 0.55 + i * 0.15);
    const w = weekend * ramp * (0.78 + rnd() * 0.44);
    impressionWeights.push(w);
    clickWeights.push(w * (0.7 + rnd() * 0.6));
  }
  const impressions = spread(totals.impressions, impressionWeights);
  const clicks = spread(totals.clicks, clickWeights);
  return impressions.map((n, i) => ({
    date: addDays(first, i),
    impressions: n,
    clicks: Math.min(clicks[i] ?? 0, n),
  }));
}
