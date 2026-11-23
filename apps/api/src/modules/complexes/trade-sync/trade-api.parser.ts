import { XMLParser } from 'fast-xml-parser';
import type { RawTradeItem, TradeApiPage } from './trade-api.client';
import { TradeApiError } from './trade-api.client';

/** resultCode values meaning success ("000" since the 2024 API renewal, "00" before). */
const OK_CODES = new Set(['00', '000']);
/** NODATA_ERROR: an empty month. */
const NO_DATA_CODES = new Set(['03', '003']);
/** Transient upstream failures worth a retry (application/http/timeout/quota). */
const RETRYABLE_CODES = new Set(['01', '04', '05', '22', '99']);

const xml = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
});

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function obj(v: Json | undefined): Record<string, Json> | undefined {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
}

function str(v: Json | undefined): string | undefined {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function toItem(v: Json): RawTradeItem | null {
  const o = obj(v);
  if (!o) return null;
  const out: Record<string, string> = {};
  for (const [k, value] of Object.entries(o)) {
    const s = str(value);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

function int(v: Json | undefined, fallback: number): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Parses a 국토교통부 실거래가 response (XML, or JSON when `_type=json`) into a page of raw rows.
 * Upstream errors (wrong key, quota, gateway errors) become TradeApiError.
 */
export function parseTradeApiResponse(body: string): TradeApiPage {
  const trimmed = body.trim();
  if (trimmed === '') throw new TradeApiError('empty response', true);
  // The API never sends a DTD; refuse one rather than expand payload-defined entities.
  if (/<!(DOCTYPE|ENTITY)/i.test(trimmed)) throw new TradeApiError('unexpected DTD', false);
  let doc: Record<string, Json> | undefined;
  try {
    doc = obj(
      (trimmed.startsWith('{') ? JSON.parse(trimmed) : xml.parse(trimmed)) as Json | undefined,
    );
  } catch {
    throw new TradeApiError('unparseable response', true);
  }
  if (!doc) throw new TradeApiError('unparseable response', true);

  // Gateway-level error envelope (invalid key, quota exceeded, …).
  const gateway = obj(obj(doc.OpenAPI_ServiceResponse)?.cmmMsgHeader);
  if (gateway) {
    const code = str(gateway.returnReasonCode) ?? '';
    const msg = str(gateway.returnAuthMsg) ?? str(gateway.errMsg) ?? 'gateway error';
    throw new TradeApiError(`gateway error ${code} ${msg}`.trim(), RETRYABLE_CODES.has(code));
  }

  const response = obj(doc.response);
  if (!response) throw new TradeApiError('unexpected response shape', true);
  const header = obj(response.header);
  const code = str(header?.resultCode) ?? '';
  if (NO_DATA_CODES.has(code)) return { items: [], totalCount: 0, pageNo: 1, numOfRows: 0 };
  if (!OK_CODES.has(code)) {
    const msg = str(header?.resultMsg) ?? 'error';
    throw new TradeApiError(`api error ${code} ${msg}`.trim(), RETRYABLE_CODES.has(code));
  }

  const resBody = obj(response.body);
  const rawItems = obj(resBody?.items)?.item;
  const list = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
  const items = list.map(toItem).filter((i): i is RawTradeItem => i !== null);
  return {
    items,
    totalCount: int(resBody?.totalCount, items.length),
    pageNo: int(resBody?.pageNo, 1),
    numOfRows: int(resBody?.numOfRows, items.length),
  };
}
