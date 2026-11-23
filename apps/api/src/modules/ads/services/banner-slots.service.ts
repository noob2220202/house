import {
  BANNER_SLOT_SPECS,
  BannerSlot,
  enumValues,
  ErrorCode,
  type BannerSlotUpdateInput,
  type BannerSlotView,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { ADS_CACHE } from '../constants';
import { liveWhere } from '../domain/schedule';
import {
  worstContextConcurrency,
  type CapacityContext,
  type PlacedWindow,
} from '../domain/slot-capacity';
import { ADS_REFERENCES, type AdsReferencesPort } from '../ports/ads-references.port';

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
    @Inject(ADS_REFERENCES) private readonly refs: AdsReferencesPort,
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
   * Throws 409 BANNER_SLOT_FULL when adding `banner` would exceed the slot's simultaneous limit
   * on some page at some instant from now on. The limit applies per page context, like serving:
   * COMPLEX_FEATURED_AGENCY holds `maxActive` agencies per complex page, MAP_AD per 읍면동, and
   * an ALL banner competes everywhere. Paused, ended and deleted banners do not count.
   */
  async assertCapacity(
    tx: PrismaTx,
    slot: BannerSlot,
    banner: PlacedWindow,
    opts: { excludeId?: string; now?: Date } = {},
  ): Promise<void> {
    const now = opts.now ?? new Date();
    const from = banner.startAt > now ? banner.startAt : now;
    if (from >= banner.endAt) return;
    const { maxActive } = await this.settings(slot, tx);
    const rows = await tx.banner.findMany({
      where: {
        slot,
        deletedAt: null,
        paused: false,
        startAt: { lt: banner.endAt },
        endAt: { gt: from },
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
      select: {
        startAt: true,
        endAt: true,
        targeting: true,
        targetRegions: { select: { regionCode: true } },
        targetComplexes: { select: { complexId: true } },
      },
    });
    const others: PlacedWindow[] = rows.map((r) => ({
      startAt: r.startAt,
      endAt: r.endAt,
      targeting: r.targeting,
      regionCodes: r.targetRegions.map((t) => t.regionCode),
      complexIds: r.targetComplexes.map((t) => t.complexId),
    }));
    const complexCodes = await this.refs.complexRegionCodesMany(
      [...banner.complexIds, ...others.flatMap((o) => o.complexIds)],
      tx,
    );
    const { peak, at, context } = worstContextConcurrency(
      { startAt: from, endAt: banner.endAt },
      banner,
      others,
      complexCodes,
    );
    if (peak + 1 > maxActive) {
      throw AppException.conflict(ErrorCode.BANNER_SLOT_FULL, {
        slot,
        maxActive,
        concurrent: peak + 1,
        at: (at ?? from).toISOString(),
        context: contextDetails(context),
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
      requiresAgency: spec.requiresAgency,
      requiredTargeting: spec.requiredTargeting,
      activeCount,
      upcomingCount,
    };
  }
}

function contextDetails(
  ctx: CapacityContext | null,
): { complexId: string } | { regionCode: string } | Record<string, never> {
  if (ctx?.kind === 'complex') return { complexId: ctx.complexId };
  if (ctx?.kind === 'region') return { regionCode: ctx.regionCode };
  return {};
}
