import { AgencyMemberRole, InquiryChannel, InquirySource, UserRole } from '@house/shared';
import type { Agency, Inquiry, Prisma, User } from '@prisma/client';
import type { Test } from 'supertest';
import {
  actionConsents,
  createAgency,
  createListing,
  createUser,
  loginUser,
  type TestApp,
  type TestSession,
} from '../../utils';

export interface Broker {
  agency: Agency;
  user: User;
  s: TestSession;
}

/** Approved agency + its owner logged in as AGENCY_OWNER acting for it. */
export async function broker(
  t: TestApp,
  data: Partial<Prisma.AgencyUncheckedCreateInput> = {},
): Promise<Broker> {
  const { agency, owner } = await createAgency(t.prisma, data);
  const s = await loginUser(
    t.app,
    { id: owner.id, role: UserRole.AGENCY_OWNER },
    {
      agencyId: agency.id,
    },
  );
  return { agency, user: owner, s };
}

/** An AGENT member (ACTIVE) of the agency, logged in for it. */
export async function agent(
  t: TestApp,
  agency: Agency,
  displayName = '김중개',
): Promise<{ user: User; s: TestSession; memberId: string }> {
  const user = await createUser(t.prisma, { role: UserRole.AGENT });
  const m = await t.prisma.agencyMember.create({
    data: { agencyId: agency.id, userId: user.id, role: AgencyMemberRole.AGENT, displayName },
  });
  const s = await loginUser(t.app, { id: user.id, role: UserRole.AGENT }, { agencyId: agency.id });
  return { user, s, memberId: m.id };
}

/** A plain member (customer) logged in on the main site. */
export async function customer(
  t: TestApp,
  data: Partial<Prisma.UserUncheckedCreateInput> = {},
): Promise<{ user: User; s: TestSession }> {
  const user = await createUser(t.prisma, data);
  return { user, s: await loginUser(t.app, user) };
}

/** A public (ACTIVE) listing whose primary agency is `agencyId`. */
export async function publicListing(
  t: TestApp,
  agencyId: string,
  listing: Partial<Prisma.ListingUncheckedCreateInput> = {},
) {
  return (
    await createListing(t.prisma, { agencyId, listing: { title: '남향 로얄층', ...listing } })
  ).listing;
}

/** Body of POST /inquiries (guest-valid: has a phone and the INQUIRY consent). */
export function inquiryBody(agencyId: string, patch: Record<string, unknown> = {}) {
  return {
    agencyId,
    name: '홍길동',
    phone: '010-1234-5678',
    message: '이 매물 아직 있나요? 주말에 보고 싶어요.',
    source: InquirySource.MAIN,
    consents: actionConsents('INQUIRY'),
    ...patch,
  };
}

let ipSeq = 10;
/** A fresh documentation-range client address (each guest has its own throttle / cap bucket). */
export function nextIp(): string {
  ipSeq += 1;
  return `198.51.100.${ipSeq % 250}`;
}

/** An anonymous request from `ip` (nginx-style X-Forwarded-For; the test peer is loopback). */
export function asGuest(req: Test, ip: string): Test {
  return req.set('X-Forwarded-For', ip);
}

/** A row written directly (no API, no throttle / cap). */
export function seedInquiry(
  t: TestApp,
  agencyId: string,
  data: Partial<Prisma.InquiryUncheckedCreateInput> = {},
): Promise<Inquiry> {
  return t.prisma.inquiry.create({
    data: {
      agencyId,
      channel: InquiryChannel.MESSAGE,
      source: InquirySource.MAIN,
      customerName: '홍길동',
      customerPhone: '01012345678',
      message: '문의 드려요.',
      lastMessageAt: new Date(),
      ...data,
    },
  });
}

/** Paths of a VALIDATION_FAILED body's issues. */
export function issuePaths(body: unknown): string[] {
  return ((body as { details?: { path: string }[] }).details ?? []).map((d) => d.path);
}

export function itemIds(body: unknown): string[] {
  return ((body as { items?: { id: string }[] }).items ?? []).map((i) => i.id);
}
