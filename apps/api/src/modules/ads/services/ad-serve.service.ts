import {
  BannerTargeting,
  PopupPage,
  type BannerServeQuery,
  type BannerSlot,
  type PublicBannerView,
  type PublicPopupView,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdsMapper, publicBannerSelect, publicPopupSelect } from '../ads.mapper';
import { ADS_CACHE, ADS_SERVE_TTL_SECONDS, POPUP_SERVE_LIMIT } from '../constants';
import { liveWhere, ttlUntilNextBoundary } from '../domain/schedule';
import { regionCodePrefixes } from '../domain/targeting';
import { ADS_REFERENCES, type AdsReferencesPort } from '../ports/ads-references.port';
import { BannerSlotsService } from './banner-slots.service';

interface Cached<T> {
  items: T[];
}

/**
 * Public read side: only live items (not paused, startAt ≤ now < endAt, not deleted), cached in
 * Redis under a version that admin writes bump. The TTL also stops at the next start/end
 * boundary so scheduled banners appear and expired ones (ENDED) disappear on time.
 */
@Injectable()
export class AdServeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly slots: BannerSlotsService,
    private readonly mapper: AdsMapper,
    @Inject(ADS_REFERENCES) private readonly refs: AdsReferencesPort,
  ) {}

  async banners(q: BannerServeQuery, now: Date = new Date()): Promise<PublicBannerView[]> {
    const version = await this.cache.version(ADS_CACHE.BANNERS);
    const key = `cache:ads:banners:v${version}:${q.slot}:${q.regionCode ?? '-'}:${q.complexId ?? '-'}`;
    const hit = await this.cache.get<Cached<PublicBannerView>>(key);
    if (hit) return hit.items;
    const { items, ttl } = await this.computeBanners(q, now);
    await this.cache.set(key, { items } satisfies Cached<PublicBannerView>, ttl);
    return items;
  }

  async popups(page: PopupPage, now: Date = new Date()): Promise<PublicPopupView[]> {
    const version = await this.cache.version(ADS_CACHE.POPUPS);
    const key = `cache:ads:popups:v${version}:${page}`;
    const hit = await this.cache.get<Cached<PublicPopupView>>(key);
    if (hit) return hit.items;
    const base: Prisma.PopupWhereInput = { deletedAt: null };
    const pages = page === PopupPage.ALL ? [PopupPage.ALL] : [page, PopupPage.ALL];
    const [rows, nextStart] = await Promise.all([
      this.prisma.popup.findMany({
        where: { ...base, ...liveWhere(now), targetPages: { hasSome: pages } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
        take: POPUP_SERVE_LIMIT,
        select: publicPopupSelect,
      }),
      this.prisma.popup.aggregate({
        where: { ...base, paused: false, startAt: { gt: now }, targetPages: { hasSome: pages } },
        _min: { startAt: true },
      }),
    ]);
    const items = rows.map((p) => this.mapper.publicPopup(p));
    const ttl = ttlUntilNextBoundary(
      [nextStart._min.startAt, ...rows.map((r) => r.endAt)],
      now,
      ADS_SERVE_TTL_SECONDS,
    );
    await this.cache.set(key, { items } satisfies Cached<PublicPopupView>, ttl);
    return items;
  }

  /** Ids of every live banner (any slot); impressions are only counted for these. */
  async liveBannerIds(now: Date = new Date()): Promise<Set<string>> {
    const version = await this.cache.version(ADS_CACHE.BANNERS);
    const key = `cache:ads:live-banner-ids:v${version}`;
    const hit = await this.cache.get<string[]>(key);
    if (hit) return new Set(hit);
    const rows = await this.prisma.banner.findMany({
      where: { deletedAt: null, ...liveWhere(now) },
      select: { id: true, endAt: true },
    });
    const next = await this.prisma.banner.aggregate({
      where: { deletedAt: null, paused: false, startAt: { gt: now } },
      _min: { startAt: true },
    });
    const ids = rows.map((r) => r.id);
    const ttl = ttlUntilNextBoundary(
      [next._min.startAt, ...rows.map((r) => r.endAt)],
      now,
      ADS_SERVE_TTL_SECONDS,
    );
    await this.cache.set(key, ids, ttl);
    return new Set(ids);
  }

  private async computeBanners(
    q: BannerServeQuery,
    now: Date,
  ): Promise<{ items: PublicBannerView[]; ttl: number }> {
    const settings = await this.slots.settings(q.slot);
    if (!settings.isEnabled || settings.maxActive === 0) {
      return { items: [], ttl: ADS_SERVE_TTL_SECONDS };
    }
    const complexCodes = q.complexId ? await this.refs.complexRegionCodes(q.complexId) : [];
    const prefixes = regionCodePrefixes([q.regionCode, ...complexCodes]);
    const targeting: Prisma.BannerWhereInput[] = [{ targeting: BannerTargeting.ALL }];
    if (prefixes.length > 0) {
      targeting.push({
        targeting: BannerTargeting.REGIONS,
        targetRegions: { some: { regionCode: { in: prefixes } } },
      });
    }
    if (q.complexId) {
      targeting.push({
        targeting: BannerTargeting.COMPLEXES,
        targetComplexes: { some: { complexId: q.complexId } },
      });
    }
    const [rows, next] = await Promise.all([
      // Priority decides which banners win when more are live than the slot allows…
      this.prisma.banner.findMany({
        where: { slot: q.slot, deletedAt: null, ...liveWhere(now), OR: targeting },
        orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
        take: settings.maxActive,
        select: publicBannerSelect,
      }),
      this.nextStart(q.slot, now),
    ]);
    // …and the admin's manual order decides how the winners are displayed.
    rows.sort((a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority || cmp(a.id, b.id));
    return {
      items: rows.map((b) => this.mapper.publicBanner(b)),
      ttl: ttlUntilNextBoundary([next, ...rows.map((r) => r.endAt)], now, ADS_SERVE_TTL_SECONDS),
    };
  }

  private async nextStart(slot: BannerSlot, now: Date): Promise<Date | null> {
    const agg = await this.prisma.banner.aggregate({
      where: { slot, deletedAt: null, paused: false, startAt: { gt: now } },
      _min: { startAt: true },
    });
    return agg._min.startAt;
  }
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
