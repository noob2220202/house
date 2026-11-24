import { BannerStatus } from '@house/shared';
interface ScheduleWhere {
    paused?: boolean;
    startAt?: {
        lte?: Date;
        gt?: Date;
    };
    endAt?: {
        lte?: Date;
        gt?: Date;
    };
}
/**
 * Prisma `where` fragment matching rows whose computed status (computeScheduleStatus) equals
 * `status` at `now`. Works for banners and popups (same paused/startAt/endAt columns).
 */
export declare function scheduleStatusWhere(status: BannerStatus, now: Date): ScheduleWhere;
/** Live right now: the only rows public endpoints may return. */
export declare function liveWhere(now: Date): ScheduleWhere;
/**
 * Seconds a serve response may be cached: until the nearest upcoming start/end boundary,
 * clamped to [1, max]. Keeps "expiry → ENDED" and "SCHEDULED → ACTIVE" transitions prompt
 * without any invalidation job.
 */
export declare function ttlUntilNextBoundary(boundaries: readonly (Date | null | undefined)[], now: Date, maxSeconds: number): number;
export {};
