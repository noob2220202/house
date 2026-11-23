import { BannerStatus } from '@house/shared';

interface ScheduleWhere {
  paused?: boolean;
  startAt?: { lte?: Date; gt?: Date };
  endAt?: { lte?: Date; gt?: Date };
}

/**
 * Prisma `where` fragment matching rows whose computed status (computeScheduleStatus) equals
 * `status` at `now`. Works for banners and popups (same paused/startAt/endAt columns).
 */
export function scheduleStatusWhere(status: BannerStatus, now: Date): ScheduleWhere {
  switch (status) {
    case BannerStatus.ENDED:
      return { endAt: { lte: now } };
    case BannerStatus.PAUSED:
      return { paused: true, endAt: { gt: now } };
    case BannerStatus.SCHEDULED:
      return { paused: false, startAt: { gt: now }, endAt: { gt: now } };
    case BannerStatus.ACTIVE:
      return { paused: false, startAt: { lte: now }, endAt: { gt: now } };
  }
}

/** Live right now: the only rows public endpoints may return. */
export function liveWhere(now: Date): ScheduleWhere {
  return scheduleStatusWhere(BannerStatus.ACTIVE, now);
}

/**
 * Seconds a serve response may be cached: until the nearest upcoming start/end boundary,
 * clamped to [1, max]. Keeps "expiry → ENDED" and "SCHEDULED → ACTIVE" transitions prompt
 * without any invalidation job.
 */
export function ttlUntilNextBoundary(
  boundaries: readonly (Date | null | undefined)[],
  now: Date,
  maxSeconds: number,
): number {
  let ttl = maxSeconds;
  for (const b of boundaries) {
    if (!b) continue;
    const seconds = Math.ceil((b.getTime() - now.getTime()) / 1000);
    if (seconds > 0) ttl = Math.min(ttl, seconds);
  }
  return Math.max(1, ttl);
}
