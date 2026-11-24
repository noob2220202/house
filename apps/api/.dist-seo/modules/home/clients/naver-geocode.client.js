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
var NaverGeocoder_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaverGeocoder = exports.GEOCODER = exports.GeocoderUnavailableError = void 0;
exports.parseGeocodeResponse = parseGeocodeResponse;
exports.parseLegalCode = parseLegalCode;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const app_config_service_1 = require("../../../config/app-config.service");
const constants_1 = require("../constants");
/** Thrown when the external geocoder fails (timeout, HTTP error, unexpected payload). */
class GeocoderUnavailableError extends Error {
}
exports.GeocoderUnavailableError = GeocoderUnavailableError;
exports.GEOCODER = Symbol('GEOCODER');
const geocodeResponseSchema = zod_1.z.object({
    status: zod_1.z.string(),
    errorMessage: zod_1.z.string().nullish(),
    addresses: zod_1.z
        .array(zod_1.z.object({
        roadAddress: zod_1.z.string().nullish(),
        jibunAddress: zod_1.z.string().nullish(),
        x: zod_1.z.string(),
        y: zod_1.z.string(),
        addressElements: zod_1.z
            .array(zod_1.z.object({
            types: zod_1.z.array(zod_1.z.string()).default([]),
            longName: zod_1.z.string().nullish(),
        }))
            .default([]),
    }))
        .default([]),
});
const reverseResponseSchema = zod_1.z.object({
    status: zod_1.z.object({ code: zod_1.z.number() }),
    results: zod_1.z
        .array(zod_1.z.object({ name: zod_1.z.string(), code: zod_1.z.object({ id: zod_1.z.string() }).nullish() }))
        .default([]),
});
/** Naver geocoding payload → hits (invalid coordinates and empty addresses dropped). */
function parseGeocodeResponse(body) {
    const parsed = geocodeResponseSchema.safeParse(body);
    if (!parsed.success || parsed.data.status !== 'OK') {
        throw new GeocoderUnavailableError(parsed.success ? (parsed.data.errorMessage ?? parsed.data.status) : 'invalid payload');
    }
    return parsed.data.addresses.flatMap((a) => {
        const lat = Number(a.y);
        const lng = Number(a.x);
        const road = a.roadAddress?.trim() || a.jibunAddress?.trim() || '';
        if (!road || !Number.isFinite(lat) || !Number.isFinite(lng))
            return [];
        const element = (type) => a.addressElements.find((e) => e.types.includes(type))?.longName?.trim() || null;
        return [
            {
                roadAddress: road,
                jibunAddress: a.jibunAddress?.trim() || null,
                zipCode: element('POSTAL_CODE'),
                buildingName: element('BUILDING_NAME'),
                lat,
                lng,
            },
        ];
    });
}
/** Reverse-geocoding payload → the 법정동 (legalcode) id, or null. */
function parseLegalCode(body) {
    const parsed = reverseResponseSchema.safeParse(body);
    if (!parsed.success || parsed.data.status.code !== 0)
        return null;
    const id = parsed.data.results.find((r) => r.name === 'legalcode')?.code?.id ?? null;
    return id && /^\d{10}$/.test(id) ? id : null;
}
let NaverGeocoder = NaverGeocoder_1 = class NaverGeocoder {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(NaverGeocoder_1.name);
    }
    isConfigured() {
        return !!this.config.get('NAVER_MAP_CLIENT_ID') && !!this.config.get('NAVER_MAP_CLIENT_SECRET');
    }
    async geocode(query, near) {
        const url = new URL(constants_1.NAVER_MAPS.GEOCODE);
        url.searchParams.set('query', query);
        url.searchParams.set('count', String(constants_1.GEOCODE_MAX_RESULTS));
        if (near)
            url.searchParams.set('coordinate', `${near.lng},${near.lat}`);
        return parseGeocodeResponse(await this.get(url));
    }
    async legalCode(lat, lng) {
        const url = new URL(constants_1.NAVER_MAPS.REVERSE_GEOCODE);
        url.searchParams.set('coords', `${lng},${lat}`);
        url.searchParams.set('orders', 'legalcode');
        url.searchParams.set('output', 'json');
        try {
            return parseLegalCode(await this.get(url));
        }
        catch (err) {
            this.logger.warn({ err }, 'reverse geocoding failed');
            return null;
        }
    }
    async get(url) {
        let res;
        try {
            res = await fetch(url, {
                headers: {
                    'x-ncp-apigw-api-key-id': this.config.get('NAVER_MAP_CLIENT_ID') ?? '',
                    'x-ncp-apigw-api-key': this.config.get('NAVER_MAP_CLIENT_SECRET') ?? '',
                    accept: 'application/json',
                },
                signal: AbortSignal.timeout(constants_1.NAVER_MAPS.TIMEOUT_MS),
            });
        }
        catch (err) {
            throw new GeocoderUnavailableError(`request failed: ${String(err)}`);
        }
        if (!res.ok)
            throw new GeocoderUnavailableError(`HTTP ${res.status}`);
        try {
            return await res.json();
        }
        catch {
            throw new GeocoderUnavailableError('invalid JSON');
        }
    }
};
exports.NaverGeocoder = NaverGeocoder;
exports.NaverGeocoder = NaverGeocoder = NaverGeocoder_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], NaverGeocoder);
//# sourceMappingURL=naver-geocode.client.js.map