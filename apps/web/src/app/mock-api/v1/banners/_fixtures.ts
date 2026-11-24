import { BANNER_SLOT_SPECS, BannerSlot, type BannerSlot as Slot } from '@house/shared';
import { mockUuid } from '@/lib/mock';
import {
  boxCreative,
  mobileCreative,
  mobileStripCreative,
  wideCreative,
  type CreativeSpec,
} from './_creatives';

/**
 * Banner fixtures (mockdata.md §5–6). Mirrors the `banners` table: slot, schedule window, paused,
 * sortOrder. The serve endpoint returns only items that are live right now — the scheduled and the
 * paused rows below exist to prove that filter.
 */
export interface MockBanner {
  key: string;
  id: string;
  slot: Slot;
  title: string;
  advertiserName: string | null;
  agencyId: string | null;
  linkUrl: string | null;
  newWindow: boolean;
  startAt: string;
  endAt: string;
  paused: boolean;
  priority: number;
  sortOrder: number;
  updatedAt: string;
  creative: CreativeSpec;
  /** No dedicated mobile image → clients fall back to the pc image. */
  noMobile?: boolean;
}

const LIVE = { startAt: '2026-01-01T00:00:00+09:00', endAt: '2099-12-31T23:59:59+09:00' };
const SCHEDULED = { startAt: '2099-01-01T00:00:00+09:00', endAt: '2099-12-31T23:59:59+09:00' };

function banner(
  key: string,
  slot: Slot,
  sortOrder: number,
  rest: Pick<MockBanner, 'title' | 'advertiserName' | 'linkUrl' | 'creative'> &
    Partial<
      Pick<MockBanner, 'agencyId' | 'newWindow' | 'paused' | 'noMobile' | 'startAt' | 'endAt'>
    >,
): MockBanner {
  return {
    key,
    id: mockUuid(key),
    slot,
    agencyId: null,
    newWindow: false,
    paused: false,
    priority: 0,
    sortOrder,
    updatedAt: '2026-11-20T09:00:00+09:00',
    ...LIVE,
    ...rest,
  };
}

export const BANNERS: readonly MockBanner[] = [
  // ---- MAIN_HERO: wide carousel on the home page (design: AD 1 / 3) -----------------------------
  banner('AD-01', BannerSlot.MAIN_HERO, 1, {
    title: '연향들 더 퍼스트 12월 견본주택 오픈',
    advertiserName: '[분양 광고주 A]',
    linkUrl: '/map/apt?q=%EC%97%B0%ED%96%A5%EB%93%A4',
    creative: {
      ground: '#6B2A1C',
      accent: '#F4E9DC',
      kicker: '연향들 도시개발구역 · 민간분양',
      headline: ['연향들 더 퍼스트', '12월 견본주택 오픈'],
      sub: '전용 84㎡ · 612세대 · 2029년 입주 예정',
      cta: '관심고객 등록',
      advertiser: '[분양 광고주 A]',
      skyline: true,
      mobile: { ground: '#0F1B3A', accent: '#E9D7A8' },
    },
  }),
  banner('AD-05', BannerSlot.MAIN_HERO, 2, {
    title: '호수공원 공인중개사사무소 — 연향·조례 아파트 전문',
    advertiserName: '호수공원 공인중개사사무소',
    agencyId: mockUuid('B02'),
    linkUrl: `/agency/${mockUuid('B02')}`,
    creative: {
      ground: '#0F1B3A',
      accent: '#E9D7A8',
      kicker: '연향·조례 아파트 전문 · 평균 응답 8분',
      headline: ['호수공원 앞 16년,', '조례·연향 아파트는 저희가 잘 압니다'],
      sub: '보유 매물 46건 · 최근 30일 거래 9건',
      cta: '매물 보러 가기',
      advertiser: '호수공원 공인중개사사무소',
      skyline: true,
    },
  }),
  banner('AD-06', BannerSlot.MAIN_HERO, 3, {
    title: '순천 공인중개사 회원 모집',
    advertiserName: null,
    linkUrl: '/agent/apply',
    creative: {
      ground: '#1539C4',
      accent: '#DCE6FF',
      kicker: '순천 개업 공인중개사 전용',
      headline: ['매물 등록은 무료,', '공동중개는 한 번의 클릭으로'],
      sub: '중개사무소 86곳이 함께 올리고 함께 중개합니다',
      cta: '중개사 회원 가입',
      skyline: true,
    },
  }),
  banner('AD-03', BannerSlot.MAIN_HERO, 4, {
    title: '늘봄 이사·청소 12월 입주 청소 예약',
    advertiserName: '[광고주 B] 늘봄 이사·청소',
    linkUrl: 'https://example.com/',
    newWindow: true,
    ...SCHEDULED, // 예약 — must not be served
    creative: {
      ground: '#2F4A3A',
      accent: '#E3F0D9',
      kicker: '순천 전 지역 · 입주 청소',
      headline: ['늘봄 이사·청소', '12월 입주 청소 예약'],
      advertiser: '[광고주 B]',
    },
  }),
  banner('AD-07', BannerSlot.MAIN_HERO, 5, {
    title: '중지된 배너',
    advertiserName: '[광고주 D]',
    linkUrl: null,
    paused: true, // 중지 — must not be served
    creative: { ground: '#333D4B', accent: '#D1D6DB', kicker: '중지', headline: ['중지된 배너'] },
  }),

  // ---- MAIN_STRIP: thin strip on the home page --------------------------------------------------
  banner('AD-08', BannerSlot.MAIN_STRIP, 1, {
    title: '순천 입주 박람회 사전 등록',
    advertiserName: '[광고주 C]',
    linkUrl: 'https://example.com/',
    newWindow: true,
    creative: {
      ground: '#23364D',
      accent: '#F3E8CC',
      kicker: '[광고주 C] · 12.12 – 12.14 순천만 컨벤션',
      headline: ['순천 입주 박람회 — 가전·가구·인테리어 견적을 한자리에서'],
      mobileHeadline: '순천 입주 박람회 12.12 – 12.14',
      advertiser: '[광고주 C]',
      cta: '사전 등록',
    },
  }),

  // ---- Slots rendered by other page groups (one live sample each) -------------------------------
  banner('AD-02', BannerSlot.MAP_AD, 1, {
    title: '호수공원 공인중개사사무소',
    advertiserName: '호수공원 공인중개사사무소',
    agencyId: mockUuid('B02'),
    linkUrl: `/agency/${mockUuid('B02')}`,
    creative: {
      ground: '#0F1B3A',
      accent: '#E9D7A8',
      kicker: '연향·조례 아파트 전문',
      headline: ['호수공원', '공인중개사사무소'],
      sub: '대표 한서윤 · 061-000-0000',
      skyline: true,
    },
  }),
  banner('AD-09', BannerSlot.COMPLEX_FEATURED_AGENCY, 1, {
    title: '신대중앙 공인중개사사무소',
    advertiserName: '신대중앙 공인중개사사무소',
    agencyId: mockUuid('B01'),
    linkUrl: `/agency/${mockUuid('B01')}`,
    creative: {
      ground: '#0A1222',
      accent: '#E9D7A8',
      kicker: '신대 레이크파크 단지 전문',
      headline: ['신대중앙 공인중개사사무소'],
    },
  }),
  banner('AD-10', BannerSlot.LISTING_SIDE, 1, {
    title: '선월 분양권 공인중개사사무소',
    advertiserName: '선월 분양권 공인중개사사무소',
    agencyId: mockUuid('B05'),
    linkUrl: `/agency/${mockUuid('B05')}`,
    noMobile: true,
    creative: {
      ground: '#3B2A5C',
      accent: '#E6DCF7',
      kicker: '분양권 전문',
      headline: ['선월 하이츠 2차', '분양권 상담'],
      sub: '프리미엄 시세 · 전매 절차 안내',
      skyline: true,
    },
  }),
  banner('AD-11', BannerSlot.AGENCY_SEARCH_TOP, 1, {
    title: '순천대정문 공인중개사사무소',
    advertiserName: '순천대정문 공인중개사사무소',
    agencyId: mockUuid('B06'),
    linkUrl: `/agency/${mockUuid('B06')}`,
    creative: {
      ground: '#123A4A',
      accent: '#D9F0F2',
      kicker: '원룸·투룸 전문 · 평균 응답 6분',
      headline: ['순천대 앞 원룸·투룸, 오늘 바로 볼 수 있는 방만 올립니다'],
      mobileHeadline: '순천대 앞 원룸·투룸 전문',
      advertiser: '순천대정문 공인중개사사무소',
      cta: '사무소 보기',
    },
  }),
];

/** Canvas used for the stand-in creative of each slot (display size; real uploads follow BANNER_SLOT_SPECS). */
export function creativeSvg(b: MockBanner, variant: 'pc' | 'mobile'): string {
  if (variant === 'mobile') {
    return b.slot === BannerSlot.MAIN_STRIP || b.slot === BannerSlot.AGENCY_SEARCH_TOP
      ? mobileStripCreative(b.creative)
      : mobileCreative(b.creative);
  }
  switch (b.slot) {
    case BannerSlot.MAIN_HERO:
    case BannerSlot.MOBILE_MAIN:
      return wideCreative(b.creative, 1240, 220);
    case BannerSlot.MAIN_STRIP:
      return wideCreative(b.creative, 1200, 120);
    case BannerSlot.AGENCY_SEARCH_TOP:
      return wideCreative(b.creative, 1200, 150);
    case BannerSlot.LISTING_SIDE:
      return boxCreative(b.creative, 300, 250);
    case BannerSlot.MAP_AD:
      return boxCreative(b.creative, 360, 200);
    case BannerSlot.COMPLEX_FEATURED_AGENCY:
      return boxCreative(b.creative, 360, 120);
    default:
      return wideCreative(b.creative);
  }
}

export function isLive(b: Pick<MockBanner, 'paused' | 'startAt' | 'endAt'>, now = new Date()) {
  return !b.paused && new Date(b.startAt) <= now && now < new Date(b.endAt);
}

/** Advertiser offices (mockdata.md §4) embedded in agency-linked banners. */
const AGENCY_INFO: Record<
  string,
  { name: string; representativeName: string; avgResponseMinutes: number }
> = {
  [mockUuid('B01')]: {
    name: '신대중앙 공인중개사사무소',
    representativeName: '김서진',
    avgResponseMinutes: 12,
  },
  [mockUuid('B02')]: {
    name: '호수공원 공인중개사사무소',
    representativeName: '한서윤',
    avgResponseMinutes: 8,
  },
  [mockUuid('B05')]: {
    name: '선월 분양권 공인중개사사무소',
    representativeName: '정민재',
    avgResponseMinutes: 10,
  },
  [mockUuid('B06')]: {
    name: '순천대정문 공인중개사사무소',
    representativeName: '최유나',
    avgResponseMinutes: 6,
  },
};

/** Public serve shape of one banner (see docs/frontend-integration/w-home.md). */
export function serveBanner(b: MockBanner) {
  const base = '/mock-api/v1/banners/creative';
  const agency = b.agencyId ? AGENCY_INFO[b.agencyId] : undefined;
  return {
    id: b.id,
    slot: b.slot,
    title: b.title,
    advertiserName: b.advertiserName,
    agencyId: b.agencyId,
    /** Advertiser office summary for agency-linked banners (map card, featured agency). */
    agency: agency
      ? {
          id: b.agencyId,
          name: agency.name,
          representativeName: agency.representativeName,
          phone: '0610000000',
          logoUrl: null,
          complexListingCount: null,
          avgResponseMinutes: agency.avgResponseMinutes,
        }
      : null,
    /** PC creative. */
    imageUrl: `${base}/${b.key}-pc.svg`,
    mobileImageUrl:
      b.noMobile || BANNER_SLOT_SPECS[b.slot].mobile === null
        ? null
        : `${base}/${b.key}-mobile.svg`,
    linkUrl: b.linkUrl,
    newWindow: b.newWindow,
    sortOrder: b.sortOrder,
    updatedAt: b.updatedAt,
  };
}
