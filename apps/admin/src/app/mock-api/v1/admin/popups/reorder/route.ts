import { reorderSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { adminGuard, readJson, validationError } from '../../banners/_guard';
import { findPopup, sortedPopups } from '../_store';

// PUT /api/v1/admin/popups/reorder — body = reorderSchema `{ ids }` in the new display order.
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 250);
  const parsed = reorderSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const popups = parsed.data.ids.map(findPopup);
  if (popups.some((p) => !p))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'ids', message: '존재하지 않는 팝업이 포함되어 있습니다.' },
    ]);
  const listed = new Set(parsed.data.ids);
  const rest = sortedPopups().filter((p) => !listed.has(p.id));
  [...popups, ...rest].forEach((p, i) => {
    if (p) p.sortOrder = i + 1;
  });
  return mockJson({ items: sortedPopups().map((p) => ({ id: p.id, sortOrder: p.sortOrder })) });
}
