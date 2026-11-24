import { BannerSlot, type BannerSlot as Slot } from '@house/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { mockDelay, mockJson, mockNotFound } from '@/lib/mock';
import { adminGuard, readJson, validationError } from '../../banners/_guard';
import { bannerState } from '../../banners/_store';
import { toSlotRow } from '../_slots';

const bodySchema = z.object({ maxActive: z.int().min(1).max(50) });
const isSlot = (value: string): value is Slot =>
  (Object.values(BannerSlot) as string[]).includes(value);

type Ctx = { params: Promise<{ slot: string }> };

// GET /api/v1/admin/banner-slots/:slot
export async function GET(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req);
  if (denied) return denied;
  const { slot } = await ctx.params;
  return isSlot(slot) ? mockJson(toSlotRow(slot)) : mockNotFound();
}

// PATCH /api/v1/admin/banner-slots/:slot — `{ maxActive }` (ADMIN+). Lowering the limit below the
// number of live banners does not pause anything; it only blocks further activations.
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const denied = adminGuard(req, { mutation: true, minRole: 'ADMIN' });
  if (denied) return denied;
  await mockDelay(req, 250);
  const { slot } = await ctx.params;
  if (!isSlot(slot)) return mockNotFound();
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  bannerState().maxActive[slot] = parsed.data.maxActive;
  return mockJson(toSlotRow(slot));
}
