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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminStatsService = void 0;
exports.kstIsoDate = kstIsoDate;
exports.statsWindow = statsWindow;
exports.splitSeries = splitSeries;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const visitor_stats_service_1 = require("../visitors/visitor-stats.service");
const admin_format_1 = require("./admin-format");
const dashboard_service_1 = require("./dashboard.service");
const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
const TOP_REGIONS = 5;
const TOP_COMPLEXES = 5;
const PROVIDERS = new Set(Object.values(shared_1.AuthProvider));
/** "YYYY-MM-DD" KST of an instant. */
function kstIsoDate(d) {
    return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
/**
 * The window of a stats request: `2 × days` KST days ending today — the first half is the
 * comparison period (`previous`), the second half the `points`.
 */
function statsWindow(days, now) {
    const today = (0, dashboard_service_1.startOfKstDay)(now);
    const to = new Date(today.getTime() + DAY_MS);
    const from = new Date(today.getTime() - (2 * days - 1) * DAY_MS);
    const dates = Array.from({ length: 2 * days }, (_, i) => kstIsoDate(new Date(from.getTime() + i * DAY_MS)));
    return {
        from,
        to,
        /** Start of the shown period (end of the previous one). */
        mid: new Date(from.getTime() + days * DAY_MS),
        previousDates: dates.slice(0, days),
        dates: dates.slice(days),
    };
}
/** Splits per-day rows into the shown period (zero-filled points) and the previous totals. */
function splitSeries(win, byDate, keys) {
    const pick = (date) => {
        const row = byDate.get(date) ?? {};
        return Object.fromEntries(keys.map((k) => [k, row[k] ?? 0]));
    };
    const previous = Object.fromEntries(keys.map((k) => [k, 0]));
    for (const d of win.previousDates) {
        const row = pick(d);
        for (const k of keys)
            previous[k] += row[k];
    }
    return { points: win.dates.map((date) => ({ date, ...pick(date) })), previous };
}
function mergeInto(target, key, rows) {
    for (const r of rows)
        target.set(r.d, { ...(target.get(r.d) ?? {}), [key]: Number(r.n) });
}
/**
 * 통계 (GET /admin/stats/:section?days=7|30|90): daily series in KST, oldest → newest, last point
 * = today, plus totals of the period right before. Cached per section and window.
 */
let AdminStatsService = class AdminStatsService {
    constructor(prisma, cache, visitors) {
        this.prisma = prisma;
        this.cache = cache;
        this.visitors = visitors;
    }
    get(section, days, now = new Date()) {
        const compute = {
            traffic: () => this.traffic(days, now),
            listings: () => this.listings(days, now),
            'deal-requests': () => this.dealRequests(days, now),
            ads: () => this.ads(days, now),
        };
        return this.cache.getOrSet(`cache:admin:stats:${section}:${days}:${kstIsoDate(now)}`, constants_1.STATS_CACHE_TTL_SECONDS, compute[section]);
    }
    /** Rows `{ d: 'YYYY-MM-DD', n }` of `table.column` per KST day inside [from, to). */
    perDay(table, column, from, to, extra = client_1.Prisma.empty) {
        return this.prisma.$queryRaw `
      SELECT to_char((${client_1.Prisma.raw(column)} AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS d,
             count(*)::int AS n
      FROM ${client_1.Prisma.raw(table)}
      WHERE ${client_1.Prisma.raw(column)} >= ${from} AND ${client_1.Prisma.raw(column)} < ${to} ${extra}
      GROUP BY 1`;
    }
    async traffic(days, now = new Date()) {
        const win = statsWindow(days, now);
        const [daily, signups, providers] = await Promise.all([
            this.visitors.dailyTraffic(2 * days, now),
            this.perDay('users', 'created_at', win.from, win.to),
            this.prisma.$queryRaw `
        SELECT t.provider::text AS provider, count(*)::int AS n
        FROM (
          SELECT DISTINCT ON (i.user_id) i.provider
          FROM identities i JOIN users u ON u.id = i.user_id
          WHERE u.created_at >= ${win.mid} AND u.created_at < ${win.to}
          ORDER BY i.user_id, i.created_at
        ) t
        GROUP BY 1`,
        ]);
        const byDate = new Map();
        for (const d of daily)
            byDate.set(d.date, { visitors: d.visitors, pageViews: d.pageViews });
        mergeInto(byDate, 'signups', signups);
        const { points, previous } = splitSeries(win, byDate, [
            'visitors',
            'pageViews',
            'signups',
        ]);
        const shown = new Set(win.dates);
        const devices = daily
            .filter((d) => shown.has(d.date))
            .reduce((acc, d) => ({ mobile: acc.mobile + d.mobile, desktop: acc.desktop + d.desktop }), {
            mobile: 0,
            desktop: 0,
        });
        return {
            days,
            points,
            previous,
            devices,
            signupsByProvider: providers
                .filter((p) => PROVIDERS.has(p.provider))
                .map((p) => ({ provider: p.provider, count: Number(p.n) }))
                .sort((a, b) => b.count - a.count),
            // Page paths are not known to the API (it only sees API reads).
            topPages: [],
        };
    }
    async listings(days, now = new Date()) {
        const win = statsWindow(days, now);
        const live = client_1.Prisma.sql `AND deleted_at IS NULL`;
        const active = {
            deletedAt: null,
            status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
        };
        const [created, closed, activeTotal, byAssetType, byDealType, complexes] = await Promise.all([
            this.perDay('listings', 'published_at', win.from, win.to, live),
            this.perDay('listings', 'closed_at', win.from, win.to, live),
            this.prisma.listing.count({ where: active }),
            this.prisma.listing.groupBy({ by: ['assetType'], where: active, _count: { _all: true } }),
            this.prisma.listing.groupBy({ by: ['dealType'], where: active, _count: { _all: true } }),
            this.prisma.complex.findMany({
                where: { listings: { some: active } },
                orderBy: [{ viewCount: 'desc' }, { id: 'asc' }],
                take: TOP_COMPLEXES,
                select: {
                    id: true,
                    name: true,
                    viewCount: true,
                    _count: { select: { listings: { where: active } } },
                },
            }),
        ]);
        const byDate = new Map();
        mergeInto(byDate, 'created', created);
        mergeInto(byDate, 'closed', closed);
        const { points, previous } = splitSeries(win, byDate, ['created', 'closed']);
        return {
            days,
            points,
            previous,
            activeTotal,
            byAssetType: byAssetType
                .map((g) => ({ assetType: g.assetType, count: g._count._all }))
                .sort((a, b) => b.count - a.count),
            byDealType: byDealType
                .map((g) => ({ dealType: g.dealType, count: g._count._all }))
                .sort((a, b) => b.count - a.count),
            topComplexes: complexes.map((c) => ({
                id: c.id,
                name: c.name,
                views: c.viewCount,
                listings: c._count.listings,
            })),
        };
    }
    async dealRequests(days, now = new Date()) {
        const win = statsWindow(days, now);
        const live = client_1.Prisma.sql `AND deleted_at IS NULL`;
        const [sell, find, proposals, response, regions] = await Promise.all([
            this.perDay('deal_requests', 'created_at', win.from, win.to, client_1.Prisma.sql `AND deleted_at IS NULL AND type = ${shared_1.DealRequestType.SELL_OR_LEASE}::deal_request_type`),
            this.perDay('deal_requests', 'created_at', win.from, win.to, client_1.Prisma.sql `AND deleted_at IS NULL AND type = ${shared_1.DealRequestType.WANTED}::deal_request_type`),
            this.perDay('proposals', 'created_at', win.from, win.to),
            this.prisma.$queryRaw `
        SELECT count(*)::int AS total,
               count(f.first_at)::int AS answered,
               avg(extract(epoch FROM (f.first_at - r.created_at)) / 60)::float AS avg_minutes
        FROM deal_requests r
        LEFT JOIN LATERAL (
          SELECT min(p.created_at) AS first_at FROM proposals p WHERE p.deal_request_id = r.id
        ) f ON true
        WHERE r.created_at >= ${win.mid} AND r.created_at < ${win.to} ${live}`,
            this.prisma.$queryRaw `
        SELECT COALESCE(emd_code, region_codes[1]) AS code, count(*)::int AS n
        FROM deal_requests
        WHERE created_at >= ${win.mid} AND created_at < ${win.to} ${live}
        GROUP BY 1`,
        ]);
        const byDate = new Map();
        mergeInto(byDate, 'sell', sell);
        mergeInto(byDate, 'find', find);
        mergeInto(byDate, 'proposals', proposals);
        const { points, previous } = splitSeries(win, byDate, ['sell', 'find', 'proposals']);
        const r = response[0];
        const total = Number(r?.total ?? 0);
        return {
            days,
            points,
            previous,
            responseRate: total > 0 ? Math.round((Number(r?.answered ?? 0) / total) * 1000) / 1000 : null,
            avgFirstResponseMinutes: r?.avg_minutes == null ? null : Math.round(Number(r.avg_minutes)),
            byRegion: await this.topRegions(regions),
        };
    }
    /** Top regions by request count plus "그 밖의 지역" for the rest (no region = 순천 전체). */
    async topRegions(rows) {
        const names = await (0, admin_format_1.regionNames)(this.prisma, rows.map((r) => r.code));
        const named = new Map();
        let rest = 0;
        for (const r of rows) {
            const name = r.code ? names.get(r.code) : undefined;
            if (name)
                named.set(name, (named.get(name) ?? 0) + Number(r.n));
            else
                rest += Number(r.n);
        }
        const sorted = [...named.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
        rest += sorted.slice(TOP_REGIONS).reduce((acc, r) => acc + r.count, 0);
        const top = sorted.slice(0, TOP_REGIONS);
        return rest > 0 ? [...top, { name: '그 밖의 지역', count: rest }] : top;
    }
    async ads(days, now = new Date()) {
        const win = statsWindow(days, now);
        const fromDate = new Date(`${win.previousDates[0]}T00:00:00Z`);
        const midDate = new Date(`${win.dates[0]}T00:00:00Z`);
        const [daily, slots, activeBanners] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT to_char(date, 'YYYY-MM-DD') AS d,
               sum(impressions)::int AS impressions, sum(clicks)::int AS clicks
        FROM banner_stat_daily
        WHERE date >= ${fromDate}::date
        GROUP BY 1`,
            this.prisma.$queryRaw `
        SELECT b.slot::text AS slot,
               sum(s.impressions)::int AS impressions, sum(s.clicks)::int AS clicks
        FROM banner_stat_daily s JOIN banners b ON b.id = s.banner_id
        WHERE s.date >= ${midDate}::date
        GROUP BY 1`,
            this.prisma.banner.count({
                where: { deletedAt: null, paused: false, startAt: { lte: now }, endAt: { gt: now } },
            }),
        ]);
        const byDate = new Map();
        for (const d of daily) {
            byDate.set(d.d, { impressions: Number(d.impressions), clicks: Number(d.clicks) });
        }
        const { points, previous } = splitSeries(win, byDate, ['impressions', 'clicks']);
        return {
            days,
            points,
            previous,
            activeBanners,
            bySlot: slots
                .map((s) => ({
                slot: s.slot,
                label: shared_1.BANNER_SLOT_SPECS[s.slot]?.label ?? s.slot,
                impressions: Number(s.impressions),
                clicks: Number(s.clicks),
            }))
                .sort((a, b) => b.impressions - a.impressions),
        };
    }
};
exports.AdminStatsService = AdminStatsService;
exports.AdminStatsService = AdminStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        visitor_stats_service_1.VisitorStatsService])
], AdminStatsService);
//# sourceMappingURL=admin-stats.service.js.map