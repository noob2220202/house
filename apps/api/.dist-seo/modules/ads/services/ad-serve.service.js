"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdServeService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const ads_mapper_1 = require("../ads.mapper");
const constants_1 = require("../constants");
const schedule_1 = require("../domain/schedule");
const targeting_1 = require("../domain/targeting");
const ads_references_port_1 = require("../ports/ads-references.port");
const banner_slots_service_1 = require("./banner-slots.service");
/**
 * Banners the public may see right now: live schedule, advertiser agency (if any) APPROVED and
 * not deleted (a SUSPENDED agency's banners stop running), pc image still usable.
 */
function servableBannerWhere(now) {
    return {
        deletedAt: null,
        ...(0, schedule_1.liveWhere)(now),
        pcMedia: { deletedAt: null, status: shared_1.MediaStatus.READY },
        OR: [{ agencyId: null }, { agency: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null } }],
    };
}
/**
 * Public read side: only live items (not paused, startAt ≤ now < endAt, not deleted), cached in
 * Redis under a version that admin writes bump. The TTL also stops at the next start/end
 * boundary so scheduled banners appear and expired ones (ENDED) disappear on time.
 */
let AdServeService = class AdServeService {
    constructor(prisma, cache, slots, mapper, refs) {
        this.prisma = prisma;
        this.cache = cache;
        this.slots = slots;
        this.mapper = mapper;
        this.refs = refs;
    }
    async banners(q, now = new Date()) {
        const version = await this.cache.version(constants_1.ADS_CACHE.BANNERS);
        const key = `cache:ads:banners:v${version}:${q.slot}:${q.regionCode ?? '-'}:${q.complexId ?? '-'}`;
        const hit = await this.cache.get(key);
        if (hit)
            return hit.items;
        const { items, ttl } = await this.computeBanners(q, now);
        await this.cache.set(key, { items }, ttl);
        return items;
    }
    async popups(page, now = new Date()) {
        const version = await this.cache.version(constants_1.ADS_CACHE.POPUPS);
        const key = `cache:ads:popups:v${version}:${page}`;
        const hit = await this.cache.get(key);
        if (hit)
            return hit.items;
        const base = {
            deletedAt: null,
            media: { deletedAt: null, status: shared_1.MediaStatus.READY },
        };
        const pages = page === shared_1.PopupPage.ALL ? [shared_1.PopupPage.ALL] : [page, shared_1.PopupPage.ALL];
        const [rows, nextStart] = await Promise.all([
            this.prisma.popup.findMany({
                where: { ...base, ...(0, schedule_1.liveWhere)(now), targetPages: { hasSome: pages } },
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
                take: constants_1.POPUP_SERVE_LIMIT,
                select: ads_mapper_1.publicPopupSelect,
            }),
            this.prisma.popup.aggregate({
                where: { ...base, paused: false, startAt: { gt: now }, targetPages: { hasSome: pages } },
                _min: { startAt: true },
            }),
        ]);
        const items = rows.map((p) => this.mapper.publicPopup(p));
        const ttl = (0, schedule_1.ttlUntilNextBoundary)([nextStart._min.startAt, ...rows.map((r) => r.endAt)], now, constants_1.ADS_SERVE_TTL_SECONDS);
        await this.cache.set(key, { items }, ttl);
        return items;
    }
    /** Ids of every live banner (any slot); impressions are only counted for these. */
    async liveBannerIds(now = new Date()) {
        const version = await this.cache.version(constants_1.ADS_CACHE.BANNERS);
        const key = `cache:ads:live-banner-ids:v${version}`;
        const hit = await this.cache.get(key);
        if (hit)
            return new Set(hit);
        const rows = await this.prisma.banner.findMany({
            where: servableBannerWhere(now),
            select: { id: true, endAt: true },
        });
        const next = await this.prisma.banner.aggregate({
            where: { deletedAt: null, paused: false, startAt: { gt: now } },
            _min: { startAt: true },
        });
        const ids = rows.map((r) => r.id);
        const ttl = (0, schedule_1.ttlUntilNextBoundary)([next._min.startAt, ...rows.map((r) => r.endAt)], now, constants_1.ADS_SERVE_TTL_SECONDS);
        await this.cache.set(key, ids, ttl);
        return new Set(ids);
    }
    async computeBanners(q, now) {
        const settings = await this.slots.settings(q.slot);
        if (!settings.isEnabled || settings.maxActive === 0) {
            return { items: [], ttl: constants_1.ADS_SERVE_TTL_SECONDS };
        }
        const complexCodes = q.complexId ? await this.refs.complexRegionCodes(q.complexId) : [];
        const prefixes = (0, targeting_1.regionCodePrefixes)([q.regionCode, ...complexCodes]);
        const targeting = [{ targeting: shared_1.BannerTargeting.ALL }];
        if (prefixes.length > 0) {
            targeting.push({
                targeting: shared_1.BannerTargeting.REGIONS,
                targetRegions: { some: { regionCode: { in: prefixes } } },
            });
        }
        if (q.complexId) {
            targeting.push({
                targeting: shared_1.BannerTargeting.COMPLEXES,
                targetComplexes: { some: { complexId: q.complexId } },
            });
        }
        const [rows, next] = await Promise.all([
            // Priority decides which banners win when more are live than the slot allows…
            this.prisma.banner.findMany({
                where: { slot: q.slot, AND: [servableBannerWhere(now), { OR: targeting }] },
                orderBy: [{ priority: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
                take: settings.maxActive,
                select: ads_mapper_1.publicBannerSelect,
            }),
            this.nextStart(q.slot, now),
        ]);
        // …and the admin's manual order decides how the winners are displayed.
        rows.sort((a, b) => a.sortOrder - b.sortOrder || b.priority - a.priority || cmp(a.id, b.id));
        return {
            items: rows.map((b) => this.mapper.publicBanner(b)),
            ttl: (0, schedule_1.ttlUntilNextBoundary)([next, ...rows.map((r) => r.endAt)], now, constants_1.ADS_SERVE_TTL_SECONDS),
        };
    }
    async nextStart(slot, now) {
        const agg = await this.prisma.banner.aggregate({
            where: { slot, deletedAt: null, paused: false, startAt: { gt: now } },
            _min: { startAt: true },
        });
        return agg._min.startAt;
    }
};
exports.AdServeService = AdServeService;
exports.AdServeService = AdServeService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(ads_references_port_1.ADS_REFERENCES)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        banner_slots_service_1.BannerSlotsService,
        ads_mapper_1.AdsMapper, Object])
], AdServeService);
function cmp(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}
//# sourceMappingURL=ad-serve.service.js.map