import { ErrorCode, UserStatus } from '@house/shared';
import { PiiScrubService } from '../../../src/modules/auth/jobs/pii-scrub.service';
import { InquiryRetentionService } from '../../../src/modules/inquiries/services/inquiry-retention.service';
import { createTestApp, resetAll, withSession, type TestApp } from '../../utils';
import { agent, broker, customer, seedInquiry } from './factories';

const DAY = 86_400_000;

describe('inquiries: retention job (e2e)', () => {
  let t: TestApp;
  let retention: InquiryRetentionService;

  beforeAll(async () => {
    t = await createTestApp();
    retention = t.app.get(InquiryRetentionService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('scrubs inquiries a year after the last message and at once for withdrawn members', async () => {
    const b = await broker(t);
    const c = await customer(t);
    const gone = await customer(t);
    const now = new Date();
    const old = await seedInquiry(t, b.agency.id, {
      userId: c.user.id,
      memo: '010-5555-0000으로 연락',
      visitorHash: 'a'.repeat(64),
      lastMessageAt: new Date(now.getTime() - 366 * DAY),
    });
    await t.prisma.inquiryMessage.createMany({
      data: [
        { inquiryId: old.id, author: 'AGENCY', body: '답변', authorName: '김중개' },
        { inquiryId: old.id, author: 'CUSTOMER', body: '추가 문의', authorName: '홍길동' },
      ],
    });
    const recent = await seedInquiry(t, b.agency.id, {
      userId: c.user.id,
      lastMessageAt: new Date(now.getTime() - 364 * DAY),
    });
    const withdrawn = await seedInquiry(t, b.agency.id, { userId: gone.user.id });
    const call = await seedInquiry(t, b.agency.id, {
      channel: 'CALL',
      userId: gone.user.id,
      customerName: '김*진',
      customerPhone: null,
      message: null,
    });
    await t.prisma.user.update({
      where: { id: gone.user.id },
      data: { status: UserStatus.WITHDRAWN, withdrawnAt: now },
    });

    expect(await retention.scrubDue(now)).toBe(3);
    const scrubbed = await t.prisma.inquiry.findUniqueOrThrow({
      where: { id: old.id },
      include: { messages: { orderBy: { author: 'asc' } } },
    });
    expect(scrubbed).toMatchObject({
      customerName: null,
      customerPhone: null,
      message: null,
      memo: null,
      visitorHash: null,
      piiScrubbedAt: now,
      // Still countable.
      agencyId: b.agency.id,
      channel: 'MESSAGE',
      status: 'NEW',
      userId: c.user.id,
    });
    expect(scrubbed.messages).toEqual([
      expect.objectContaining({ author: 'CUSTOMER', body: '', authorName: null }),
      expect.objectContaining({ author: 'AGENCY', body: '', authorName: '김중개' }),
    ]);
    for (const id of [withdrawn.id, call.id]) {
      const row = await t.prisma.inquiry.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ customerName: null, customerPhone: null, piiScrubbedAt: now });
    }
    // The office's free-text delete reason of a soft-deleted row is erased with the rest.
    const spam = await seedInquiry(t, b.agency.id, {
      deletedAt: now,
      deleteReason: '스팸 010-1234-5678 김OO',
      lastMessageAt: new Date(now.getTime() - 400 * DAY),
    });
    expect(await retention.scrubDue(now)).toBe(1);
    expect(await t.prisma.inquiry.findUniqueOrThrow({ where: { id: spam.id } })).toMatchObject({
      deleteReason: null,
      customerName: null,
      piiScrubbedAt: now,
    });
    await t.prisma.inquiry.delete({ where: { id: spam.id } });

    const kept = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: recent.id } });
    expect(kept).toMatchObject({ customerName: '홍길동', piiScrubbedAt: null });
    expect(await t.prisma.inquiry.count()).toBe(4);

    // Idempotent.
    expect(await retention.scrubDue(now)).toBe(0);

    // A scrubbed thread can no longer be answered or continued.
    const view = await withSession(t.http().get(`/api/v1/agency/inquiries/${old.id}`), b.s).expect(
      200,
    );
    expect(view.body).toMatchObject({ canReply: false, customerName: null, message: null });
    const reply = await withSession(
      t.http().post(`/api/v1/agency/inquiries/${old.id}/replies`),
      b.s,
    )
      .send({ message: '답변' })
      .expect(409);
    expect(reply.body.code).toBe(ErrorCode.INQUIRY_REPLY_NOT_ALLOWED);
    const follow = await withSession(t.http().post(`/api/v1/me/inquiries/${old.id}/messages`), c.s)
      .send({ message: '추가 문의' })
      .expect(409);
    expect(follow.body.code).toBe(ErrorCode.INQUIRY_REPLY_NOT_ALLOWED);
  });

  it('a withdrawn staff member’s name leaves the replies they wrote with their PII scrub', async () => {
    const b = await broker(t);
    const staff = await agent(t, b.agency, '박실명');
    const keep = await agent(t, b.agency, '이중개');
    const c = await customer(t);
    const row = await seedInquiry(t, b.agency.id, { userId: c.user.id });
    await t.prisma.inquiryMessage.createMany({
      data: [
        {
          inquiryId: row.id,
          author: 'AGENCY',
          body: '네',
          authorUserId: staff.user.id,
          authorName: '박실명',
        },
        {
          inquiryId: row.id,
          author: 'AGENCY',
          body: '네',
          authorUserId: keep.user.id,
          authorName: '이중개',
        },
        {
          inquiryId: row.id,
          author: 'CUSTOMER',
          body: '감사',
          authorUserId: c.user.id,
          authorName: '홍길동',
        },
      ],
    });
    const now = new Date();
    await t.prisma.user.update({
      where: { id: staff.user.id },
      data: { status: UserStatus.WITHDRAWN, withdrawnAt: now, piiScrubAfter: now },
    });
    await t.app.get(PiiScrubService).scrubDue(now);
    const names = await t.prisma.inquiryMessage.findMany({
      where: { inquiryId: row.id },
      select: { authorUserId: true, authorName: true },
    });
    expect(names).toEqual(
      expect.arrayContaining([
        { authorUserId: staff.user.id, authorName: '탈퇴 회원' },
        { authorUserId: keep.user.id, authorName: '이중개' },
        { authorUserId: c.user.id, authorName: '홍길동' },
      ]),
    );
    const view = await withSession(t.http().get(`/api/v1/me/inquiries/${row.id}`), c.s).expect(200);
    expect(JSON.stringify(view.body)).not.toContain('박실명');
  });

  it('works through every batch', async () => {
    const b = await broker(t);
    const long = new Date(Date.now() - 400 * DAY);
    for (let i = 0; i < 3; i++) await seedInquiry(t, b.agency.id, { lastMessageAt: long });
    expect(await retention.scrubDue(new Date(), 1)).toBe(3);
    expect(await t.prisma.inquiry.count({ where: { piiScrubbedAt: null } })).toBe(0);
  });

  it('scrubUser erases one member’s inquiries immediately (withdrawal hook)', async () => {
    const b = await broker(t);
    const c = await customer(t);
    const other = await customer(t);
    await seedInquiry(t, b.agency.id, { userId: c.user.id });
    const untouched = await seedInquiry(t, b.agency.id, { userId: other.user.id });
    expect(await retention.scrubUser(c.user.id)).toBe(1);
    expect(await retention.scrubUser(c.user.id)).toBe(0);
    const row = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: untouched.id } });
    expect(row.customerName).toBe('홍길동');
  });
});
