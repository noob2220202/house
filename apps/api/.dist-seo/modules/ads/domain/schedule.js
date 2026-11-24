"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleStatusWhere = scheduleStatusWhere;
exports.liveWhere = liveWhere;
exports.ttlUntilNextBoundary = ttlUntilNextBoundary;
const shared_1 = require("@house/shared");
/**
 * Prisma `where` fragment matching rows whose computed status (computeScheduleStatus) equals
 * `status` at `now`. Works for banners and popups (same paused/startAt/endAt columns).
 */
function scheduleStatusWhere(status, now) {
    switch (status) {
        case shared_1.BannerStatus.ENDED:
            return { endAt: { lte: now } };
        case shared_1.BannerStatus.PAUSED:
            return { paused: true, endAt: { gt: now } };
        case shared_1.BannerStatus.SCHEDULED:
            return { paused: false, startAt: { gt: now }, endAt: { gt: now } };
        case shared_1.BannerStatus.ACTIVE:
            return { paused: false, startAt: { lte: now }, endAt: { gt: now } };
    }
}
/** Live right now: the only rows public endpoints may return. */
function liveWhere(now) {
    return scheduleStatusWhere(shared_1.BannerStatus.ACTIVE, now);
}
/**
 * Seconds a serve response may be cached: until the nearest upcoming start/end boundary,
 * clamped to [1, max]. Keeps "expiry → ENDED" and "SCHEDULED → ACTIVE" transitions prompt
 * without any invalidation job.
 */
function ttlUntilNextBoundary(boundaries, now, maxSeconds) {
    let ttl = maxSeconds;
    for (const b of boundaries) {
        if (!b)
            continue;
        const seconds = Math.ceil((b.getTime() - now.getTime()) / 1000);
        if (seconds > 0)
            ttl = Math.min(ttl, seconds);
    }
    return Math.max(1, ttl);
}
//# sourceMappingURL=schedule.js.map