import { stat } from 'node:fs/promises';
import path from 'node:path';
import { AdminRole, ErrorCode, UserRole } from '@house/shared';
import {
  createAdmin,
  createAgency,
  createListing,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  withSession,
  type TestSession,
} from '../../utils';
import { pdf, png } from './fixtures';
import { createMediaTestApp, itemIds, upload, uploadReady, type MediaTestApp } from './helpers';

const BAD_ID = 'nope';

describe('admin media: /api/v1/admin/media (e2e)', () => {
  let t: MediaTestApp;

  beforeAll(async () => {
    t = await createMediaTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function admin(role: AdminRole = AdminRole.ADMIN, mfaVerified = true) {
    const a = await createAdmin(t.prisma, { role });
    return { admin: a, s: await loginAdmin(t.app, { id: a.id, role }, { mfaVerified }) };
  }

  async function adminBanner(s: TestSession): Promise<string> {
    const view = await uploadReady(t, s, {
      admin: true,
      purpose: 'BANNER',
      file: await png(600, 200),
    });
    return view.id;
  }

  async function userDoc() {
    const user = await createUser(t.prisma);
    const s = await loginUser(t.app, { id: user.id });
    const res = await upload(t, s, {
      purpose: 'AGENCY_DOCUMENT',
      file: pdf(),
      contentType: 'application/pdf',
    }).expect(201);
    return { user, id: res.body.id as string };
  }

  describe('POST /admin/media', () => {
    it('201: banner image owned by the admin, audited', async () => {
      const { admin: a, s } = await admin(AdminRole.OPERATOR);
      const id = await adminBanner(s);
      const row = await t.prisma.media.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ ownerAdminId: a.id, ownerUserId: null, status: 'READY' });
      const log = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'media.upload' } });
      expect(log).toMatchObject({ adminUserId: a.id, resourceType: 'Media', resourceId: id });
    });

    it('401 for user sessions and for admins without TOTP', async () => {
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, { id: user.id });
      await withSession(t.http().post('/api/v1/admin/media?purpose=BANNER'), us)
        .attach('file', await png(), 'a.png')
        .expect(401);
      const { s } = await admin(AdminRole.ADMIN, false);
      const res = await upload(t, s, { admin: true, purpose: 'BANNER', file: await png() }).expect(
        401,
      );
      expect(res.body.code).toBe(ErrorCode.AUTH_TOTP_REQUIRED);
    });

    it('403 for purposes admins do not upload', async () => {
      const { s } = await admin();
      const res = await upload(t, s, {
        admin: true,
        purpose: 'LISTING_PHOTO',
        file: await png(),
      }).expect(403);
      expect(res.body.code).toBe(ErrorCode.MEDIA_PURPOSE_NOT_ALLOWED);
    });

    it('400 for an invalid purpose / 415 for a non-image', async () => {
      const { s } = await admin();
      await upload(t, s, { admin: true, purpose: 'nope', file: await png() }).expect(400);
      await upload(t, s, { admin: true, purpose: 'POPUP', file: pdf() }).expect(415);
    });
  });

  describe('GET /admin/media', () => {
    it('200: everything, filterable by owner / purpose / orphaned', async () => {
      const { s } = await admin(AdminRole.OPERATOR);
      const bannerId = await adminBanner(s);
      const doc = await userDoc();

      const all = await withSession(t.http().get('/api/v1/admin/media'), s).expect(200);
      expect(all.body.total).toBe(2);
      expect(all.body.items[0]).toHaveProperty('sha256');
      expect(all.body.items[0]).toHaveProperty('references');

      const mine = await withSession(
        t.http().get(`/api/v1/admin/media?ownerUserId=${doc.user.id}`),
        s,
      ).expect(200);
      expect(itemIds(mine.body)).toEqual([doc.id]);

      const byPurpose = await withSession(
        t.http().get('/api/v1/admin/media?purpose=BANNER'),
        s,
      ).expect(200);
      expect(itemIds(byPurpose.body)).toEqual([bannerId]);

      const orphaned = await withSession(
        t.http().get('/api/v1/admin/media?orphaned=true'),
        s,
      ).expect(200);
      expect(orphaned.body.total).toBe(2);
      const attached = await withSession(
        t.http().get('/api/v1/admin/media?orphaned=false'),
        s,
      ).expect(200);
      expect(attached.body.total).toBe(0);
    });

    it('401 with a user session', async () => {
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, { id: user.id });
      await withSession(t.http().get('/api/v1/admin/media'), us).expect(401);
    });

    it('400 for invalid filters', async () => {
      const { s } = await admin();
      const res = await withSession(t.http().get('/api/v1/admin/media?ownerUserId=x'), s).expect(
        400,
      );
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET /admin/media/:id and /:id/file', () => {
    it('200: detail with references; private file streamed and audited', async () => {
      const { admin: a, s } = await admin(AdminRole.OPERATOR);
      const doc = await userDoc();
      const detail = await withSession(t.http().get(`/api/v1/admin/media/${doc.id}`), s).expect(
        200,
      );
      expect(detail.body).toMatchObject({
        id: doc.id,
        ownerUserId: doc.user.id,
        visibility: 'PRIVATE',
        references: { agencyDocuments: 0 },
      });

      const file = await withSession(t.http().get(`/api/v1/admin/media/${doc.id}/file`), s)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(file.headers['content-type']).toBe('application/pdf');
      expect(file.headers['cache-control']).toBe('private, no-store');
      expect(file.headers['content-disposition']).toBe(
        `attachment; filename="media-${doc.id}.pdf"`,
      );
      expect(file.headers['content-security-policy']).toMatch(/sandbox/);
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      expect(file.body).toEqual(pdf());
      // recordSafe is fire-and-forget: wait for the row.
      let log = null;
      for (let i = 0; i < 20 && !log; i++) {
        log = await t.prisma.auditLog.findFirst({ where: { action: 'media.file.view' } });
        if (!log) await new Promise((r) => setImmediate(r));
      }
      expect(log).toMatchObject({ adminUserId: a.id, resourceId: doc.id });
    });

    it('404 for unknown ids, 401 for user sessions', async () => {
      const { s } = await admin();
      const unknown = '01900000-0000-7000-8000-000000000000';
      const res = await withSession(t.http().get(`/api/v1/admin/media/${unknown}`), s).expect(404);
      expect(res.body.code).toBe(ErrorCode.MEDIA_NOT_FOUND);
      await withSession(t.http().get(`/api/v1/admin/media/${unknown}/file`), s).expect(404);
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, { id: user.id });
      await withSession(t.http().get(`/api/v1/admin/media/${unknown}`), us).expect(401);
      await withSession(t.http().get(`/api/v1/admin/media/${unknown}/file`), us).expect(401);
    });

    it('400 for malformed ids', async () => {
      const { s } = await admin();
      await withSession(t.http().get(`/api/v1/admin/media/${BAD_ID}`), s).expect(400);
      await withSession(t.http().get(`/api/v1/admin/media/${BAD_ID}/file`), s).expect(400);
    });
  });

  describe('DELETE /admin/media/:id', () => {
    it('200: ADMIN removes an unattached upload; audited with before/after', async () => {
      const { admin: a, s } = await admin(AdminRole.ADMIN);
      const doc = await userDoc();
      const row = await t.prisma.media.findUniqueOrThrow({ where: { id: doc.id } });
      const res = await withSession(t.http().delete(`/api/v1/admin/media/${doc.id}`), s).expect(
        200,
      );
      expect(res.body.deletedAt).not.toBeNull();
      await expect(stat(path.join(t.privateDir, row.storageKey))).rejects.toThrow();
      const log = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'media.delete' } });
      expect(log).toMatchObject({ adminUserId: a.id, resourceId: doc.id });
      expect(log.before).toMatchObject({ id: doc.id, deletedAt: null });
    });

    it('409 while attached; 403 for OPERATOR; 401 for user sessions', async () => {
      const { s } = await admin(AdminRole.ADMIN);
      const { agency, owner } = await createAgency(t.prisma);
      const os = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        {
          agencyId: agency.id,
        },
      );
      const photo = {
        body: await uploadReady(t, os, { purpose: 'LISTING_PHOTO', file: await png() }),
      };
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.listingPhoto.create({
        data: { listingId: listing.id, mediaId: photo.body.id },
      });
      const res = await withSession(
        t.http().delete(`/api/v1/admin/media/${photo.body.id}`),
        s,
      ).expect(409);
      expect(res.body.code).toBe(ErrorCode.MEDIA_IN_USE);

      const op = await admin(AdminRole.OPERATOR);
      await withSession(t.http().delete(`/api/v1/admin/media/${photo.body.id}`), op.s).expect(403);
      await withSession(t.http().delete(`/api/v1/admin/media/${photo.body.id}`), os).expect(401);
    });

    it('400 for a malformed id', async () => {
      const { s } = await admin(AdminRole.ADMIN);
      await withSession(t.http().delete(`/api/v1/admin/media/${BAD_ID}`), s).expect(400);
    });
  });

  describe('POST /admin/media/cleanup', () => {
    it('200: runs the orphan cleanup now (audited)', async () => {
      const { s } = await admin(AdminRole.ADMIN);
      const res = await withSession(t.http().post('/api/v1/admin/media/cleanup'), s).expect(200);
      expect(res.body).toEqual({ orphaned: 0, staleFailed: 0, purged: 0 });
      await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'media.cleanup' } });
    });

    it('403 for OPERATOR, 401 for TOTP-pending admins, 403 without CSRF', async () => {
      const op = await admin(AdminRole.OPERATOR);
      await withSession(t.http().post('/api/v1/admin/media/cleanup'), op.s).expect(403);
      const pending = await admin(AdminRole.SUPER_ADMIN, false);
      await withSession(t.http().post('/api/v1/admin/media/cleanup'), pending.s).expect(401);
      const { s } = await admin(AdminRole.ADMIN);
      await t
        .http()
        .post('/api/v1/admin/media/cleanup')
        .set('Cookie', s.cookie)
        .set('Origin', 'https://evil.example')
        .expect(403);
    });
  });
});
