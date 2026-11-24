import { ERROR_MESSAGES, bannerCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyById } from '../../../agencies/_fixtures';
import { adminGuard, readJson, validationError } from '../_guard';
import { checkBannerInput } from '../_rules';
import { bannerState, findBanner, renumberSlot, slotBanners, toAdminBanner } from '../_store';

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => mockError(404, 'BANNER_NOT_FOUND', ERROR_MESSAGES.BANNER_NOT_FOUND);

// GET /api/v1/admin/banners/:id
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req, 100);
  const banner = findBanner((await ctx.params).id);
  return banner ? mockJson(toAdminBanner(banner)) : notFound();
}

// PATCH /api/v1/admin/banners/:id — partial body (the status toggle sends only `{ paused }`); the
// merged record must satisfy bannerCreateSchema.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 250);
  const banner = findBanner((await ctx.params).id);
  if (!banner) return notFound();
  const body = await readJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.');
  const patch = body as Record<string, unknown>;
  const has = (key: string) => Object.prototype.hasOwnProperty.call(patch, key);
  const current = {
    slot: banner.slot,
    title: banner.title,
    advertiserName: banner.advertiserName ?? undefined,
    agencyId: banner.agencyId ?? undefined,
    pcMediaId: banner.pcMediaId,
    mobileMediaId: banner.mobileMediaId ?? undefined,
    linkUrl: banner.linkUrl ?? undefined,
    newWindow: banner.newWindow,
    startAt: banner.startAt,
    endAt: banner.endAt,
    paused: banner.paused,
    priority: banner.priority,
    targeting: banner.targeting,
    targetRegionCodes: banner.targetRegionCodes,
    targetComplexIds: banner.targetComplexIds,
    memo: banner.memo ?? undefined,
  };
  // `null` clears an optional field (agencyId, mobileMediaId, linkUrl, memo, advertiserName).
  const merged = Object.fromEntries(
    Object.entries({ ...current, ...patch }).filter(([, v]) => v !== null),
  );
  const parsed = bannerCreateSchema.safeParse(merged);
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const invalid = checkBannerInput(input, banner);
  if (invalid) return invalid;

  const previousSlot = banner.slot;
  Object.assign(banner, {
    slot: input.slot,
    title: input.title,
    advertiserName: input.advertiserName || agencyById(input.agencyId)?.name || null,
    agencyId: input.agencyId ?? null,
    pcMediaId: input.pcMediaId,
    mobileMediaId: input.mobileMediaId ?? null,
    linkUrl: input.linkUrl ?? null,
    newWindow: input.newWindow,
    startAt: input.startAt,
    endAt: input.endAt,
    paused: input.paused,
    priority: input.priority,
    targeting: input.targeting,
    targetRegionCodes: input.targetRegionCodes,
    targetComplexIds: input.targetComplexIds,
    memo: has('memo') ? (input.memo ?? null) : banner.memo,
    updatedAt: new Date().toISOString(),
  });
  if (previousSlot !== banner.slot) {
    banner.sortOrder = slotBanners(banner.slot).length + 1;
    renumberSlot(previousSlot);
    renumberSlot(banner.slot);
  }
  return mockJson(toAdminBanner(banner));
}

// DELETE /api/v1/admin/banners/:id → 204
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 250);
  const banner = findBanner((await ctx.params).id);
  if (!banner) return notFound();
  const state = bannerState();
  state.banners = state.banners.filter((b) => b.id !== banner.id);
  renumberSlot(banner.slot);
  return new Response(null, { status: 204 });
}
