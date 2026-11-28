import { describe, expect, it } from 'vitest';
import type { AgencyInquiry } from '../api/schemas';
import {
  inquiryPreview,
  inquirySource,
  inquiryTitle,
  replyCount,
  statusChangedMessage,
} from './inquiry';
import {
  DEFAULT_INQUIRY_FILTERS,
  activeInquiryFilterCount,
  inquiryFiltersToQuery,
  inquiryFiltersToSearch,
  parseInquiryFilters,
} from './params';

const listing: NonNullable<AgencyInquiry['listing']> = {
  id: 'L01',
  title: '신대 레이크파크 1단지 103동',
  assetType: 'APT',
  dealType: 'SALE',
  salePrice: 44500,
  deposit: null,
  monthlyRent: null,
  presalePrice: null,
  coverPhotoUrl: null,
};

describe('inquiry URL filters', () => {
  it('parses, serializes and maps the 문의함 filters', () => {
    expect(parseInquiryFilters(new URLSearchParams(''))).toEqual(DEFAULT_INQUIRY_FILTERS);
    const filters = parseInquiryFilters(
      new URLSearchParams(
        'status=progress&channel=call&source=site&unread=1&q=%20레이크%20&page=2&id=inq-01',
      ),
    );
    expect(filters).toEqual({
      status: 'progress',
      channel: 'call',
      source: 'site',
      unread: true,
      q: '레이크',
      page: 2,
      id: 'inq-01',
    });
    expect(
      parseInquiryFilters(new URLSearchParams(inquiryFiltersToSearch(filters).slice(1))),
    ).toEqual(filters);
    expect(inquiryFiltersToSearch(DEFAULT_INQUIRY_FILTERS)).toBe('');
    // The API query (`agencyInquiryListQuerySchema`): enum values, `unread`, page size 12.
    expect(inquiryFiltersToQuery(filters)).toEqual({
      status: 'IN_PROGRESS',
      channel: 'CALL',
      source: 'SITE',
      unread: true,
      q: '레이크',
      page: 2,
      pageSize: 12,
    });
    expect(activeInquiryFilterCount(filters)).toBe(4);
    expect(parseInquiryFilters({ channel: 'fax', unread: 'yes', source: 'app' })).toEqual(
      DEFAULT_INQUIRY_FILTERS,
    );
  });
});

describe('inquiry text', () => {
  it('describes texts and contact actions', () => {
    expect(inquiryTitle({ customerName: '박서연', channel: 'MESSAGE' })).toBe('박서연 님의 문의');
    expect(inquiryTitle({ customerName: null, channel: 'CALL' })).toBe('비회원 고객 · 전화');
    expect(
      inquiryPreview({
        channel: 'MESSAGE',
        message: '집 볼 수 있을까요?',
        listing: null,
        source: 'MAIN',
      }),
    ).toBe('집 볼 수 있을까요?');
    expect(inquiryPreview({ channel: 'CALL', message: null, listing, source: 'MAIN' })).toBe(
      '매물 상세에서 전화 걸기를 눌렀어요',
    );
    expect(inquiryPreview({ channel: 'COPY', message: null, listing: null, source: 'MAIN' })).toBe(
      '사무소 페이지에서 사무소 전화번호를 복사했어요',
    );
    expect(inquiryPreview({ channel: 'SMS', message: null, listing: null, source: 'SITE' })).toBe(
      '홈페이지에서 문자 보내기를 눌렀어요',
    );
  });

  it('previews the latest text of a thread and counts our answers', () => {
    const messages: AgencyInquiry['messages'] = [
      { id: 'm1', author: 'AGENCY', body: '네, 가능합니다.', authorName: '김서진', createdAt: 'a' },
      {
        id: 'm2',
        author: 'CUSTOMER',
        body: '그럼 토요일에 갈게요.',
        authorName: null,
        createdAt: 'b',
      },
    ];
    expect(
      inquiryPreview({
        channel: 'MESSAGE',
        message: '처음',
        listing: null,
        source: 'MAIN',
        messages,
      }),
    ).toBe('그럼 토요일에 갈게요.');
    expect(replyCount({ messages })).toBe(1);
  });

  it('names where it came from', () => {
    expect(inquirySource({ listing, source: 'MAIN' })).toBe(
      '신대 레이크파크 1단지 103동 · 매매 4억 4,500',
    );
    expect(inquirySource({ listing: null, source: 'MAIN' })).toBe('사무소 페이지');
    expect(inquirySource({ listing: null, source: 'SITE' })).toBe('사무소 홈페이지');
  });

  it('words the status toast with the right particle (no robotic (으)로)', () => {
    expect(statusChangedMessage('IN_PROGRESS')).toBe('‘응대 중’으로 바꿨어요.');
    expect(statusChangedMessage('DONE')).toBe('‘응대 완료’로 바꿨어요.');
    expect(statusChangedMessage('NEW')).toBe('‘새 문의’로 바꿨어요.');
  });
});
