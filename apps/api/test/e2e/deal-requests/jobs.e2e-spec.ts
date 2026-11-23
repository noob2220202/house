import {
  AgencyStatus,
  DealRequestStatus,
  MediaPurpose,
  DealRequestVisibility,
  NotificationType,
  UserStatus,
} from '@house/shared';
import type { Job } from 'bullmq';
import { DEAL_REQUEST_JOBS } from '../../../src/modules/deal-requests/constants';
import { DealRequestsProcessor } from '../../../src/modules/deal-requests/jobs/deal-requests.processor';
import { DealRequestMaintenanceService } from '../../../src/modules/deal-requests/services/deal-request-maintenance.service';
import { createAgency, createMedia, resetAll, withSession, type TestApp } from '../../utils';
import {
  agent,
  broker,
  dealRequest,
  proposal,
  requester,
  sellBody,
  createDealRequestsApp,
} from './factories';

describe('deal-requests: jobs (e2e)', () => {
  let t: TestApp;
  let jobs: DealRequestMaintenanceService;

  beforeAll(async () => {
    ({ t } = await createDealRequestsApp());
    jobs = t.app.get(DealRequestMaintenanceService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  const received = (userId: string) =>
    t.prisma.notification.count({
      where: { userId, type: NotificationType.DEAL_REQUEST_RECEIVED },
    });

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_deal_requests?');
    expect(t.redis.options.db).toBe(5);
    const [row] = await t.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('house_test_deal_requests');
  });

  describe('fanout', () => {
    it('region-wide: notifies active members of approved agencies in the 시군구 exactly once', async () => {
      const b1 = await broker(t);
      const a1 = await agent(t, b1.agency);
      const elsewhere = await broker(t, { sggCode: '46130' });
      const pending = await createAgency(t.prisma, { status: AgencyStatus.PENDING });
      const { user, s } = await requester(t);
      const res = await withSession(t.http().post('/api/v1/deal-requests'), s)
        .send(sellBody())
        .expect(201);
      const id = res.body.id as string;
      await jobs.fanout(id);
      await jobs.fanout(id); // retry / duplicate job: no double notification
      expect(await received(b1.user.id)).toBe(1);
      expect(await received(a1.user.id)).toBe(1);
      expect(await received(elsewhere.user.id)).toBe(0);
      expect(await received(pending.owner.id)).toBe(0);
      expect(await received(user.id)).toBe(0);
      const n = await t.prisma.notification.findFirstOrThrow({ where: { userId: b1.user.id } });
      expect(n.data).toEqual({ dealRequestId: id });
      expect(n.title).toContain('내놓기');
      expect(JSON.stringify(n)).not.toContain('01012345678');
    });

    it('selected agencies only; nothing for closed requests', async () => {
      const target = await broker(t);
      const bystander = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, {
        visibility: DealRequestVisibility.SELECTED_AGENCIES,
      });
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: req.id, agencyId: target.agency.id },
      });
      expect(await jobs.fanout(req.id)).toBe(1);
      expect(await received(target.user.id)).toBe(1);
      expect(await received(bystander.user.id)).toBe(0);
      const closed = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.CANCELLED });
      expect(await jobs.fanout(closed.id)).toBe(0);
    });
  });

  it('expireDue: OPEN past expiresAt → EXPIRED with a notice; MATCHED never expires; idempotent', async () => {
    const { user } = await requester(t);
    const now = new Date('2026-12-01T00:00:00.000Z');
    const due = await dealRequest(t.prisma, user.id, {
      expiresAt: new Date('2026-11-30T00:00:00Z'),
    });
    const matched = await dealRequest(t.prisma, user.id, {
      status: DealRequestStatus.MATCHED,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    const fresh = await dealRequest(t.prisma, user.id, {
      expiresAt: new Date('2026-12-02T00:00:00Z'),
    });
    const closed = await dealRequest(t.prisma, user.id, {
      status: DealRequestStatus.CLOSED,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
    });
    expect(await jobs.expireDue(now)).toBe(1);
    expect(await jobs.expireDue(now)).toBe(0);
    const status = async (id: string) =>
      (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(due.id)).toBe('EXPIRED');
    // An agency is mid-deal with the requester: the request (and the agency's contact access) stays.
    expect(await status(matched.id)).toBe('MATCHED');
    expect(await status(fresh.id)).toBe('OPEN');
    expect(await status(closed.id)).toBe('CLOSED');
    const row = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: due.id } });
    expect(row.closedAt?.toISOString()).toBe(now.toISOString());
    expect(await t.prisma.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  it('scrubDue: erases contact of long-ended requests and of withdrawn members', async () => {
    const b = await broker(t);
    const { user } = await requester(t);
    const now = new Date('2026-12-01T00:00:00.000Z');
    const old = await dealRequest(t.prisma, user.id, {
      status: DealRequestStatus.CLOSED,
      closedAt: new Date('2026-08-01T00:00:00Z'),
    });
    const recent = await dealRequest(t.prisma, user.id, {
      status: DealRequestStatus.CLOSED,
      closedAt: new Date('2026-11-01T00:00:00Z'),
    });
    await t.prisma.dealRequestContactGrant.create({
      data: { dealRequestId: old.id, agencyId: b.agency.id },
    });
    const gone = await requester(t);
    const live = await dealRequest(t.prisma, gone.user.id, {
      lat: 34.95,
      lng: 127.48,
      floor: 7,
      exclusiveArea: 84.97,
      description: '남향, 올수리',
    });
    await proposal(t.prisma, live.id, b.agency.id);
    const photo = await createMedia(t.prisma, {
      purpose: MediaPurpose.DEAL_REQUEST_PHOTO,
      ownerUserId: gone.user.id,
    });
    await t.prisma.dealRequestPhoto.create({ data: { dealRequestId: live.id, mediaId: photo.id } });
    // Ended + contact already erased by retention, then the member withdrew: address etc. remain.
    const ancient = await dealRequest(t.prisma, gone.user.id, {
      status: DealRequestStatus.CLOSED,
      closedAt: new Date('2026-01-01T00:00:00Z'),
      contactName: '',
      contactPhone: '',
      addressDetail: null,
      contactScrubbedAt: new Date('2026-04-01T00:00:00Z'),
    });
    await t.prisma.user.update({
      where: { id: gone.user.id },
      data: { status: UserStatus.WITHDRAWN },
    });

    expect(await jobs.scrubDue(now)).toBe(3);
    expect(await jobs.scrubDue(now)).toBe(0);
    const o = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: old.id } });
    expect(o).toMatchObject({ contactName: '', contactPhone: '', addressDetail: null });
    expect(o.contactScrubbedAt?.toISOString()).toBe(now.toISOString());
    expect((await t.prisma.dealRequestContactGrant.findFirstOrThrow()).revokedAt).not.toBeNull();
    const l = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: live.id } });
    expect(l).toMatchObject({
      status: 'CANCELLED',
      closeReason: '회원 탈퇴',
      contactName: '',
      contactPhone: '',
      addressDetail: null,
      roadAddress: null,
      lat: null,
      lng: null,
      floor: null,
      exclusiveArea: null,
      description: null,
    });
    const [loc] = await t.prisma.$queryRaw<{ location: string | null }[]>`
      SELECT location::text AS location FROM deal_requests WHERE id = ${live.id}::uuid`;
    expect(loc?.location).toBeNull();
    expect(await t.prisma.dealRequestPhoto.count()).toBe(0);
    expect(
      (await t.prisma.media.findUniqueOrThrow({ where: { id: photo.id } })).deletedAt,
    ).not.toBeNull();
    expect(
      await t.prisma.notification.count({
        where: { userId: b.user.id, type: NotificationType.SYSTEM },
      }),
    ).toBe(1);
    const a = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: ancient.id } });
    expect(a).toMatchObject({ status: 'CLOSED', roadAddress: null });
    const r = await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: recent.id } });
    expect(r.contactPhone).toBe('01012345678');
  });

  it('scrubUser: cancels, revokes and erases one member at once (own tx or the caller’s)', async () => {
    const b = await broker(t);
    const { user } = await requester(t);
    const bystander = await requester(t);
    const kept = await dealRequest(t.prisma, bystander.user.id);
    const live = await dealRequest(t.prisma, user.id, { lat: 34.95, lng: 127.48 });
    const matched = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.MATCHED });
    await proposal(t.prisma, matched.id, b.agency.id, { status: 'ACCEPTED' });
    await t.prisma.dealRequestContactGrant.create({
      data: { dealRequestId: matched.id, agencyId: b.agency.id },
    });
    const now = new Date();

    const notices = await t.prisma.$transaction((tx) => jobs.scrubUser(user.id, now, tx));
    expect(notices.map((n) => n.userId)).toEqual([b.user.id]);
    await jobs.dispatch(notices);
    for (const id of [live.id, matched.id]) {
      expect(await t.prisma.dealRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
        status: 'CANCELLED',
        contactPhone: '',
        roadAddress: null,
        lat: null,
      });
    }
    expect((await t.prisma.dealRequestContactGrant.findFirstOrThrow()).revokedAt).not.toBeNull();
    expect(
      (await t.prisma.dealRequest.findUniqueOrThrow({ where: { id: kept.id } })).contactPhone,
    ).toBe('01012345678');
    // Idempotent; nothing left to cancel, so no further notices.
    expect(await jobs.scrubUser(user.id)).toEqual([]);
  });

  it('processor routes jobs by name and ignores unknown ones', async () => {
    const processor = t.app.get(DealRequestsProcessor);
    const job = (name: string, data: object = {}) =>
      ({ name, data }) as unknown as Job<{ dealRequestId?: unknown }>;
    await expect(processor.process(job(DEAL_REQUEST_JOBS.EXPIRE))).resolves.toEqual({ count: 0 });
    await expect(processor.process(job(DEAL_REQUEST_JOBS.SCRUB))).resolves.toEqual({ count: 0 });
    await expect(
      processor.process(job(DEAL_REQUEST_JOBS.FANOUT, { dealRequestId: 1 })),
    ).resolves.toEqual({
      count: 0,
    });
    await expect(processor.process(job('other'))).resolves.toEqual({ count: 0 });
  });
});
