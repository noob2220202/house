import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { AGENCY_CACHE } from '../constants';

/** Version-bump invalidation for the cached public agency reads (profiles, map tiles). */
@Injectable()
export class AgencyCacheService {
  constructor(private readonly cache: CacheService) {}

  async publicKey(...parts: (string | number)[]): Promise<string> {
    const v = await this.cache.version(AGENCY_CACHE.PUBLIC);
    return `cache:agencies:v${v}:${parts.join(':')}`;
  }

  getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    return this.cache.getOrSet(key, ttlSeconds, compute);
  }

  invalidatePublic(): Promise<void> {
    return this.cache.bump(AGENCY_CACHE.PUBLIC);
  }
}
