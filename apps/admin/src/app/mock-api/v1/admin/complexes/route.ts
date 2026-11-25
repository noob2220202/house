import type { NextRequest } from 'next/server';
import { complexFormSchema } from '@/features/m-content/api/inputs';
import { complexDetail, complexSummary } from '@/features/m-content/mock/complex-view';
import {
  isResponse,
  matchesText,
  mockAdmin,
  mockBody,
  mockConflict,
} from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

// GET /api/v1/admin/complexes?q&emdCode&missingExternalCode&source&includeDeleted&page&pageSize →
// Paginated<AdminComplexListItem> (shared), ordered by name like the API.
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const emdCode = sp.get('emdCode');
  const missingCode = ['1', 'true'].includes(sp.get('missingExternalCode') ?? '');
  const source = sp.get('source');
  const rows = db()
    .complexes.filter((c) => matchesText(sp.get('q'), c.name, c.roadAddress, c.jibunAddress))
    .filter((c) => !emdCode || c.emdCode === emdCode)
    .filter((c) => !missingCode || !c.externalCode)
    .filter((c) => !source || (c.source ?? 'ADMIN') === source)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id))
    .map(complexSummary);
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req, { pageSize: 10 }));
}

// POST /api/v1/admin/complexes
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, complexFormSchema);
  if (isResponse(input)) return input;
  const store = db();
  if (input.externalCode && store.complexes.some((c) => c.externalCode === input.externalCode))
    return mockConflict('COMPLEX_EXTERNAL_CODE_TAKEN', '이미 등록된 외부 코드입니다.');
  const now = nowIso();
  const row = {
    id: newId(),
    ...input,
    sggCode: input.emdCode.slice(0, 5),
    viewCount: 0,
    favoriteCount: 0,
    activeListingCount: 0,
    lastTradeDate: null,
    tradeTotal: 0,
    tradeUnmatched: 0,
    createdAt: now,
    updatedAt: now,
    areaTypes: [],
    photos: [],
  };
  store.complexes.unshift(row);
  audit(ctx, req, {
    action: 'complex.create',
    resourceType: 'Complex',
    resourceId: row.id,
    resourceLabel: row.name,
    after: { name: row.name, emdName: row.emdName, households: row.households },
  });
  return mockJson(complexDetail(row), { status: 201 });
}
