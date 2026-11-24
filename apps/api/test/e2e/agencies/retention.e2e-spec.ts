import { access } from 'node:fs/promises';
import path from 'node:path';
import { AgencyStatus } from '@house/shared';
import { AgencyRetentionService } from '../../../src/modules/agencies/services/agency-retention.service';
import { createTestApp, resetAll, type TestApp } from '../../utils';
import { createPendingAgency, writePrivateFile } from './helpers';

const DAY = 86_400_000;

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

/** 반려된 신청은 반려 후 1년 (PRIVACY_AGENCY_APPLICATION): the daily purge job. */
describe('agencies: retention purge of rejected applications (e2e, real DB)', () => {
  let t: TestApp;
  let svc: AgencyRetentionService;
  const now = new Date('2028-03-01T03:47:00Z');

  beforeAll(async () => {
    t = await createTestApp();
    svc = t.app.get(AgencyRetentionService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  /** A rejected application with its 등록증 on disk, rejected `daysAgo` before `now`. */
  async function rejected(daysAgo: number, extra: { deletedAt?: Date } = {}) {
    const app = await createPendingAgency(t.prisma, {
      mobile: '01012345678',
      email: 'rep@example.com',
    });
    const rejectedAt = new Date(now.getTime() - daysAgo * DAY);
    await t.prisma.agency.update({
      where: { id: app.agency.id },
      data: { status: AgencyStatus.REJECTED, statusReason: '서류 불일치', ...extra },
    });
    await t.prisma.agencyStatusHistory.create({
      data: {
        agencyId: app.agency.id,
        fromStatus: AgencyStatus.PENDING,
        toStatus: AgencyStatus.REJECTED,
        reason: '서류 불일치',
        createdAt: rejectedAt,
      },
    });
    await writePrivateFile(app.document, '%PDF-1.4 등록증');
    const file = path.join(process.env.PRIVATE_UPLOAD_DIR ?? '', app.document.storageKey);
    return { ...app, file };
  }

  it('erases applications rejected more than a year ago: row, staff, documents, files; audited', async () => {
    const due = await rejected(370);
    const removedByAdmin = await rejected(400, { deletedAt: new Date(now.getTime() - 380 * DAY) });
    // Exactly one calendar year (2027-03-01 → 2028-03-01, a leap year: 366 days) is not yet past.
    const recent = await rejected(366);
    expect(await exists(due.file)).toBe(true);

    expect(await svc.purgeRejectedApplications(now)).toBe(2);

    for (const gone of [due, removedByAdmin]) {
      expect(await t.prisma.agency.findUnique({ where: { id: gone.agency.id } })).toBeNull();
      expect(await t.prisma.agencyMember.count({ where: { agencyId: gone.agency.id } })).toBe(0);
      expect(await t.prisma.agencyDocument.count({ where: { agencyId: gone.agency.id } })).toBe(0);
      expect(
        await t.prisma.agencyStatusHistory.count({ where: { agencyId: gone.agency.id } }),
      ).toBe(0);
      const media = await t.prisma.media.findUniqueOrThrow({ where: { id: gone.document.id } });
      expect(media.deletedAt).toEqual(now);
      expect(media.originalFilename).toBeNull();
      expect(await exists(gone.file)).toBe(false);
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency.purge-rejected', resourceId: gone.agency.id },
      });
      expect(audit.actorType).toBe('SYSTEM');
      // The entry proves the purge without keeping what was purged.
      const logged = JSON.stringify([audit.before, audit.after]);
      expect(logged).not.toContain(gone.agency.representativeName);
      expect(logged).not.toContain(gone.agency.registrationNumber);
      expect(logged).not.toContain('01012345678');
    }
    // The applicant's account stays; only the application is erased.
    expect(await t.prisma.user.findUnique({ where: { id: due.owner.id } })).not.toBeNull();

    // Within the year: untouched.
    expect(await t.prisma.agency.findUnique({ where: { id: recent.agency.id } })).toMatchObject({
      representativeName: recent.agency.representativeName,
      mobile: '01012345678',
    });
    expect(await t.prisma.agencyDocument.count({ where: { agencyId: recent.agency.id } })).toBe(1);
    expect(await exists(recent.file)).toBe(true);

    // Idempotent.
    expect(await svc.purgeRejectedApplications(now)).toBe(0);
  });

  it('keeps resubmitted (pending) and re-rejected applications until a year after the latest rejection', async () => {
    const resubmitted = await rejected(500);
    await t.prisma.agency.update({
      where: { id: resubmitted.agency.id },
      data: { status: AgencyStatus.PENDING },
    });
    const reRejected = await rejected(500);
    await t.prisma.agencyStatusHistory.create({
      data: {
        agencyId: reRejected.agency.id,
        fromStatus: AgencyStatus.PENDING,
        toStatus: AgencyStatus.REJECTED,
        createdAt: new Date(now.getTime() - 30 * DAY),
      },
    });

    expect(await svc.purgeRejectedApplications(now)).toBe(0);
    expect(await t.prisma.agency.count()).toBe(2);
    expect(await exists(resubmitted.file)).toBe(true);
    expect(await exists(reRejected.file)).toBe(true);

    // A year after the second rejection it is due.
    expect(await svc.purgeRejectedApplications(new Date(now.getTime() + 340 * DAY))).toBe(1);
    expect(await t.prisma.agency.findUnique({ where: { id: reRejected.agency.id } })).toBeNull();
    expect(
      await t.prisma.agency.findUnique({ where: { id: resubmitted.agency.id } }),
    ).not.toBeNull();
  });

  it('never touches approved or suspended offices', async () => {
    const approved = await rejected(800);
    await t.prisma.agency.update({
      where: { id: approved.agency.id },
      data: { status: AgencyStatus.SUSPENDED, approvedAt: new Date('2026-01-01') },
    });
    expect(await svc.purgeRejectedApplications(now)).toBe(0);
    expect(await t.prisma.agency.count()).toBe(1);
  });
});
