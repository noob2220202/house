import { type PopularComplexItem, type PopularComplexesQuery } from '@house/shared';
import type Redis from 'ioredis';
import type { Principal } from '../../../common/auth/principal';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplexListingsService } from './complex-listings.service';
/** Who a view is attributed to; `null` from viewerKey() means "do not count". */
export interface Viewer {
    key: string;
    /** Anonymous viewers are keyed by network and subject to the per-network daily cap. */
    anonymous: boolean;
}
/**
 * Network a client address belongs to: IPv4 /24, IPv6 /64 (IPv4-mapped IPv6 is treated as IPv4).
 * Rotating addresses inside a home/office network or rotating the User-Agent gains nothing.
 */
export declare function networkPrefix(ip: string | undefined): string | null;
/** Weight of a day `ageDays` old: 1 today, ½ after one half-life. */
export declare function decayWeight(ageDays: number): number;
/**
 * Sums per-day view counts with exponential time decay. `days[i]` is the ZSET content of the day
 * `i` days ago, as ZRANGE … WITHSCORES output (flat [member, score, …]).
 */
export declare function decayedScores(days: readonly (readonly string[])[]): Map<string, number>;
/** "자주 찾는 단지": deduped view counting + time-decayed 30-day ranking. */
export declare class ComplexPopularityService {
    private readonly redis;
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly listings;
    private readonly logger;
    private readonly viewerSecret;
    constructor(redis: Redis, prisma: PrismaService, cache: CacheService, config: AppConfig, listings: ComplexListingsService);
    /**
     * Per-viewer key: user id, else an HMAC (server secret) of the client's network — never raw or
     * reversible PII in Redis. Admins, bots and requests without an address are not counted.
     */
    viewerKey(principal: Principal | undefined): Viewer | null;
    /** Records a deduped view; returns the current total (falls back to `dbCount` on Redis errors). */
    recordView(complexId: string, viewer: Viewer | null, dbCount: number, now?: Date): Promise<number>;
    popular(q: PopularComplexesQuery, now?: Date): Promise<PopularComplexItem[]>;
    /** Redis view totals → complexes.view_count (idempotent). Returns the number of rows flushed. */
    flush(batchSize?: number): Promise<number>;
    private windowScores;
    private computePopular;
}
