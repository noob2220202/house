import {
  checkAdWindow,
  ErrorCode,
  MediaPurpose,
  type AdminPopupListQuery,
  type AdminPopupView,
  type Paginated,
  type PopupCreateInput,
  type PopupReorderInput,
  type PopupUpdateInput,
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
import { PrismaService } from '../../../prisma/prisma.service';
import { adminPopupSelect, AdsMapper, type AdminPopupRow } from '../ads.mapper';
import { ADS_CACHE } from '../constants';
import { scheduleStatusWhere } from '../domain/schedule';
import { ADS_MEDIA, type AdsMediaPort } from '../ports/ads-media.port';

const POPUP_ORDER_LOCK = 'ads:popup-order';

/** Admin CRUD + reorder of popups. Every write bumps the public popup cache. */
@Injectable()
export class PopupAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: AdsMapper,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    @Inject(ADS_MEDIA) private readonly media: AdsMediaPort,
  ) {}

  async list(q: AdminPopupListQuery, now: Date = new Date()): Promise<Paginated<AdminPopupView>> {
    const where: Prisma.PopupWhereInput = {
      deletedAt: null,
      ...(q.status ? scheduleStatusWhere(q.status, now) : {}),
      ...(q.targetPage ? { targetPages: { has: q.targetPage } } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.popup.findMany({
          where,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
          select: adminPopupSelect,
          ...args,
        }),
      () => this.prisma.popup.count({ where }),
    );
    return { ...page, items: page.items.map((p) => this.mapper.adminPopup(p, now)) };
  }

  async get(id: string): Promise<AdminPopupView> {
    return this.mapper.adminPopup(await this.load(id));
  }

  async create(dto: PopupCreateInput, adminId: string): Promise<AdminPopupView> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${POPUP_ORDER_LOCK}))`;
      await this.media.assertUsable([dto.mediaId], MediaPurpose.POPUP, tx);
      const last = await tx.popup.aggregate({
        where: { deletedAt: null },
        _max: { sortOrder: true },
      });
      return tx.popup.create({
        data: {
          title: dto.title,
          mediaId: dto.mediaId,
          linkUrl: dto.linkUrl ?? null,
          newWindow: dto.newWindow,
          targetPages: dto.targetPages,
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          paused: dto.paused,
          dismissDays: dto.dismissDays,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          createdByAdminId: adminId,
        },
        select: adminPopupSelect,
      });
    });
    await this.cache.bump(ADS_CACHE.POPUPS);
    return this.mapper.adminPopup(row);
  }

  async update(id: string, dto: PopupUpdateInput): Promise<AdminPopupView> {
    const current = await this.load(id);
    RequestContext.setAuditBefore(this.mapper.adminPopup(current));
    const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : current.endAt;
    parseOrThrow(
      z
        .unknown()
        .superRefine((_, ctx) =>
          checkAdWindow({ startAt: startAt.toISOString(), endAt: endAt.toISOString() }, ctx),
        ),
      null,
    );
    const newMedia = dto.mediaId && dto.mediaId !== current.media.id ? dto.mediaId : undefined;
    const row = await this.prisma.$transaction(async (tx) => {
      if (newMedia) await this.media.assertUsable([newMedia], MediaPurpose.POPUP, tx);
      const updated = await tx.popup.update({
        where: { id },
        data: {
          title: dto.title,
          mediaId: dto.mediaId,
          linkUrl: dto.linkUrl,
          newWindow: dto.newWindow,
          targetPages: dto.targetPages,
          startAt,
          endAt,
          paused: dto.paused,
          dismissDays: dto.dismissDays,
        },
        select: adminPopupSelect,
      });
      if (newMedia) await this.media.released([current.media.id], tx);
      return updated;
    });
    await this.cache.bump(ADS_CACHE.POPUPS);
    return this.mapper.adminPopup(row);
  }

  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    RequestContext.setAuditBefore(this.mapper.adminPopup(current));
    await this.prisma.$transaction(async (tx) => {
      await tx.popup.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.media.released([current.media.id], tx);
    });
    await this.cache.bump(ADS_CACHE.POPUPS);
  }

  /** `ids` first in the given order; other not-ended popups keep their relative order after them. */
  async reorder(dto: PopupReorderInput): Promise<{ items: AdminPopupView[] }> {
    const now = new Date();
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${POPUP_ORDER_LOCK}))`;
      const existing = await tx.popup.findMany({
        where: { deletedAt: null, OR: [{ id: { in: dto.ids } }, { endAt: { gt: now } }] },
        select: { id: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      });
      const known = new Set(existing.map((p) => p.id));
      const unknown = dto.ids.filter((id) => !known.has(id));
      if (unknown.length > 0) {
        throw AppException.badRequest(ErrorCode.POPUP_REORDER_INVALID, { unknownIds: unknown });
      }
      const listed = new Set(dto.ids);
      const order = [...dto.ids, ...existing.filter((p) => !listed.has(p.id)).map((p) => p.id)];
      const values = Prisma.join(order.map((pid, i) => Prisma.sql`(${pid}::uuid, ${i}::int)`));
      await tx.$executeRaw`
        UPDATE popups AS p SET sort_order = v.ord, updated_at = now()
        FROM (VALUES ${values}) AS v(id, ord)
        WHERE p.id = v.id AND p.sort_order IS DISTINCT FROM v.ord`;
      await this.audit.record(
        {
          action: 'popup.reorder',
          resourceType: 'Popup',
          before: { ids: existing.map((p) => p.id) },
          after: { ids: order },
        },
        tx,
      );
      return tx.popup.findMany({
        where: { id: { in: order } },
        select: adminPopupSelect,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
    });
    await this.cache.bump(ADS_CACHE.POPUPS);
    return { items: rows.map((p) => this.mapper.adminPopup(p, now)) };
  }

  private async load(id: string): Promise<AdminPopupRow> {
    const row = await this.prisma.popup.findFirst({
      where: { id, deletedAt: null },
      select: adminPopupSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.POPUP_NOT_FOUND);
    return row;
  }
}
