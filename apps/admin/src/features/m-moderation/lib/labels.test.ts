import { describe, expect, it } from 'vitest';
import {
  dealRequestArea,
  dealRequestPrice,
  dealRequestSpamState,
  dealRequestTitle,
  documentSummary,
  historyLabel,
  isModerationAction,
  listingName,
  listingPrice,
  listingSpec,
  maskEmail,
  maskName,
  maskPhoneOnce,
  readyToApprove,
  reportActionOf,
  reportSla,
  reportSlaLabel,
  reportTargetTitle,
  shortId,
  isScrubbedMember,
  memberLabel,
  userDisplayName,
  waitingDays,
  waitingLabel,
} from './labels';

const NOW = new Date('2026-11-24T03:00:00.000Z'); // 12:00 KST
const hoursAgo = (h: number, m = 0) =>
  new Date(NOW.getTime() - (h * 60 + m) * 60_000).toISOString();

describe('agency helpers', () => {
  it('summarises the submitted documents', () => {
    expect(documentSummary(['REGISTRATION_CERT', 'BUSINESS_REG_CERT', 'OTHER'])).toMatchObject({
      complete: true,
      label: '3종 확인',
    });
    const missing = documentSummary(['REGISTRATION_CERT', 'OTHER']);
    expect(missing.complete).toBe(false);
    expect(missing.missing).toEqual(['BUSINESS_REG_CERT']);
    expect(missing.label).toBe('사업자등록증 누락');
    expect(documentSummary([]).missing).toHaveLength(2);
  });
  it('counts waiting days on the KST calendar', () => {
    // 23:30 KST the day before → already "1일째" at noon KST.
    expect(waitingDays('2026-11-23T14:30:00.000Z', NOW)).toBe(1);
    expect(waitingDays('2026-11-23T15:30:00.000Z', NOW)).toBe(0);
    expect(waitingDays('2026-11-20T03:00:00.000Z', NOW)).toBe(4);
    expect(waitingDays('not a date', NOW)).toBe(0);
    expect(waitingDays('2026-12-01T00:00:00.000Z', NOW)).toBe(0);
  });
  it('words the wait the same in every view', () => {
    expect(waitingLabel(0)).toBe('오늘 신청');
    expect(waitingLabel(1)).toBe('1일째 대기');
    expect(waitingLabel(4)).toBe('4일째 대기');
  });
  it('allows one-click approval only with complete documents and a matched registry', () => {
    expect(readyToApprove(true, 'MATCHED')).toBe(true);
    expect(readyToApprove(false, 'MATCHED')).toBe(false);
    expect(readyToApprove(true, 'UNAVAILABLE')).toBe(false);
    expect(readyToApprove(true, 'MISMATCH')).toBe(false);
    expect(readyToApprove(true, null)).toBe(false);
    expect(readyToApprove(true, undefined)).toBe(false);
  });
});

describe('listing helpers', () => {
  const base = {
    title: '연향동 패션거리 1층 코너 상가',
    complexName: null,
    buildingName: null,
    dong: null,
    emdName: '연향동',
    assetType: 'COMMERCIAL',
  } as const;

  it('names a listing by complex + 동, then building, then title', () => {
    expect(listingName({ ...base, complexName: '신대 레이크파크 1단지', dong: '103동' })).toBe(
      '신대 레이크파크 1단지 103동',
    );
    expect(listingName({ ...base, buildingName: '석현동 해오름빌' })).toBe('석현동 해오름빌');
    expect(listingName(base)).toBe('연향동 패션거리 1층 코너 상가');
    expect(listingName({ ...base, title: null })).toBe('연향동 상업·업무');
    expect(listingName({ ...base, title: null, assetType: null })).toBe('연향동 매물');
  });
  it('formats the headline price per deal type', () => {
    expect(listingPrice({ dealType: 'SALE', salePrice: 44500 })).toBe('4억 4,500');
    expect(listingPrice({ dealType: 'JEONSE', deposit: 24000 })).toBe('2억 4,000');
    expect(listingPrice({ dealType: 'MONTHLY', deposit: 500, monthlyRent: 42 })).toBe('500/42');
    expect(listingPrice({ dealType: 'PRESALE', presalePrice: 41900, salePrice: null })).toBe(
      '4억 1,900',
    );
  });
  it('builds the spec line from what is known', () => {
    expect(
      listingSpec({
        supplyArea: 112.4,
        exclusiveArea: 84.98,
        floorClass: 'HIGH',
        floor: 20,
        totalFloors: 25,
      }),
    ).toMatch(/^34평 · 전용 84\.98㎡ · /);
    expect(listingSpec({})).toBe('');
  });
  it('shortens a UUID to a readable reference', () => {
    expect(shortId('b7000000-0000-4000-8000-00000abc0012')).toBe('#0ABC-0012');
  });
  it('labels audit actions and flags moderator actions', () => {
    expect(historyLabel('LISTING_HIDDEN')).toBe('숨김 처리');
    expect(historyLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(isModerationAction('LISTING_HIDDEN')).toBe(true);
    expect(isModerationAction('LISTING_UNHIDDEN')).toBe(false);
    expect(isModerationAction('DEAL_REQUEST_SPAM_FLAGGED')).toBe(true);
    expect(isModerationAction('LISTING_PUBLISHED')).toBe(false);
  });
});

describe('report helpers', () => {
  it('tracks the 24-hour handling target for open reports only', () => {
    expect(reportSla(hoursAgo(5), 'RECEIVED', NOW)).toEqual({
      hours: 5,
      open: true,
      overdue: false,
    });
    expect(reportSla(hoursAgo(24), 'IN_REVIEW', NOW).overdue).toBe(true);
    expect(reportSla(hoursAgo(80), 'RESOLVED', NOW)).toMatchObject({ open: false, overdue: false });
  });
  it('words the time left / overdue badge', () => {
    expect(reportSlaLabel(hoursAgo(0, 40), 'RECEIVED', NOW)).toEqual({
      overdue: false,
      text: '처리 기한 23시간 남음',
    });
    expect(reportSlaLabel(hoursAgo(23, 30), 'RECEIVED', NOW)?.text).toBe('처리 기한 30분 남음');
    expect(reportSlaLabel(hoursAgo(27), 'IN_REVIEW', NOW)).toEqual({
      overdue: true,
      text: '처리 기한 초과 · 27시간째',
    });
    expect(reportSlaLabel(hoursAgo(75), 'RECEIVED', NOW)?.text).toBe('처리 기한 초과 · 3일째');
    expect(reportSlaLabel(hoursAgo(75), 'REJECTED', NOW)).toBeNull();
  });
  it('maps the resolution checkboxes to the backend action', () => {
    expect(reportActionOf(true, true)).toBe('LISTING_HIDDEN_AGENCY_WARNED');
    expect(reportActionOf(true, false)).toBe('LISTING_HIDDEN');
    expect(reportActionOf(false, true)).toBe('AGENCY_WARNED');
    expect(reportActionOf(false, false)).toBe('NONE');
  });
  it('titles the reported target', () => {
    expect(
      reportTargetTitle({
        targetType: 'LISTING',
        listing: { title: null, complexName: '연향 센트럴', dong: '108동' },
      }),
    ).toBe('연향 센트럴 108동');
    expect(reportTargetTitle({ targetType: 'LISTING', listing: null })).toBe('삭제된 매물');
    expect(reportTargetTitle({ targetType: 'AGENCY', agency: { name: '금당리버' } })).toBe(
      '금당리버',
    );
    expect(reportTargetTitle({ targetType: 'AGENCY', agency: null })).toBe('삭제된 중개사무소');
  });
});

describe('deal request helpers', () => {
  type Summary = Parameters<typeof dealRequestTitle>[0];
  const sell: Summary = {
    type: 'SELL_OR_LEASE',
    assetType: 'APT',
    dealTypes: ['SALE'],
    complexName: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    exclusiveArea: 84.98,
    regionNames: [],
    areaMin: null,
    areaMax: null,
  };
  const wanted: Summary = {
    type: 'WANTED',
    assetType: 'ONEROOM',
    dealTypes: ['MONTHLY'],
    complexName: null,
    emdName: null,
    exclusiveArea: null,
    regionNames: ['석현동', '덕월동', '장천동', '매곡동'],
    areaMin: null,
    areaMax: null,
  };

  it('titles 내놓기 by the property and 구하기 by the wanted regions', () => {
    expect(dealRequestTitle(sell)).toBe('신대 레이크파크 1단지 · 전용 84㎡ 매매');
    expect(dealRequestTitle(wanted)).toBe('석현동·덕월동 외 2곳 · 월세');
    expect(dealRequestTitle({ ...wanted, regionNames: [], dealTypes: [] })).toBe(
      '지역 무관 · 원룸·투룸',
    );
  });
  it('describes the wanted area', () => {
    expect(dealRequestArea({ exclusiveArea: 59.9 })).toBe('전용 59㎡');
    expect(dealRequestArea({ areaMin: 59, areaMax: 85 })).toBe('전용 59~85㎡');
    expect(dealRequestArea({ areaMin: 84, areaMax: 84 })).toBe('전용 84㎡');
    expect(dealRequestArea({ areaMin: 100 })).toBe('전용 100㎡ 이상');
    expect(dealRequestArea({})).toBeNull();
  });
  it('formats the asking price / budget', () => {
    expect(
      dealRequestPrice({ type: 'SELL_OR_LEASE', dealTypes: ['SALE'], desiredSalePrice: 45000 }),
    ).toBe('희망가 4억 5,000');
    expect(
      dealRequestPrice({
        type: 'SELL_OR_LEASE',
        dealTypes: ['MONTHLY'],
        desiredDeposit: 2000,
        desiredMonthlyRent: 65,
      }),
    ).toBe('희망가 2,000/65');
    expect(dealRequestPrice({ type: 'SELL_OR_LEASE', dealTypes: ['SALE'] })).toBe('희망가 협의');
    expect(dealRequestPrice({ type: 'WANTED', dealTypes: ['SALE'], priceMax: 45000 })).toBe(
      '4억 5,000 이하',
    );
    expect(
      dealRequestPrice({ type: 'WANTED', dealTypes: ['MONTHLY'], depositMax: 500, rentMax: 40 }),
    ).toBe('보증금 500 이하 · 월 40 이하');
    expect(dealRequestPrice({ type: 'WANTED', dealTypes: ['SALE'] })).toBe('금액 협의');
  });
  it('separates flagged, suspected and clean requests', () => {
    expect(
      dealRequestSpamState({ spamFlaggedAt: hoursAgo(1), spamSignalCount: 2, status: 'OPEN' }),
    ).toBe('flagged');
    expect(dealRequestSpamState({ spamFlaggedAt: null, spamSignalCount: 2, status: 'OPEN' })).toBe(
      'suspected',
    );
    // Signals on a request that is no longer open need no attention.
    expect(
      dealRequestSpamState({ spamFlaggedAt: null, spamSignalCount: 2, status: 'CLOSED' }),
    ).toBe('clean');
    expect(dealRequestSpamState({ spamSignalCount: 0, status: 'OPEN' })).toBe('clean');
  });
});

describe('privacy helpers', () => {
  it('masks e-mail addresses', () => {
    expect(maskEmail('seoyun.han@example.com')).toBe('se********@example.com');
    expect(maskEmail('ab@example.com')).toBe('a***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskEmail('broken')).toBe('***');
    expect(maskEmail(null)).toBe('');
  });
  it('masks names', () => {
    expect(maskName('한서윤')).toBe('한*윤');
    expect(maskName('김민')).toBe('김*');
    expect(maskName('남궁민수')).toBe('남**수');
  });

  it('keeps values the API already masked as they are', () => {
    expect(maskName('한*윤')).toBe('한*윤');
    expect(maskEmail('se*****@example.com')).toBe('se*****@example.com');
    expect(maskPhoneOnce('010-****-1100')).toBe('010-****-1100');
    expect(maskPhoneOnce('01000001100')).toBe('010-****-1100');
    expect(maskPhoneOnce(null)).toBe('');
    expect(maskName('김')).toBe('김');
    expect(maskName(undefined)).toBe('');
  });
  it('picks the best display name', () => {
    expect(userDisplayName({ nickname: '신대사는곰', name: '김하준' })).toBe('신대사는곰');
    expect(userDisplayName({ nickname: null, name: '김하준' })).toBe('김하준');
    expect(userDisplayName({})).toBe('이름 없음');
  });
  it('calls a member withdrawn only by status, never by a missing nickname', () => {
    expect(memberLabel({ nickname: '신대사는곰', status: 'ACTIVE' })).toBe('신대사는곰');
    // A live Google sign-up without a nickname.
    expect(memberLabel({ nickname: null, status: 'ACTIVE' })).toBe('닉네임 없음 회원');
    expect(memberLabel({ nickname: null })).toBe('닉네임 없음 회원');
    expect(memberLabel({ nickname: '떠난회원', status: 'WITHDRAWN' })).toBe('탈퇴한 회원');
    expect(memberLabel(null)).toBe('탈퇴한 회원');
    expect(isScrubbedMember({ status: 'ACTIVE', nickname: null, name: null })).toBe(false);
    expect(isScrubbedMember({ status: 'WITHDRAWN', nickname: null, name: null })).toBe(true);
    expect(isScrubbedMember({ status: 'WITHDRAWN', nickname: '곰', name: null })).toBe(false);
  });
});
