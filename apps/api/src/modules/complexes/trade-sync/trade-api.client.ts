import { Injectable } from '@nestjs/common';
import { TradeSyncKind } from '@house/shared';
import { AppConfig } from '../../../config/app-config.service';
import { TRADE_API } from '../constants';
import { parseTradeApiResponse } from './trade-api.parser';

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

export const TRADE_API_CLIENT = Symbol('TRADE_API_CLIENT');

/** Errors from the upstream API. Messages never contain the service key. */
export class TradeApiError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'TradeApiError';
  }
}

@Injectable()
export class DataGoKrTradeApiClient implements TradeApiClient {
  private readonly serviceKey: string | undefined;

  constructor(config: AppConfig) {
    this.serviceKey = config.get('DATA_GO_KR_SERVICE_KEY');
  }

  get configured(): boolean {
    return this.serviceKey !== undefined;
  }

  async fetchPage(req: TradeApiPageRequest): Promise<TradeApiPage> {
    if (!this.serviceKey) throw new TradeApiError('DATA_GO_KR_SERVICE_KEY is not set', false);
    const url = new URL(TRADE_API.ENDPOINTS[req.kind]);
    // The decoded key is percent-encoded here exactly once.
    url.searchParams.set('serviceKey', this.serviceKey);
    url.searchParams.set('LAWD_CD', req.sggCode);
    url.searchParams.set('DEAL_YMD', String(req.yearMonth));
    url.searchParams.set('pageNo', String(req.pageNo));
    url.searchParams.set('numOfRows', String(req.numOfRows));

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { accept: 'application/xml, application/json;q=0.9' },
        signal: AbortSignal.timeout(TRADE_API.TIMEOUT_MS),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network';
      throw new TradeApiError(`${req.kind} request failed (${reason})`, true);
    }
    const body = await res.text();
    if (!res.ok) {
      throw new TradeApiError(
        `${req.kind} HTTP ${res.status}`,
        res.status >= 500 || res.status === 429,
      );
    }
    return parseTradeApiResponse(body);
  }
}
