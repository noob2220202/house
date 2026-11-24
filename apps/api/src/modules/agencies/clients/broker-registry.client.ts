import { registrationNumberKey, type BrokerRegistryRecord } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
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
  findByRegistrationNumber(
    registrationNumber: string,
    sggCode: string,
  ): Promise<BrokerRegistryRecord | null>;
}

export const BROKER_REGISTRY = Symbol('BROKER_REGISTRY');

export class BrokerRegistryUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BrokerRegistryUnavailableError';
  }
}

const ENDPOINT = 'https://api.vworld.kr/ned/data/getEBOfficeInfo';
const TIMEOUT_MS = 5_000;

const officeSchema = z.object({
  jurirno: z.string(),
  bsnmCmpnm: z.string(),
  brkrNm: z.string().nullish(),
  sttusSeCode: z.string().nullish(),
  sttusSeCodeNm: z.string().nullish(),
  ldCodeNm: z.string().nullish(),
  registDe: z.string().nullish(),
});
const responseSchema = z.object({
  EBOfficeInfos: z
    .object({ field: z.union([z.array(officeSchema), officeSchema]).optional() })
    .optional(),
});
/** 브이월드 error envelope, e.g. {"response":{"status":"ERROR","error":{"code":"INCORRECT_KEY",…}}}. */
const errorSchema = z.object({
  response: z.object({
    status: z.literal('ERROR'),
    error: z.object({ code: z.string().optional(), text: z.string().optional() }).optional(),
  }),
});

/** 상태구분코드 "1" = 영업 (2 휴업, 3 휴업연장, 4 실효, 5 폐업, …). */
const OPERATING_STATUS_CODE = '1';

export function parseRegistryResponse(
  body: unknown,
  registrationNumber: string,
): BrokerRegistryRecord | null {
  const apiError = errorSchema.safeParse(body);
  if (apiError.success) {
    const code = apiError.data.response.error?.code ?? 'UNKNOWN';
    throw new BrokerRegistryUnavailableError(`registry error ${code}`);
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new BrokerRegistryUnavailableError('unexpected registry response');
  const field = parsed.data.EBOfficeInfos?.field;
  const offices = field === undefined ? [] : Array.isArray(field) ? field : [field];
  // The registry prints numbers with or without hyphens; compare punctuation-free keys.
  const key = registrationNumberKey(registrationNumber);
  const office = offices.find((o) => registrationNumberKey(o.jurirno) === key);
  if (!office) return null;
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
@Injectable()
export class VworldBrokerRegistryClient implements BrokerRegistryClient {
  private readonly logger = new Logger(VworldBrokerRegistryClient.name);
  private readonly apiKey: string | undefined;
  private readonly domain: string;

  constructor(config: AppConfig) {
    this.apiKey = config.get('VWORLD_API_KEY');
    this.domain = resolveVworldDomain(config.get('VWORLD_DOMAIN'), config.get('PUBLIC_BASE_URL'));
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  async findByRegistrationNumber(
    registrationNumber: string,
    sggCode: string,
  ): Promise<BrokerRegistryRecord | null> {
    if (!this.apiKey) throw new BrokerRegistryUnavailableError('registry lookup not configured');
    const url = new URL(ENDPOINT);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('domain', this.domain);
    url.searchParams.set('ldCode', sggCode);
    url.searchParams.set('jurirno', registrationNumber);
    url.searchParams.set('format', 'json');
    url.searchParams.set('numOfRows', '10');
    url.searchParams.set('pageNo', '1');
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Referer: `https://${this.domain}/` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'broker registry request failed');
      throw new BrokerRegistryUnavailableError('registry request failed', { cause: err });
    }
    if (!res.ok) throw new BrokerRegistryUnavailableError(`registry HTTP ${res.status}`);
    let body: unknown;
    try {
      body = await res.json();
    } catch (err) {
      throw new BrokerRegistryUnavailableError('registry returned non-JSON', { cause: err });
    }
    try {
      return parseRegistryResponse(body, registrationNumber);
    } catch (err) {
      this.logger.warn({ err: (err as Error).message }, 'broker registry lookup failed');
      throw err;
    }
  }
}

/** Bare host for 브이월드: explicit VWORLD_DOMAIN (scheme/path tolerated) or PUBLIC_BASE_URL's host. */
export function resolveVworldDomain(configured: string | undefined, publicBaseUrl: string): string {
  const raw = configured?.trim();
  if (raw) {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).host;
  }
  return new URL(publicBaseUrl).host;
}
