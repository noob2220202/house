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
var VworldBrokerRegistryClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VworldBrokerRegistryClient = exports.BrokerRegistryUnavailableError = exports.BROKER_REGISTRY = void 0;
exports.parseRegistryResponse = parseRegistryResponse;
exports.resolveVworldDomain = resolveVworldDomain;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const app_config_service_1 = require("../../../config/app-config.service");
exports.BROKER_REGISTRY = Symbol('BROKER_REGISTRY');
class BrokerRegistryUnavailableError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'BrokerRegistryUnavailableError';
    }
}
exports.BrokerRegistryUnavailableError = BrokerRegistryUnavailableError;
const ENDPOINT = 'https://api.vworld.kr/ned/data/getEBOfficeInfo';
const TIMEOUT_MS = 5_000;
const officeSchema = zod_1.z.object({
    jurirno: zod_1.z.string(),
    bsnmCmpnm: zod_1.z.string(),
    brkrNm: zod_1.z.string().nullish(),
    sttusSeCode: zod_1.z.string().nullish(),
    sttusSeCodeNm: zod_1.z.string().nullish(),
    ldCodeNm: zod_1.z.string().nullish(),
    registDe: zod_1.z.string().nullish(),
});
const responseSchema = zod_1.z.object({
    EBOfficeInfos: zod_1.z
        .object({ field: zod_1.z.union([zod_1.z.array(officeSchema), officeSchema]).optional() })
        .optional(),
});
/** 브이월드 error envelope, e.g. {"response":{"status":"ERROR","error":{"code":"INCORRECT_KEY",…}}}. */
const errorSchema = zod_1.z.object({
    response: zod_1.z.object({
        status: zod_1.z.literal('ERROR'),
        error: zod_1.z.object({ code: zod_1.z.string().optional(), text: zod_1.z.string().optional() }).optional(),
    }),
});
/** 상태구분코드 "1" = 영업 (2 휴업, 3 휴업연장, 4 실효, 5 폐업, …). */
const OPERATING_STATUS_CODE = '1';
function parseRegistryResponse(body, registrationNumber) {
    const apiError = errorSchema.safeParse(body);
    if (apiError.success) {
        const code = apiError.data.response.error?.code ?? 'UNKNOWN';
        throw new BrokerRegistryUnavailableError(`registry error ${code}`);
    }
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success)
        throw new BrokerRegistryUnavailableError('unexpected registry response');
    const field = parsed.data.EBOfficeInfos?.field;
    const offices = field === undefined ? [] : Array.isArray(field) ? field : [field];
    // The registry prints numbers with or without hyphens; compare punctuation-free keys.
    const key = (0, shared_1.registrationNumberKey)(registrationNumber);
    const office = offices.find((o) => (0, shared_1.registrationNumberKey)(o.jurirno) === key);
    if (!office)
        return null;
    const registeredOn = office.registDe?.trim() ?? null;
    return {
        registrationNumber,
        officeName: office.bsnmCmpnm.trim(),
        representativeName: office.brkrNm?.trim() || null,
        operating: office.sttusSeCode === OPERATING_STATUS_CODE,
        statusLabel: office.sttusSeCodeNm?.trim() || null,
        regionName: office.ldCodeNm?.trim() || null,
        registeredOn: registeredOn && /^\d{4}-?\d{2}-?\d{2}$/.test(registeredOn) ? registeredOn : null,
    };
}
/**
 * 브이월드 (VWORLD_API_KEY) implementation. Disabled when the key is not configured.
 * A 브이월드 key only authenticates for the domain registered at issuance, so the call sends
 * that domain both as the `domain` parameter and as the Referer.
 */
let VworldBrokerRegistryClient = VworldBrokerRegistryClient_1 = class VworldBrokerRegistryClient {
    constructor(config) {
        this.logger = new common_1.Logger(VworldBrokerRegistryClient_1.name);
        this.apiKey = config.get('VWORLD_API_KEY');
        this.domain = resolveVworldDomain(config.get('VWORLD_DOMAIN'), config.get('PUBLIC_BASE_URL'));
    }
    get enabled() {
        return Boolean(this.apiKey);
    }
    /**
     * Looks the office up under the current 시군구 code (12150) first. Whether 브이월드 already files
     * offices registered before the 2026-07-01 reorganisation under the new code is not documented,
     * so when no office matches, the legacy code (46150) is asked once more.
     */
    async findByRegistrationNumber(registrationNumber, sggCode) {
        if (!this.apiKey)
            throw new BrokerRegistryUnavailableError('registry lookup not configured');
        const ldCode = (0, shared_1.canonicalRegionCode)(sggCode);
        const found = await this.lookup(this.apiKey, registrationNumber, ldCode);
        const legacy = found ? null : (0, shared_1.legacyRegionCode)(ldCode);
        if (!legacy)
            return found;
        const retried = await this.lookup(this.apiKey, registrationNumber, legacy);
        this.logger.warn({ ldCode, legacyLdCode: legacy, found: retried !== null }, 'broker registry had no office under the current 시군구 code; retried with the legacy code');
        return retried;
    }
    async lookup(apiKey, registrationNumber, ldCode) {
        const url = new URL(ENDPOINT);
        url.searchParams.set('key', apiKey);
        url.searchParams.set('domain', this.domain);
        url.searchParams.set('ldCode', ldCode);
        url.searchParams.set('jurirno', registrationNumber);
        url.searchParams.set('format', 'json');
        url.searchParams.set('numOfRows', '10');
        url.searchParams.set('pageNo', '1');
        let res;
        try {
            res = await fetch(url, {
                headers: { Referer: `https://${this.domain}/` },
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
        }
        catch (err) {
            this.logger.warn({ err: err.message }, 'broker registry request failed');
            throw new BrokerRegistryUnavailableError('registry request failed', { cause: err });
        }
        if (!res.ok)
            throw new BrokerRegistryUnavailableError(`registry HTTP ${res.status}`);
        let body;
        try {
            body = await res.json();
        }
        catch (err) {
            throw new BrokerRegistryUnavailableError('registry returned non-JSON', { cause: err });
        }
        try {
            return parseRegistryResponse(body, registrationNumber);
        }
        catch (err) {
            this.logger.warn({ err: err.message }, 'broker registry lookup failed');
            throw err;
        }
    }
};
exports.VworldBrokerRegistryClient = VworldBrokerRegistryClient;
exports.VworldBrokerRegistryClient = VworldBrokerRegistryClient = VworldBrokerRegistryClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], VworldBrokerRegistryClient);
/** Bare host for 브이월드: explicit VWORLD_DOMAIN (scheme/path tolerated) or PUBLIC_BASE_URL's host. */
function resolveVworldDomain(configured, publicBaseUrl) {
    const raw = configured?.trim();
    if (raw) {
        const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
        return new URL(withScheme).host;
    }
    return new URL(publicBaseUrl).host;
}
//# sourceMappingURL=broker-registry.client.js.map