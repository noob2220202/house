import type { NextRequest } from 'next/server';
import { mockCsv, mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import { agenciesFor, publicAgency } from '../_store';

const AREA_LABEL: Record<string, string> = {
  '1215033028': '신대·선월',
  '1215033029': '신대·선월',
  '1215012100': '연향·금당',
  '1215012000': '조례',
  '1215011900': '오천',
  '1215012200': '왕지',
  '1215011000': '석현',
};

/**
 * GET /api/v1/deal-requests/target-agencies?q&emdCode&regionCodes&page&pageSize  (ASSUMED endpoint)
 * Approved agencies that would receive a request for the given area — `total` is the reach count,
 * `q` searches by 상호 / 대표 / 주소 for the "선택한 중개사" picker.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const codes = [...mockCsv(sp, 'regionCodes'), ...(sp.get('emdCode') ? [sp.get('emdCode')!] : [])];
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  let list = agenciesFor(codes);
  if (q) {
    list = list.filter((a) =>
      [a.name, a.representativeName, a.roadAddress, a.specialty].some((s) =>
        s.toLowerCase().includes(q),
      ),
    );
  }
  // Offices based in the area first, then by response time.
  const local = (a: (typeof list)[number]) => (codes.includes(a.serviceCodes[0] ?? '') ? 0 : 1);
  list = [...list].sort(
    (a, b) => local(a) - local(b) || a.avgResponseMinutes - b.avgResponseMinutes,
  );
  const labels = [...new Set(codes.map((c) => AREA_LABEL[c]).filter(Boolean))];
  return mockJson({
    ...mockPaginate(list.map(publicAgency), req, { pageSize: 10 }),
    areaLabel: labels.length > 0 ? labels.slice(0, 3).join('·') : null,
  });
}
