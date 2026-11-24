import { ReportTargetType, type ReportReason, type TradeDealType } from '@house/shared';
import { api, qk } from '@/lib/api';
import { complexStatsSchema, complexTradesPageSchema } from './schemas';

/** Browser-side calls of the listing-detail page (TanStack Query fetchers + mutations). */

export const listingKeys = {
  stats: (complexId: string, params: { dealType: TradeDealType; areaTypeId: string | null }) =>
    qk('complexes', 'stats', { complexId, ...params }),
  trades: (complexId: string, params: { dealType: TradeDealType; areaTypeId: string | null }) =>
    qk('complexes', 'trades', { complexId, ...params }),
};

/** View counter + server-side recent view (assumed endpoint, best effort). */
export const recordListingView = (id: string) =>
  api.post(`/listings/${encodeURIComponent(id)}/view`);

export interface ReportInput {
  listingId: string;
  reason: ReportReason;
  detail?: string;
  reporterPhone?: string;
}

export function createListingReport(input: ReportInput) {
  return api.post('/reports', {
    targetType: ReportTargetType.LISTING,
    targetId: input.listingId,
    reason: input.reason,
    ...(input.detail ? { detail: input.detail } : {}),
    ...(input.reporterPhone ? { reporterPhone: input.reporterPhone } : {}),
  });
}

export function fetchComplexStats(
  complexId: string,
  params: { dealType: TradeDealType; areaTypeId: string | null },
  signal?: AbortSignal,
) {
  return api.get(`/complexes/${encodeURIComponent(complexId)}/stats`, {
    query: { dealType: params.dealType, areaTypeId: params.areaTypeId },
    schema: complexStatsSchema,
    signal,
  });
}

export function fetchComplexTrades(
  complexId: string,
  params: { dealType: TradeDealType; areaTypeId: string | null; fromYm?: number },
  signal?: AbortSignal,
) {
  return api.get(`/complexes/${encodeURIComponent(complexId)}/trades`, {
    query: {
      dealType: params.dealType,
      areaTypeId: params.areaTypeId,
      fromYm: params.fromYm,
      page: 1,
      pageSize: 100,
    },
    schema: complexTradesPageSchema,
    signal,
  });
}
