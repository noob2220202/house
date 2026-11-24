import { TradeSyncKind } from '@house/shared';
import { AppConfig } from '../../../config/app-config.service';
/** One row of a 국토교통부 response: tag/field name → trimmed string value. */
export type RawTradeItem = Readonly<Record<string, string>>;
export interface TradeApiPageRequest {
    kind: TradeSyncKind;
    /** LAWD_CD: 5-digit 시군구 code. */
    sggCode: string;
    /** DEAL_YMD: YYYYMM. */
    yearMonth: number;
    pageNo: number;
    numOfRows: number;
}
export interface TradeApiPage {
    items: RawTradeItem[];
    totalCount: number;
    pageNo: number;
    numOfRows: number;
}
/** data.go.kr 실거래가 API (아파트 매매 + 전월세) behind an interface; tests bind a fixture fake. */
export interface TradeApiClient {
    /** False when no service key is configured (sync is then refused). */
    readonly configured: boolean;
    fetchPage(req: TradeApiPageRequest): Promise<TradeApiPage>;
}
export declare const TRADE_API_CLIENT: unique symbol;
/** Errors from the upstream API. Messages never contain the service key. */
export declare class TradeApiError extends Error {
    readonly retryable: boolean;
    constructor(message: string, retryable: boolean);
}
export declare class DataGoKrTradeApiClient implements TradeApiClient {
    private readonly serviceKey;
    constructor(config: AppConfig);
    get configured(): boolean;
    fetchPage(req: TradeApiPageRequest): Promise<TradeApiPage>;
}
