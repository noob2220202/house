import { parseTradeApiResponse } from './trade-api.parser';
import { TradeApiError } from './trade-api.client';

const wrap = (items: string, total: number, code = '000') => `<?xml version="1.0"?>
<response><header><resultCode>${code}</resultCode><resultMsg>OK</resultMsg></header>
<body><items>${items}</items><numOfRows>10</numOfRows><pageNo>1</pageNo><totalCount>${total}</totalCount></body></response>`;

describe('parseTradeApiResponse', () => {
  it('parses XML items as trimmed strings (no numeric coercion)', () => {
    const page = parseTradeApiResponse(
      wrap(
        '<item><aptNm> 연향부영 </aptNm><dealAmount>  18,500</dealAmount><umdCd>01400</umdCd></item>' +
          '<item><aptNm>조례현대</aptNm><dealAmount>25,000</dealAmount></item>',
        2,
      ),
    );
    expect(page.totalCount).toBe(2);
    expect(page.items).toEqual([
      { aptNm: '연향부영', dealAmount: '18,500', umdCd: '01400' },
      { aptNm: '조례현대', dealAmount: '25,000' },
    ]);
  });

  it('handles a single <item> and empty <items>', () => {
    expect(parseTradeApiResponse(wrap('<item><aptNm>A</aptNm></item>', 1)).items).toHaveLength(1);
    expect(parseTradeApiResponse(wrap('', 0))).toMatchObject({ items: [], totalCount: 0 });
  });

  it('treats NODATA as an empty page', () => {
    expect(parseTradeApiResponse(wrap('', 0, '03')).items).toEqual([]);
  });

  it('parses JSON responses', () => {
    const page = parseTradeApiResponse(
      JSON.stringify({
        response: {
          header: { resultCode: '000', resultMsg: 'OK' },
          body: { items: { item: [{ aptNm: 'A', floor: 3 }] }, totalCount: 1 },
        },
      }),
    );
    expect(page.items).toEqual([{ aptNm: 'A', floor: '3' }]);
  });

  it('maps API and gateway errors to TradeApiError with retryability', () => {
    const quota = () => parseTradeApiResponse(wrap('', 0, '22'));
    expect(quota).toThrow(TradeApiError);
    try {
      quota();
    } catch (e) {
      expect((e as TradeApiError).retryable).toBe(true);
    }
    const gateway = `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>
      <returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode>
      </cmmMsgHeader></OpenAPI_ServiceResponse>`;
    try {
      parseTradeApiResponse(gateway);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(TradeApiError);
      expect((e as TradeApiError).message).toContain('SERVICE_KEY_IS_NOT_REGISTERED_ERROR');
      expect((e as TradeApiError).retryable).toBe(false);
    }
  });

  it('rejects empty, garbage and DTD payloads', () => {
    expect(() => parseTradeApiResponse('')).toThrow(TradeApiError);
    expect(() => parseTradeApiResponse('<html>bad gateway</html>')).toThrow(TradeApiError);
    expect(() =>
      parseTradeApiResponse('<!DOCTYPE r [<!ENTITY x "y">]><response></response>'),
    ).toThrow('unexpected DTD');
  });
});
