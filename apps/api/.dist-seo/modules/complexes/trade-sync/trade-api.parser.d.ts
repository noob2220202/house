import type { TradeApiPage } from './trade-api.client';
/**
 * Parses a 국토교통부 실거래가 response (XML, or JSON when `_type=json`) into a page of raw rows.
 * Upstream errors (wrong key, quota, gateway errors) become TradeApiError.
 */
export declare function parseTradeApiResponse(body: string): TradeApiPage;
