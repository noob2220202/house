import { AgencyStatus, ErrorCode, NotificationType } from '@house/shared';
import { DailyCapService } from '../../../src/common/throttle/daily-cap.service';
import {
  createActionConsentTerms,
  createTestApp,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import {
  agent,
  broker,
  customer,
  inquiryBody,
  issuePaths,
  itemIds,
  publicListing,
  seedInquiry,
} from './factories';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe('inquiries: MY > 문의 내역 (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await createActionConsentTerms(t.prisma);
  });
  afterAll(() => t?.close());

  it('full thread: ask → office answers → member reads → follows up → office sees it new again', async () => {
    const b = await broker(t);
    const a = await agent(t, b.agency, '이실장');
    const listing = await publicListing(t, b.agency.id);
    const c = await customer(t);

    const created = await withSession(t.http().post('/api/v1/inquiries'), c.s)
      .send(inquiryBody(b.agency.id, { listingId: listing.id }))
      .expect(201);
    const id = created.body.id as string;

    await withSession(t.http().post(`/api/v1/agency/inquiries/${id}/replies`), a.s)
      .send({ message: '네, 아직 있어요. 토요일 오전 괜찮으세요?' })
      .expect(201);

    const list = await withSession(t.http().get('/api/v1/me/inquiries'), c.s).expect(200);
    expect(list.body).toMatchObject({ total: 1, page: 1 });
    expect(list.body.items[0]).toMatchObject({
      id,
      agency: { id: b.agency.id, name: b.agency.name, logoUrl: null },
      listing: { id: listing.id, title: '남향 로얄층' },
      status: 'IN_PROGRESS',
      preview: '네, 아직 있어요. 토요일 오전 괜찮으세요?',
      replyCount: 1,
      hasUnreadReply: true,
    });

    const detail = await withSession(t.http().get(`/api/v1/me/inquiries/${id}`), c.s).expect(200);
    expect(detail.body).toMatchObject({
      id,
      agency: { id: b.agency.id, phone: b.agency.phone },
      status: 'IN_PROGRESS',
      name: '홍길동',
      phone: '01012345678',
      message: '이 매물 아직 있나요? 주말에 보고 싶어요.',
      messages: [{ author: 'AGENCY', authorName: '이실장' }],
    });
    // Opening the thread reads the answer.
    const reread = await withSession(t.http().get('/api/v1/me/inquiries'), c.s).expect(200);
    expect(reread.body.items[0].hasUnreadReply).toBe(false);

    await t.prisma.notification.deleteMany();
    const follow = await withSession(t.http().post(`/api/v1/me/inquiries/${id}/messages`), c.s)
      .send({ message: '네, 10시에 갈게요.' })
      .expect(201);
    expect(follow.body.status).toBe('NEW');
    expect((follow.body.messages as { author: string }[]).map((m) => m.author)).toEqual([
      'AGENCY',
      'CUSTOMER',
    ]);
    expect(follow.body.messages[1]).toMatchObject({
      body: '네, 10시에 갈게요.',
      authorName: '홍길동',
    });

    const inbox = await withSession(t.http().get(`/api/v1/agency/inquiries/${id}`), b.s).expect(
      200,
    );
    expect(inbox.body).toMatchObject({ status: 'NEW', readAt: null });
    const notes = await t.prisma.notification.findMany();
    expect(notes.map((n) => n.userId).sort()).toEqual([b.user.id, a.user.id].sort());
    expect(notes[0]).toMatchObject({
      type: NotificationType.INQUIRY_RECEIVED,
      title: '고객이 문의에 메시지를 더 남겼습니다.',
      data: { agencyId: b.agency.id, inquiryId: id, followUp: true },
    });
    // The member's own MY list shows the follow-up as the latest message; nothing unread.
    const after = await withSession(t.http().get('/api/v1/me/inquiries'), c.s).expect(200);
    expect(after.body.items[0]).toMatchObject({
      preview: '네, 10시에 갈게요.',
      hasUnreadReply: false,
    });
  });

  describe('GET /api/v1/me/inquiries', () => {
    it('only the member’s written, non-deleted inquiries, newest activity first', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const someone = await customer(t);
      const older = await seedInquiry(t, b.agency.id, {
        userId: c.user.id,
        lastMessageAt: minutesAgo(30),
      });
      const newer = await seedInquiry(t, b.agency.id, {
        userId: c.user.id,
        lastMessageAt: minutesAgo(5),
      });
      await seedInquiry(t, b.agency.id, { userId: c.user.id, channel: 'CALL', message: null });
      await seedInquiry(t, b.agency.id, { userId: c.user.id, deletedAt: new Date() });
      await seedInquiry(t, b.agency.id, { userId: someone.user.id });
      await seedInquiry(t, b.agency.id);
      const res = await withSession(t.http().get('/api/v1/me/inquiries'), c.s).expect(200);
      expect(itemIds(res.body)).toEqual([newer.id, older.id]);
      expect(res.body.items[0]).toMatchObject({
        preview: '문의 드려요.',
        replyCount: 0,
        hasUnreadReply: false,
        listing: null,
      });
      const p2 = await withSession(t.http().get('/api/v1/me/inquiries?pageSize=1&page=2'), c.s);
      expect(itemIds(p2.body)).toEqual([older.id]);
    });

    it('401 anonymous; 400 for a bad page size', async () => {
      await t.http().get('/api/v1/me/inquiries').expect(401);
      const c = await customer(t);
      const res = await withSession(t.http().get('/api/v1/me/inquiries?pageSize=0'), c.s).expect(
        400,
      );
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET /api/v1/me/inquiries/:id', () => {
    it('404 for others’ and guest rows; 400 bad id; 401 anonymous', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const someone = await customer(t);
      const theirs = await seedInquiry(t, b.agency.id, { userId: someone.user.id });
      const guest = await seedInquiry(t, b.agency.id);
      for (const id of [theirs.id, guest.id]) {
        const res = await withSession(t.http().get(`/api/v1/me/inquiries/${id}`), c.s).expect(404);
        expect(res.body.code).toBe(ErrorCode.INQUIRY_NOT_FOUND);
      }
      await withSession(t.http().get('/api/v1/me/inquiries/x'), c.s).expect(400);
      await t.http().get(`/api/v1/me/inquiries/${theirs.id}`).expect(401);
      const db = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: theirs.id } });
      expect(db.customerReadAt).toBeNull();
    });
  });

  describe('POST /api/v1/me/inquiries/:id/messages', () => {
    it('404 for others’ rows; 400 empty; 401 anonymous; 409 when the office cannot take it', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const someone = await customer(t);
      const mine = await seedInquiry(t, b.agency.id, { userId: c.user.id });
      const theirs = await seedInquiry(t, b.agency.id, { userId: someone.user.id });
      await withSession(t.http().post(`/api/v1/me/inquiries/${theirs.id}/messages`), c.s)
        .send({ message: '추가 문의' })
        .expect(404);
      const empty = await withSession(
        t.http().post(`/api/v1/me/inquiries/${mine.id}/messages`),
        c.s,
      )
        .send({ message: '  ' })
        .expect(400);
      expect(issuePaths(empty.body)).toContain('message');
      await t
        .http()
        .post(`/api/v1/me/inquiries/${mine.id}/messages`)
        .send({ message: '추가 문의' })
        .expect(401);
      await t.prisma.agency.update({
        where: { id: b.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      const res = await withSession(t.http().post(`/api/v1/me/inquiries/${mine.id}/messages`), c.s)
        .send({ message: '추가 문의' })
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.INQUIRY_REPLY_NOT_ALLOWED);
      expect(await t.prisma.inquiryMessage.count()).toBe(0);
    });

    it('follow-ups are capped per member and day (429 INQUIRY_DAILY_LIMIT)', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const mine = await seedInquiry(t, b.agency.id, { userId: c.user.id });
      const caps = t.app.get(DailyCapService);
      for (let i = 0; i < 30; i++) await caps.consume('INQUIRY_FOLLOW_UP', `u:${c.user.id}`);
      const res = await withSession(t.http().post(`/api/v1/me/inquiries/${mine.id}/messages`), c.s)
        .send({ message: '추가 문의' })
        .expect(429);
      expect(res.body.code).toBe(ErrorCode.INQUIRY_DAILY_LIMIT);
    });
  });
});
