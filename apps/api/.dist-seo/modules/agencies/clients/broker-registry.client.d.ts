import { type BrokerRegistryRecord } from '@house/shared';
import { AppConfig } from '../../../config/app-config.service';
/**
 * Public broker registry lookup (브이월드 부동산중개업 사무소정보조회 getEBOfficeInfo) by 등록번호.
 * The former 국가공간정보포털(nsdi.go.kr) API moved to 브이월드 when nsdi closed on 2024-01-01;
 * data.go.kr now only carries the bulk file dataset, so the live lookup goes to api.vworld.kr.
 * `null` = no such office; throws BrokerRegistryUnavailableError when the lookup cannot be made.
 * Tests bind a fake; nothing here is required for approval — it only assists the reviewer.
 */
export interface BrokerRegistryClient {
    readonly enabled: boolean;
    findByRegistrationNumber(registrationNumber: string, sggCode: string): Promise<BrokerRegistryRecord | null>;
}
export declare const BROKER_REGISTRY: unique symbol;
export declare class BrokerRegistryUnavailableError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
export declare function parseRegistryResponse(body: unknown, registrationNumber: string): BrokerRegistryRecord | null;
/**
 * 브이월드 (VWORLD_API_KEY) implementation. Disabled when the key is not configured.
 * A 브이월드 key only authenticates for the domain registered at issuance, so the call sends
 * that domain both as the `domain` parameter and as the Referer.
 */
export declare class VworldBrokerRegistryClient implements BrokerRegistryClient {
    private readonly logger;
    private readonly apiKey;
    private readonly domain;
    constructor(config: AppConfig);
    get enabled(): boolean;
    /**
     * Looks the office up under the current 시군구 code (12150) first. Whether 브이월드 already files
     * offices registered before the 2026-07-01 reorganisation under the new code is not documented,
     * so when no office matches, the legacy code (46150) is asked once more.
     */
    findByRegistrationNumber(registrationNumber: string, sggCode: string): Promise<BrokerRegistryRecord | null>;
    private lookup;
}
/** Bare host for 브이월드: explicit VWORLD_DOMAIN (scheme/path tolerated) or PUBLIC_BASE_URL's host. */
export declare function resolveVworldDomain(configured: string | undefined, publicBaseUrl: string): string;
