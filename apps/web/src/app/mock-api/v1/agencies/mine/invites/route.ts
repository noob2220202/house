import { agencyInviteCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockForbidden, mockJson } from '@/lib/mock';
import {
  agencyContext,
  agencyNotFound,
  inviteView,
  newInviteCode,
  newInviteId,
  readJson,
  validationError,
  type MockInvite,
} from '../_store';

const MAX_OPEN_INVITES = 10;
const HOUR = 3_600_000;

/** GET /api/v1/agencies/mine/invites — AGENCY_OWNER only; open invites without their codes. */
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const now = new Date().toISOString();
  return mockJson(ctx.state.invites.filter((i) => i.expiresAt > now).map(inviteView));
}

/**
 * POST /api/v1/agencies/mine/invites — `agencyInviteCreateSchema` (`{ label?, expiresInHours }`,
 * default 72 h) → 201 `AgencyInviteView` WITH the one-time `code` (never returned again).
 */
export async function POST(req: NextRequest) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 400);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const parsed = agencyInviteCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const now = Date.now();
  const open = ctx.state.invites.filter((i) => Date.parse(i.expiresAt) > now);
  if (open.length >= MAX_OPEN_INVITES) {
    return mockError(
      409,
      'AGENCY_INVITE_LIMIT',
      `초대 코드는 한 번에 ${MAX_OPEN_INVITES}개까지 만들 수 있습니다.`,
    );
  }
  const code = newInviteCode();
  const invite: MockInvite = {
    id: newInviteId(),
    code,
    codeHint: code.slice(-4),
    label: parsed.data.label ?? null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + parsed.data.expiresInHours * HOUR).toISOString(),
  };
  ctx.state.invites = [...open, invite];
  return mockJson({ ...inviteView(invite), code }, { status: 201 });
}
