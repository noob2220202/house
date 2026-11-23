import { stat } from 'node:fs/promises';
import path from 'node:path';
import { ErrorCode, MEDIA_ORPHAN_GRACE_HOURS, UserRole } from '@house/shared';
import { Prisma } from '@prisma/client';
import { MediaCleanupService } from '../../../src/modules/media/media-cleanup.service';
import { MediaService } from '../../../src/modules/media/media.service';
import {
  createAgency,
  createListing,
  createMedia,
  createUser,
  loginUser,
  resetAll,
  withSession,
} from '../../utils';
import { pdf, png } from './fixtures';
import { createMediaTestApp, upload, uploadReady, type MediaTestApp } from './helpers';

const HOUR = 3_600_000;

/** A promise plus its resolver, to hold a transaction open at a chosen point. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function isFkViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003';
}

describe('media: attach/delete races, one-shot locks, reference guard, owner scrub (e2e)', () => {
  let t: MediaTestApp;
  let media: MediaService;
  let cleanup: MediaCleanupService;

  beforeAll(async () => {
    t = await createMediaTestApp();
    media = t.app.get(MediaService);
    cleanup = t.app.get(MediaCleanupService);
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  /** Waits until some other backend of this database is blocked on a row/transaction lock. */
  async function untilLockWaiter(): Promise<void> {
    for (let i = 0; i < 100; i++) {
      const [row] = await t.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if ((row?.n ?? 0) > 0) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('no backend ended up waiting for a lock');
  }

  async function agentWithPhoto() {
    const { agency, owner } = await createAgency(t.prisma);
    const s = await loginUser(
      t.app,
      { id: owner.id, role: UserRole.AGENCY_OWNER },
      { agencyId: agency.id },
    );
    const photo = await uploadReady(t, s, { purpose: 'LISTING_PHOTO', file: await png() });
    const { listing } = await createListing(t.prisma, { agencyId: agency.id });
    return { owner, s, listing, mediaId: photo.id };
  }

  describe('DELETE /media/:id racing an attach', () => {
    it('attach holds its lock: the delete waits, then answers 409 MEDIA_IN_USE', async () => {
      const { owner, s, listing, mediaId } = await agentWithPhoto();
      const attached = deferred();
      const gate = deferred();
      const attach = t.prisma.$transaction(
        async (tx) => {
          await media.assertUsable(
            [mediaId],
            { purpose: 'LISTING_PHOTO', ownerUserId: owner.id },
            tx,
          );
          await tx.listingPhoto.create({ data: { listingId: listing.id, mediaId } });
          attached.resolve();
          await gate.promise;
        },
        { timeout: 20_000 },
      );
      await attached.promise;
      const del = withSession(t.http().delete(`/api/v1/media/${mediaId}`), s).then((r) => r);
      await untilLockWaiter();
      gate.resolve();
      await attach;
      const res = await del;
      expect(res.status).toBe(409);
      expect(res.body.code).toBe(ErrorCode.MEDIA_IN_USE);
      const row = await t.prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
      expect(row.deletedAt).toBeNull();
      await expect(stat(path.join(t.publicDir, row.storageKey))).resolves.toBeTruthy();
    });

    it('delete commits first: a late attach (even without assertUsable) is refused by the guard', async () => {
      const { listing, mediaId } = await agentWithPhoto();
      const deletedRow = deferred();
      const gate = deferred();
      // Same statements as the soft-delete: row lock, then deleted_at.
      const softDelete = t.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM media WHERE id = ${mediaId}::uuid FOR UPDATE`;
          await tx.media.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
          deletedRow.resolve();
          await gate.promise;
        },
        { timeout: 20_000 },
      );
      await deletedRow.promise;
      // An interim consumer that only did an unlocked count() before inserting its FK row.
      const lateAttach = t.prisma.listingPhoto
        .create({ data: { listingId: listing.id, mediaId } })
        .then(
          () => 'attached',
          (err: unknown) => {
            if (isFkViolation(err)) return 'refused';
            throw err;
          },
        );
      await untilLockWaiter();
      gate.resolve();
      await softDelete;
      expect(await lateAttach).toBe('refused');
      expect(await t.prisma.listingPhoto.count({ where: { mediaId } })).toBe(0);
    });

    it('guard: no new reference to a soft-deleted upload; unrelated updates still work', async () => {
      const { listing, mediaId } = await agentWithPhoto();
      const photo = await t.prisma.listingPhoto.create({
        data: { listingId: listing.id, mediaId },
      });
      const removed = await createMedia(t.prisma, { deletedAt: new Date() });
      await expect(
        t.prisma.listingPhoto.create({ data: { listingId: listing.id, mediaId: removed.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      await expect(
        t.prisma.listingPhoto.update({ where: { id: photo.id }, data: { mediaId: removed.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      // Existing links are untouched by a later soft-delete of the media (owners detach first),
      // and updating other columns does not re-check the reference.
      await t.prisma.media.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
      await expect(
        t.prisma.listingPhoto.update({ where: { id: photo.id }, data: { sortOrder: 3 } }),
      ).resolves.toMatchObject({ sortOrder: 3 });

      const { agency } = await createAgency(t.prisma);
      await expect(
        t.prisma.agency.update({ where: { id: agency.id }, data: { logoMediaId: removed.id } }),
      ).rejects.toMatchObject({ code: 'P2003' });
      const logo = await createMedia(t.prisma, { purpose: 'AGENCY_LOGO' });
      await expect(
        t.prisma.agency.update({ where: { id: agency.id }, data: { logoMediaId: logo.id } }),
      ).resolves.toMatchObject({ logoMediaId: logo.id });
      await expect(
        t.prisma.agency.update({ where: { id: agency.id }, data: { logoMediaId: null } }),
      ).resolves.toMatchObject({ logoMediaId: null });
    });

    it('cleanup never purges a soft-deleted row that is still referenced', async () => {
      const { listing, mediaId } = await agentWithPhoto();
      await t.prisma.listingPhoto.create({ data: { listingId: listing.id, mediaId } });
      await t.prisma.media.update({ where: { id: mediaId }, data: { deletedAt: new Date() } });
      const later = new Date(Date.now() + 3 * MEDIA_ORPHAN_GRACE_HOURS * HOUR);
      expect(await cleanup.run(later)).toMatchObject({ purged: 0 });
      await expect(t.prisma.media.findUnique({ where: { id: mediaId } })).resolves.not.toBeNull();
    });
  });

  describe('one-shot attachments (unattached rule)', () => {
    it('two transactions claiming the same document: exactly one wins', async () => {
      const applicant = await createUser(t.prisma);
      const doc = await createMedia(t.prisma, {
        purpose: 'AGENCY_DOCUMENT',
        visibility: 'PRIVATE',
        mimeType: 'application/pdf',
        ownerUserId: applicant.id,
      });
      const { agency: first } = await createAgency(t.prisma);
      const { agency: second } = await createAgency(t.prisma);
      const rule = {
        purpose: 'AGENCY_DOCUMENT' as const,
        ownerUserId: applicant.id,
        unattached: true,
      };
      const claim = (agencyId: string, hold?: { locked: () => void; gate: Promise<void> }) =>
        t.prisma.$transaction(
          async (tx) => {
            await media.assertUsable([doc.id], rule, tx);
            hold?.locked();
            await tx.agencyDocument.create({
              data: { agencyId, type: 'REGISTRATION_CERT', mediaId: doc.id },
            });
            await hold?.gate;
          },
          { timeout: 20_000 },
        );

      const locked = deferred();
      const gate = deferred();
      const a = claim(first.id, { locked: locked.resolve, gate: gate.promise });
      await locked.promise;
      const b = claim(second.id).then(
        () => 'ok',
        (err: { code?: string }) => err.code,
      );
      await untilLockWaiter();
      gate.resolve();
      await a;
      expect(await b).toBe(ErrorCode.MEDIA_INVALID);
      const links = await t.prisma.agencyDocument.findMany({ where: { mediaId: doc.id } });
      expect(links.map((l) => l.agencyId)).toEqual([first.id]);
    });

    it('locks several ids in a stable order (no deadlock with reversed input)', async () => {
      const user = await createUser(t.prisma);
      const [m1, m2] = await Promise.all(
        [0, 1].map(() =>
          createMedia(t.prisma, { purpose: 'DEAL_REQUEST_PHOTO', ownerUserId: user.id }),
        ),
      );
      const rule = {
        purpose: 'DEAL_REQUEST_PHOTO' as const,
        ownerUserId: user.id,
        unattached: true,
      };
      const run = (ids: string[]) =>
        t.prisma.$transaction(
          async (tx) => {
            const refs = await media.assertUsable(ids, rule, tx);
            await new Promise((r) => setTimeout(r, 50));
            return refs.map((r) => r.id);
          },
          { timeout: 20_000 },
        );
      const [x, y] = await Promise.all([run([m1!.id, m2!.id]), run([m2!.id, m1!.id])]);
      expect(x).toEqual([m1!.id, m2!.id]);
      expect(y).toEqual([m2!.id, m1!.id]);
    });
  });

  describe('MediaService.scrubOwner (member withdrawal)', () => {
    it('clears file names everywhere, soft-deletes unattached uploads, keeps attached ones', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const s = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      );
      const loosePhoto = await uploadReady(t, s, {
        purpose: 'LISTING_PHOTO',
        file: await png(),
        filename: '홍길동_집.png',
      });
      const docRes = await upload(t, s, {
        purpose: 'AGENCY_DOCUMENT',
        file: pdf(),
        filename: '홍길동_중개사무소등록증.pdf',
        contentType: 'application/pdf',
      }).expect(201);
      const loose = { id: loosePhoto.id };
      const doc = { id: (docRes.body as { id: string }).id };
      await t.prisma.agencyDocument.create({
        data: { agencyId: agency.id, type: 'REGISTRATION_CERT', mediaId: doc.id },
      });
      const someoneElse = await createMedia(t.prisma, { originalFilename: 'keep.png' });

      const result = await t.prisma.$transaction((tx) => media.scrubOwner(owner.id, tx));
      expect(result).toEqual({ filenamesCleared: 2, deleted: 1 });

      const rows = await t.prisma.media.findMany({ where: { ownerUserId: owner.id } });
      expect(rows.every((r) => r.originalFilename === null)).toBe(true);
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(loose.id)?.deletedAt).not.toBeNull();
      expect(byId.get(doc.id)?.deletedAt).toBeNull();
      expect(
        (await t.prisma.media.findUniqueOrThrow({ where: { id: someoneElse.id } }))
          .originalFilename,
      ).toBe('keep.png');

      // Idempotent, and the purge removes the scrubbed upload's files after the grace period.
      expect(await t.prisma.$transaction((tx) => media.scrubOwner(owner.id, tx))).toEqual({
        filenamesCleared: 0,
        deleted: 0,
      });
      const looseRow = byId.get(loose.id)!;
      await cleanup.run(new Date(Date.now() + (MEDIA_ORPHAN_GRACE_HOURS + 1) * HOUR));
      await expect(t.prisma.media.findUnique({ where: { id: looseRow.id } })).resolves.toBeNull();
      await expect(stat(path.join(t.publicDir, looseRow.storageKey))).rejects.toThrow();
      await expect(t.prisma.media.findUnique({ where: { id: doc.id } })).resolves.not.toBeNull();
    });
  });
});
