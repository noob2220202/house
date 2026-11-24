import { randomUUID } from 'node:crypto';
import { BannerSlot, BannerStatus, bannerInputSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson, mockPaginate } from '@/lib/mock';
import { agencyById } from '../../agencies/_fixtures';
import { adminGuard, readJson, validationError } from './_guard';
import { checkBannerInput } from './_rules';
import {
  bannerState,
  SLOT_ORDER,
  slotBanners,
  statusOf,
  toAdminBanner,
  type MockBanner,
} from './_store';

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const SLOTS = Object.values(BannerSlot) as string[];
const STATUSES = Object.values(BannerStatus) as string[];

// GET /api/v1/admin/banners?slot&status&q&page&pageSize — every banner (any status), ordered by
// slot then sortOrder. `status` filters on the computed status.
export async function GET(req: NextRequest) {
  const denied = adminGuard(req);
  if (denied) return denied;
  await mockDelay(req);
  const sp = req.nextUrl.searchParams;
  const slot = sp.get('slot');
  const status = sp.get('status');
  const q = squash(sp.get('q') ?? '');
  if ((slot && !SLOTS.includes(slot)) || (status && !STATUSES.includes(status)))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: slot && !SLOTS.includes(slot) ? 'slot' : 'status', message: '올바른 값이 아닙니다.' },
    ]);
  const rows = bannerState()
    .banners.filter((b) => !slot || b.slot === slot)
    .filter((b) => !status || statusOf(b) === status)
    .filter(
      (b) =>
        !q ||
        squash(b.title).includes(q) ||
        squash(b.advertiserName ?? '').includes(q) ||
        squash(b.code).includes(q),
    )
    .sort(
      (a, b) =>
        SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.sortOrder - b.sortOrder,
    );
  const page = mockPaginate(rows, req, { pageSize: 20 });
  return mockJson({ ...page, items: page.items.map(toAdminBanner) });
}

// POST /api/v1/admin/banners — body = bannerInputSchema. New banners go to the end of their slot.
export async function POST(req: NextRequest) {
  const denied = adminGuard(req, { mutation: true });
  if (denied) return denied;
  await mockDelay(req, 300);
  const parsed = bannerInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;
  const invalid = checkBannerInput(input);
  if (invalid) return invalid;

  const state = bannerState();
  state.seq += 1;
  const now = new Date().toISOString();
  const banner: MockBanner = {
    id: randomUUID(),
    code: `AD-${state.seq}`,
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
    sortOrder: slotBanners(input.slot).length + 1,
    targeting: input.targeting,
    targetRegionCodes: input.targetRegionCodes,
    targetComplexIds: input.targetComplexIds,
    memo: input.memo ?? null,
    createdAt: now,
    updatedAt: now,
    totals: { impressions: 0, clicks: 0 },
  };
  state.banners.push(banner);
  return mockJson(toAdminBanner(banner), { status: 201 });
}
