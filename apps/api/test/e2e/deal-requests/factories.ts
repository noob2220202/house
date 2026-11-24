import {
  AgencyMemberRole,
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  DEFAULT_SGG_CODE,
  UserRole,
} from '@house/shared';
import type { Agency, DealRequest, Prisma, User } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';
import { DEAL_REQUESTS_QUEUE } from '../../../src/modules/deal-requests/constants';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import {
  actionConsents,
  createAgency,
  createTestApp,
  createUser,
  loginUser,
  type TestApp,
  type TestSession,
} from '../../utils';

export const EMD = `${DEFAULT_SGG_CODE}10100`;

/** Records enqueued jobs instead of handing them to the worker. */
export interface RecordingQueue {
  readonly jobs: { name: string; data: unknown; opts: unknown }[];
}

/**
 * App for this module's suites. `queue.add` is stubbed to record jobs instead of handing them to the
 * background worker, so a fan-out never races the next test's TRUNCATE; specs call
 * DealRequestMaintenanceService directly.
 */
export async function createDealRequestsApp(
  override?: (b: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<{ t: TestApp; queue: RecordingQueue }> {
  const t = await createTestApp(override ? { override } : {});
  const recorder: RecordingQueue = { jobs: [] };
  const real = t.app.get<Queue>(getQueueToken(DEAL_REQUESTS_QUEUE));
  jest.spyOn(real, 'add').mockImplementation((name, data, opts) => {
    recorder.jobs.push({ name, data: data as unknown, opts });
    return Promise.resolve({ id: String(recorder.jobs.length) } as Job);
  });
  return { t, queue: recorder };
}

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
    { agencyId: agency.id },
  );
  return { agency, user: owner, s };
}

/** An AGENT member of `agency`, logged in. */
export async function agent(t: TestApp, agency: Agency): Promise<{ user: User; s: TestSession }> {
  const user = await createUser(t.prisma, { role: UserRole.AGENT });
  await t.prisma.agencyMember.create({
    data: {
      agencyId: agency.id,
      userId: user.id,
      role: AgencyMemberRole.AGENT,
      displayName: '김중개',
    },
  });
  const s = await loginUser(t.app, { id: user.id, role: UserRole.AGENT }, { agencyId: agency.id });
  return { user, s };
}

export async function requester(t: TestApp): Promise<{ user: User; s: TestSession }> {
  const user = await createUser(t.prisma);
  return { user, s: await loginUser(t.app, { id: user.id }) };
}

export function sellBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: DealRequestType.SELL_OR_LEASE,
    assetType: AssetType.APT,
    dealTypes: [DealType.SALE],
    visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
    contactName: '홍길동',
    contactPhone: '010-1234-5678',
    roadAddress: '전남광주통합특별시 순천시 중앙로 1',
    addressDetail: '101동 1001호',
    emdCode: EMD,
    lat: 34.95,
    lng: 127.48,
    exclusiveArea: 84.97,
    floor: 7,
    desiredSalePrice: 30000,
    moveInDate: '2027-01-15',
    description: '남향, 올수리',
    consents: actionConsents('DEAL_REQUEST'),
    ...over,
  };
}

export function wantedBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: DealRequestType.WANTED,
    assetType: AssetType.ONEROOM,
    dealTypes: [DealType.MONTHLY],
    visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
    contactName: '김철수',
    contactPhone: '01098765432',
    regionCodes: [EMD],
    depositMin: 300,
    depositMax: 1000,
    rentMax: 50,
    consents: actionConsents('DEAL_REQUEST'),
    ...over,
  };
}

/** Inserts a request directly (no API, no cap/throttle). */
export async function dealRequest(
  prisma: PrismaService,
  userId: string,
  data: Partial<Prisma.DealRequestUncheckedCreateInput> = {},
): Promise<DealRequest> {
  return prisma.dealRequest.create({
    data: {
      type: DealRequestType.SELL_OR_LEASE,
      userId,
      status: DealRequestStatus.OPEN,
      assetType: AssetType.APT,
      dealTypes: [DealType.SALE],
      visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
      sggCode: DEFAULT_SGG_CODE,
      contactName: '홍길동',
      contactPhone: '01012345678',
      roadAddress: '전남광주통합특별시 순천시 중앙로 1',
      addressDetail: '101동 1001호',
      desiredSalePrice: 30000,
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
      ...data,
    },
  });
}

/** Proposal row inserted directly. */
export async function proposal(
  prisma: PrismaService,
  dealRequestId: string,
  agencyId: string,
  data: Partial<Prisma.ProposalUncheckedCreateInput> = {},
) {
  const p = await prisma.proposal.create({
    data: { dealRequestId, agencyId, message: '좋은 매물 있습니다.', ...data },
  });
  await prisma.dealRequest.update({
    where: { id: dealRequestId },
    data: { proposalCount: { increment: 1 } },
  });
  return p;
}

export const errorCode = (res: { body: { code?: unknown } }): unknown => res.body.code;

/** Ids of a paginated / cursor response body (supertest bodies are untyped). */
export function itemIds(body: unknown): string[] {
  return ((body as { items?: { id: string }[] }).items ?? []).map((i) => i.id);
}

/** Paths of a VALIDATION_FAILED body's issues. */
export function issuePaths(body: unknown): string[] {
  return ((body as { details?: { path: string }[] }).details ?? []).map((d) => d.path);
}
