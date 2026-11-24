import { NextResponse, type NextRequest } from 'next/server';
import { areaTypeFormSchema } from '@/features/m-content/api/inputs';
import { findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, changedOnly, pickChanged } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string; areaTypeId: string }> };
const missing = () => mockNotFound('AREA_TYPE_NOT_FOUND', '평형을 찾을 수 없습니다.');

// PATCH /api/v1/admin/complexes/:id/area-types/:areaTypeId
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id, areaTypeId } = await params;
  const complex = findComplex(id);
  const row = complex?.areaTypes.find((a) => a.id === areaTypeId);
  if (!complex || !row) return missing();
  const input = await mockBody(req, areaTypeFormSchema);
  if (isResponse(input)) return input;
  if (
    complex.areaTypes.some(
      (a) =>
        a.id !== areaTypeId &&
        a.exclusiveArea === input.exclusiveArea &&
        a.typeName === input.typeName,
    )
  )
    return mockConflict('AREA_TYPE_EXISTS', '같은 전용면적·타입명의 평형이 이미 있습니다.');
  const before = pickChanged(row, input);
  const after = changedOnly(row, input);
  Object.assign(row, input);
  complex.updatedAt = nowIso();
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: 'complex.area_type.update',
      resourceType: 'Complex',
      resourceId: id,
      resourceLabel: complex.name,
      before,
      after,
    });
  return mockJson(row);
}

// DELETE /api/v1/admin/complexes/:id/area-types/:areaTypeId — matched trades keep their rows
// (TradeRecord.areaTypeId → SET NULL) and show up as "unmatched" again.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id, areaTypeId } = await params;
  const complex = findComplex(id);
  const row = complex?.areaTypes.find((a) => a.id === areaTypeId);
  if (!complex || !row) return missing();
  complex.areaTypes = complex.areaTypes.filter((a) => a.id !== areaTypeId);
  complex.tradeUnmatched += row.tradeCount;
  complex.tradeTotal -= row.tradeCount;
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.area_type.remove',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    before: { exclusiveArea: row.exclusiveArea, typeName: row.typeName },
  });
  return new NextResponse(null, { status: 204 });
}
