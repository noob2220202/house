import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ErrorCode, MEDIA_USER_QUOTA, UserRole, type OwnMediaView } from '@house/shared';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import sharp from 'sharp';
import { kstDateKey } from '../../../src/common/throttle/daily-cap.service';
import { ImageProcessor } from '../../../src/modules/media/image-processor';
import { MediaProcessingService } from '../../../src/modules/media/media-processing.service';
import { QUEUES } from '../../../src/queue/queue.constants';
import {
  createAgency,
  createMedia,
  createUser,
  loginUser,
  resetAll,
  withSession,
} from '../../utils';
import { fakeHeic, jpegWithExif, pdf, png, pngHeaderOnly, webp } from './fixtures';
import { createMediaTestApp, upload, uploadReady, withBadCsrf, type MediaTestApp } from './helpers';

describe('POST /api/v1/media (e2e)', () => {
  let t: MediaTestApp;

  beforeAll(async () => {
    t = await createMediaTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function agent() {
    const { agency, owner } = await createAgency(t.prisma);
    const s = await loginUser(
      t.app,
      { id: owner.id, role: UserRole.AGENCY_OWNER },
      {
        agencyId: agency.id,
      },
    );
    return { agency, owner, s };
  }

  async function plainUser() {
    const user = await createUser(t.prisma);
    return { user, s: await loginUser(t.app, { id: user.id }) };
  }

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_media?');
    expect(t.redis.options.db).toBe(7);
    const [row] = await t.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    expect(row?.db).toBe('house_test_media');
  });

  describe('happy paths', () => {
    it('listing photo: 202 PENDING, then (worker) READY sanitized webp + variants', async () => {
      const { owner, s } = await agent();
      const res = await upload(t, s, {
        purpose: 'LISTING_PHOTO',
        file: await jpegWithExif(400, 200),
        filename: '거실 사진.jpg',
      }).expect(202);
      expect(res.body).toMatchObject({ status: 'PENDING', mimeType: 'image/webp', url: null });
      const id = (res.body as OwnMediaView).id;
      await expect(t.app.get(MediaProcessingService).processPending(id)).resolves.toBe('READY');
      const view = await withSession(t.http().get(`/api/v1/media/${id}`), s).expect(200);

      expect(view.body).toMatchObject({
        purpose: 'LISTING_PHOTO',
        visibility: 'PUBLIC',
        status: 'READY',
        mimeType: 'image/webp',
        width: 200,
        height: 400,
        originalFilename: '거실 사진.jpg',
        attached: false,
        error: null,
      });
      const body = view.body as OwnMediaView;
      expect(body.url).toMatch(/^\/media\/img\/\d{4}\/\d{2}\/[0-9a-f]{2}\/[0-9a-f]{32}\.webp$/);
      expect(Object.keys(body.variants).sort()).toEqual(['large', 'medium', 'thumb']);
      expect(res.body).not.toHaveProperty('storageKey');
      expect(view.body).not.toHaveProperty('storageKey');

      const row = await t.prisma.media.findUniqueOrThrow({ where: { id } });
      expect(row.ownerUserId).toBe(owner.id);
      const stored = await readFile(path.join(t.publicDir, row.storageKey));
      const meta = await sharp(stored).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 200, height: 400 });
      expect(meta.exif).toBeUndefined();
      expect(row.sizeBytes).toBe(stored.length);
      for (const v of ['thumb', 'medium', 'large'] as const) {
        const url = body.variants[v]?.url ?? '';
        await expect(
          stat(path.join(t.publicDir, url.replace(/^\/media\//, ''))),
        ).resolves.toBeTruthy();
      }
    });

    it('any user: deal-request photo (png) and agency logo (webp)', async () => {
      const { s } = await plainUser();
      const a = await uploadReady(t, s, {
        purpose: 'DEAL_REQUEST_PHOTO',
        file: await png(),
        filename: 'a.png',
      });
      expect(a).toMatchObject({ status: 'READY', width: 64, height: 48 });
      const b = await uploadReady(t, s, {
        purpose: 'AGENCY_LOGO',
        file: await webp(),
        filename: 'me.webp',
      });
      expect(b).toMatchObject({ status: 'READY', width: 64, height: 48 });
    });

    it('SEC-01: the HTTP API never decodes an image (libvips runs in the worker only)', async () => {
      const processor = t.app.get(ImageProcessor);
      const spies = [
        jest.spyOn(processor, 'probe'),
        jest.spyOn(processor, 'processImage'),
        jest.spyOn(processor, 'processDocument'),
      ];
      try {
        const { s } = await plainUser();
        const cases = [
          { purpose: 'DEAL_REQUEST_PHOTO', file: await jpegWithExif(40, 20) },
          { purpose: 'DEAL_REQUEST_PHOTO', file: await png() },
          { purpose: 'AGENCY_LOGO', file: await webp() },
          { purpose: 'AGENCY_DOCUMENT', file: await jpegWithExif(40, 20) },
          { purpose: 'AGENCY_DOCUMENT', file: await png() },
        ];
        for (const c of cases) {
          const res = await upload(t, s, c).expect(202);
          expect(res.body).toMatchObject({ status: 'PENDING' });
        }
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
        const docs = await t.prisma.media.findMany({
          where: { purpose: 'AGENCY_DOCUMENT' },
          select: { mimeType: true, storageKey: true },
          orderBy: { createdAt: 'asc' },
        });
        expect(docs.map((d) => d.mimeType)).toEqual(['image/jpeg', 'image/png']);
        expect(docs.every((d) => d.storageKey.startsWith('doc/'))).toBe(true);
      } finally {
        for (const spy of spies) spy.mockRestore();
      }
    });

    it('403 PROFILE for everyone: no FK link yet, so uploads would never be collected', async () => {
      const { s } = await plainUser();
      const res = await upload(t, s, { purpose: 'PROFILE', file: await png() }).expect(403);
      expect(res.body.code).toBe(ErrorCode.MEDIA_PURPOSE_NOT_ALLOWED);
      expect(await t.prisma.media.count()).toBe(0);
    });

    it('agency document (pdf): private, stored outside the public root, no URL', async () => {
      const { s } = await plainUser();
      const file = pdf();
      const res = await upload(t, s, {
        purpose: 'AGENCY_DOCUMENT',
        file,
        filename: '등록증.pdf',
        contentType: 'application/pdf',
      }).expect(201);
      expect(res.body).toMatchObject({
        visibility: 'PRIVATE',
        status: 'READY',
        mimeType: 'application/pdf',
        url: null,
        variants: {},
      });
      const row = await t.prisma.media.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.storageKey).toMatch(/^doc\/\d{4}\/\d{2}\/[0-9a-f]{32}\.pdf$/);
      expect(await readFile(path.join(t.privateDir, row.storageKey))).toEqual(file);
      await expect(stat(path.join(t.publicDir, row.storageKey))).rejects.toThrow();
    });

    it('HEIC goes to the worker: 202 PENDING with raw bytes in private staging + a queued job', async () => {
      const { s } = await agent();
      const res = await upload(t, s, {
        purpose: 'LISTING_PHOTO',
        file: fakeHeic(),
        filename: 'IMG_0001.HEIC',
        contentType: 'image/heic',
      }).expect(202);
      const { id } = res.body as OwnMediaView;
      expect(res.body).toMatchObject({ status: 'PENDING', url: null, variants: {} });
      await expect(stat(path.join(t.privateDir, 'staging', id))).resolves.toBeTruthy();
      const queue = t.app.get<Queue>(getQueueToken(QUEUES.MEDIA_PROCESSING));
      const job = await queue.getJob(id);
      expect(job?.data).toEqual({ mediaId: id });
    });
  });

  describe('authorization', () => {
    it('401 without a session (body never read)', async () => {
      const res = await upload(t, null, { purpose: 'AGENCY_LOGO', file: await png() }).expect(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('403 CSRF_FAILED with a forged CSRF token', async () => {
      const { s } = await plainUser();
      const req = withBadCsrf(t.http().post('/api/v1/media?purpose=AGENCY_LOGO'), s).attach(
        'file',
        await png(),
        'a.png',
      );
      expect((await req.expect(403)).body.code).toBe(ErrorCode.CSRF_FAILED);
    });

    it('403 MEDIA_PURPOSE_NOT_ALLOWED: plain users cannot upload listing photos or banners', async () => {
      const { s } = await plainUser();
      for (const purpose of ['LISTING_PHOTO', 'BANNER', 'COMPLEX_PHOTO']) {
        const res = await upload(t, s, { purpose, file: await png() }).expect(403);
        expect(res.body.code).toBe(ErrorCode.MEDIA_PURPOSE_NOT_ALLOWED);
      }
      expect(await t.prisma.media.count()).toBe(0);
    });

    it('429 when the daily upload cap is used up', async () => {
      const { user, s } = await plainUser();
      await t.redis.set(`cap:MEDIA_UPLOAD:${kstDateKey()}:${user.id}`, '300');
      const res = await upload(t, s, { purpose: 'AGENCY_LOGO', file: await png() }).expect(429);
      expect(res.body.code).toBe(ErrorCode.RATE_LIMITED);
    });

    it('409 MEDIA_QUOTA_EXCEEDED when the storage quota is full', async () => {
      const { user, s } = await plainUser();
      await createMedia(t.prisma, {
        purpose: 'AGENCY_LOGO',
        ownerUserId: user.id,
        sizeBytes: MEDIA_USER_QUOTA.maxBytes - 10,
      });
      const res = await upload(t, s, { purpose: 'AGENCY_LOGO', file: await png() }).expect(409);
      expect(res.body).toMatchObject({
        code: ErrorCode.MEDIA_QUOTA_EXCEEDED,
        details: { maxBytes: MEDIA_USER_QUOTA.maxBytes },
      });
    });

    it('429 MEDIA_TOO_MANY_PENDING when too many uploads wait for processing', async () => {
      const { owner, s } = await agent();
      await t.prisma.media.createMany({
        data: Array.from({ length: MEDIA_USER_QUOTA.maxPending }, (_, i) => ({
          purpose: 'LISTING_PHOTO' as const,
          status: 'PENDING' as const,
          mimeType: 'image/webp',
          sizeBytes: 10,
          sha256: String(i).padStart(64, '0'),
          storageKey: `img/test/pending-${i}.webp`,
          ownerUserId: owner.id,
        })),
      });
      const res = await upload(t, s, {
        purpose: 'LISTING_PHOTO',
        file: fakeHeic(),
        contentType: 'image/heic',
      }).expect(429);
      expect(res.body.code).toBe(ErrorCode.MEDIA_TOO_MANY_PENDING);
    });
  });

  describe('validation', () => {
    it('400 VALIDATION_FAILED for a missing or unknown purpose', async () => {
      const { s } = await plainUser();
      const missing = await upload(t, s, { file: await png() }).expect(400);
      expect(missing.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      const bad = await upload(t, s, { purpose: 'WALLPAPER', file: await png() }).expect(400);
      expect(bad.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('400 MEDIA_FILE_REQUIRED without a multipart file', async () => {
      const { s } = await plainUser();
      const json = await upload(t, s, { purpose: 'AGENCY_LOGO' }).send({ file: 'x' }).expect(400);
      expect(json.body.code).toBe(ErrorCode.MEDIA_FILE_REQUIRED);
      const noFile = await upload(t, s, { purpose: 'AGENCY_LOGO' }).field('note', 'hi').expect(400);
      expect(noFile.body.code).toBe(ErrorCode.MEDIA_FILE_REQUIRED);
    });

    it('400 MEDIA_UPLOAD_INVALID for a wrong field name or several files', async () => {
      const { s } = await plainUser();
      const wrong = await upload(t, s, {
        purpose: 'AGENCY_LOGO',
        file: await png(),
        field: 'image',
      }).expect(400);
      expect(wrong.body.code).toBe(ErrorCode.MEDIA_UPLOAD_INVALID);
      const two = await upload(t, s, { purpose: 'AGENCY_LOGO', file: await png() })
        .attach('file', await png(), 'b.png')
        .expect(400);
      expect(two.body.code).toBe(ErrorCode.MEDIA_UPLOAD_INVALID);
    });

    it('415 for content that is not an accepted image, whatever name/type the client claims', async () => {
      const { s } = await plainUser();
      const disguised = [
        Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'latin1'),
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        Buffer.from('<html><body>hi</body></html>'),
        pdf(),
      ];
      for (const file of disguised) {
        const res = await upload(t, s, { purpose: 'AGENCY_LOGO', file, filename: 'x.jpg' }).expect(
          415,
        );
        expect(res.body.code).toBe(ErrorCode.MEDIA_UNSUPPORTED_TYPE);
      }
      // A webp is fine as an image but not as an agency document.
      const doc = await upload(t, s, { purpose: 'AGENCY_DOCUMENT', file: await webp() }).expect(
        415,
      );
      expect(doc.body.code).toBe(ErrorCode.MEDIA_UNSUPPORTED_TYPE);
      expect(await t.prisma.media.count()).toBe(0);
    });

    it('415 for a corrupt image behind a valid signature (header check, nothing stored)', async () => {
      const { s } = await plainUser();
      const corrupt = [
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]),
        (await png()).subarray(0, 20),
        Buffer.from('RIFF\0\0\0\0WEBPVP8 \0\0\0\0\0\0\0\0\0\0\0\0\0\0', 'latin1'),
      ];
      for (const file of corrupt) {
        const res = await upload(t, s, { purpose: 'AGENCY_LOGO', file }).expect(415);
        expect(res.body.code).toBe(ErrorCode.MEDIA_UNSUPPORTED_TYPE);
      }
      expect(await t.prisma.media.count()).toBe(0);
    });

    it('400 MEDIA_DIMENSIONS_INVALID up front for a decompression bomb header', async () => {
      const { s } = await plainUser();
      const res = await upload(t, s, {
        purpose: 'DEAL_REQUEST_PHOTO',
        file: pngHeaderOnly(20_000, 20_000),
      }).expect(400);
      expect(res.body.code).toBe(ErrorCode.MEDIA_DIMENSIONS_INVALID);
      expect(await t.prisma.media.count()).toBe(0);
    });

    it('415 MEDIA_HEIC_UNSUPPORTED up front when this server cannot convert HEIC', async () => {
      const { s } = await agent();
      t.heic.supported = false;
      try {
        const res = await upload(t, s, {
          purpose: 'LISTING_PHOTO',
          file: fakeHeic(),
          contentType: 'image/heic',
        }).expect(415);
        expect(res.body.code).toBe(ErrorCode.MEDIA_HEIC_UNSUPPORTED);
      } finally {
        t.heic.supported = true;
      }
      expect(await t.prisma.media.count()).toBe(0);
    });

    it('413 MEDIA_TOO_LARGE above the purpose limit (agency logo: 5MB)', async () => {
      const { s } = await plainUser();
      const big = Buffer.concat([await png(), Buffer.alloc(5 * 1024 * 1024)]);
      const res = await upload(t, s, { purpose: 'AGENCY_LOGO', file: big }).expect(413);
      expect(res.body).toMatchObject({
        code: ErrorCode.MEDIA_TOO_LARGE,
        details: { maxBytes: 5 * 1024 * 1024 },
      });
    });
  });
});
