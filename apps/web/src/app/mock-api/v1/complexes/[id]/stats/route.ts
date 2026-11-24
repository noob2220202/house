import { TradeDealType } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { areaTypeIdOf, findComplexSpec, tradeDataOf } from '../../_fixtures';

type Ctx = { params: Promise<{ id: string }> };

const isDealType = (v: string): v is TradeDealType => v in TradeDealType;

// GET /api/v1/complexes/:id/stats?dealType&areaTypeId&fromYm&toYm — public (complexes module).
// → { dealType, areaTypeId, months: ComplexTradeStat[], latest: TradeRecord[] }
//   months = monthly aggregates of ONE series (default: 매매 of the largest 평형);
//   latest = latest trade of every 평형 × deal type.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');

  const sp = req.nextUrl.searchParams;
  const dealParam = sp.get('dealType') ?? TradeDealType.SALE;
  if (!isDealType(dealParam)) {
    return mockError(400, 'VALIDATION_FAILED', '요청 값이 올바르지 않습니다.', [
      { path: 'dealType', message: '올바른 거래 유형이 아닙니다.' },
    ]);
  }
  const main = [...spec.areas].sort((a, b) => b.households - a.households)[0];
  const requested = sp.get('areaTypeId');
  const known = spec.areas.find((a) => areaTypeIdOf(spec.code, a) === requested) ?? main;
  const areaTypeId = known ? areaTypeIdOf(spec.code, known) : null;
  const fromYm = Number(sp.get('fromYm')) || 0;
  const toYm = Number(sp.get('toYm')) || 999999;

  const { monthly, latest } = tradeDataOf(spec);
  const months = monthly
    .filter(
      (m) =>
        m.areaTypeId === areaTypeId &&
        m.dealType === dealParam &&
        m.yearMonth >= fromYm &&
        m.yearMonth <= toYm,
    )
    .map(({ areaTypeId: _a, exclusiveArea: _e, dealType: _d, ...month }) => month);
  return mockJson({ dealType: dealParam, areaTypeId, months, latest });
}
