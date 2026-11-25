import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AdminRole, TradeDealType, TradeSyncKind } from '@house/shared';
import type { Complex, ComplexAreaType, Prisma, TradeRecord } from '@prisma/client';
import { RegionsService } from '../../../src/modules/complexes/services/regions.service';
import {
  TRADE_API_CLIENT,
  TradeApiError,
  type TradeApiClient,
  type TradeApiPage,
  type TradeApiPageRequest,
} from '../../../src/modules/complexes/trade-sync/trade-api.client';
import { parseTradeApiResponse } from '../../../src/modules/complexes/trade-sync/trade-api.parser';
import {
  createAdmin,
  createComplex,
  createTestApp,
  loginAdmin,
  type TestApp,
  type TestSession,
} from '../../utils';

export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export function fixture(name: string): string {
  return readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

/**
 * Fixture-backed TradeApiClient: responses keyed by `${kind}:${yearMonth}` (XML bodies parsed by
 * the real parser) for any LAWD_CD, or by `${kind}:${yearMonth}:${sggCode}` for one code only
 * (`set(..., sggCode)`, e.g. to simulate the legacy-code fallback); optional page cap to exercise
 * pagination, and injectable failures.
 */
export class FakeTradeApi implements TradeApiClient {
  configured = true;
  readonly calls: TradeApiPageRequest[] = [];
  /** Simulates an API that returns at most N rows per page. */
  maxRowsPerPage: number | null = null;
  private readonly bodies = new Map<string, string>();
  private readonly failures = new Map<string, Error>();

  set(kind: TradeSyncKind, yearMonth: number, body: string, sggCode?: string): this {
    this.bodies.set(sggCode ? `${kind}:${yearMonth}:${sggCode}` : `${kind}:${yearMonth}`, body);
    return this;
  }

  fail(kind: TradeSyncKind, yearMonth: number, error: Error): this {
    this.failures.set(`${kind}:${yearMonth}`, error);
    return this;
  }

  clearFailures(): void {
    this.failures.clear();
  }

  reset(): void {
    this.configured = true;
    this.maxRowsPerPage = null;
    this.calls.length = 0;
    this.bodies.clear();
    this.failures.clear();
  }

  fetchPage(req: TradeApiPageRequest): Promise<TradeApiPage> {
    this.calls.push(req);
    const key = `${req.kind}:${req.yearMonth}`;
    const failure = this.failures.get(key);
    if (failure) return Promise.reject(failure);
    const body = this.bodies.get(`${key}:${req.sggCode}`) ?? this.bodies.get(key);
    if (body === undefined) return Promise.resolve(parseTradeApiResponse(emptyResponse()));
    const all = parseTradeApiResponse(body);
    const size = Math.min(req.numOfRows, this.maxRowsPerPage ?? req.numOfRows);
    const start = (req.pageNo - 1) * size;
    return Promise.resolve({
      items: all.items.slice(start, start + size),
      totalCount: all.totalCount,
      pageNo: req.pageNo,
      numOfRows: size,
    });
  }
}

export function emptyResponse(): string {
  return '<response><header><resultCode>03</resultCode><resultMsg>NODATA_ERROR</resultMsg></header></response>';
}

export const quotaError = (): TradeApiError =>
  new TradeApiError('api error 22 LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR', true);

export async function createComplexesApp(fake: FakeTradeApi): Promise<TestApp> {
  return createTestApp({ override: (b) => b.overrideProvider(TRADE_API_CLIENT).useValue(fake) });
}

export async function seedRegions(t: TestApp): Promise<void> {
  await t.app.get(RegionsService).seedDefault();
}

export async function adminSession(
  t: TestApp,
  role: AdminRole = AdminRole.ADMIN,
  opts: { mfaVerified?: boolean } = {},
): Promise<TestSession> {
  const admin = await createAdmin(t.prisma, { role });
  return loginAdmin(t.app, { id: admin.id, role }, opts);
}

/** 연향부영3차 as the 국토교통부 fixtures describe it, with two 평형. */
export async function seedBuyoung(
  t: TestApp,
  data: Partial<Prisma.ComplexUncheckedCreateInput> = {},
): Promise<{ complex: Complex; at84: ComplexAreaType; at59: ComplexAreaType }> {
  const complex = await createComplex(t.prisma, {
    name: '연향부영3차',
    roadAddress: '전남광주통합특별시 순천시 연향번영길 100',
    jibunAddress: '전남광주통합특별시 순천시 연향동 1234-5',
    emdCode: '12150114',
    emdName: '연향동',
    jibun: '1234-5',
    households: 600,
    buildings: 8,
    approvalDate: new Date('1998-05-20T00:00:00Z'),
    builtYear: 1998,
    lat: 34.9601,
    lng: 127.5208,
    ...data,
  });
  const at84 = await t.prisma.complexAreaType.create({
    data: { complexId: complex.id, exclusiveArea: '84.97', supplyArea: '112.4', typeName: '84A' },
  });
  const at59 = await t.prisma.complexAreaType.create({
    data: { complexId: complex.id, exclusiveArea: '59.84', supplyArea: '79.3', typeName: '59' },
  });
  return { complex, at84, at59 };
}

let tradeSeq = 0;
export async function insertTrade(
  t: TestApp,
  data: Partial<Prisma.TradeRecordUncheckedCreateInput> & { complexId: string },
): Promise<TradeRecord> {
  const n = ++tradeSeq;
  const dealDate = (data.dealDate as Date | undefined) ?? new Date('2024-10-01T00:00:00Z');
  return t.prisma.tradeRecord.create({
    data: {
      sourceKey: createHash('sha256').update(`test-${n}-${Math.random()}`).digest('hex'),
      kind: TradeSyncKind.APT_TRADE,
      sggCode: '12150',
      aptName: '테스트',
      dealType: TradeDealType.SALE,
      dealYm: dealDate.getUTCFullYear() * 100 + dealDate.getUTCMonth() + 1,
      exclusiveArea: '84.97',
      price: 20000,
      ...data,
      dealDate,
    },
  });
}
