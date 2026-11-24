import type { NextRequest } from 'next/server';
import {
  MOCK_ADMIN_NAME,
  isBlocked,
  modGate,
  nowIso,
  readBody,
  readText,
  validationError,
} from '@/features/m-moderation/mock/handler';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { reportsDb } from '../reports/_fixtures';
import { addListingHistory, hideListing, listingsDb } from './_fixtures';

/**
 * Moderator actions on a listing (mock of the ASSUMED endpoints):
 *  - hide    { reason }  ACTIVE | RESERVED → HIDDEN (removed from the public site, reason sent to the offices)
 *  - unhide  { reason? } HIDDEN → ACTIVE
 *  - close   { reason }  ACTIVE | RESERVED | HIDDEN → CLOSED (force close; cannot be re-opened by the office)
 */
export async function moderateListingMock(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
  action: 'hide' | 'unhide' | 'close',
) {
  const gate = await modGate(req, { mutation: true });
  if (isBlocked(gate)) return gate;
  const { id } = await ctx.params;
  const listing = listingsDb().find((l) => l.id === id);
  if (!listing) return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  const reason = readText(await readBody(req), 'reason');
  const admin = MOCK_ADMIN_NAME[gate.role];
  const conflict = () =>
    mockError(
      409,
      'LISTING_STATUS_CONFLICT',
      '현재 상태에서는 처리할 수 없습니다. 새로고침 후 다시 확인해 주세요.',
    );

  if (action !== 'unhide' && reason.length < 5)
    return validationError('reason', '사유를 5자 이상 입력해 주세요.');
  if (reason.length > 500) return validationError('reason', '사유는 500자 이내로 입력해 주세요.');

  if (action === 'hide') {
    if (listing.status !== 'ACTIVE' && listing.status !== 'RESERVED') return conflict();
    hideListing(listing, reason, admin);
  } else if (action === 'unhide') {
    if (listing.status !== 'HIDDEN') return conflict();
    listing.status = 'ACTIVE';
    listing.hiddenReason = null;
    addListingHistory(listing, {
      action: 'LISTING_UNHIDDEN',
      actorType: 'ADMIN',
      actorName: admin,
      note: reason || null,
    });
  } else {
    if (listing.status === 'CLOSED' || listing.status === 'DRAFT') return conflict();
    listing.status = 'CLOSED';
    listing.closedAt = nowIso();
    listing.expiresAt = null;
    addListingHistory(listing, {
      action: 'LISTING_FORCE_CLOSED',
      actorType: 'ADMIN',
      actorName: admin,
      note: reason,
    });
  }
  const reports = reportsDb()
    .filter((r) => r.listingId === id)
    .map((r) => ({ id: r.id, reason: r.reason, status: r.status, createdAt: r.createdAt }));
  return mockJson({ ...listing, reports });
}
