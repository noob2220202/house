import { idSchema, type BannerSlot } from '@house/shared';
import { queryOptions } from '@tanstack/react-query';
import { api, qk } from '@/lib/api';
import { servedBannerListSchema } from './schemas';

export interface BannerTarget {
  /** 법정동코드 in view → REGIONS targeting. */
  regionCode?: string | null;
  /** Complex in view → COMPLEXES targeting. Ignored unless it is a well-formed id (else 400). */
  complexId?: string | null;
}

const validId = (id: string | null | undefined) =>
  id && idSchema.safeParse(id).success ? id : null;

/** Query of one slot + target (shared by the hook and by callers that start it early). */
export function servedBannersQuery(slot: BannerSlot, target: BannerTarget = {}) {
  const regionCode = target.regionCode || null;
  const complexId = validId(target.complexId);
  return queryOptions({
    queryKey: qk('banners', 'serve', { slot, regionCode, complexId }),
    queryFn: ({ signal }) =>
      api.get('/banners', {
        query: {
          slot,
          ...(regionCode ? { regionCode } : {}),
          ...(complexId ? { complexId } : {}),
        },
        schema: servedBannerListSchema,
        signal,
      }),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
