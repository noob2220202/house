import { AgencySiteStatus, agencySiteRequestSchema, agencySiteUpdateSchema } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import { mockDelay, mockError, mockForbidden, mockJson } from '@/lib/mock';
import {
  MOCK_OWNER_OFFICE,
  mineSiteResponse,
  newOwnerSiteRow,
  saveOwnerSite,
  siteRowOf,
  slugTaken,
} from '../../../sites/_state';
import {
  agencyContext,
  agencyNotFound,
  readJson,
  validationError,
  type MockAgencyContext,
} from '../_store';

/**
 * Preamble of the 사무소 홈페이지 handlers: an ACTIVE member (AGENT / AGENCY_OWNER) of an APPROVED
 * office; `owner` = writes (AGENCY_OWNER only).
 */
async function siteContext(
  req: NextRequest,
  { owner = false, mutation = false } = {},
): Promise<NextResponse | MockAgencyContext> {
  const ctx = agencyContext(req, { mutation });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, mutation ? 400 : 150);
  if (ctx.role === 'USER') return mockForbidden();
  if (!ctx.agency) return agencyNotFound();
  if (ctx.agency.status !== 'APPROVED') {
    return mockError(403, 'AGENCY_NOT_APPROVED', '승인된 중개사무소만 이용할 수 있습니다.');
  }
  if (owner && !ctx.isOwner) return mockForbidden();
  return ctx;
}

// GET /api/v1/agencies/mine/site — `MyAgencySiteResponse` (owner and staff).
export async function GET(req: NextRequest) {
  const ctx = await siteContext(req);
  if (!('state' in ctx)) return ctx;
  return mockJson(mineSiteResponse(ctx.agency!.id));
}

// POST /api/v1/agencies/mine/site `{ slug, color?, tagline? }` — request / re-request / change a
// pending request (→ REQUESTED, 200). ACTIVE / SUSPENDED → 409 AGENCY_SITE_ALREADY_ACTIVE.
export async function POST(req: NextRequest) {
  const ctx = await siteContext(req, { owner: true, mutation: true });
  if (!('state' in ctx)) return ctx;
  const parsed = agencySiteRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const { slug, color, tagline } = parsed.data;
  const current = siteRowOf(MOCK_OWNER_OFFICE);
  if (
    current &&
    (current.status === AgencySiteStatus.ACTIVE || current.status === AgencySiteStatus.SUSPENDED)
  ) {
    return mockError(409, 'AGENCY_SITE_ALREADY_ACTIVE', '이미 운영 중인 홈페이지가 있습니다.');
  }
  if (slugTaken(slug, MOCK_OWNER_OFFICE)) {
    return mockError(409, 'AGENCY_SITE_SLUG_DUPLICATE', '이미 사용 중인 홈페이지 주소입니다.', [
      { path: 'slug', message: '이미 다른 사무소가 쓰고 있는 주소예요.' },
    ]);
  }
  const now = new Date().toISOString();
  saveOwnerSite(
    newOwnerSiteRow({
      ...(current ?? { createdAt: now }),
      status: AgencySiteStatus.REQUESTED,
      slug: null,
      requestedSlug: slug,
      color: color ?? current?.color ?? 'BLUE',
      tagline: tagline === undefined ? (current?.tagline ?? null) : tagline,
      requestedAt: now,
      decidedAt: null,
      decisionReason: null,
      updatedAt: now,
    }),
  );
  return mockJson(mineSiteResponse(ctx.agency!.id));
}

// PATCH /api/v1/agencies/mine/site `{ color?, tagline? }` — any status; 404 before a request.
export async function PATCH(req: NextRequest) {
  const ctx = await siteContext(req, { owner: true, mutation: true });
  if (!('state' in ctx)) return ctx;
  const parsed = agencySiteUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  const current = siteRowOf(MOCK_OWNER_OFFICE);
  if (!current) {
    return mockError(404, 'AGENCY_SITE_NOT_FOUND', '사무소 홈페이지를 찾을 수 없습니다.');
  }
  const { color, tagline } = parsed.data;
  saveOwnerSite({
    ...current,
    color: color ?? current.color,
    tagline: tagline === undefined ? current.tagline : tagline,
    updatedAt: new Date().toISOString(),
  });
  return mockJson(mineSiteResponse(ctx.agency!.id));
}
