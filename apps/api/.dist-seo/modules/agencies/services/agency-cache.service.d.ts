import { CacheService } from '../../../common/cache/cache.service';
/** Version-bump invalidation for the cached public agency reads (profiles, map tiles). */
export declare class AgencyCacheService {
    private readonly cache;
    constructor(cache: CacheService);
    publicKey(...parts: (string | number)[]): Promise<string>;
    getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T>;
    invalidatePublic(): Promise<void>;
}
