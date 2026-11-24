import type Redis from 'ioredis';
import { type DailyCapKey } from './throttle.constants';
/** "YYYYMMDD" of the current day in Asia/Seoul. */
export declare function kstDateKey(now?: Date): string;
/** Seconds until the next KST midnight (min 1). */
export declare function secondsUntilKstMidnight(now?: Date): number;
/**
 * Per-user daily caps backed by Redis counters (reset at KST midnight).
 *   await this.caps.consume('DEAL_REQUEST_CREATE', user.userId); // throws 429 RATE_LIMITED when over
 * Call it right before the write; it counts the attempt even if the write later fails, which is the
 * conservative choice for abuse control.
 */
export declare class DailyCapService {
    private readonly redis;
    constructor(redis: Redis);
    consume(key: DailyCapKey, subjectId: string, now?: Date): Promise<number>;
    used(key: DailyCapKey, subjectId: string, now?: Date): Promise<number>;
}
