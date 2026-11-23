import type { BrokerRegistryRecord } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AppConfig } from '../../../config/app-config.service';

/**
 * Public broker registry lookup (국가공간정보 부동산중개업 정보, 중개업소 조회) by 등록번호.
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

const ENDPOINT = 'https://apis.data.go.kr/1611000/nsdi/EstateBrkpgService/attr/getEBOfficeInfo';
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

/** 상태구분코드 "1" = 영업 (2 휴업, 3 휴업연장, 4 실효, 5 폐업, …). */
const OPERATING_STATUS_CODE = '1';

export function parseRegistryResponse(
  body: unknown,
  registrationNumber: string,
): BrokerRegistryRecord | null {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new BrokerRegistryUnavailableError('unexpected registry response');
  const field = parsed.data.EBOfficeInfos?.field;
  const offices = field === undefined ? [] : Array.isArray(field) ? field : [field];
  const office = offices.find((o) => o.jurirno.replace(/\s/g, '') === registrationNumber);
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

/** data.go.kr (DATA_GO_KR_SERVICE_KEY) implementation. Disabled when the key is not configured. */
@Injectable()
export class DataGoKrBrokerRegistryClient implements BrokerRegistryClient {
  private readonly logger = new Logger(DataGoKrBrokerRegistryClient.name);
  private readonly serviceKey: string | undefined;

  constructor(config: AppConfig) {
    this.serviceKey = config.get('DATA_GO_KR_SERVICE_KEY');
  }

  get enabled(): boolean {
    return Boolean(this.serviceKey);
  }

  async findByRegistrationNumber(
    registrationNumber: string,
    sggCode: string,
  ): Promise<BrokerRegistryRecord | null> {
    if (!this.serviceKey)
      throw new BrokerRegistryUnavailableError('registry lookup not configured');
    const url = new URL(ENDPOINT);
    url.searchParams.set('serviceKey', this.serviceKey);
    url.searchParams.set('ldCode', sggCode);
    url.searchParams.set('jurirno', registrationNumber);
    url.searchParams.set('format', 'json');
    url.searchParams.set('numOfRows', '10');
    url.searchParams.set('pageNo', '1');
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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
    return parseRegistryResponse(body, registrationNumber);
  }
}
