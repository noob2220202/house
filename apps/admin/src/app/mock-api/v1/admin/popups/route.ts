import { randomUUID } from 'node:crypto';
import { BannerStatus, popupCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson, mockPaginate } from '@/lib/mock';
import { adminGuard, readJson, validationError } from '../banners/_guard';
import { getMedia } from '../media/_store';
import { popupState, popupStatusOf, sortedPopups, toAdminPopup, type MockPopup } from './_store';

const STATUSES = Object.values(BannerStatus) as string[];

// GET /api/v1/admin/popups?status&page&pageSize — every popup (any status), ordered by sortOrder.
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req);
  const status = req.nextUrl.searchParams.get('status');
  if (status && !STATUSES.includes(status))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'status', message: '올바른 값이 아닙니다.' },
    ]);
  const rows = sortedPopups().filter((p) => !status || popupStatusOf(p) === status);
  const page = mockPaginate(rows, req, { pageSize: 20 });
  return mockJson({ ...page, items: page.items.map(toAdminPopup) });
}

// POST /api/v1/admin/popups — body = popupCreateSchema. New popups go to the end of the order.
export async function POST(req: NextRequest) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 300);
  const parsed = popupCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  if (!getMedia(input.mediaId))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'mediaId', message: '이미지를 다시 올려 주세요.' },
    ]);
  const state = popupState();
  state.seq += 1;
  const now = new Date().toISOString();
  const popup: MockPopup = {
    id: randomUUID(),
    code: `AD-${state.seq}`,
    title: input.title,
    mediaId: input.mediaId,
    linkUrl: input.linkUrl ?? null,
    newWindow: input.newWindow,
    targetPages: input.targetPages,
    startAt: input.startAt,
    endAt: input.endAt,
    paused: input.paused,
    dismissDays: input.dismissDays,
    sortOrder: state.popups.length + 1,
    createdAt: now,
    updatedAt: now,
    totals: { impressions: 0, clicks: 0 },
  };
  state.popups.push(popup);
  return mockJson(toAdminPopup(popup), { status: 201 });
}
