"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataGoKrTradeApiClient = exports.TradeApiError = exports.TRADE_API_CLIENT = void 0;
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const constants_1 = require("../constants");
const trade_api_parser_1 = require("./trade-api.parser");
exports.TRADE_API_CLIENT = Symbol('TRADE_API_CLIENT');
/** Errors from the upstream API. Messages never contain the service key. */
class TradeApiError extends Error {
    constructor(message, retryable) {
        super(message);
        this.retryable = retryable;
        this.name = 'TradeApiError';
    }
}
exports.TradeApiError = TradeApiError;
let DataGoKrTradeApiClient = class DataGoKrTradeApiClient {
    constructor(config) {
        this.serviceKey = config.get('DATA_GO_KR_SERVICE_KEY');
    }
    get configured() {
        return this.serviceKey !== undefined;
    }
    async fetchPage(req) {
        if (!this.serviceKey)
            throw new TradeApiError('DATA_GO_KR_SERVICE_KEY is not set', false);
        const url = new URL(constants_1.TRADE_API.ENDPOINTS[req.kind]);
        // The decoded key is percent-encoded here exactly once.
        url.searchParams.set('serviceKey', this.serviceKey);
        url.searchParams.set('LAWD_CD', req.sggCode);
        url.searchParams.set('DEAL_YMD', String(req.yearMonth));
        url.searchParams.set('pageNo', String(req.pageNo));
        url.searchParams.set('numOfRows', String(req.numOfRows));
        let res;
        try {
            res = await fetch(url, {
                headers: { accept: 'application/xml, application/json;q=0.9' },
                signal: AbortSignal.timeout(constants_1.TRADE_API.TIMEOUT_MS),
            });
        }
        catch (err) {
            const reason = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network';
            throw new TradeApiError(`${req.kind} request failed (${reason})`, true);
        }
        const body = await res.text();
        if (!res.ok) {
            throw new TradeApiError(`${req.kind} HTTP ${res.status}`, res.status >= 500 || res.status === 429);
        }
        return (0, trade_api_parser_1.parseTradeApiResponse)(body);
    }
};
exports.DataGoKrTradeApiClient = DataGoKrTradeApiClient;
exports.DataGoKrTradeApiClient = DataGoKrTradeApiClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], DataGoKrTradeApiClient);
//# sourceMappingURL=trade-api.client.js.map