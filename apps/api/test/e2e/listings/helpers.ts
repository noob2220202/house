import {
  AgencyMemberRole,
  AssetType,
  DealType,
  Direction,
  DirectionBasis,
  ListingStatus,
  MoveInType,
  UserRole,
} from '@house/shared';
import type { Agency, User } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import {
  createAgency,
  createListing,
  createUser,
  loginUser,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';

/** 법정동코드 inside 순천시 (46150). */
export const EMD_CODE = '4615010400';
export const OTHER_EMD_CODE = '4615010500';

export interface AgencyCtx {
  agency: Agency;
  owner: User;
  ownerSession: TestSession;
}

export async function agencyWithOwner(
  t: TestApp,
  data: Partial<Prisma.AgencyUncheckedCreateInput> = {},
): Promise<AgencyCtx> {
  const { agency, owner } = await createAgency(t.prisma, data);
  const ownerSession = await loginUser(
    t.app,
    { id: owner.id, role: UserRole.AGENCY_OWNER },
    { agencyId: agency.id },
  );
  return { agency, owner, ownerSession };
}

/** An AGENT staff member of `agencyId` with a session acting for that agency. */
export async function agentOf(
  t: TestApp,
  agencyId: string,
  opts: { status?: 'ACTIVE' | 'REMOVED' } = {},
): Promise<{ user: User; memberId: string; session: TestSession }> {
  const user = await createUser(t.prisma, { role: UserRole.AGENT });
  const member = await t.prisma.agencyMember.create({
    data: {
      agencyId,
      userId: user.id,
      role: AgencyMemberRole.AGENT,
      displayName: '김중개',
      phone: '01022223333',
      status: opts.status ?? 'ACTIVE',
    },
  });
  const session = await loginUser(t.app, { id: user.id, role: UserRole.AGENT }, { agencyId });
  return { user, memberId: member.id, session };
}

/** A draft payload that satisfies every 표시·광고 명시사항 for an apartment sale. */
export function publishablePayload(overrides: Record<string, unknown> = {}) {
  const { property, ...rest } = overrides as { property?: Record<string, unknown> };
  return {
    dealType: DealType.SALE,
    title: '남향 로얄층 올수리',
    description: '역세권, 학군 우수',
    salePrice: 35_000,
    maintenanceFeeWon: 150_000,
    moveInType: MoveInType.IMMEDIATE,
    options: ['ELEVATOR', 'PARKING'],
    ...rest,
    property: {
      assetType: AssetType.APT,
      roadAddress: '전라남도 순천시 연향로 100',
      jibunAddress: '전라남도 순천시 연향동 1500',
      buildingName: '테스트아파트',
      emdCode: EMD_CODE,
      lat: 34.95,
      lng: 127.49,
      dong: '101',
      ho: '1203',
      floor: 12,
      totalFloors: 20,
      exclusiveArea: 84.97,
      supplyArea: 112.4,
      rooms: 3,
      baths: 2,
      direction: Direction.SOUTH,
      directionBasis: DirectionBasis.LIVING_ROOM,
      approvalDate: '2015-06-30',
      parkingSpaces: 1,
      ...property,
    },
  };
}

export async function createDraft(
  t: TestApp,
  session: TestSession,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const res = await withSession(t.http().post('/api/v1/agency/listings'), session)
    .send(publishablePayload(overrides))
    .expect(201);
  return (res.body as { id: string }).id;
}

export async function createPublished(
  t: TestApp,
  session: TestSession,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const id = await createDraft(t, session, overrides);
  await withSession(t.http().post(`/api/v1/agency/listings/${id}/publish`), session).expect(200);
  return id;
}

/** Direct DB listing (bypasses the API) — for search fixtures. */
export async function seedListing(
  t: TestApp,
  agencyId: string,
  opts: {
    property?: Partial<Prisma.PropertyUncheckedCreateInput>;
    listing?: Partial<Prisma.ListingUncheckedCreateInput>;
  } = {},
) {
  return createListing(t.prisma, {
    agencyId,
    property: { emdCode: EMD_CODE, ho: '999', ...opts.property },
    listing: { status: ListingStatus.ACTIVE, emdCode: EMD_CODE, ...opts.listing },
  });
}

export const NIL_UUID = '00000000-0000-7000-8000-000000000000';
