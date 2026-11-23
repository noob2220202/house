import { AgencyStatus } from '@house/shared';
import { AgenciesService } from '../../../src/modules/agencies/services/agencies.service';
import { createAgency, createTestApp, createUser, resetAll, type TestApp } from '../../utils';
import { createAgent, createPendingAgency } from './helpers';

/** The exported AgenciesService contract other modules (listings, deal-requests, admin) rely on. */
describe('agencies: AgenciesService (e2e, real DB)', () => {
  let t: TestApp;
  let svc: AgenciesService;

  beforeAll(async () => {
    t = await createTestApp();
    svc = t.app.get(AgenciesService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('assertActiveMember: active members of approved agencies pass, others are refused', async () => {
    const { agency, owner } = await createAgency(t.prisma);
    const { user: agent, memberId } = await createAgent(t.prisma, agency.id);
    await expect(svc.assertActiveMember(agent.id, agency.id)).resolves.toMatchObject({
      memberId,
      role: 'AGENT',
      agencyStatus: 'APPROVED',
    });
    await expect(
      svc.assertActiveMember(agent.id, agency.id, { requireOwner: true }),
    ).rejects.toMatchObject({ code: 'AGENCY_MEMBERSHIP_REQUIRED' });
    await expect(
      svc.assertActiveMember(owner.id, agency.id, { requireOwner: true }),
    ).resolves.toMatchObject({ role: 'OWNER' });

    const stranger = await createUser(t.prisma);
    await expect(svc.assertActiveMember(stranger.id, agency.id)).rejects.toMatchObject({
      code: 'AGENCY_MEMBERSHIP_REQUIRED',
    });
    await expect(svc.assertActiveMember(agent.id, null)).rejects.toMatchObject({
      code: 'AGENCY_MEMBERSHIP_REQUIRED',
    });

    const pending = await createPendingAgency(t.prisma);
    await expect(svc.assertActiveMember(pending.owner.id, pending.agency.id)).rejects.toMatchObject(
      { code: 'AGENCY_NOT_APPROVED' },
    );
    await expect(
      svc.assertActiveMember(pending.owner.id, pending.agency.id, { requireApproved: false }),
    ).resolves.toMatchObject({ agencyStatus: 'PENDING' });
    expect(await svc.findActiveMember(agency.id, memberId)).toMatchObject({ id: memberId });
    expect(await svc.findActiveMember(pending.agency.id, memberId)).toBeNull();
  });

  it('disclosure: approved agencies only, batch without N+1', async () => {
    const { agency } = await createAgency(t.prisma, { addressDetail: '2층' });
    const suspended = await createAgency(t.prisma, { status: AgencyStatus.SUSPENDED });
    const d = await svc.getDisclosure(agency.id);
    expect(d).toEqual({
      agencyId: agency.id,
      name: agency.name,
      address: `${agency.roadAddress} 2층`,
      roadAddress: `${agency.roadAddress} 2층`,
      phone: agency.phone,
      registrationNumber: agency.registrationNumber,
      representativeName: agency.representativeName,
    });
    expect(await svc.getDisclosure(suspended.agency.id)).toBeNull();
    const map = await svc.getDisclosures([agency.id, suspended.agency.id, agency.id]);
    expect([...map.keys()]).toEqual([agency.id]);
    expect(await svc.isApproved(agency.id)).toBe(true);
    expect(await svc.isApproved(suspended.agency.id)).toBe(false);
  });

  it('recordWarning: stores the warning, bumps the counter and notifies the owner', async () => {
    const { agency, owner } = await createAgency(t.prisma);
    const w = await svc.recordWarning({ agencyId: agency.id, reason: '허위매물 신고 확인' });
    expect(w.id).toEqual(expect.any(String));
    const row = await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } });
    expect(row.warningCount).toBe(1);
    const n = await t.prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
    expect(n).toMatchObject({ type: 'AGENCY_WARNED', body: '허위매물 신고 확인' });
    await expect(
      svc.recordWarning({ agencyId: '0190f3c2-7a4b-7cde-8f00-123456789abc', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'AGENCY_NOT_FOUND' });
  });
});
