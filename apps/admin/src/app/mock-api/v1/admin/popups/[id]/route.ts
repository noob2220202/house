import { ERROR_MESSAGES, popupInputSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { adminGuard, readJson, validationError } from '../../banners/_guard';
import { getMedia } from '../../media/_store';
import { findPopup, popupState, renumberPopups, toAdminPopup } from '../_store';

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => mockError(404, 'POPUP_NOT_FOUND', ERROR_MESSAGES.POPUP_NOT_FOUND);

// GET /api/v1/admin/popups/:id
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req, 100);
  const popup = findPopup((await ctx.params).id);
  return popup ? mockJson(toAdminPopup(popup)) : notFound();
}

// PATCH /api/v1/admin/popups/:id — partial body; the merged record must satisfy popupInputSchema.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 250);
  const popup = findPopup((await ctx.params).id);
  if (!popup) return notFound();
  const body = await readJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.');
  const current = {
    title: popup.title,
    mediaId: popup.mediaId,
    linkUrl: popup.linkUrl ?? undefined,
    newWindow: popup.newWindow,
    targetPages: popup.targetPages,
    startAt: popup.startAt,
    endAt: popup.endAt,
    paused: popup.paused,
    dismissDays: popup.dismissDays,
  };
  const merged = Object.fromEntries(
    Object.entries({ ...current, ...(body as Record<string, unknown>) }).filter(
      ([, v]) => v !== null,
    ),
  );
  const parsed = popupInputSchema.safeParse(merged);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  if (!getMedia(input.mediaId))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'mediaId', message: '이미지를 다시 올려 주세요.' },
    ]);
  Object.assign(popup, {
    title: input.title,
    mediaId: input.mediaId,
    linkUrl: input.linkUrl ?? null,
    newWindow: input.newWindow,
    targetPages: input.targetPages,
    startAt: input.startAt,
    endAt: input.endAt,
    paused: input.paused,
    dismissDays: input.dismissDays,
    updatedAt: new Date().toISOString(),
  });
  return mockJson(toAdminPopup(popup));
}

// DELETE /api/v1/admin/popups/:id → 204
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 250);
  const popup = findPopup((await ctx.params).id);
  if (!popup) return notFound();
  const state = popupState();
  state.popups = state.popups.filter((p) => p.id !== popup.id);
  renumberPopups();
  return new Response(null, { status: 204 });
}
