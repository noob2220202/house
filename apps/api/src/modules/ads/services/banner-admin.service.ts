import {
  BannerTargeting,
  checkAdWindow,
  checkBannerSlotRules,
  checkBannerTargeting,
  ErrorCode,
  MediaPurpose,
  type AdminBannerListQuery,
  type AdminBannerView,
  type BannerCreateInput,
  type BannerReorderInput,
  type BannerUpdateInput,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { parseOrThrow } from '../../../common/pipes/zod-validation.pipe';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { adminBannerSelect, AdsMapper, type AdminBannerRow } from '../ads.mapper';
import { ADS_CACHE } from '../constants';
import { scheduleStatusWhere } from '../domain/schedule';
import { placementGrows, windowGrows } from '../domain/slot-capacity';
import { ADS_MEDIA, type AdsMediaPort } from '../ports/ads-media.port';
import { ADS_REFERENCES, type AdsReferencesPort } from '../ports/ads-references.port';
import { BannerSlotsService } from './banner-slots.service';

const blankToNull = (v: string | null | undefined): string | null | undefined =>
  v === undefined ? undefined : v === null || v.trim() === '' ? null : v;

/** Admin CRUD, reorder and validation of banners. Every write bumps the public serve cache. */
@Injectable()
export class BannerAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: BannerSlotsService,
    private readonly mapper: AdsMapper,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    @Inject(ADS_MEDIA) private readonly media: AdsMediaPort,
    @Inject(ADS_REFERENCES) private readonly refs: AdsReferencesPort,
  ) {}

  async list(q: AdminBannerListQuery, now: Date = new Date()): Promise<Paginated<AdminBannerView>> {
    const where: Prisma.BannerWhereInput = {
      deletedAt: null,
      ...(q.slot ? { slot: q.slot } : {}),
      ...(q.agencyId ? { agencyId: q.agencyId } : {}),
      ...(q.status ? scheduleStatusWhere(q.status, now) : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { advertiserName: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.BannerOrderByWithRelationInput[] = q.slot
      ? [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }];
    const page = await paginate(
      q,
      (args) => this.prisma.banner.findMany({ where, orderBy, select: adminBannerSelect, ...args }),
      () => this.prisma.banner.count({ where }),
    );
    return { ...page, items: page.items.map((b) => this.mapper.adminBanner(b, now)) };
  }

  async get(id: string): Promise<AdminBannerView> {
    return this.mapper.adminBanner(await this.load(id));
  }

  async create(dto: BannerCreateInput, adminId: string): Promise<AdminBannerView> {
    const now = new Date();
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    const row = await this.prisma.$transaction(async (tx) => {
      await this.slots.lock(tx, dto.slot);
      await this.assertReferences(tx, {
        mediaIds: [dto.pcMediaId, dto.mobileMediaId],
        agencyId: dto.agencyId,
        regionCodes: dto.targetRegionCodes,
        complexIds: dto.targetComplexIds,
      });
      if (!dto.paused) {
        await this.slots.assertCapacity(
          tx,
          dto.slot,
          {
            startAt,
            endAt,
            targeting: dto.targeting,
            regionCodes: dto.targetRegionCodes,
            complexIds: dto.targetComplexIds,
          },
          { now },
        );
      }
      const last = await tx.banner.aggregate({
        where: { slot: dto.slot, deletedAt: null },
        _max: { sortOrder: true },
      });
      return tx.banner.create({
        data: {
          slot: dto.slot,
          title: dto.title,
          advertiserName: blankToNull(dto.advertiserName) ?? null,
          agencyId: dto.agencyId ?? null,
          pcMediaId: dto.pcMediaId,
          mobileMediaId: dto.mobileMediaId ?? null,
          linkUrl: dto.linkUrl ?? null,
          newWindow: dto.newWindow,
          startAt,
          endAt,
          paused: dto.paused,
          priority: dto.priority,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          targeting: dto.targeting,
          memo: blankToNull(dto.memo) ?? null,
          createdByAdminId: adminId,
          targetRegions: {
            createMany: { data: dto.targetRegionCodes.map((regionCode) => ({ regionCode })) },
          },
          targetComplexes: {
            createMany: { data: dto.targetComplexIds.map((complexId) => ({ complexId })) },
          },
        },
        select: adminBannerSelect,
      });
    });
    await this.cache.bump(ADS_CACHE.BANNERS);
    return this.mapper.adminBanner(row, now);
  }

  async update(id: string, dto: BannerUpdateInput): Promise<AdminBannerView> {
    const now = new Date();
    const current = await this.load(id);
    RequestContext.setAuditBefore(this.mapper.adminBanner(current, now));

    const oldRegions = current.targetRegions.map((r) => r.regionCode);
    const oldComplexes = current.targetComplexes.map((t) => t.complex.id);
    const targeting = dto.targeting ?? current.targeting;
    const regions =
      dto.targetRegionCodes ?? (targeting === BannerTargeting.REGIONS ? oldRegions : []);
    const complexes =
      dto.targetComplexIds ?? (targeting === BannerTargeting.COMPLEXES ? oldComplexes : []);
    const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
    const paused = dto.paused ?? current.paused;
    const agencyId = dto.agencyId === undefined ? (current.agency?.id ?? null) : dto.agencyId;

    // Cross-field rules on the merged row (PATCH bodies are partial).
    parseOrThrow(
      z.unknown().superRefine((_, ctx) => {
        checkAdWindow({ startAt: startAt.toISOString(), endAt: endAt.toISOString() }, ctx);
        checkBannerTargeting(
          { targeting, targetRegionCodes: regions, targetComplexIds: complexes },
          ctx,
        );
        checkBannerSlotRules({ slot: current.slot, agencyId, targeting }, ctx);
      }),
      null,
    );

    const regionsChanged = !sameSet(regions, oldRegions);
    const complexesChanged = !sameSet(complexes, oldComplexes);
    const newPc = dto.pcMediaId && dto.pcMediaId !== current.pcMedia.id ? dto.pcMediaId : undefined;
    const oldMobile = current.mobileMedia?.id ?? null;
    const newMobile =
      dto.mobileMediaId && dto.mobileMediaId !== oldMobile ? dto.mobileMediaId : undefined;
    const releasedMedia = [
      ...(newPc ? [current.pcMedia.id] : []),
      ...(oldMobile && dto.mobileMediaId !== undefined && dto.mobileMediaId !== oldMobile
        ? [oldMobile]
        : []),
    ];

    // Re-check capacity only when the banner becomes live somewhere/somewhen it was not:
    // copy edits, shortening, pausing or narrowing must keep working after a slot limit was
    // lowered (that is exactly when admins cut banners back).
    const grows =
      !paused &&
      (windowGrows(
        { startAt: current.startAt, endAt: current.endAt, paused: current.paused },
        {
          startAt,
          endAt,
          paused,
        },
      ) ||
        placementGrows(
          {
            targeting: current.targeting,
            regionCodes: oldRegions,
            complexIds: oldComplexes,
          },
          { targeting, regionCodes: regions, complexIds: complexes },
        ));

    const row = await this.prisma.$transaction(async (tx) => {
      if (grows) await this.slots.lock(tx, current.slot);
      await this.assertReferences(tx, {
        mediaIds: [newPc, newMobile],
        agencyId: dto.agencyId && dto.agencyId !== current.agency?.id ? dto.agencyId : undefined,
        regionCodes: regionsChanged ? regions.filter((c) => !oldRegions.includes(c)) : [],
        complexIds: complexesChanged ? complexes.filter((c) => !oldComplexes.includes(c)) : [],
      });
      if (grows) {
        await this.slots.assertCapacity(
          tx,
          current.slot,
          { startAt, endAt, targeting, regionCodes: regions, complexIds: complexes },
          { excludeId: id, now },
        );
      }
      if (regionsChanged) {
        await tx.bannerTargetRegion.deleteMany({ where: { bannerId: id } });
        await tx.bannerTargetRegion.createMany({
          data: regions.map((regionCode) => ({ bannerId: id, regionCode })),
        });
      }
      if (complexesChanged) {
        await tx.bannerTargetComplex.deleteMany({ where: { bannerId: id } });
        await tx.bannerTargetComplex.createMany({
          data: complexes.map((complexId) => ({ bannerId: id, complexId })),
        });
      }
      const updated = await tx.banner.update({
        where: { id },
        data: {
          title: dto.title,
          advertiserName: blankToNull(dto.advertiserName),
          agencyId: dto.agencyId,
          pcMediaId: dto.pcMediaId,
          mobileMediaId: dto.mobileMediaId,
          linkUrl: dto.linkUrl,
          newWindow: dto.newWindow,
          startAt,
          endAt,
          paused,
          priority: dto.priority,
          targeting,
          memo: blankToNull(dto.memo),
        },
        select: adminBannerSelect,
      });
      await this.media.released(releasedMedia, tx);
      return updated;
    });
    await this.cache.bump(ADS_CACHE.BANNERS);
    return this.mapper.adminBanner(row, now);
  }

  /**
   * Soft delete; stats rows stay for reporting. The row keeps its media FKs, so the images stay
   * "attached" for the media library; released() only restarts their grace period.
   */
  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    RequestContext.setAuditBefore(this.mapper.adminBanner(current));
    await this.prisma.$transaction(async (tx) => {
      await tx.banner.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.media.released(
        [current.pcMedia.id, ...(current.mobileMedia ? [current.mobileMedia.id] : [])],
        tx,
      );
    });
    await this.cache.bump(ADS_CACHE.BANNERS);
  }

  /**
   * Sets the display order of a slot: `ids` (any subset of the slot's banners) come first in the
   * given order, the slot's other not-ended banners keep their relative order after them.
   */
  async reorder(dto: BannerReorderInput): Promise<{ items: AdminBannerView[] }> {
    const now = new Date();
    const rows = await this.prisma.$transaction(async (tx) => {
      await this.slots.lock(tx, dto.slot);
      const inSlot = await tx.banner.findMany({
        where: {
          slot: dto.slot,
          deletedAt: null,
          OR: [{ id: { in: dto.ids } }, { endAt: { gt: now } }],
        },
        select: { id: true, sortOrder: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      });
      const known = new Set(inSlot.map((b) => b.id));
      const unknown = dto.ids.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw AppException.badRequest(ErrorCode.BANNER_REORDER_INVALID, { unknownIds: unknown });
      }
      const listed = new Set(dto.ids);
      const order = [...dto.ids, ...inSlot.filter((b) => !listed.has(b.id)).map((b) => b.id)];
      await this.applyOrder(tx, order);
      await this.audit.record(
        {
          action: 'banner.reorder',
          resourceType: 'Banner',
          resourceId: dto.slot,
          before: { slot: dto.slot, ids: inSlot.map((b) => b.id) },
          after: { slot: dto.slot, ids: order },
        },
        tx,
      );
      return tx.banner.findMany({
        where: { id: { in: order } },
        select: adminBannerSelect,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
    });
    await this.cache.bump(ADS_CACHE.BANNERS);
    return { items: rows.map((b) => this.mapper.adminBanner(b, now)) };
  }

  /** Existing, not-deleted banner or 404. */
  async load(id: string): Promise<AdminBannerRow> {
    const row = await this.prisma.banner.findFirst({
      where: { id, deletedAt: null },
      select: adminBannerSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.BANNER_NOT_FOUND);
    return row;
  }

  private async applyOrder(tx: PrismaTx, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const values = Prisma.join(ids.map((id, i) => Prisma.sql`(${id}::uuid, ${i}::int)`));
    await tx.$executeRaw`
      UPDATE banners AS b SET sort_order = v.ord, updated_at = now()
      FROM (VALUES ${values}) AS v(id, ord)
      WHERE b.id = v.id AND b.sort_order IS DISTINCT FROM v.ord`;
  }

  /** Inside the write transaction: media rows stay locked (FOR SHARE) until commit. */
  private async assertReferences(
    tx: PrismaTx,
    refs: {
      mediaIds: (string | undefined)[];
      agencyId: string | undefined;
      regionCodes: string[];
      complexIds: string[];
    },
  ): Promise<void> {
    const mediaIds = refs.mediaIds.filter((m): m is string => typeof m === 'string');
    // Sequential: one transaction connection.
    await this.media.assertUsable(mediaIds, MediaPurpose.BANNER, tx);
    if (refs.agencyId) await this.refs.assertAgency(refs.agencyId, tx);
    await this.refs.assertRegions(refs.regionCodes, tx);
    await this.refs.assertComplexes(refs.complexIds, tx);
  }
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}
