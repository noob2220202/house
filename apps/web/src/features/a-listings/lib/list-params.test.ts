import { AssetType, DealType, ListingStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  LIST_DEFAULTS,
  LIST_PAGE_SIZE,
  activeFilterCount,
  buildListQuery,
  parseListParams,
  toApiQuery,
  type ListParams,
} from './list-params';

const parse = (query: string) => parseListParams(new URLSearchParams(query));

describe('/agent/listings URL state', () => {
  it('defaults when the query is empty', () => {
    expect(parse('')).toEqual(LIST_DEFAULTS);
    expect(buildListQuery(LIST_DEFAULTS)).toBe('');
  });

  it('parses every parameter', () => {
    expect(
      parse(
        'status=ACTIVE&q=%EB%A0%88%EC%9D%B4%ED%81%AC&deal=MONTHLY&asset=ONEROOM&due=1&co=1&sort=VERIFY_DUE&page=3',
      ),
    ).toEqual({
      status: ListingStatus.ACTIVE,
      q: '레이크',
      deal: DealType.MONTHLY,
      asset: AssetType.ONEROOM,
      due: true,
      co: true,
      sort: 'VERIFY_DUE',
      page: 3,
    });
  });

  it('ignores unknown values instead of passing them to the API', () => {
    expect(parse('status=DELETED&deal=LEASE&asset=CASTLE&sort=RANDOM&page=-2&due=yes')).toEqual(
      LIST_DEFAULTS,
    );
    expect(parse('page=1.5').page).toBe(1);
    expect(parse(`q=${'가'.repeat(100)}`).q).toHaveLength(60);
  });

  it('round-trips through the query string and omits defaults', () => {
    const params: ListParams = {
      status: ListingStatus.RESERVED,
      q: '103동',
      deal: DealType.SALE,
      asset: '',
      due: false,
      co: true,
      sort: 'PRICE_DESC',
      page: 2,
    };
    const query = buildListQuery(params);
    expect(query).toBe(
      `?status=RESERVED&q=${encodeURIComponent('103동')}&deal=SALE&co=1&sort=PRICE_DESC&page=2`,
    );
    expect(parse(query.slice(1))).toEqual(params);
  });

  it('counts narrowing filters (the status tab and sort are not filters)', () => {
    expect(activeFilterCount(LIST_DEFAULTS)).toBe(0);
    expect(
      activeFilterCount({ ...LIST_DEFAULTS, status: ListingStatus.ACTIVE, sort: 'VIEWS' }),
    ).toBe(0);
    expect(activeFilterCount({ ...LIST_DEFAULTS, q: '신대', due: true, deal: DealType.SALE })).toBe(
      3,
    );
  });
});

describe('toApiQuery', () => {
  it('sends only what is set, with the fixed page size', () => {
    expect(toApiQuery(LIST_DEFAULTS)).toEqual({
      status: undefined,
      q: undefined,
      dealTypes: undefined,
      assetTypes: undefined,
      verificationDue: undefined,
      coBrokered: undefined,
      sort: 'UPDATED',
      page: 1,
      pageSize: LIST_PAGE_SIZE,
    });
  });

  it('maps tabs and filters to the API parameter names (csv arrays)', () => {
    expect(
      toApiQuery({
        status: ListingStatus.HIDDEN,
        q: '석현동',
        deal: DealType.JEONSE,
        asset: AssetType.HOUSE,
        due: true,
        co: true,
        sort: 'LATEST',
        page: 4,
      }),
    ).toEqual({
      status: [ListingStatus.HIDDEN],
      q: '석현동',
      dealTypes: [DealType.JEONSE],
      assetTypes: [AssetType.HOUSE],
      verificationDue: true,
      coBrokered: true,
      sort: 'LATEST',
      page: 4,
      pageSize: LIST_PAGE_SIZE,
    });
  });
});
