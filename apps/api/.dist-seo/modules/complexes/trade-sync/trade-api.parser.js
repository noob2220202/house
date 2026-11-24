"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTradeApiResponse = parseTradeApiResponse;
const fast_xml_parser_1 = require("fast-xml-parser");
const trade_api_client_1 = require("./trade-api.client");
/** resultCode values meaning success ("000" since the 2024 API renewal, "00" before). */
const OK_CODES = new Set(['00', '000']);
/** NODATA_ERROR: an empty month. */
const NO_DATA_CODES = new Set(['03', '003']);
/** Transient upstream failures worth a retry (application/http/timeout/quota). */
const RETRYABLE_CODES = new Set(['01', '04', '05', '22', '99']);
const xml = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
    processEntities: true,
    htmlEntities: false,
});
function obj(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : undefined;
}
function str(v) {
    if (typeof v === 'string')
        return v.trim();
    if (typeof v === 'number' || typeof v === 'boolean')
        return String(v);
    return undefined;
}
function toItem(v) {
    const o = obj(v);
    if (!o)
        return null;
    const out = {};
    for (const [k, value] of Object.entries(o)) {
        const s = str(value);
        if (s !== undefined)
            out[k] = s;
    }
    return out;
}
function int(v, fallback) {
    const n = Number(str(v));
    return Number.isFinite(n) ? n : fallback;
}
/**
 * Parses a 국토교통부 실거래가 response (XML, or JSON when `_type=json`) into a page of raw rows.
 * Upstream errors (wrong key, quota, gateway errors) become TradeApiError.
 */
function parseTradeApiResponse(body) {
    const trimmed = body.trim();
    if (trimmed === '')
        throw new trade_api_client_1.TradeApiError('empty response', true);
    // The API never sends a DTD; refuse one rather than expand payload-defined entities.
    if (/<!(DOCTYPE|ENTITY)/i.test(trimmed))
        throw new trade_api_client_1.TradeApiError('unexpected DTD', false);
    let doc;
    try {
        doc = obj((trimmed.startsWith('{') ? JSON.parse(trimmed) : xml.parse(trimmed)));
    }
    catch {
        throw new trade_api_client_1.TradeApiError('unparseable response', true);
    }
    if (!doc)
        throw new trade_api_client_1.TradeApiError('unparseable response', true);
    // Gateway-level error envelope (invalid key, quota exceeded, …).
    const gateway = obj(obj(doc.OpenAPI_ServiceResponse)?.cmmMsgHeader);
    if (gateway) {
        const code = str(gateway.returnReasonCode) ?? '';
        const msg = str(gateway.returnAuthMsg) ?? str(gateway.errMsg) ?? 'gateway error';
        throw new trade_api_client_1.TradeApiError(`gateway error ${code} ${msg}`.trim(), RETRYABLE_CODES.has(code));
    }
    const response = obj(doc.response);
    if (!response)
        throw new trade_api_client_1.TradeApiError('unexpected response shape', true);
    const header = obj(response.header);
    const code = str(header?.resultCode) ?? '';
    if (NO_DATA_CODES.has(code))
        return { items: [], totalCount: 0, pageNo: 1, numOfRows: 0 };
    if (!OK_CODES.has(code)) {
        const msg = str(header?.resultMsg) ?? 'error';
        throw new trade_api_client_1.TradeApiError(`api error ${code} ${msg}`.trim(), RETRYABLE_CODES.has(code));
    }
    const resBody = obj(response.body);
    const rawItems = obj(resBody?.items)?.item;
    const list = rawItems === undefined ? [] : Array.isArray(rawItems) ? rawItems : [rawItems];
    const items = list.map(toItem).filter((i) => i !== null);
    return {
        items,
        totalCount: int(resBody?.totalCount, items.length),
        pageNo: int(resBody?.pageNo, 1),
        numOfRows: int(resBody?.numOfRows, items.length),
    };
}
//# sourceMappingURL=trade-api.parser.js.map