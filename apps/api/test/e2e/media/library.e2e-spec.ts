import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ErrorCode, UserRole } from '@house/shared';
import {
  createAgency,
  createListing,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestSession,
} from '../../utils';
import { jpegWithExif, pdf, png } from './fixtures';
import { createMediaTestApp, itemIds, upload, uploadReady, type MediaTestApp } from './helpers';

const BAD_ID = 'not-a-uuid';

describe('media library: GET/DELETE /api/v1/media (e2e)', () => {
  let t: MediaTestApp;

  beforeAll(async () => {
    t = await createMediaTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function userSession(role: UserRole = UserRole.USER, agencyId: string | null = null) {
    const user = await createUser(t.prisma, { role });
    return { user, s: await loginUser(t.app, { id: user.id, role }, { agencyId }) };
  }

  async function uploadPng(s: TestSession, purpose = 'DEAL_REQUEST_PHOTO') {
    const view = await uploadReady(t, s, { purpose, file: await png(), filename: 'p.png' });
    return view as { id: string; url: string; variants: Record<string, { url: string }> };
  }

  async function uploadDoc(s: TestSession) {
    const file = pdf();
    const res = await upload(t, s, {
      purpose: 'AGENCY_DOCUMENT',
      file,
      filename: 'doc.pdf',
      contentType: 'application/pdf',
    }).expect(201);
    return { id: res.body.id as string, file };
  }

  describe('GET /media (mine)', () => {
    it('200: only my live uploads, newest first, filterable', async () => {
      const me = await userSession();
      const other = await userSession();
      const a = await uploadPng(me.s);
      const b = await uploadPng(me.s, 'AGENCY_LOGO');
      await uploadPng(other.s);

      const all = await withSession(t.http().get('/api/v1/media'), me.s).expect(200);
      expect(all.body).toMatchObject({ total: 2, page: 1 });
      expect(itemIds(all.body)).toEqual([b.id, a.id]);
      expect(all.body.items[0]).toHaveProperty('originalFilename', 'p.png');

      const filtered = await withSession(
        t.http().get('/api/v1/media?purpose=AGENCY_LOGO&status=READY&pageSize=1'),
        me.s,
      ).expect(200);
      expect(filtered.body).toMatchObject({ total: 1, pageSize: 1 });
      expect(filtered.body.items[0].id).toBe(b.id);
    });

    it('401 anonymous', async () => {
      await t.http().get('/api/v1/media').expect(401);
    });

    it('400 invalid filters', async () => {
      const me = await userSession();
      const res = await withSession(t.http().get('/api/v1/media?status=DONE'), me.s).expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      await withSession(t.http().get('/api/v1/media?pageSize=1000'), me.s).expect(400);
    });
  });

  describe('GET /media/:id', () => {
    it('200: anyone sees READY public media without owner-only fields', async () => {
      const me = await userSession();
      const m = await uploadPng(me.s, 'AGENCY_LOGO');
      const res = await t.http().get(`/api/v1/media/${m.id}`).expect(200);
      expect(res.body).toMatchObject({ id: m.id, status: 'READY', url: m.url });
      expect(res.body).not.toHaveProperty('originalFilename');
      expect(res.body).not.toHaveProperty('attached');
    });

    it('200: the owner sees own PENDING/private uploads', async () => {
      const me = await userSession();
      const doc = await uploadDoc(me.s);
      const res = await withSession(t.http().get(`/api/v1/media/${doc.id}`), me.s).expect(200);
      expect(res.body).toMatchObject({
        visibility: 'PRIVATE',
        url: null,
        originalFilename: 'doc.pdf',
      });
    });

    it('404 for private media of others and for unprocessed media', async () => {
      const me = await userSession();
      const other = await userSession();
      const doc = await uploadDoc(me.s);
      const a = await t.http().get(`/api/v1/media/${doc.id}`).expect(404);
      expect(a.body.code).toBe(ErrorCode.MEDIA_NOT_FOUND);
      await withSession(t.http().get(`/api/v1/media/${doc.id}`), other.s).expect(404);
      const pending = await t.prisma.media.create({
        data: {
          purpose: 'AGENCY_LOGO',
          status: 'PENDING',
          mimeType: 'image/webp',
          sizeBytes: 1,
          sha256: '0'.repeat(64),
          storageKey: 'img/test/p.webp',
          ownerUserId: me.user.id,
        },
      });
      await withSession(t.http().get(`/api/v1/media/${pending.id}`), other.s).expect(404);
    });

    it('deal-request photos: metadata for the uploader only (the request itself is restricted)', async () => {
      const me = await userSession();
      const other = await userSession();
      const photo = await uploadPng(me.s, 'DEAL_REQUEST_PHOTO');
      await t.http().get(`/api/v1/media/${photo.id}`).expect(404);
      await withSession(t.http().get(`/api/v1/media/${photo.id}`), other.s).expect(404);
      const mine = await withSession(t.http().get(`/api/v1/media/${photo.id}`), me.s).expect(200);
      expect(mine.body).toMatchObject({ id: photo.id, purpose: 'DEAL_REQUEST_PHOTO' });
      const logo = await uploadPng(me.s, 'AGENCY_LOGO');
      await t.http().get(`/api/v1/media/${logo.id}`).expect(200);
    });

    it('400 for a malformed id', async () => {
      const res = await t.http().get(`/api/v1/media/${BAD_ID}`).expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET /media/:id/private', () => {
    it('200: the uploader streams the file, never cached', async () => {
      const me = await userSession();
      const doc = await uploadDoc(me.s);
      const res = await withSession(t.http().get(`/api/v1/media/${doc.id}/private`), me.s)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      // PDFs are stored as uploaded: always a download, sandboxed, never active on the site origin.
      expect(res.headers['content-disposition']).toBe(`attachment; filename="media-${doc.id}.pdf"`);
      expect(res.headers['content-security-policy']).toMatch(/default-src 'none'.*sandbox/);
      expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
      expect(res.body).toEqual(doc.file);
    });

    it('200: staff of the agency the document is attached to', async () => {
      const applicant = await userSession();
      const doc = await uploadDoc(applicant.s);
      const { agency } = await createAgency(t.prisma);
      await t.prisma.agencyDocument.create({
        data: { agencyId: agency.id, type: 'REGISTRATION_CERT', mediaId: doc.id },
      });
      const staff = await userSession(UserRole.AGENT, agency.id);
      await withSession(t.http().get(`/api/v1/media/${doc.id}/private`), staff.s).expect(200);

      // Staff of another agency, or a plain user claiming the agency, get nothing.
      const { agency: otherAgency } = await createAgency(t.prisma);
      const outsider = await userSession(UserRole.AGENT, otherAgency.id);
      await withSession(t.http().get(`/api/v1/media/${doc.id}/private`), outsider.s).expect(404);
      const plain = await userSession(UserRole.USER, agency.id);
      await withSession(t.http().get(`/api/v1/media/${doc.id}/private`), plain.s).expect(404);
    });

    it('401 anonymous, 404 for other users and for public media', async () => {
      const me = await userSession();
      const other = await userSession();
      const doc = await uploadDoc(me.s);
      await t.http().get(`/api/v1/media/${doc.id}/private`).expect(401);
      const res = await withSession(
        t.http().get(`/api/v1/media/${doc.id}/private`),
        other.s,
      ).expect(404);
      expect(res.body.code).toBe(ErrorCode.MEDIA_NOT_FOUND);
      const pub = await uploadPng(me.s);
      await withSession(t.http().get(`/api/v1/media/${pub.id}/private`), me.s).expect(404);
    });

    it('400 for a malformed id', async () => {
      const me = await userSession();
      await withSession(t.http().get(`/api/v1/media/${BAD_ID}/private`), me.s).expect(400);
    });
  });

  describe('DELETE /media/:id', () => {
    it('204: removes an unattached upload and its files', async () => {
      const me = await userSession();
      const m = await uploadPng(me.s);
      const row = await t.prisma.media.findUniqueOrThrow({ where: { id: m.id } });
      const file = path.join(t.publicDir, row.storageKey);
      await expect(stat(file)).resolves.toBeTruthy();

      await withSession(t.http().delete(`/api/v1/media/${m.id}`), me.s).expect(204);

      const after = await t.prisma.media.findUniqueOrThrow({ where: { id: m.id } });
      expect(after.deletedAt).not.toBeNull();
      await expect(stat(file)).rejects.toThrow();
      await expect(stat(file.replace('.webp', '_thumb.webp'))).rejects.toThrow();
      await withSession(t.http().get(`/api/v1/media/${m.id}`), me.s).expect(404);
      await withSession(t.http().delete(`/api/v1/media/${m.id}`), me.s).expect(404);
    });

    it('409 MEDIA_IN_USE while attached to a listing', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const s = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        {
          agencyId: agency.id,
        },
      );
      const res = {
        body: await uploadReady(t, s, { purpose: 'LISTING_PHOTO', file: await jpegWithExif() }),
      };
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.listingPhoto.create({ data: { listingId: listing.id, mediaId: res.body.id } });

      const del = await withSession(t.http().delete(`/api/v1/media/${res.body.id}`), s).expect(409);
      expect(del.body.code).toBe(ErrorCode.MEDIA_IN_USE);
      const own = await withSession(t.http().get(`/api/v1/media/${res.body.id}`), s).expect(200);
      expect(own.body.attached).toBe(true);
    });

    it('401 anonymous, 404 for somebody else’s upload, 403 without CSRF', async () => {
      const me = await userSession();
      const other = await userSession();
      const m = await uploadPng(me.s);
      await t.http().delete(`/api/v1/media/${m.id}`).expect(401);
      await withSession(t.http().delete(`/api/v1/media/${m.id}`), other.s).expect(404);
      await t
        .http()
        .delete(`/api/v1/media/${m.id}`)
        .set('Cookie', me.s.cookie)
        .set('Origin', me.s.origin)
        .expect(403);
      expect(
        (await t.prisma.media.findUniqueOrThrow({ where: { id: m.id } })).deletedAt,
      ).toBeNull();
    });

    it('400 for a malformed id', async () => {
      const me = await userSession();
      await withSession(t.http().delete(`/api/v1/media/${BAD_ID}`), me.s).expect(400);
    });
  });
});
