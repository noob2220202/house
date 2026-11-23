import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ErrorCode, MEDIA_ORPHAN_GRACE_HOURS, UserRole } from '@house/shared';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { AppException } from '../../../src/common/errors/app.exception';
import { MediaProcessor } from '../../../src/modules/media/jobs/media.processor';
import { MediaCleanupService } from '../../../src/modules/media/media-cleanup.service';
import { MediaProcessingService } from '../../../src/modules/media/media-processing.service';
import { MediaService } from '../../../src/modules/media/media.service';
import {
  createAdmin,
  createAgency,
  createListing,
  createMedia,
  createUser,
  loginUser,
  resetAll,
  type TestSession,
  withSession,
} from '../../utils';
import { fakeHeic, png } from './fixtures';
import { createMediaTestApp, solidRaw, upload, uploadReady, type MediaTestApp } from './helpers';

const HOUR = 3_600_000;

describe('media lifecycle: processing, cleanup, MediaService (e2e)', () => {
  let t: MediaTestApp;
  let processing: MediaProcessingService;
  let cleanup: MediaCleanupService;
  let media: MediaService;

  beforeAll(async () => {
    t = await createMediaTestApp();
    processing = t.app.get(MediaProcessingService);
    cleanup = t.app.get(MediaCleanupService);
    media = t.app.get(MediaService);
  });
  beforeEach(async () => {
    await resetAll(t);
    t.heic.next = solidRaw(80, 60);
  });
  afterAll(() => t?.close());

  async function agentSession() {
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

  async function queuedHeic(s: TestSession): Promise<string> {
    const res = await upload(t, s, {
      purpose: 'LISTING_PHOTO',
      file: fakeHeic(),
      contentType: 'image/heic',
    }).expect(202);
    return res.body.id as string;
  }

  describe('background processing', () => {
    it('HEIC agency documents go through the worker too: PENDING → private JPEG', async () => {
      const s = await loginUser(t.app, { id: (await createUser(t.prisma)).id });
      const res = await upload(t, s, {
        purpose: 'AGENCY_DOCUMENT',
        file: fakeHeic(),
        filename: 'scan.heic',
        contentType: 'image/heic',
      }).expect(202);
      const id = res.body.id as string;
      expect(res.body).toMatchObject({ status: 'PENDING', visibility: 'PRIVATE', url: null });
      await expect(stat(path.join(t.privateDir, 'staging', id))).resolves.toBeTruthy();

      await expect(processing.processPending(id)).resolves.toBe('READY');
      const row = await t.prisma.media.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        status: 'READY',
        visibility: 'PRIVATE',
        mimeType: 'image/jpeg',
        width: 80,
        height: 60,
        variants: null,
      });
      expect(row.storageKey).toMatch(/^doc\/\d{4}\/\d{2}\/[0-9a-f]{32}\.jpg$/);
      const stored = await readFile(path.join(t.privateDir, row.storageKey));
      expect((await sharp(stored).metadata()).format).toBe('jpeg');
      expect(row.sizeBytes).toBe(stored.length);
      await expect(stat(path.join(t.privateDir, 'staging', id))).rejects.toThrow();
      await expect(stat(path.join(t.publicDir, row.storageKey))).rejects.toThrow();
      const file = await withSession(t.http().get(`/api/v1/media/${id}/private`), s).expect(200);
      expect(file.headers['content-type']).toBe('image/jpeg');
      expect(file.headers['content-disposition']).toBe(`inline; filename="media-${id}.jpg"`);
      expect(file.headers['content-security-policy']).toMatch(/sandbox/);
    });

    it('PENDING → READY: variants written, staging removed; reruns are no-ops', async () => {
      const { s } = await agentSession();
      const id = await queuedHeic(s);

      await expect(processing.processPending(id)).resolves.toBe('READY');

      const row = await t.prisma.media.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: 'READY', width: 80, height: 60, error: null });
      const stored = await readFile(path.join(t.publicDir, row.storageKey));
      expect((await sharp(stored).metadata()).format).toBe('webp');
      expect(row.sizeBytes).toBe(stored.length);
      await expect(stat(path.join(t.privateDir, 'staging', id))).rejects.toThrow();

      await expect(processing.processPending(id)).resolves.toBe('SKIPPED');
      const view = await t.http().get(`/api/v1/media/${id}`).expect(200);
      expect(view.body.variants.thumb.url).toMatch(/_thumb\.webp$/);
    });

    it('PENDING → FAILED with a user-safe message when the image is rejected', async () => {
      const { s } = await agentSession();
      const id = await queuedHeic(s);
      t.heic.next = new AppException(ErrorCode.MEDIA_HEIC_UNSUPPORTED, { status: 415 });

      await expect(processing.processPending(id)).resolves.toBe('FAILED');

      const row = await t.prisma.media.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('FAILED');
      expect(row.error).toContain('HEIC');
      await expect(stat(path.join(t.privateDir, 'staging', id))).rejects.toThrow();
    });

    it('a deleted upload is skipped and its staging dropped', async () => {
      const { s } = await agentSession();
      const id = await queuedHeic(s);
      await t.prisma.media.update({ where: { id }, data: { deletedAt: new Date() } });
      await expect(processing.processPending(id)).resolves.toBe('SKIPPED');
      await expect(stat(path.join(t.privateDir, 'staging', id))).rejects.toThrow();
    });

    it('the worker dispatches by job name and marks FAILED after the last transient attempt', async () => {
      const worker = t.app.get(MediaProcessor);
      await expect(worker.process({ name: 'other', data: {} } as Job)).rejects.toThrow(
        /cannot handle/,
      );
      await expect(
        worker.process({ name: 'media.orphan-cleanup', data: {} } as Job),
      ).resolves.toEqual({ orphaned: 0, staleFailed: 0, purged: 0 });

      const { s } = await agentSession();
      const id = await queuedHeic(s);
      const spy = jest
        .spyOn(processing, 'processPending')
        .mockRejectedValueOnce(new Error('disk full'))
        .mockRejectedValueOnce(new Error('disk full'));
      const job = (attemptsMade: number) =>
        ({
          name: 'media.process',
          data: { mediaId: id },
          attemptsMade,
          opts: { attempts: 3 },
        }) as Job;
      await expect(worker.process(job(0))).rejects.toThrow('disk full');
      expect((await t.prisma.media.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
      await expect(worker.process(job(2))).rejects.toThrow('disk full');
      expect((await t.prisma.media.findUniqueOrThrow({ where: { id } })).status).toBe('FAILED');
      spy.mockRestore();
    });
  });

  describe('orphan cleanup', () => {
    it('collects only unattached, non-exempt uploads past the grace period, then purges them', async () => {
      const { agency, s } = await agentSession();
      const orphan = {
        body: await uploadReady(t, s, { purpose: 'LISTING_PHOTO', file: await png() }),
      };
      const attached = {
        body: await uploadReady(t, s, { purpose: 'LISTING_PHOTO', file: await png() }),
      };
      // CONTENT (embedded in notice bodies, no FK yet) is exempt.
      const content = await createMedia(t.prisma, { purpose: 'CONTENT' });
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.listingPhoto.create({
        data: { listingId: listing.id, mediaId: attached.body.id },
      });
      const orphanRow = await t.prisma.media.findUniqueOrThrow({ where: { id: orphan.body.id } });

      // Within the grace period nothing happens.
      expect(await cleanup.run(new Date(Date.now() + 1 * HOUR))).toEqual({
        orphaned: 0,
        staleFailed: 0,
        purged: 0,
      });

      const later = new Date(Date.now() + (MEDIA_ORPHAN_GRACE_HOURS + 1) * HOUR);
      expect(await cleanup.run(later)).toMatchObject({ orphaned: 1, purged: 0 });
      const soft = await t.prisma.media.findUniqueOrThrow({ where: { id: orphan.body.id } });
      expect(soft.deletedAt).not.toBeNull();
      expect(
        (await t.prisma.media.findUniqueOrThrow({ where: { id: attached.body.id } })).deletedAt,
      ).toBeNull();
      expect(
        (await t.prisma.media.findUniqueOrThrow({ where: { id: content.id } })).deletedAt,
      ).toBeNull();
      await expect(stat(path.join(t.publicDir, orphanRow.storageKey))).resolves.toBeTruthy();

      const evenLater = new Date(later.getTime() + (MEDIA_ORPHAN_GRACE_HOURS + 1) * HOUR);
      expect(await cleanup.run(evenLater)).toMatchObject({ purged: 1 });
      expect(await t.prisma.media.findUnique({ where: { id: orphan.body.id } })).toBeNull();
      await expect(stat(path.join(t.publicDir, orphanRow.storageKey))).rejects.toThrow();
      await expect(
        stat(path.join(t.publicDir, orphanRow.storageKey.replace('.webp', '_large.webp'))),
      ).rejects.toThrow();
      expect(await t.prisma.media.count()).toBe(2);
    });

    it('a detach (released) restarts the grace period', async () => {
      const { agency, s } = await agentSession();
      const { id } = await uploadReady(t, s, { purpose: 'LISTING_PHOTO', file: await png() });
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.listingPhoto.create({ data: { listingId: listing.id, mediaId: id } });
      await t.prisma.media.update({
        where: { id },
        data: {
          createdAt: new Date(Date.now() - 72 * HOUR),
          updatedAt: new Date(Date.now() - 72 * HOUR),
        },
      });
      await t.prisma.listingPhoto.deleteMany({ where: { mediaId: id } });
      await media.released([id]);

      expect((await cleanup.run()).orphaned).toBe(0);
      expect((await cleanup.run(new Date(Date.now() + 25 * HOUR))).orphaned).toBe(1);
    });

    it('stale PENDING uploads (lost jobs) become FAILED', async () => {
      const { s } = await agentSession();
      const id = await queuedHeic(s);
      const res = await cleanup.run(new Date(Date.now() + (MEDIA_ORPHAN_GRACE_HOURS + 1) * HOUR));
      expect(res.staleFailed).toBe(1);
      expect((await t.prisma.media.findUniqueOrThrow({ where: { id } })).status).toBe('FAILED');
    });
  });

  describe('MediaService (used by other modules)', () => {
    it('assertUsable: purpose, READY, owner, unattached and orWhere', async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const mine = await createMedia(t.prisma, {
        purpose: 'DEAL_REQUEST_PHOTO',
        ownerUserId: user.id,
      });
      const theirs = await createMedia(t.prisma, {
        purpose: 'DEAL_REQUEST_PHOTO',
        ownerUserId: other.id,
      });
      const pending = await createMedia(t.prisma, {
        purpose: 'DEAL_REQUEST_PHOTO',
        ownerUserId: user.id,
        status: 'PENDING',
      });
      const rule = { purpose: 'DEAL_REQUEST_PHOTO' as const, ownerUserId: user.id };

      const refs = await media.assertUsable([mine.id, mine.id], rule);
      expect(refs.map((r) => r.id)).toEqual([mine.id]);
      expect(media.url(refs[0]!)).toBe(`/media/${mine.storageKey}`);

      for (const ids of [[theirs.id], [pending.id], ['not-a-uuid']]) {
        await expect(media.assertUsable(ids, rule)).rejects.toMatchObject({
          code: ErrorCode.MEDIA_INVALID,
        });
      }
      await expect(
        media.assertUsable([mine.id], {
          purpose: 'BANNER',
          errorCode: ErrorCode.BANNER_MEDIA_INVALID,
        }),
      ).rejects.toMatchObject({ code: ErrorCode.BANNER_MEDIA_INVALID });

      // orWhere: someone else's photo already attached to the same listing is accepted.
      const { agency } = await createAgency(t.prisma);
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      const coPhoto = await createMedia(t.prisma, {
        purpose: 'LISTING_PHOTO',
        ownerUserId: other.id,
      });
      await t.prisma.listingPhoto.create({ data: { listingId: listing.id, mediaId: coPhoto.id } });
      await expect(
        media.assertUsable([coPhoto.id], {
          purpose: 'LISTING_PHOTO',
          ownerUserId: user.id,
          orWhere: { listingPhotos: { some: { listingId: listing.id } } },
        }),
      ).resolves.toHaveLength(1);
      // unattached: the same photo is not usable for a one-shot attachment.
      await expect(
        t.prisma.$transaction((tx) =>
          media.assertUsable([coPhoto.id], { purpose: 'LISTING_PHOTO', unattached: true }, tx),
        ),
      ).rejects.toMatchObject({ code: ErrorCode.MEDIA_INVALID });
      // ...and an unlocked one-shot check is a programming error.
      await expect(
        media.assertUsable([mine.id], { purpose: 'DEAL_REQUEST_PHOTO', unattached: true }),
      ).rejects.toThrow(/requires a transaction/);
    });

    it('assertUsable inside a transaction locks rows; views/privateFilePath helpers', async () => {
      const admin = await createAdmin(t.prisma);
      const banner = await createMedia(t.prisma, { purpose: 'BANNER', ownerAdminId: admin.id });
      const doc = await createMedia(t.prisma, {
        purpose: 'AGENCY_DOCUMENT',
        visibility: 'PRIVATE',
        mimeType: 'application/pdf',
        storageKey: 'doc/2026/01/abc.pdf',
      });
      await t.prisma.$transaction(async (tx) => {
        await expect(
          media.assertUsable([banner.id], { purpose: 'BANNER' }, tx),
        ).resolves.toHaveLength(1);
      });
      const views = await media.views([doc.id, banner.id]);
      expect(views.map((v) => v.id)).toEqual([banner.id]);
      expect(media.privateFilePath(doc.storageKey)).toBe(
        path.join(t.privateDir, 'doc/2026/01/abc.pdf'),
      );
      expect(media.privateFilePath('../../etc/passwd')).toBeNull();
      expect(media.variantUrls(banner)).toEqual({
        thumb: `/media/${banner.storageKey}`,
        medium: `/media/${banner.storageKey}`,
        large: `/media/${banner.storageKey}`,
      });
    });
  });
});
