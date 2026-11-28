import { AgencyStatus, ErrorCode, NotificationType, UserStatus } from '@house/shared';
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
  issuePaths,
  itemIds,
  publicListing,
  seedInquiry,
} from './factories';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe('inquiries: console inbox (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await createActionConsentTerms(t.prisma);
  });
  afterAll(() => t?.close());

  describe('GET /api/v1/agency/inquiries', () => {
    it('200: own rows newest activity first, unread + status counts, filters and search', async () => {
      const b = await broker(t);
      const other = await broker(t);
      const listing = await publicListing(t, b.agency.id, { title: '연향동 투룸' });
      const c = await customer(t);
      const member = await seedInquiry(t, b.agency.id, {
        userId: c.user.id,
        customerName: '김민지',
        customerPhone: '01098765432',
        listingId: listing.id,
        source: 'SITE',
        lastMessageAt: minutesAgo(1),
      });
      const guest = await seedInquiry(t, b.agency.id, {
        customerName: '박서준',
        message: '주차 가능한가요?',
        status: 'IN_PROGRESS',
        readAt: minutesAgo(1),
        lastMessageAt: minutesAgo(5),
      });
      const call = await seedInquiry(t, b.agency.id, {
        channel: 'CALL',
        customerName: null,
        customerPhone: null,
        message: null,
        status: 'DONE',
        lastMessageAt: minutesAgo(10),
      });
      await seedInquiry(t, b.agency.id, { deletedAt: new Date() });
      await seedInquiry(t, other.agency.id);

      const res = await withSession(t.http().get('/api/v1/agency/inquiries'), b.s).expect(200);
      expect(itemIds(res.body)).toEqual([member.id, guest.id, call.id]);
      expect(res.body).toMatchObject({
        total: 3,
        page: 1,
        pageSize: 12,
        unreadCount: 2,
        statusCounts: { NEW: 1, IN_PROGRESS: 1, DONE: 1 },
      });
      expect(res.body.items[0]).toMatchObject({
        id: member.id,
        channel: 'MESSAGE',
        source: 'SITE',
        customerName: '김민지',
        customerPhone: '01098765432',
        isMember: true,
        canReply: true,
        listing: { id: listing.id, title: '연향동 투룸', dealType: 'SALE', salePrice: 30_000 },
        readAt: null,
      });
      expect(res.body.items[0].messages).toBeUndefined();
      expect(res.body.items[1]).toMatchObject({ isMember: false, canReply: false });
      expect(res.body.items[2]).toMatchObject({ channel: 'CALL', canReply: false, listing: null });

      const ids = async (qs: string) =>
        itemIds(
          (await withSession(t.http().get(`/api/v1/agency/inquiries?${qs}`), b.s).expect(200)).body,
        );
      expect(await ids('status=IN_PROGRESS')).toEqual([guest.id]);
      expect(await ids('channel=CALL')).toEqual([call.id]);
      expect(await ids('source=SITE')).toEqual([member.id]);
      expect(await ids('unread=true')).toEqual([member.id, call.id]);
      expect(await ids(`q=${encodeURIComponent('민지')}`)).toEqual([member.id]);
      expect(await ids('q=010-9876')).toEqual([member.id]);
      expect(await ids(`q=${encodeURIComponent('주차')}`)).toEqual([guest.id]);
      expect(await ids(`q=${encodeURIComponent('투룸')}`)).toEqual([member.id]);
      expect(await ids('pageSize=1&page=2')).toEqual([guest.id]);

      // Status tabs count under the other filters, not under `status`.
      const tabs = await withSession(
        t.http().get('/api/v1/agency/inquiries?status=NEW&channel=MESSAGE'),
        b.s,
      ).expect(200);
      expect(tabs.body.statusCounts).toEqual({ NEW: 1, IN_PROGRESS: 1, DONE: 0 });
      expect(itemIds(tabs.body)).toEqual([member.id]);
    });

    it('search finds the listing name the row shows for untitled listings, and thread messages', async () => {
      const b = await broker(t);
      const untitled = await publicListing(t, b.agency.id, { title: null });
      await t.prisma.property.update({
        where: { id: untitled.propertyId },
        data: { buildingName: '레이크파크빌' },
      });
      const row = await seedInquiry(t, b.agency.id, { listingId: untitled.id });
      const followUp = await seedInquiry(t, b.agency.id, { message: '처음 문의' });
      await t.prisma.inquiryMessage.create({
        data: { inquiryId: followUp.id, author: 'CUSTOMER', body: '복층 구조인가요?' },
      });
      const list = await withSession(t.http().get('/api/v1/agency/inquiries'), b.s).expect(200);
      const items = list.body.items as { id: string; listing: { title: string } | null }[];
      expect(items.find((i) => i.id === row.id)?.listing?.title).toBe('레이크파크빌');
      const ids = async (q: string) =>
        itemIds(
          (
            await withSession(
              t.http().get(`/api/v1/agency/inquiries?q=${encodeURIComponent(q)}`),
              b.s,
            ).expect(200)
          ).body,
        );
      expect(await ids('레이크파크')).toEqual([row.id]);
      expect(await ids('매물로')).toEqual([row.id]);
      expect(await ids('복층')).toEqual([followUp.id]);
    });

    it('401 anonymous; 403 for plain users, suspended offices and removed members', async () => {
      await t.http().get('/api/v1/agency/inquiries').expect(401);
      const c = await customer(t);
      await withSession(t.http().get('/api/v1/agency/inquiries'), c.s).expect(403);
      const suspended = await broker(t, { status: AgencyStatus.SUSPENDED });
      const res = await withSession(t.http().get('/api/v1/agency/inquiries'), suspended.s).expect(
        403,
      );
      expect(res.body.code).toBe(ErrorCode.AGENCY_NOT_APPROVED);
      const b = await broker(t);
      const a = await agent(t, b.agency);
      await withSession(t.http().get('/api/v1/agency/inquiries'), a.s).expect(200);
      await t.prisma.agencyMember.update({
        where: { id: a.memberId },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      await withSession(t.http().get('/api/v1/agency/inquiries'), a.s).expect(403);
    });

    it('400 for bad query values', async () => {
      const b = await broker(t);
      for (const qs of ['pageSize=51', 'channel=FAX', 'status=OPEN', `q=${'a'.repeat(51)}`]) {
        const res = await withSession(t.http().get(`/api/v1/agency/inquiries?${qs}`), b.s).expect(
          400,
        );
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });
  });

  describe('GET / PATCH / DELETE /api/v1/agency/inquiries/:id', () => {
    it('detail with the thread; other offices’ rows are 404; bad ids 400', async () => {
      const b = await broker(t);
      const other = await broker(t);
      const row = await seedInquiry(t, b.agency.id);
      await t.prisma.inquiryMessage.create({
        data: { inquiryId: row.id, author: 'AGENCY', body: '네, 가능해요.', authorName: '김중개' },
      });
      const res = await withSession(t.http().get(`/api/v1/agency/inquiries/${row.id}`), b.s).expect(
        200,
      );
      expect(res.body).toMatchObject({
        id: row.id,
        message: '문의 드려요.',
        messages: [{ author: 'AGENCY', body: '네, 가능해요.', authorName: '김중개' }],
      });
      // Reading the detail does not mark it read (PATCH read does).
      expect(res.body.readAt).toBeNull();
      const theirs = await seedInquiry(t, other.agency.id);
      const nf = await withSession(
        t.http().get(`/api/v1/agency/inquiries/${theirs.id}`),
        b.s,
      ).expect(404);
      expect(nf.body.code).toBe(ErrorCode.INQUIRY_NOT_FOUND);
      await withSession(t.http().get('/api/v1/agency/inquiries/not-a-uuid'), b.s).expect(400);
      const c = await customer(t);
      await withSession(t.http().get(`/api/v1/agency/inquiries/${row.id}`), c.s).expect(403);
    });

    it('PATCH status (caller becomes the handler), memo and read flag', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency, '이실장');
      const row = await seedInquiry(t, b.agency.id);
      const url = `/api/v1/agency/inquiries/${row.id}`;
      const res = await withSession(t.http().patch(url), a.s)
        .send({ status: 'DONE', memo: ' 계약 완료 ', read: true })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'DONE',
        memo: '계약 완료',
        handledByName: '이실장',
        readAt: expect.any(String),
      });
      // Memo only: the handler stays; read:false makes it unread again; '' clears the memo.
      const again = await withSession(t.http().patch(url), b.s)
        .send({ memo: '', read: false })
        .expect(200);
      expect(again.body).toMatchObject({ memo: null, handledByName: '이실장', readAt: null });
      const db = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: row.id } });
      expect(db.handledByUserId).toBe(a.user.id);

      await withSession(t.http().patch(url), b.s).send({}).expect(400);
      const bad = await withSession(t.http().patch(url), b.s)
        .send({ status: 'CLOSED' })
        .expect(400);
      expect(issuePaths(bad.body)).toContain('status');
      const other = await broker(t);
      await withSession(t.http().patch(url), other.s).send({ status: 'NEW' }).expect(404);
      await t.http().patch(url).send({ status: 'NEW' }).expect(401);
    });

    it('DELETE soft-deletes (스팸 처리) with an optional reason → gone from inbox and MY', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const row = await seedInquiry(t, b.agency.id, { userId: c.user.id });
      const spam = await seedInquiry(t, b.agency.id);
      const url = `/api/v1/agency/inquiries/${row.id}`;

      await withSession(t.http().delete(url), c.s).expect(403);
      const tooLong = await withSession(t.http().delete(url), b.s)
        .send({ reason: 'a'.repeat(201) })
        .expect(400);
      expect(issuePaths(tooLong.body)).toContain('reason');
      await withSession(t.http().delete(url), b.s).send({ reason: ' 중복 문의 ' }).expect(204);
      await withSession(t.http().delete(`/api/v1/agency/inquiries/${spam.id}`), b.s).expect(204);
      const db = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: row.id } });
      expect(db).toMatchObject({ deleteReason: '중복 문의', deletedAt: expect.any(Date) });

      await withSession(t.http().get(url), b.s).expect(404);
      await withSession(t.http().delete(url), b.s).expect(404);
      const list = await withSession(t.http().get('/api/v1/agency/inquiries'), b.s).expect(200);
      expect(list.body).toMatchObject({ total: 0, unreadCount: 0 });
      const mine = await withSession(t.http().get('/api/v1/me/inquiries'), c.s).expect(200);
      expect(mine.body.total).toBe(0);
      await withSession(t.http().get(`/api/v1/me/inquiries/${row.id}`), c.s).expect(404);
    });
  });

  describe('POST /api/v1/agency/inquiries/:id/replies', () => {
    it('201: answers a member, moves NEW → 응대 중, notifies the customer’s personal feed', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency, '이실장');
      const c = await customer(t);
      const row = await seedInquiry(t, b.agency.id, { userId: c.user.id });

      const res = await withSession(
        t.http().post(`/api/v1/agency/inquiries/${row.id}/replies`),
        a.s,
      )
        .send({ message: ' 네, 주말 방문 가능합니다. ' })
        .expect(201);
      expect(res.body).toMatchObject({
        status: 'IN_PROGRESS',
        handledByName: '이실장',
        readAt: expect.any(String),
        canReply: true,
        messages: [{ author: 'AGENCY', body: '네, 주말 방문 가능합니다.', authorName: '이실장' }],
      });
      expect(new Date(res.body.lastMessageAt as string).getTime()).toBeGreaterThan(
        row.lastMessageAt.getTime(),
      );

      const note = await t.prisma.notification.findFirstOrThrow({ where: { userId: c.user.id } });
      expect(note).toMatchObject({
        type: NotificationType.INQUIRY_REPLIED,
        title: '문의에 답변이 도착했습니다.',
        body: `${b.agency.name}에서 답변을 남겼어요.`,
        data: { inquiryId: row.id, agencyName: b.agency.name },
      });
      const personal = await withSession(
        t.http().get('/api/v1/me/notifications?scope=personal'),
        c.s,
      ).expect(200);
      expect((personal.body.items as { type: string }[]).map((n) => n.type)).toEqual([
        'INQUIRY_REPLIED',
      ]);
      const agencyFeed = await withSession(
        t.http().get('/api/v1/me/notifications?scope=agency'),
        c.s,
      ).expect(200);
      expect(agencyFeed.body.items).toHaveLength(0);

      // A second answer keeps 응대 중 (no status bounce) and the first handler.
      await withSession(t.http().post(`/api/v1/agency/inquiries/${row.id}/replies`), b.s)
        .send({ message: '주소 보내드릴게요.' })
        .expect(201);
      const db = await t.prisma.inquiry.findUniqueOrThrow({
        where: { id: row.id },
        include: { messages: true },
      });
      expect(db).toMatchObject({ status: 'IN_PROGRESS', handledByUserId: a.user.id });
      expect(db.messages).toHaveLength(2);
    });

    it('409 INQUIRY_REPLY_NOT_ALLOWED for guests, contact events and withdrawn members', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const guest = await seedInquiry(t, b.agency.id);
      const call = await seedInquiry(t, b.agency.id, { channel: 'CALL', userId: c.user.id });
      const gone = await customer(t);
      const withdrawn = await seedInquiry(t, b.agency.id, { userId: gone.user.id });
      await t.prisma.user.update({
        where: { id: gone.user.id },
        data: { status: UserStatus.WITHDRAWN, withdrawnAt: new Date() },
      });
      for (const id of [guest.id, call.id, withdrawn.id]) {
        const res = await withSession(t.http().post(`/api/v1/agency/inquiries/${id}/replies`), b.s)
          .send({ message: '답변' })
          .expect(409);
        expect(res.body.code).toBe(ErrorCode.INQUIRY_REPLY_NOT_ALLOWED);
      }
      expect(await t.prisma.inquiryMessage.count()).toBe(0);
      expect(await t.prisma.notification.count()).toBe(0);
    });

    it('400 for an empty / too long message; 404 for other offices; 403 for plain users', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const row = await seedInquiry(t, b.agency.id, { userId: c.user.id });
      const url = `/api/v1/agency/inquiries/${row.id}/replies`;
      for (const message of [' ', 'a'.repeat(1001)]) {
        const res = await withSession(t.http().post(url), b.s).send({ message }).expect(400);
        expect(issuePaths(res.body)).toContain('message');
      }
      const other = await broker(t);
      await withSession(t.http().post(url), other.s).send({ message: '답변' }).expect(404);
      await withSession(t.http().post(url), c.s).send({ message: '답변' }).expect(403);
    });
  });

  describe('POST /api/v1/agency/inquiries/read', () => {
    it('marks every row of the office read; other offices untouched', async () => {
      const b = await broker(t);
      const other = await broker(t);
      await seedInquiry(t, b.agency.id);
      await seedInquiry(t, b.agency.id, { channel: 'COPY', message: null });
      await seedInquiry(t, b.agency.id, { readAt: minutesAgo(3) });
      const theirs = await seedInquiry(t, other.agency.id);
      const res = await withSession(t.http().post('/api/v1/agency/inquiries/read'), b.s)
        .send({ all: true })
        .expect(200);
      expect(res.body).toEqual({ updated: 2, unreadCount: 0 });
      const db = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: theirs.id } });
      expect(db.readAt).toBeNull();
    });

    it('400 without all:true; 403 for plain users; 401 anonymous', async () => {
      const b = await broker(t);
      await withSession(t.http().post('/api/v1/agency/inquiries/read'), b.s)
        .send({ all: false })
        .expect(400);
      const c = await customer(t);
      await withSession(t.http().post('/api/v1/agency/inquiries/read'), c.s)
        .send({ all: true })
        .expect(403);
      await t.http().post('/api/v1/agency/inquiries/read').send({ all: true }).expect(401);
    });
  });
});
