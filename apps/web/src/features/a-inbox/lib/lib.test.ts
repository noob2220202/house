import { describe, expect, it } from 'vitest';
import type { AgencyDealRequest, InboxListing, MyProposal } from '../api/schemas';
import { agencyDealRequestSchema } from '../api/schemas';
import { inquiryPreview, inquiryTitle } from './inquiry';
import { matchListing, rankListings } from './match';
import { agentNotificationHref, isAgencyNotification } from './notifications';
import {
  DEFAULT_INQUIRY_FILTERS,
  DEFAULT_REQUEST_FILTERS,
  activeRequestFilterCount,
  inquiryFiltersToQuery,
  inquiryFiltersToSearch,
  parseInquiryFilters,
  parseRequestFilters,
  requestFiltersToQuery,
  requestFiltersToSearch,
} from './params';
import {
  PROPOSAL_TEXT_MAX,
  appendTemplate,
  composeProposalMessage,
  offerKindOf,
  offerLine,
  proposalFormSchema,
  proposalTemplates,
  splitProposalMessage,
  toProposalBody,
} from './proposal';
import {
  requestHeadlinePrice,
  requestPriceLines,
  requestSubtitle,
  requestTitle,
  splitFlags,
} from './request-text';
import { canPropose, canWithdraw, inboxStage, proposalTimeline, stagePill } from './stage';

const SINDAE = '4615033028';
const SEONWOL = '4615033029';

/** Minimal request through the response schema (so defaults match what the API client yields). */
function request(over: Record<string, unknown>): AgencyDealRequest {
  return agencyDealRequestSchema.parse({
    id: 'r1',
    type: 'WANTED',
    status: 'OPEN',
    assetType: 'APT',
    dealTypes: ['SALE'],
    visibility: 'ALL_AGENCIES_IN_REGION',
    createdAt: '2026-11-23T03:00:00Z',
    ...over,
  });
}

const proposal = (status: MyProposal['status'], over: Partial<MyProposal> = {}): MyProposal => ({
  id: 'p1',
  status,
  message: '',
  listings: [],
  createdAt: '2026-11-23T04:00:00Z',
  ...over,
});

const listing = (over: Partial<InboxListing>): InboxListing => ({
  id: 'l1',
  title: '신대 레이크파크 1단지 103동',
  assetType: 'APT',
  dealType: 'SALE',
  price: 44500,
  exclusiveArea: 84.98,
  rooms: 3,
  emdCode: SINDAE,
  complexId: 'c1',
  ...over,
});

describe('inbox stage', () => {
  it('derives the stage from the request status, our proposal and the contact grant', () => {
    expect(inboxStage(request({}))).toBe('NEW');
    // MATCHED requests still take proposals.
    expect(inboxStage(request({ status: 'MATCHED' }))).toBe('NEW');
    expect(inboxStage(request({ myProposal: proposal('SENT') }))).toBe('PROPOSED');
    expect(inboxStage(request({ myProposal: proposal('VIEWED') }))).toBe('PROPOSED');
    expect(inboxStage(request({ myProposal: proposal('ACCEPTED') }))).toBe('ACCEPTED');
    expect(inboxStage(request({ myProposal: proposal('VIEWED'), contactGranted: true }))).toBe(
      'ACCEPTED',
    );
    expect(inboxStage(request({ myProposal: proposal('DECLINED') }))).toBe('ENDED');
    expect(inboxStage(request({ myProposal: proposal('WITHDRAWN') }))).toBe('ENDED');
    for (const status of ['CLOSED', 'CANCELLED', 'EXPIRED'])
      expect(inboxStage(request({ status, myProposal: proposal('ACCEPTED') }))).toBe('ENDED');
  });

  it('allows one proposal per request and withdrawal only before the answer', () => {
    expect(canPropose(request({}))).toBe(true);
    expect(canPropose(request({ status: 'EXPIRED' }))).toBe(false);
    expect(canPropose(request({ myProposal: proposal('WITHDRAWN') }))).toBe(false);
    expect(canWithdraw(request({ myProposal: proposal('SENT') }))).toBe(true);
    expect(canWithdraw(request({ myProposal: proposal('VIEWED') }))).toBe(true);
    expect(canWithdraw(request({ myProposal: proposal('ACCEPTED') }))).toBe(false);
    expect(canWithdraw(request({ status: 'CLOSED', myProposal: proposal('SENT') }))).toBe(false);
    expect(canWithdraw(request({}))).toBe(false);
  });

  it('labels the pill with the most specific state', () => {
    expect(stagePill(request({}))).toEqual({ label: '제안 전', tone: 'review' });
    expect(stagePill(request({ myProposal: proposal('SENT') })).label).toBe('제안 보냄');
    expect(stagePill(request({ myProposal: proposal('VIEWED') })).label).toBe('요청자 확인');
    expect(stagePill(request({ myProposal: proposal('ACCEPTED') })).label).toBe('제안 수락');
    expect(
      stagePill(request({ myProposal: proposal('ACCEPTED'), contactGranted: true })).label,
    ).toBe('연락처 공개');
    expect(stagePill(request({ myProposal: proposal('DECLINED') }))).toEqual({
      label: '거절됨',
      tone: 'rejected',
    });
    expect(stagePill(request({ status: 'EXPIRED', myProposal: proposal('SENT') })).label).toBe(
      '기간 만료',
    );
  });

  it('builds the proposal timeline', () => {
    expect(proposalTimeline(request({}))).toEqual([]);
    const sent = proposalTimeline(request({ myProposal: proposal('SENT') }));
    expect(sent.map((s) => [s.key, s.state])).toEqual([
      ['sent', 'done'],
      ['viewed', 'pending'],
      ['answered', 'pending'],
      ['contact', 'pending'],
    ]);
    const accepted = proposalTimeline(
      request({
        myProposal: proposal('ACCEPTED', { respondedAt: '2026-11-23T06:00:00Z' }),
        contactGranted: true,
      }),
      '2026-11-23T07:00:00Z',
    );
    expect(accepted.every((s) => s.state === 'done')).toBe(true);
    expect(accepted[3]?.at).toBe('2026-11-23T07:00:00Z');
    const declined = proposalTimeline(request({ myProposal: proposal('DECLINED') }));
    expect(declined.map((s) => s.key)).toEqual(['sent', 'viewed', 'answered']);
    expect(declined[2]).toMatchObject({ label: '제안 거절', state: 'off' });
    // Withdrawn before the requester ever opened it.
    expect(proposalTimeline(request({ myProposal: proposal('WITHDRAWN') }))[1]?.state).toBe('off');
  });
});

describe('URL filters', () => {
  it('parses request filters defensively', () => {
    expect(parseRequestFilters(new URLSearchParams(''))).toEqual(DEFAULT_REQUEST_FILTERS);
    expect(
      parseRequestFilters(
        new URLSearchParams(
          `stage=new&type=sell&region=${SINDAE},${SINDAE},abc&asset=APT,NOPE,LAND&sort=expiring&page=3`,
        ),
      ),
    ).toEqual({
      stage: 'new',
      type: 'sell',
      regions: [SINDAE],
      assets: ['APT', 'LAND'],
      sort: 'expiring',
      page: 3,
    });
    expect(parseRequestFilters({ stage: 'bogus', page: '-4', type: ['find', 'sell'] })).toEqual({
      ...DEFAULT_REQUEST_FILTERS,
      type: 'find',
    });
  });

  it('round-trips request filters and keeps the default URL clean', () => {
    expect(requestFiltersToSearch(DEFAULT_REQUEST_FILTERS)).toBe('');
    const filters = {
      stage: 'proposed',
      type: 'find',
      regions: [SINDAE, SEONWOL],
      assets: ['OFFICETEL'],
      sort: 'expiring',
      page: 2,
    } as const;
    const search = requestFiltersToSearch({
      ...filters,
      regions: [...filters.regions],
      assets: [...filters.assets],
    });
    expect(parseRequestFilters(new URLSearchParams(search.slice(1)))).toEqual(filters);
  });

  it('maps request filters to the API query', () => {
    expect(requestFiltersToQuery(DEFAULT_REQUEST_FILTERS)).toEqual({
      type: undefined,
      stage: undefined,
      regionCodes: undefined,
      assetTypes: undefined,
      sort: undefined,
      page: 1,
      pageSize: 10,
    });
    expect(
      requestFiltersToQuery({
        stage: 'accepted',
        type: 'sell',
        regions: [SINDAE],
        assets: ['APT'],
        sort: 'expiring',
        page: 2,
      }),
    ).toMatchObject({
      type: 'SELL_OR_LEASE',
      stage: 'ACCEPTED',
      regionCodes: [SINDAE],
      assetTypes: ['APT'],
      sort: 'EXPIRING',
      page: 2,
    });
    expect(activeRequestFilterCount(DEFAULT_REQUEST_FILTERS)).toBe(0);
    expect(
      activeRequestFilterCount({
        ...DEFAULT_REQUEST_FILTERS,
        stage: 'new',
        type: 'sell',
        regions: [SINDAE],
      }),
    ).toBe(2);
  });

  it('parses, serializes and maps inquiry filters', () => {
    expect(parseInquiryFilters(new URLSearchParams(''))).toEqual(DEFAULT_INQUIRY_FILTERS);
    const filters = parseInquiryFilters(
      new URLSearchParams('status=progress&channel=call&unread=1&q=%20레이크%20&page=2&id=inq-01'),
    );
    expect(filters).toEqual({
      status: 'progress',
      channel: 'call',
      unread: true,
      q: '레이크',
      page: 2,
      id: 'inq-01',
    });
    expect(
      parseInquiryFilters(new URLSearchParams(inquiryFiltersToSearch(filters).slice(1))),
    ).toEqual(filters);
    expect(inquiryFiltersToSearch(DEFAULT_INQUIRY_FILTERS)).toBe('');
    expect(inquiryFiltersToQuery(filters)).toEqual({
      status: 'IN_PROGRESS',
      channel: 'CALL',
      unreadOnly: true,
      q: '레이크',
      page: 2,
      pageSize: 12,
    });
    expect(parseInquiryFilters({ channel: 'fax', unread: 'yes' })).toEqual(DEFAULT_INQUIRY_FILTERS);
  });
});

describe('proposal form', () => {
  const sell = request({ type: 'SELL_OR_LEASE', dealTypes: ['SALE'] });

  it('knows which price a 내놓기 request asks for', () => {
    expect(offerKindOf(sell)).toBe('sale');
    expect(offerKindOf(request({ type: 'SELL_OR_LEASE', dealTypes: ['PRESALE'] }))).toBe('sale');
    expect(offerKindOf(request({ type: 'SELL_OR_LEASE', dealTypes: ['JEONSE'] }))).toBe('jeonse');
    expect(offerKindOf(request({ type: 'SELL_OR_LEASE', dealTypes: ['MONTHLY'] }))).toBe('monthly');
    expect(offerKindOf(request({ type: 'WANTED' }))).toBeNull();
  });

  it('formats the suggested price line', () => {
    expect(offerLine('sale', { offerPrice: '4억 4,000', offerRent: '' })).toBe(
      '예상 매매가 4억 4,000',
    );
    expect(offerLine('jeonse', { offerPrice: '28500', offerRent: '' })).toBe(
      '예상 전세가 2억 8,500',
    );
    expect(offerLine('monthly', { offerPrice: '3000', offerRent: '85' })).toBe(
      '예상 보증금/월세 3,000/85',
    );
    expect(offerLine('monthly', { offerPrice: '3000', offerRent: '' })).toBe('예상 보증금 3,000');
    expect(offerLine('sale', { offerPrice: '', offerRent: '' })).toBeNull();
    expect(offerLine(null, { offerPrice: '44000', offerRent: '' })).toBeNull();
  });

  it('carries the price as a leading line of the message and splits it back', () => {
    const message = composeProposalMessage(
      '  안녕하세요.\n잘 부탁드립니다. ',
      '예상 매매가 4억 4,000',
    );
    expect(message).toBe('· 예상 매매가 4억 4,000\n\n안녕하세요.\n잘 부탁드립니다.');
    expect(splitProposalMessage(message)).toEqual({
      offers: ['예상 매매가 4억 4,000'],
      text: '안녕하세요.\n잘 부탁드립니다.',
    });
    expect(composeProposalMessage('본문', null)).toBe('본문');
    expect(splitProposalMessage('본문만 있는 제안')).toEqual({
      offers: [],
      text: '본문만 있는 제안',
    });
    expect(splitProposalMessage(null)).toEqual({ offers: [], text: '' });
    // An agent's own "· " bullets are part of the message, not price offers.
    const bullets = '· 3단지 39평 최근 2건 계약\n· 무료 촬영\n\n연락 주세요.';
    expect(splitProposalMessage(bullets)).toEqual({ offers: [], text: bullets });
    expect(
      splitProposalMessage('· 예상 보증금/월세 3,000/90\n· 반려동물 협의 가능\n\n본문'),
    ).toEqual({ offers: ['예상 보증금/월세 3,000/90'], text: '· 반려동물 협의 가능\n\n본문' });
  });

  it('builds the API body (proposalCreateSchema)', () => {
    expect(
      toProposalBody(
        {
          message: '같은 단지 거래 경험이 많습니다.',
          offerPrice: '44000',
          offerRent: '',
          listingIds: ['a', 'b'],
        },
        'sale',
      ),
    ).toEqual({
      message: '· 예상 매매가 4억 4,000\n\n같은 단지 거래 경험이 많습니다.',
      listingIds: ['a', 'b'],
    });
  });

  it('validates message length, prices and the listing limit', () => {
    const base = {
      message: '조건에 맞는 매물을 추천드립니다.',
      offerPrice: '',
      offerRent: '',
      listingIds: [],
    };
    expect(proposalFormSchema.safeParse(base).success).toBe(true);
    expect(proposalFormSchema.safeParse({ ...base, message: '짧아요' }).success).toBe(false);
    expect(
      proposalFormSchema.safeParse({ ...base, message: '가'.repeat(PROPOSAL_TEXT_MAX + 1) })
        .success,
    ).toBe(false);
    expect(proposalFormSchema.safeParse({ ...base, offerPrice: '4억 4,000' }).success).toBe(true);
    expect(proposalFormSchema.safeParse({ ...base, offerPrice: '사억' }).success).toBe(false);
    // 월세 without a deposit is incomplete.
    const rentOnly = proposalFormSchema.safeParse({ ...base, offerRent: '90' });
    expect(rentOnly.success).toBe(false);
    expect(rentOnly.error?.issues[0]?.path).toEqual(['offerPrice']);
    expect(
      proposalFormSchema.safeParse({
        ...base,
        listingIds: Array.from({ length: 11 }, (_, i) => `l${i}`),
      }).success,
    ).toBe(false);
  });

  it('offers starter sentences and appends them once', () => {
    const templates = proposalTemplates(sell, {
      agencyName: '신대중앙 공인중개사사무소',
      memberName: '김서진',
    });
    expect(templates[0]?.text).toBe('안녕하세요, 신대중앙 공인중개사사무소 김서진입니다.');
    expect(proposalTemplates(request({}), {})[0]?.text).toBe('안녕하세요.');
    expect(appendTemplate('', '인사')).toBe('인사');
    expect(appendTemplate('인사\n', '경험')).toBe('인사\n경험');
    expect(appendTemplate('인사\n경험', '경험')).toBe('인사\n경험');
  });
});

describe('listing ↔ request match', () => {
  const wanted = request({
    regionCodes: [SINDAE],
    priceMax: 45000,
    areaMin: 82.64,
    areaMax: 115.7,
    roomsMin: 3,
  });

  it('marks a listing that meets every stated condition', () => {
    const m = matchListing(wanted, listing({}));
    expect(m.full).toBe(true);
    expect(m.misses).toEqual([]);
    expect(m.reasons).toEqual(['매물 종류', '거래 유형', '지역', '예산', '면적', '방 수']);
  });

  it('names the conditions a listing misses', () => {
    expect(matchListing(wanted, listing({ price: 46000 })).misses).toEqual(['예산']);
    expect(matchListing(wanted, listing({ exclusiveArea: 59.92 })).misses).toEqual(['면적']);
    expect(matchListing(wanted, listing({ emdCode: SEONWOL, dealType: 'JEONSE' })).misses).toEqual([
      '거래 유형',
      '지역',
    ]);
    // A wanted complex counts even outside the wanted regions.
    const byComplex = request({ regionCodes: [SEONWOL], complexIds: ['c1'] });
    expect(matchListing(byComplex, listing({})).reasons).toContain('희망 단지');
  });

  it('checks 월세 and 전세 budgets against the right fields', () => {
    const monthly = request({
      assetType: 'OFFICETEL',
      dealTypes: ['MONTHLY'],
      depositMax: 1000,
      rentMax: 60,
    });
    const room = (over: Partial<InboxListing>) =>
      listing({
        assetType: 'OFFICETEL',
        dealType: 'MONTHLY',
        price: null,
        deposit: 500,
        monthlyRent: 55,
        ...over,
      });
    expect(matchListing(monthly, room({})).full).toBe(true);
    expect(matchListing(monthly, room({ monthlyRent: 70 })).misses).toEqual(['예산']);
    const jeonse = request({ dealTypes: ['JEONSE'], depositMax: 30000 });
    expect(matchListing(jeonse, listing({ dealType: 'JEONSE', price: 28000 })).full).toBe(true);
    expect(matchListing(jeonse, listing({ dealType: 'JEONSE', price: 31000 })).misses).toEqual([
      '예산',
    ]);
  });

  it('treats listings near a 내놓기 request as comparables', () => {
    const sell = request({ type: 'SELL_OR_LEASE', emdCode: SINDAE, complexId: 'c1' });
    expect(matchListing(sell, listing({})).reasons).toContain('같은 단지');
    expect(matchListing(sell, listing({ complexId: 'c2' })).reasons).toContain('같은 지역');
    expect(matchListing(sell, listing({ complexId: 'c2', emdCode: SEONWOL })).misses).toEqual([
      '같은 지역',
    ]);
  });

  it('ranks full matches first and keeps the server order for ties', () => {
    const ranked = rankListings(wanted, [
      listing({ id: 'far', emdCode: SEONWOL, price: 60000 }),
      listing({ id: 'pricey', price: 46000 }),
      listing({ id: 'fit-1' }),
      listing({ id: 'fit-2' }),
    ]);
    expect(ranked.map((r) => r.listing.id)).toEqual(['fit-1', 'fit-2', 'pricey', 'far']);
  });
});

describe('request text', () => {
  const sell = request({
    type: 'SELL_OR_LEASE',
    complexName: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    exclusiveArea: 84.98,
    floor: 18,
    desiredSalePrice: 45000,
    moveInDate: '2027-02-20',
  });

  it('titles a request without private address parts', () => {
    expect(requestTitle(sell)).toBe('신대 레이크파크 1단지 · 매매');
    expect(requestSubtitle(sell)).toBe(
      '아파트 · 해룡면 신대리 · 전용 84.98㎡ (25.7평) · 18층 · 2027년 2월 20일 입주 가능',
    );
    expect(
      requestTitle(request({ regionCodes: [SINDAE, SEONWOL], dealTypes: ['SALE', 'JEONSE'] })),
    ).toBe('신대지구 · 선월지구 아파트 · 매매·전세');
    expect(
      requestTitle(
        request({
          type: 'SELL_OR_LEASE',
          assetType: 'COMMERCIAL',
          emdName: '해룡면 신대리',
          dealTypes: ['MONTHLY'],
        }),
      ),
    ).toBe('해룡면 신대리 상업·업무 · 월세');
  });

  it('lists the prices the requester gave', () => {
    expect(requestPriceLines(sell)).toEqual([{ label: '희망 매매가', value: '4억 5,000' }]);
    expect(
      requestPriceLines(
        request({
          type: 'SELL_OR_LEASE',
          dealTypes: ['MONTHLY'],
          desiredDeposit: 3000,
          desiredMonthlyRent: 90,
        }),
      ),
    ).toEqual([{ label: '희망 보증금/월세', value: '3,000/90' }]);
    expect(requestPriceLines(request({ priceMin: 30000, priceMax: 45000 }))).toEqual([
      { label: '매매 예산', value: '3억 ~ 4억 5,000' },
    ]);
    expect(requestPriceLines(request({}))).toEqual([]);
  });

  it('collapses the row price to one line', () => {
    expect(requestHeadlinePrice(request({ depositMax: 1000, rentMax: 60 }))).toEqual({
      label: '보증금/월세',
      value: '1,000/60 이하',
    });
    expect(requestHeadlinePrice(request({ priceMax: 45000, depositMax: 30000 }))).toEqual({
      label: '매매 예산 외 1',
      value: '4억 5,000 이하',
    });
    expect(requestHeadlinePrice(request({}))).toBeNull();
  });

  it('splits the flag lines from the free text', () => {
    expect(splitFlags('· 가격 협의 가능\n· 즉시 입주 가능\n\n남향 고층입니다.')).toEqual({
      flags: ['가격 협의 가능', '즉시 입주 가능'],
      text: '남향 고층입니다.',
    });
    expect(splitFlags('그냥 설명')).toEqual({ flags: [], text: '그냥 설명' });
    expect(splitFlags(undefined)).toEqual({ flags: [], text: '' });
  });
});

describe('console notifications', () => {
  it('sends agency events to console pages', () => {
    const data = { agencyId: 'a1', dealRequestId: 'req-01' };
    expect(isAgencyNotification({ data })).toBe(true);
    expect(agentNotificationHref({ type: 'DEAL_REQUEST_RECEIVED', data })).toBe(
      '/agent/requests/req-01',
    );
    expect(agentNotificationHref({ type: 'PROPOSAL_ACCEPTED', data })).toBe(
      '/agent/requests/req-01',
    );
    expect(agentNotificationHref({ type: 'CONTACT_GRANTED', data: { agencyId: 'a1' } })).toBe(
      '/agent/requests',
    );
    expect(
      agentNotificationHref({ type: 'SYSTEM', data: { agencyId: 'a1', inquiryId: 'inq 1' } }),
    ).toBe('/agent/inquiries?id=inq%201');
  });

  it('keeps personal notifications on the my-page links and ignores unsafe urls', () => {
    expect(
      agentNotificationHref({ type: 'PROPOSAL_RECEIVED', data: { dealRequestId: 'dr1' } }),
    ).toBe('/me/requests/dr1');
    expect(
      agentNotificationHref({ type: 'SYSTEM', data: { agencyId: 'a1', url: '/agent/listings' } }),
    ).toBe('/agent/listings');
    expect(
      agentNotificationHref({ type: 'SYSTEM', data: { url: 'https://evil.example' } }),
    ).toBeNull();
    expect(agentNotificationHref({ type: 'AGENCY_APPROVED', data: { agencyId: 'a1' } })).toBe(
      '/agent',
    );
  });
});

describe('inquiry text', () => {
  it('describes messages and contact actions', () => {
    expect(inquiryTitle({ customerName: '박*연', channel: 'MESSAGE' })).toBe('박*연 님의 문의');
    expect(inquiryTitle({ customerName: null, channel: 'CALL' })).toBe('비회원 고객 · 전화');
    expect(
      inquiryPreview({ channel: 'MESSAGE', message: '집 볼 수 있을까요?', listing: null }),
    ).toBe('집 볼 수 있을까요?');
    expect(inquiryPreview({ channel: 'CALL', message: null, listing: listing({}) })).toBe(
      '매물 상세에서 전화 걸기를 눌렀어요',
    );
    expect(inquiryPreview({ channel: 'COPY', message: null, listing: null })).toBe(
      '사무소 페이지에서 사무소 전화번호를 복사했어요',
    );
  });
});
