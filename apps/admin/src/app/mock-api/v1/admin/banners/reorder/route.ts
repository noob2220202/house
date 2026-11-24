import { reorderSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { adminGuard, readJson, validationError } from '../_guard';
import { findBanner, slotBanners } from '../_store';

// PUT /api/v1/admin/banners/reorder — body = reorderSchema `{ ids }`: banner ids of ONE slot in the
// new display order (sortOrder becomes 1..n; banners of the slot that are not listed keep their
// relative order after the listed ones).
export async function PUT(req: NextRequest) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 250);
  const parsed = reorderSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const banners = parsed.data.ids.map(findBanner);
  const first = banners[0];
  if (!first || banners.some((b) => !b || b.slot !== first.slot))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'ids', message: '같은 노출 위치의 배너만 순서를 바꿀 수 있습니다.' },
    ]);
  const listed = new Set(parsed.data.ids);
  const rest = slotBanners(first.slot).filter((b) => !listed.has(b.id));
  [...banners, ...rest].forEach((b, i) => {
    if (b) b.sortOrder = i + 1;
  });
  return mockJson({
    items: slotBanners(first.slot).map((b) => ({ id: b.id, sortOrder: b.sortOrder })),
  });
}
