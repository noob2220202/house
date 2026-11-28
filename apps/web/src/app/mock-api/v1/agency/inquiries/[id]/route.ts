import { agencyInquiryDeleteSchema, agencyInquiryUpdateSchema } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import {
  MEMBER_NAME,
  agencyInquiryView,
  findOfficeInquiry,
  forcedFailure,
  inquiryNotFound,
  validationFailed,
} from '../../../inquiries/_store';
import { agencyGuard } from '../../deal-requests/_store';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/agency/inquiries/:id — one inquiry with its thread; other offices' rows → 404. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 200);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const { id } = await ctx.params;
  const found = findOfficeInquiry(id);
  return found ? mockJson(agencyInquiryView(found, true)) : inquiryNotFound();
}

/**
 * PATCH /api/v1/agency/inquiries/:id `{ status?, memo?, read? }` (`agencyInquiryUpdateSchema`).
 * A status change records the caller as the handler. → the updated inquiry (with its thread).
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const { id } = await ctx.params;
  const found = findOfficeInquiry(id);
  if (!found) return inquiryNotFound();
  const parsed = agencyInquiryUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const body = parsed.data;
  const now = new Date().toISOString();
  if (body.status !== undefined && body.status !== found.status) {
    found.status = body.status;
    found.handledByName = MEMBER_NAME[g.role];
  }
  if (body.memo !== undefined) found.memo = body.memo;
  if (body.read === true) found.readAt ??= now;
  if (body.read === false) found.readAt = null;
  found.updatedAt = now;
  return mockJson(agencyInquiryView(found, true));
}

/** DELETE /api/v1/agency/inquiries/:id `{ reason? }` — soft delete (스팸 처리 / 정리). → 204. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const { id } = await ctx.params;
  const found = findOfficeInquiry(id);
  if (!found) return inquiryNotFound();
  const text = await req.text().catch(() => '');
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : undefined;
  } catch {
    raw = undefined;
  }
  const parsed = agencyInquiryDeleteSchema.safeParse(raw);
  if (!parsed.success) return validationFailed(parsed.error.issues);
  found.deletedAt = new Date().toISOString();
  found.deleteReason = parsed.data.reason ?? null;
  return new NextResponse(null, { status: 204 });
}
