import type { NextRequest } from 'next/server';
import { inviteMemberPayloadSchema, type AgencyMember } from '@/features/a-agency/api/schemas';
import { mockDelay, mockError, mockForbidden, mockJson } from '@/lib/mock';
import {
  agencyContext,
  agencyNotFound,
  mockId,
  newInviteCode,
  readJson,
  validationError,
} from '../_store';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 20;

// GET /api/v1/agencies/mine/members — AGENCY_OWNER only. `{ items }` of ACTIVE + INVITED members.
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  return mockJson({ items: ctx.state.members.filter((m) => m.status !== 'REMOVED') });
}

/**
 * POST /api/v1/agencies/mine/members — invite a staff member. Body (ASSUMED):
 * `{ displayName, title?, isLicensed, licenseNumber?, phone? }` → INVITED member with a one-time
 * `inviteCode` (valid 7 days) that the invitee enters on /agent/apply (POST /agencies/join).
 */
export async function POST(req: NextRequest) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 400);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  // Strict like the API: blank optional fields must be omitted, never sent as ''.
  const parsed = inviteMemberPayloadSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  if (ctx.state.members.filter((m) => m.status !== 'REMOVED').length >= MAX_MEMBERS) {
    return mockError(409, 'AGENCY_MEMBER_LIMIT', `직원은 ${MAX_MEMBERS}명까지 등록할 수 있습니다.`);
  }
  const input = parsed.data;
  const member: AgencyMember = {
    id: mockId('mem'),
    userId: null,
    role: 'AGENT',
    status: 'INVITED',
    displayName: input.displayName,
    title: input.title ?? null,
    // phoneSchema already normalised it to digits.
    phone: input.phone ?? null,
    isLicensed: input.isLicensed,
    licenseNumber: input.isLicensed ? (input.licenseNumber ?? null) : null,
    joinedAt: null,
    inviteCode: newInviteCode(),
    inviteExpiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    activeListingCount: 0,
  };
  ctx.state.members = [...ctx.state.members, member];
  return mockJson(member, { status: 201 });
}
