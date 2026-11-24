import { describe, expect, it } from 'vitest';
import { insertIntoPage, removeFromPage } from '../api';
import { ME_NAV, activeMeNavKey } from '../routes';
import {
  listingSummarySchema,
  type FavoriteComplex,
  type ListingSummary,
  type Profile,
} from '../schemas';
import {
  complexHeadlinePrice,
  complexListingTotal,
  complexMeta,
  listingHeadlineAmount,
  listingMeta,
  listingOneLiner,
  listingPriceText,
  toListingCardModel,
} from './listing-card';
import {
  isAgencyNotification,
  notificationHref,
  notificationMeta,
  unreadBadge,
} from './notifications';
import { parsePageParam } from './params';
import {
  marketingConsentCaption,
  profileFormDefaults,
  profileFormSchema,
  toProfilePatch,
} from './profile';
import { groupRecentViews, kstDaysAgo, recentBucketOf } from './recent';

const listing = (over: Partial<ListingSummary>): ListingSummary =>
  listingSummarySchema.parse({
    id: 'l1',
    assetType: 'APT',
    dealType: 'SALE',
    status: 'ACTIVE',
    complexName: '신대 레이크파크 1단지',
    dong: '103동',
    complexId: 'c1',
    agencyCount: 3,
    ...over,
  });

describe('off-market listings', () => {
  it('never shows the 실매물 확인 date next to 거래완료 / 광고 종료', () => {
    const verifiedAt = '2026-11-20T10:00:00+09:00';
    const live = toListingCardModel(listing({ salePrice: 1, verifiedAt }));
    expect(live.verifiedDate).toBe('26.11.20');
    expect(live.inactiveLabel).toBeNull();
    expect(live.inactiveNote).toBeNull();
    const closed = toListingCardModel(listing({ salePrice: 1, verifiedAt, status: 'CLOSED' }));
    expect(closed.inactiveLabel).toBe('거래완료');
    expect(closed.verifiedDate).toBeUndefined();
    expect(closed.inactiveNote).toBe('거래가 끝난 매물이에요');
    const hidden = toListingCardModel(listing({ salePrice: 1, verifiedAt, status: 'HIDDEN' }));
    expect(hidden.inactiveLabel).toBe('광고 종료');
    expect(hidden.verifiedDate).toBeUndefined();
    expect(hidden.inactiveNote).toBe('광고가 끝난 매물이에요');
    // 계약중 is still on the market: the badge stays.
    expect(toListingCardModel(listing({ verifiedAt, status: 'RESERVED' })).verifiedDate).toBe(
      '26.11.20',
    );
  });
});

describe('listing card mapping', () => {
  it('formats the headline price per deal type', () => {
    expect(listingPriceText(listing({ salePrice: 44500 }))).toBe('4억 4,500');
    expect(listingPriceText(listing({ dealType: 'JEONSE', deposit: 24000 }))).toBe('2억 4,000');
    expect(listingPriceText(listing({ dealType: 'MONTHLY', deposit: 500, monthlyRent: 42 }))).toBe(
      '500/42',
    );
    expect(listingPriceText(listing({ dealType: 'SALE' }))).toBe('가격 협의');
  });

  it('adds the premium to the 분양권 price (same as the backend priceSort)', () => {
    const presale = listing({ dealType: 'PRESALE', presalePrice: 39200, premium: 2700 });
    expect(listingHeadlineAmount(presale)).toBe(41900);
    expect(listingPriceText(presale)).toBe('4억 1,900');
    const minus = listing({ dealType: 'PRESALE', presalePrice: 35000, premium: -1200 });
    expect(listingPriceText(minus)).toBe('3억 3,800');
    expect(toListingCardModel(minus).premium).toBe(-1200);
    expect(toListingCardModel(listing({ salePrice: 1, premium: 100 })).premium).toBeUndefined();
  });

  it('builds 평 · 층 · 향 for complex listings and 위치 · 층 · 준공년 for the rest', () => {
    expect(
      listingMeta(
        listing({ supplyArea: 112.4, floorClass: 'HIGH', totalFloors: 25, direction: 'SOUTH' }),
      ),
    ).toEqual(['34평', '고/25층', '남향']);
    expect(
      listingMeta(
        listing({
          assetType: 'ONEROOM',
          complexId: null,
          locationNote: '순천대 정문 도보 6분',
          emdName: '석현동',
          floor: 3,
          totalFloors: 4,
          builtYear: 2019,
        }),
      ),
    ).toEqual(['순천대 정문 도보 6분', '3/4층', '2019년']);
    // falls back to the 법정동 and skips unknown facts
    expect(
      listingMeta(listing({ assetType: 'HOUSE', complexId: null, emdName: '왕지동' })),
    ).toEqual(['왕지동']);
  });

  it('maps the API summary to card props', () => {
    const m = toListingCardModel(
      listing({ salePrice: 44500, verifiedAt: '2026-11-22T10:00:00+09:00', coverPhotoUrl: null }),
    );
    expect(m).toMatchObject({
      href: '/listing/l1',
      deal: 'sale',
      dealLabel: '매매',
      price: '4억 4,500',
      title: '신대 레이크파크 1단지',
      subtitle: '103동',
      verifiedDate: '26.11.22',
      brokerCount: 3,
      placeholder: 'tower',
      photoUrl: null,
      inactiveLabel: null,
      reserved: false,
    });
    expect(m.photoAlt).toBe('신대 레이크파크 1단지 103동 대표 사진');
  });

  it('labels listings that left the market', () => {
    expect(toListingCardModel(listing({ status: 'CLOSED' })).inactiveLabel).toBe('거래완료');
    expect(toListingCardModel(listing({ status: 'HIDDEN' })).inactiveLabel).toBe('광고 종료');
    expect(toListingCardModel(listing({ status: 'RESERVED' }))).toMatchObject({
      inactiveLabel: null,
      reserved: true,
    });
  });

  it('writes a one-line summary', () => {
    expect(
      listingOneLiner(
        listing({ salePrice: 44500, supplyArea: 112.4, floorClass: 'HIGH', totalFloors: 25 }),
      ),
    ).toBe('매매 4억 4,500 · 34평 · 고/25층');
  });
});

const complex = (over: Partial<FavoriteComplex>): FavoriteComplex => ({
  id: 'c1',
  name: '신대 레이크파크 1단지',
  pyeongLabels: ['25', '34', '41'],
  counts: { presale: 0, sale: 38, jeonse: 12, monthly: 6 },
  favoritedAt: '2026-11-20T10:00:00+09:00',
  ...over,
});

describe('complex card mapping', () => {
  it('builds the meta line', () => {
    expect(complexMeta(complex({ households: 1412, builtYear: 2019 }))).toBe(
      '1,412세대 · 2019년 · 25·34·41평',
    );
    expect(
      complexMeta(
        complex({ households: 1120, builtYear: null, moveInYm: '2027.03', pyeongLabels: [] }),
      ),
    ).toBe('1,120세대 · 2027.03 입주');
  });
  it('picks the headline price: 매매 → 분양권 → 전세', () => {
    expect(complexHeadlinePrice(complex({ salePrice: { min: 39000, max: 48500 } }))).toEqual({
      deal: 'sale',
      label: '매매',
      text: '3억 9,000 ~ 4억 8,500',
    });
    expect(complexHeadlinePrice(complex({ presalePrice: { min: 33800, max: 43500 } }))?.deal).toBe(
      'presale',
    );
    expect(complexHeadlinePrice(complex({ jeonsePrice: { min: 1, max: 2 } }))?.deal).toBe('jeonse');
    expect(complexHeadlinePrice(complex({}))).toBeNull();
  });
  it('sums the listing counts', () => {
    expect(complexListingTotal(complex({}))).toBe(56);
  });
});

describe('recent views grouping (Asia/Seoul days)', () => {
  // 2026-11-23 00:30 KST
  const now = new Date('2026-11-22T15:30:00Z');
  it('counts calendar days in KST, not 24h windows', () => {
    expect(kstDaysAgo('2026-11-22T15:05:00Z', now)).toBe(0); // 00:05 KST today
    expect(kstDaysAgo('2026-11-22T14:50:00Z', now)).toBe(1); // 23:50 KST yesterday
    expect(kstDaysAgo('2026-11-30T00:00:00Z', now)).toBe(0); // future → clamped
  });
  it('buckets by day', () => {
    expect(recentBucketOf('2026-11-22T15:05:00Z', now)).toBe('today');
    expect(recentBucketOf('2026-11-22T10:00:00Z', now)).toBe('yesterday');
    expect(recentBucketOf('2026-11-17T10:00:00Z', now)).toBe('week');
    expect(recentBucketOf('2026-11-10T10:00:00Z', now)).toBe('earlier');
  });
  it('keeps order inside buckets and drops empty ones', () => {
    const groups = groupRecentViews(
      [
        { id: 'a', viewedAt: '2026-11-22T15:10:00Z' },
        { id: 'b', viewedAt: '2026-11-22T15:01:00Z' },
        { id: 'c', viewedAt: '2026-11-01T00:00:00Z' },
      ],
      now,
    );
    expect(groups.map((g) => [g.key, g.label, g.items.map((i) => i.id)])).toEqual([
      ['today', '오늘', ['a', 'b']],
      ['earlier', '지난 기록', ['c']],
    ]);
    expect(groupRecentViews([], now)).toEqual([]);
  });
});

describe('notifications', () => {
  it('deep-links by type and payload', () => {
    expect(notificationHref({ type: 'PROPOSAL_RECEIVED', data: { dealRequestId: 'abc' } })).toBe(
      '/me/requests/abc',
    );
    expect(notificationHref({ type: 'PROPOSAL_RECEIVED', data: null })).toBe('/me/requests');
    expect(notificationHref({ type: 'AGENCY_APPROVED', data: {} })).toBe('/agent');
    expect(notificationHref({ type: 'AGENCY_REJECTED', data: {} })).toBe('/agent/apply');
    expect(notificationHref({ type: 'LISTING_HIDDEN', data: { listingId: 'l9' } })).toBe(
      '/listing/l9',
    );
    expect(notificationHref({ type: 'REPORT_RESOLVED', data: { reportId: 'r1' } })).toBeNull();
    expect(notificationHref({ type: 'SYSTEM', data: { complexId: 'c5', listingId: 'l5' } })).toBe(
      '/complex/c5',
    );
    expect(notificationHref({ type: 'SYSTEM', data: undefined })).toBeNull();
    // A SYSTEM row about the user's own request ("요청이 전달됐어요").
    expect(notificationHref({ type: 'SYSTEM', data: { dealRequestId: 'w1' } })).toBe(
      '/me/requests/w1',
    );
  });
  it('sends agency events to the broker console, never to /me/requests', () => {
    // One feed per user: the same row is rendered on /me and in the console, so the audience is
    // decided by the row. These three types only ever go to agency members …
    for (const type of ['DEAL_REQUEST_RECEIVED', 'PROPOSAL_ACCEPTED', 'CONTACT_GRANTED'] as const) {
      expect(isAgencyNotification({ type, data: null })).toBe(true);
      expect(notificationHref({ type, data: { dealRequestId: 'req 1' } })).toBe(
        '/agent/requests/req%201',
      );
      expect(notificationHref({ type, data: { agencyId: 'a1', dealRequestId: 'r2' } })).toBe(
        '/agent/requests/r2',
      );
      expect(notificationHref({ type, data: null })).toBe('/agent/requests');
    }
    // … and `data.agencyId` marks an agency event of any other type.
    expect(isAgencyNotification({ type: 'PROPOSAL_RECEIVED', data: { dealRequestId: 'x' } })).toBe(
      false,
    );
    expect(
      notificationHref({ type: 'PROPOSAL_RECEIVED', data: { agencyId: 'a1', dealRequestId: 'x' } }),
    ).toBe('/agent/requests/x');
    expect(notificationHref({ type: 'SYSTEM', data: { agencyId: 'a1', inquiryId: 'inq 1' } })).toBe(
      '/agent/inquiries?id=inq%201',
    );
    expect(
      notificationHref({
        type: 'LISTING_HIDDEN',
        data: { agencyId: 'a1', url: '/agent/listings' },
      }),
    ).toBe('/agent/listings');
    expect(
      notificationHref({ type: 'SYSTEM', data: { agencyId: 'a1', url: 'https://evil.example' } }),
    ).toBeNull();
    expect(notificationHref({ type: 'AGENCY_APPROVED', data: { agencyId: 'a1' } })).toBe('/agent');
  });
  it('only follows site-relative urls from the payload', () => {
    expect(notificationHref({ type: 'SYSTEM', data: { url: '/notices' } })).toBe('/notices');
    expect(
      notificationHref({ type: 'SYSTEM', data: { url: 'https://evil.example/x' } }),
    ).toBeNull();
    expect(notificationHref({ type: 'SYSTEM', data: { url: '//evil.example' } })).toBeNull();
    expect(notificationHref({ type: 'SYSTEM', data: { url: 42 } })).toBeNull();
  });
  it('has meta for every type and a capped badge', () => {
    expect(notificationMeta('PROPOSAL_RECEIVED')).toMatchObject({
      label: '제안 도착',
      icon: 'chat',
    });
    // Agency-side types are captioned from the agency's point of view.
    expect(notificationMeta('DEAL_REQUEST_RECEIVED').label).toBe('새 요청 도착');
    expect(notificationMeta('PROPOSAL_ACCEPTED').label).toBe('제안 수락됨');
    expect(notificationMeta('CONTACT_GRANTED').label).toBe('연락처 공개됨');
    expect(notificationMeta('SYSTEM').label).toBe('알림');
    expect(notificationMeta('SYSTEM', { agencyId: 'a1', inquiryId: 'i1' }).label).toBe('매물 문의');
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(undefined)).toBeNull();
    expect(unreadBadge(7)).toBe('7');
    expect(unreadBadge(120)).toBe('99+');
  });
});

const profile: Profile = {
  id: 'u1',
  role: 'USER',
  status: 'ACTIVE',
  nickname: '순천살이',
  phone: '01012345678',
  marketingOptIn: false,
};

describe('profile form', () => {
  it('captions the marketing consent with the time of the last change (KST)', () => {
    expect(marketingConsentCaption(true, '2026-11-23T05:02:00Z')).toBe(
      '2026.11.23 14:02 수신 동의',
    );
    expect(marketingConsentCaption(false, '2026-11-23T05:02:00Z')).toBe(
      '2026.11.23 14:02 수신 거부',
    );
    expect(marketingConsentCaption(false, null)).toBe('수신 동의 안 함');
    expect(marketingConsentCaption(true)).toBe('수신 동의');
  });
  it('validates nickname and the plain phone field', () => {
    const ok = (v: unknown) => profileFormSchema.safeParse(v).success;
    expect(ok({ nickname: '순천살이', phone: '010-1234-5678', marketingOptIn: false })).toBe(true);
    expect(ok({ nickname: '순천살이', phone: '', marketingOptIn: true })).toBe(true); // phone optional
    expect(ok({ nickname: '  ', phone: '', marketingOptIn: true })).toBe(false);
    expect(ok({ nickname: 'a'.repeat(31), phone: '', marketingOptIn: true })).toBe(false);
    expect(ok({ nickname: '순천살이', phone: '061-000-0000', marketingOptIn: true })).toBe(false); // mobile only
    expect(ok({ nickname: '순천살이', phone: '010-12', marketingOptIn: true })).toBe(false);
  });
  it('prefills with a formatted phone', () => {
    expect(profileFormDefaults(profile)).toEqual({
      nickname: '순천살이',
      phone: '010-1234-5678',
      marketingOptIn: false,
    });
    expect(profileFormDefaults({ ...profile, phone: null }).phone).toBe('');
  });
  it('sends only changed fields, with the phone normalised and "" → null', () => {
    const base = profileFormDefaults(profile);
    expect(toProfilePatch(base, profile)).toEqual({});
    expect(toProfilePatch({ ...base, nickname: ' 신대댁 ' }, profile)).toEqual({
      nickname: '신대댁',
    });
    expect(toProfilePatch({ ...base, phone: '+82 10-9999-8888' }, profile)).toEqual({
      phone: '01099998888',
    });
    expect(toProfilePatch({ ...base, phone: '' }, profile)).toEqual({ phone: null });
    expect(toProfilePatch({ ...base, marketingOptIn: true }, profile)).toEqual({
      marketingOptIn: true,
    });
    expect(toProfilePatch({ ...base, phone: '' }, { ...profile, phone: null })).toEqual({});
  });
});

describe('routing helpers', () => {
  it('finds the active nav item (most specific wins)', () => {
    expect(activeMeNavKey('/me')).toBe('overview');
    expect(activeMeNavKey('/me/favorites')).toBe('favorites');
    expect(activeMeNavKey('/me/requests/abc')).toBe('requests');
    expect(activeMeNavKey('/me/account')).toBe('profile');
    expect(activeMeNavKey('/me/withdraw')).toBe('profile');
    expect(activeMeNavKey('/me/unknown')).toBeNull();
    expect(activeMeNavKey('/')).toBeNull();
    expect(new Set(ME_NAV.map((i) => i.key)).size).toBe(ME_NAV.length);
  });
  it('parses ?page= defensively', () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam(['2', '9'])).toBe(2);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-1')).toBe(1);
    expect(parsePageParam('1e3')).toBe(1);
    expect(parsePageParam('9999')).toBe(500);
  });
});

describe('removeFromPage (optimistic favourite removal)', () => {
  const page = {
    items: [{ id: 'a' }, { id: 'b' }],
    page: 1,
    pageSize: 1,
    total: 2,
    totalPages: 2,
  };
  it('drops the row and keeps the counters consistent', () => {
    expect(removeFromPage(page, 'a')).toEqual({
      items: [{ id: 'b' }],
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    });
  });
  it('returns the same object when the id is not on the page', () => {
    expect(removeFromPage(page, 'zzz')).toBe(page);
  });
});

describe('insertIntoPage (rollback of one failed removal)', () => {
  const page = { items: [{ id: 'a' }, { id: 'c' }], page: 1, pageSize: 2, total: 2, totalPages: 1 };
  it('puts the row back at its old position and restores the counters', () => {
    expect(insertIntoPage(page, { id: 'b' }, 1)).toEqual({
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(insertIntoPage(page, { id: 'z' }, 99).items.map((i) => i.id)).toEqual(['a', 'c', 'z']);
  });
  it('does not duplicate a row that is already there (a refetch brought it back first)', () => {
    expect(insertIntoPage(page, { id: 'a' }, 0)).toBe(page);
  });
});
