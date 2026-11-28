import {
  AgencyMemberStatus,
  AgencyStatus,
  ErrorCode,
  ListingStatus,
  NotificationType,
  TermsType,
} from '@house/shared';
import { DailyCapService } from '../../../src/common/throttle/daily-cap.service';
import { InquiryVisitorService } from '../../../src/modules/inquiries/services/inquiry-visitor.service';
import {
  actionConsents,
  createActionConsentTerms,
  createAgency,
  resetAll,
  withSession,
  createTestApp,
  type TestApp,
} from '../../utils';
import {
  agent,
  asGuest,
  broker,
  customer,
  inquiryBody,
  issuePaths,
  nextIp,
  publicListing,
} from './factories';

describe('inquiries: customer side (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await createActionConsentTerms(t.prisma);
  });
  afterAll(() => t?.close());

  const post = (ip: string) => asGuest(t.http().post('/api/v1/inquiries'), ip);

  describe('POST /api/v1/inquiries', () => {
    it('201 guest: stores the inquiry with the verified consent documents and tells every member', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency);
      const removed = await agent(t, b.agency, '퇴사자');
      await t.prisma.agencyMember.update({
        where: { id: removed.memberId },
        data: { status: AgencyMemberStatus.REMOVED, removedAt: new Date() },
      });
      const other = await broker(t);
      const ip = nextIp();

      const res = await post(ip)
        .send(inquiryBody(b.agency.id, { source: 'SITE' }))
        .expect(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        createdAt: expect.any(String),
        member: false,
      });

      const row = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: res.body.id } });
      const doc = await t.prisma.termsDocument.findFirstOrThrow({
        where: { type: TermsType.INQUIRY_PRIVACY },
      });
      expect(row).toMatchObject({
        agencyId: b.agency.id,
        listingId: null,
        userId: null,
        channel: 'MESSAGE',
        status: 'NEW',
        source: 'SITE',
        customerName: '홍길동',
        customerPhone: '01012345678',
        message: '이 매물 아직 있나요? 주말에 보고 싶어요.',
        readAt: null,
        consentTermsDocumentIds: [doc.id],
        piiScrubbedAt: null,
      });
      expect(row.visitorHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.visitorHash).toBe(t.app.get(InquiryVisitorService).hashIp(ip));
      expect(row.lastMessageAt.toISOString()).toBe(res.body.createdAt);
      expect(await t.prisma.userConsent.count()).toBe(0);

      const notes = await t.prisma.notification.findMany({ orderBy: { userId: 'asc' } });
      expect(notes.map((n) => n.userId).sort()).toEqual([b.user.id, a.user.id].sort());
      expect(notes[0]).toMatchObject({
        type: NotificationType.INQUIRY_RECEIVED,
        title: '새 문의가 도착했습니다.',
        body: '사무소 홈페이지에서 보낸 사무소 문의',
        data: { agencyId: b.agency.id, inquiryId: row.id },
      });
      expect(JSON.stringify(notes)).not.toMatch(/홍길동|01012345678/);
      expect(await t.prisma.notification.count({ where: { userId: other.user.id } })).toBe(0);

      // Feed scope: an agency-only notice, in the console feed and never in the personal one.
      const agencyFeed = await withSession(
        t.http().get('/api/v1/me/notifications?scope=agency'),
        b.s,
      ).expect(200);
      expect(agencyFeed.body.items).toHaveLength(1);
      expect(agencyFeed.body.items[0]).toMatchObject({ type: 'INQUIRY_RECEIVED' });
      const personal = await withSession(
        t.http().get('/api/v1/me/notifications?scope=personal'),
        b.s,
      ).expect(200);
      expect(personal.body.items).toHaveLength(0);
    });

    it('201 member about a listing: consent recorded on the account, phone optional', async () => {
      const b = await broker(t);
      const listing = await publicListing(t, b.agency.id);
      const c = await customer(t);
      const res = await withSession(t.http().post('/api/v1/inquiries'), c.s)
        .send(inquiryBody(b.agency.id, { listingId: listing.id, phone: null }))
        .expect(201);
      expect(res.body.member).toBe(true);
      const row = await t.prisma.inquiry.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row).toMatchObject({
        userId: c.user.id,
        listingId: listing.id,
        customerPhone: null,
        consentTermsDocumentIds: [],
        visitorHash: null,
      });
      const consents = await t.prisma.userConsent.findMany({
        where: { userId: c.user.id },
        include: { termsDocument: true },
      });
      expect(consents.map((x) => x.termsDocument.type)).toEqual([TermsType.INQUIRY_PRIVACY]);
      const note = await t.prisma.notification.findFirstOrThrow({ where: { userId: b.user.id } });
      expect(note.body).toBe('매물 문의 · 남향 로얄층');
    });

    it('accepts a listing the office co-brokers; 404 for other offices’ or non-public listings', async () => {
      const a = await broker(t);
      const b = await broker(t);
      const shared = await publicListing(t, a.agency.id);
      await t.prisma.listingAgency.create({
        data: { listingId: shared.id, agencyId: b.agency.id, isPrimary: false },
      });
      const foreign = await publicListing(t, a.agency.id);
      const draft = await publicListing(t, b.agency.id, { status: ListingStatus.DRAFT });
      const ip = nextIp();
      await post(ip)
        .send(inquiryBody(b.agency.id, { listingId: shared.id }))
        .expect(201);
      for (const listingId of [foreign.id, draft.id]) {
        const res = await post(ip).send(inquiryBody(b.agency.id, { listingId })).expect(404);
        expect(res.body.code).toBe(ErrorCode.INQUIRY_LISTING_NOT_FOUND);
      }
      // The listing's primary office suspended → no longer public.
      await t.prisma.agency.update({
        where: { id: a.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      const res = await post(ip)
        .send(inquiryBody(b.agency.id, { listingId: shared.id }))
        .expect(404);
      expect(res.body.code).toBe(ErrorCode.INQUIRY_LISTING_NOT_FOUND);
      expect(await t.prisma.inquiry.count()).toBe(1);
    });

    it('404 INQUIRY_AGENCY_NOT_FOUND unless the office is APPROVED', async () => {
      const { agency: pending } = await createAgency(t.prisma, { status: AgencyStatus.PENDING });
      const { agency: deleted } = await createAgency(t.prisma, { deletedAt: new Date() });
      const ip = nextIp();
      for (const id of [pending.id, deleted.id, '0190a0b0-0000-7000-8000-00000000abcd']) {
        const res = await post(ip).send(inquiryBody(id)).expect(404);
        expect(res.body.code).toBe(ErrorCode.INQUIRY_AGENCY_NOT_FOUND);
      }
    });

    it('400 INQUIRY_REJECTED for a filled honeypot (no row, no cap used)', async () => {
      const b = await broker(t);
      const ip = nextIp();
      const res = await post(ip)
        .send(inquiryBody(b.agency.id, { website: 'http://spam.example' }))
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.INQUIRY_REJECTED);
      expect(await t.prisma.inquiry.count()).toBe(0);
      const hash = t.app.get(InquiryVisitorService).hashIp(ip);
      expect(await t.app.get(DailyCapService).used('INQUIRY_CREATE', `ip:${hash}`)).toBe(0);
      // An empty honeypot (what the real form sends) is fine.
      await post(ip)
        .send(inquiryBody(b.agency.id, { website: '' }))
        .expect(201);
    });

    it('400 INQUIRY_PHONE_REQUIRED for a guest without a phone', async () => {
      const b = await broker(t);
      const res = await post(nextIp())
        .send(inquiryBody(b.agency.id, { phone: undefined }))
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.INQUIRY_PHONE_REQUIRED);
    });

    it('400 VALIDATION_FAILED for bad fields', async () => {
      const b = await broker(t);
      const ip = nextIp();
      for (const [patch, path] of [
        [{ name: ' ' }, 'name'],
        [{ message: '네' }, 'message'],
        [{ phone: '12345' }, 'phone'],
        [{ agencyId: 'x' }, 'agencyId'],
        [{ source: 'APP' }, 'source'],
      ] as const) {
        const res = await post(ip).send(inquiryBody(b.agency.id, patch)).expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(issuePaths(res.body)).toContain(path);
      }
      expect(await t.prisma.inquiry.count()).toBe(0);
    });

    it('consent: required, current version only, 503 when no document is published', async () => {
      const b = await broker(t);
      const ip = nextIp();
      const missing = await post(ip)
        .send(inquiryBody(b.agency.id, { consents: [] }))
        .expect(400);
      expect(missing.body.code).toBe(ErrorCode.AUTH_CONSENT_REQUIRED);
      const old = await post(ip)
        .send(inquiryBody(b.agency.id, { consents: actionConsents('INQUIRY', '0.9') }))
        .expect(400);
      expect(old.body.code).toBe(ErrorCode.AUTH_CONSENT_OUTDATED);
      await t.prisma.termsDocument.deleteMany({ where: { type: TermsType.INQUIRY_PRIVACY } });
      const none = await post(ip).send(inquiryBody(b.agency.id)).expect(503);
      expect(none.body.code).toBe(ErrorCode.AUTH_CONSENT_UNAVAILABLE);
      expect(await t.prisma.inquiry.count()).toBe(0);
    });

    it('daily cap: 10 per guest address and per member (429 INQUIRY_DAILY_LIMIT)', async () => {
      const b = await broker(t);
      const caps = t.app.get(DailyCapService);
      const ip = nextIp();
      const hash = t.app.get(InquiryVisitorService).hashIp(ip);
      for (let i = 0; i < 10; i++) await caps.consume('INQUIRY_CREATE', `ip:${hash}`);
      const res = await post(ip).send(inquiryBody(b.agency.id)).expect(429);
      expect(res.body).toMatchObject({
        code: ErrorCode.INQUIRY_DAILY_LIMIT,
        details: { limit: 10 },
      });
      // Another address (and a member on the same address) is not affected.
      await post(nextIp()).send(inquiryBody(b.agency.id)).expect(201);
      const c = await customer(t);
      await withSession(asGuest(t.http().post('/api/v1/inquiries'), ip), c.s)
        .send(inquiryBody(b.agency.id))
        .expect(201);
      for (let i = 0; i < 9; i++) await caps.consume('INQUIRY_CREATE', `u:${c.user.id}`);
      const capped = await withSession(t.http().post('/api/v1/inquiries'), c.s)
        .send(inquiryBody(b.agency.id))
        .expect(429);
      expect(capped.body.code).toBe(ErrorCode.INQUIRY_DAILY_LIMIT);
      expect(await t.prisma.inquiry.count()).toBe(2);
    });

    it('throttles to 5 per minute per client (THROTTLE.INQUIRY)', async () => {
      const b = await broker(t);
      const ip = nextIp();
      for (let i = 0; i < 5; i++) await post(ip).send(inquiryBody(b.agency.id)).expect(201);
      const res = await post(ip).send(inquiryBody(b.agency.id)).expect(429);
      expect(res.body.code).not.toBe(ErrorCode.INQUIRY_DAILY_LIMIT);
      await post(nextIp()).send(inquiryBody(b.agency.id)).expect(201);
    });

    it('403 CSRF_FAILED for a member without the CSRF token or from a foreign origin', async () => {
      const b = await broker(t);
      const c = await customer(t);
      const res = await t
        .http()
        .post('/api/v1/inquiries')
        .set('Cookie', c.s.cookie)
        .set('Origin', c.s.origin)
        .send(inquiryBody(b.agency.id))
        .expect(403);
      expect(res.body.code).toBe('CSRF_FAILED');
      const foreign = await post(nextIp())
        .set('Origin', 'https://evil.example')
        .send(inquiryBody(b.agency.id))
        .expect(403);
      expect(foreign.body.code).toBe('CSRF_FAILED');
      expect(await t.prisma.inquiry.count()).toBe(0);
    });
  });

  describe('POST /api/v1/inquiries/contact-events', () => {
    const event = (ip: string) => asGuest(t.http().post('/api/v1/inquiries/contact-events'), ip);

    it('204: one row per visitor + office + listing + channel and window, without PII', async () => {
      const b = await broker(t);
      const listing = await publicListing(t, b.agency.id);
      const ip = nextIp();
      const body = {
        agencyId: b.agency.id,
        listingId: listing.id,
        channel: 'CALL',
        source: 'SITE',
      };
      await event(ip).send(body).expect(204);
      await event(ip).send(body).expect(204);
      expect(await t.prisma.inquiry.count()).toBe(1);
      const row = await t.prisma.inquiry.findFirstOrThrow();
      expect(row).toMatchObject({
        channel: 'CALL',
        source: 'SITE',
        // A log line, not a case: never in the 새 문의 tab or its count.
        status: 'DONE',
        listingId: listing.id,
        userId: null,
        customerName: null,
        customerPhone: null,
        message: null,
      });
      // A contact press is a log line, not a message: it never counts toward the unread badge.
      expect(row.readAt).toEqual(row.createdAt);
      expect(row.visitorHash).toMatch(/^[0-9a-f]{64}$/);

      // Different channel, office page, or visitor → new rows.
      await event(ip)
        .send({ ...body, channel: 'COPY' })
        .expect(204);
      await event(ip)
        .send({ ...body, listingId: null })
        .expect(204);
      await event(nextIp()).send(body).expect(204);
      expect(await t.prisma.inquiry.count()).toBe(4);

      // The window is CONTACT_EVENT_DEDUPE_HOURS (6 h); once it ends the press is logged again.
      const hash = t.app.get(InquiryVisitorService).hashIp(ip);
      const key = `inquiries:contact:ip:${hash}:${b.agency.id}:${listing.id}:CALL`;
      const ttl = await t.redis.ttl(key);
      expect(ttl).toBeGreaterThan(6 * 3600 - 60);
      expect(ttl).toBeLessThanOrEqual(6 * 3600);
      await t.redis.del(key);
      await event(ip).send(body).expect(204);
      expect(await t.prisma.inquiry.count()).toBe(5);
      expect(await t.prisma.notification.count()).toBe(0);

      // The office sees them under 전체 and the channel filter, never as 새 문의 or unread.
      const inbox = await withSession(t.http().get('/api/v1/agency/inquiries'), b.s).expect(200);
      expect(inbox.body).toMatchObject({
        total: 5,
        unreadCount: 0,
        statusCounts: { NEW: 0, IN_PROGRESS: 0, DONE: 5 },
      });
      expect(inbox.body.items[0]).toMatchObject({ customerName: null, isMember: false });
      const fresh = await withSession(
        t.http().get('/api/v1/agency/inquiries?status=NEW'),
        b.s,
      ).expect(200);
      expect(fresh.body.total).toBe(0);
      const calls = await withSession(
        t.http().get('/api/v1/agency/inquiries?channel=CALL'),
        b.s,
      ).expect(200);
      expect(calls.body.total).toBe(4);
    });

    it('a member is logged without any name (no consent); the office’s own staff are not logged', async () => {
      const b = await broker(t);
      const c = await customer(t, { name: '김서진' });
      await withSession(t.http().post('/api/v1/inquiries/contact-events'), c.s)
        .send({ agencyId: b.agency.id, channel: 'SMS', source: 'MAIN' })
        .expect(204);
      const row = await t.prisma.inquiry.findFirstOrThrow();
      expect(row).toMatchObject({
        userId: c.user.id,
        customerName: null,
        visitorHash: null,
        status: 'DONE',
      });
      expect(row.readAt).toEqual(row.createdAt);
      const inbox = await withSession(t.http().get('/api/v1/agency/inquiries'), b.s).expect(200);
      expect(inbox.body.items[0]).toMatchObject({
        channel: 'SMS',
        customerName: null,
        isMember: true,
        canReply: false,
      });
      await withSession(t.http().post('/api/v1/inquiries/contact-events'), b.s)
        .send({ agencyId: b.agency.id, channel: 'CALL', source: 'MAIN' })
        .expect(204);
      expect(await t.prisma.inquiry.count()).toBe(1);
    });

    it('404 for unknown offices / listings; 400 for MESSAGE or bad ids; 403 foreign origin', async () => {
      const b = await broker(t);
      const { agency: pending } = await createAgency(t.prisma, { status: AgencyStatus.PENDING });
      const ip = nextIp();
      const notFound = await event(ip)
        .send({ agencyId: pending.id, channel: 'CALL', source: 'MAIN' })
        .expect(404);
      expect(notFound.body.code).toBe(ErrorCode.INQUIRY_AGENCY_NOT_FOUND);
      const other = await broker(t);
      const foreign = await publicListing(t, other.agency.id);
      const noListing = await event(ip)
        .send({ agencyId: b.agency.id, listingId: foreign.id, channel: 'CALL', source: 'MAIN' })
        .expect(404);
      expect(noListing.body.code).toBe(ErrorCode.INQUIRY_LISTING_NOT_FOUND);
      for (const body of [
        { agencyId: b.agency.id, channel: 'MESSAGE', source: 'MAIN' },
        { agencyId: 'x', channel: 'CALL', source: 'MAIN' },
        { agencyId: b.agency.id, channel: 'CALL' },
      ]) {
        const res = await event(ip).send(body).expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
      await event(ip)
        .set('Origin', 'https://evil.example')
        .send({ agencyId: b.agency.id, channel: 'CALL', source: 'MAIN' })
        .expect(403);
      expect(await t.prisma.inquiry.count()).toBe(0);
    });
  });
});
