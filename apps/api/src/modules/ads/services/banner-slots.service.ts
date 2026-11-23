import {
  BANNER_SLOT_SPECS,
  BannerSlot,
  enumValues,
  ErrorCode,
  type BannerSlotUpdateInput,
  type BannerSlotView,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { ADS_CACHE } from '../constants';
import { liveWhere } from '../domain/schedule';
import { peakConcurrency, type TimeWindow } from '../domain/slot-capacity';

export interface SlotSettings {
  maxActive: number;
  isEnabled: boolean;
  note: string | null;
}

/** Slot limits: BANNER_SLOT_SPECS defaults, overridable per slot in banner_slot_configs. */
@Injectable()
export class BannerSlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async settings(slot: BannerSlot, db: PrismaTx = this.prisma): Promise<SlotSettings> {
    const row = await db.bannerSlotConfig.findUnique({ where: { slot } });
    return {
      maxActive: row?.maxActive ?? BANNER_SLOT_SPECS[slot].maxActive,
      isEnabled: row?.isEnabled ?? true,
      note: row?.note ?? null,
    };
  }

  async list(now: Date = new Date()): Promise<BannerSlotView[]> {
    const [configs, active, upcoming] = await Promise.all([
      this.prisma.bannerSlotConfig.findMany(),
      this.prisma.banner.groupBy({
        by: ['slot'],
        where: { deletedAt: null, ...liveWhere(now) },
        _count: { _all: true },
      }),
      this.prisma.banner.groupBy({
        by: ['slot'],
        where: { deletedAt: null, paused: false, endAt: { gt: now } },
        _count: { _all: true },
      }),
    ]);
    const bySlot = new Map(configs.map((c) => [c.slot, c]));
    const activeBySlot = new Map(active.map((r) => [r.slot, r._count._all]));
    const upcomingBySlot = new Map(upcoming.map((r) => [r.slot, r._count._all]));
    return enumValues(BannerSlot).map((slot) => {
      const c = bySlot.get(slot);
      return this.view(
        slot,
        {
          maxActive: c?.maxActive ?? BANNER_SLOT_SPECS[slot].maxActive,
          isEnabled: c?.isEnabled ?? true,
          note: c?.note ?? null,
        },
        activeBySlot.get(slot) ?? 0,
        upcomingBySlot.get(slot) ?? 0,
      );
    });
  }

  async get(slot: BannerSlot): Promise<BannerSlotView> {
    const all = await this.list();
    const found = all.find((s) => s.slot === slot);
    if (!found) throw AppException.notFound();
    return found;
  }

  async update(slot: BannerSlot, dto: BannerSlotUpdateInput): Promise<BannerSlotView> {
    const before = await this.settings(slot);
    RequestContext.setAuditBefore({ slot, ...before });
    const next: SlotSettings = {
      maxActive: dto.maxActive ?? before.maxActive,
      isEnabled: dto.isEnabled ?? before.isEnabled,
      note: dto.note === undefined ? before.note : dto.note || null,
    };
    await this.prisma.bannerSlotConfig.upsert({
      where: { slot },
      create: { slot, ...next },
      update: next,
    });
    await this.cache.bump(ADS_CACHE.BANNERS);
    return this.get(slot);
  }

  /**
   * Serializes slot writes (create/schedule changes) so two concurrent requests cannot both pass
   * the capacity check. Transaction-scoped advisory lock.
   */
  async lock(tx: PrismaTx, slot: BannerSlot): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ads:banner-slot:${slot}`}))`;
  }

  /**
   * Throws 409 BANNER_SLOT_FULL when adding `window` would exceed the slot's simultaneous limit at
   * any instant from now on. Paused, ended and deleted banners do not count.
   */
  async assertCapacity(
    tx: PrismaTx,
    slot: BannerSlot,
    window: TimeWindow,
    opts: { excludeId?: string; now?: Date } = {},
  ): Promise<void> {
    const now = opts.now ?? new Date();
    const from = window.startAt > now ? window.startAt : now;
    if (from >= window.endAt) return;
    const { maxActive } = await this.settings(slot, tx);
    const others = await tx.banner.findMany({
      where: {
        slot,
        deletedAt: null,
        paused: false,
        startAt: { lt: window.endAt },
        endAt: { gt: from },
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
      select: { startAt: true, endAt: true },
    });
    const { peak, at } = peakConcurrency({ startAt: from, endAt: window.endAt }, others);
    if (peak + 1 > maxActive) {
      throw AppException.conflict(ErrorCode.BANNER_SLOT_FULL, {
        slot,
        maxActive,
        concurrent: peak + 1,
        at: (at ?? from).toISOString(),
      });
    }
  }

  private view(
    slot: BannerSlot,
    s: SlotSettings,
    activeCount: number,
    upcomingCount: number,
  ): BannerSlotView {
    const spec = BANNER_SLOT_SPECS[slot];
    return {
      slot,
      label: spec.label,
      pc: spec.pc,
      mobile: spec.mobile,
      maxActive: s.maxActive,
      defaultMaxActive: spec.maxActive,
      isEnabled: s.isEnabled,
      note: s.note,
      activeCount,
      upcomingCount,
    };
  }
}
