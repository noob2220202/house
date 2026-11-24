import { isValidYearMonth } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { mockTradeReport } from '../../_data';

// GET /api/v1/seo/reports/apartment-trades?ym=YYYYMM — public (seo module): monthly 실거래 report.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const ymRaw = req.nextUrl.searchParams.get('ym');
  const ym = ymRaw ? Number(ymRaw) : undefined;
  if (ym !== undefined && !isValidYearMonth(ym)) {
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'ym', message: '연월은 YYYYMM 형식이어야 합니다.' },
    ]);
  }
  const report = mockTradeReport(ym);
  if (!report) return mockNotFound();
  return mockJson(report);
}
