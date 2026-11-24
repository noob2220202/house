import type { NextRequest } from 'next/server';
import { areaTypeFormSchema } from '@/features/m-content/api/inputs';
import { findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

// POST /api/v1/admin/complexes/:id/area-types — ASSUMED sub-path ("+ area types" in the README)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const complex = findComplex(id);
  if (!complex) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  const input = await mockBody(req, areaTypeFormSchema);
  if (isResponse(input)) return input;
  // @@unique([complexId, exclusiveArea, typeName])
  if (
    complex.areaTypes.some(
      (a) => a.exclusiveArea === input.exclusiveArea && a.typeName === input.typeName,
    )
  )
    return mockConflict('AREA_TYPE_EXISTS', '같은 전용면적·타입명의 평형이 이미 있습니다.');
  const row = { id: newId(), ...input, tradeCount: 0, lastSalePrice: null };
  complex.areaTypes.push(row);
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.area_type.add',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    after: input,
  });
  return mockJson(row, { status: 201 });
}
