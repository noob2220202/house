import { MediaPurpose, type DealRequestType, type DealRequestCreateInput } from '@house/shared';
import { z } from 'zod';
import { api, qk } from '@/lib/api';
import {
  addressMatchSchema,
  contactGrantResultSchema,
  dealRequestDetailSchema,
  dealRequestPageSchema,
  mediaSchema,
  proposalSchema,
  regionListSchema,
  targetAgencyPageSchema,
  type Media,
} from './schemas';

/**
 * The create response is only used for its id (the completion page loads the detail itself), so a
 * shape drift in the rest of the 201 body can never turn a created request into a false failure —
 * and a duplicate request when the user submits again.
 */
const createdSchema = z.looseObject({ id: z.string().min(1) });

/** Thumbnail URL of a media DTO ('' while the variants are still being processed). */
export function mediaThumbUrl(media: Pick<Media, 'variants'>): string {
  return media.variants.thumb?.url ?? media.variants.medium?.url ?? '';
}

/** Create payload = the shared schema input + photo ids (assumed field, see the integration doc). */
export type DealRequestCreatePayload = DealRequestCreateInput & { photoMediaIds?: string[] };

export interface MyRequestsQuery {
  type?: DealRequestType;
  /** One status or several, comma separated ("CLOSED,CANCELLED,EXPIRED"). */
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface TargetAgencyQuery {
  q?: string;
  emdCode?: string;
  regionCodes?: string[];
  page?: number;
  pageSize?: number;
}

export const dealKeys = {
  all: ['deal-requests'] as const,
  mine: (query: MyRequestsQuery) => qk('deal-requests', 'mine', query),
  detail: (id: string) => qk('deal-requests', 'detail', id),
  targets: (query: TargetAgencyQuery) => qk('deal-requests', 'target-agencies', query),
  addressMatch: (roadAddress: string) => qk('deal-requests', 'address-match', roadAddress),
  regions: () => qk('deal-requests', 'regions'),
};

export const dealApi = {
  create: (payload: DealRequestCreatePayload) =>
    api.post('/deal-requests', payload, { schema: createdSchema }),

  listMine: (query: MyRequestsQuery, signal?: AbortSignal) =>
    api.get('/me/deal-requests', { query: { ...query }, schema: dealRequestPageSchema, signal }),

  getMine: (id: string, signal?: AbortSignal) =>
    api.get(`/me/deal-requests/${id}`, { schema: dealRequestDetailSchema, signal }),

  cancel: (id: string) =>
    api.post(`/me/deal-requests/${id}/cancel`, undefined, { schema: dealRequestDetailSchema }),

  close: (id: string) =>
    api.post(`/me/deal-requests/${id}/close`, undefined, { schema: dealRequestDetailSchema }),

  grantContact: (id: string, agencyId: string) =>
    api.post(
      `/me/deal-requests/${id}/contact-grants`,
      { agencyId },
      { schema: contactGrantResultSchema },
    ),

  revokeContact: (id: string, agencyId: string) =>
    api.delete(`/me/deal-requests/${id}/contact-grants/${agencyId}`),

  acceptProposal: (proposalId: string) =>
    api.post(`/me/proposals/${proposalId}/accept`, undefined, { schema: proposalSchema }),

  declineProposal: (proposalId: string) =>
    api.post(`/me/proposals/${proposalId}/decline`, undefined, { schema: proposalSchema }),

  targetAgencies: (query: TargetAgencyQuery, signal?: AbortSignal) =>
    api.get('/deal-requests/target-agencies', {
      query: { ...query },
      schema: targetAgencyPageSchema,
      signal,
    }),

  addressMatch: (
    query: { roadAddress: string; buildingName?: string; bcode?: string },
    signal?: AbortSignal,
  ) => api.get('/deal-requests/address-match', { query, schema: addressMatchSchema, signal }),

  /** POST /media?purpose=DEAL_REQUEST_PHOTO (multipart `file`). */
  uploadPhoto: (file: File, signal?: AbortSignal) => {
    const body = new FormData();
    body.append('file', file);
    return apiUpload(body, signal);
  },

  /** GET /media/:id — metadata + variant URLs (polled until the thumbnail exists). */
  getMedia: (id: string, signal?: AbortSignal) =>
    api.get(`/media/${id}`, { schema: mediaSchema, signal }),

  deleteMedia: (id: string) => api.delete(`/media/${id}`),

  /**
   * GET /regions — 읍면동 / 지구 of the service region (ASSUMED endpoint, shared with w-map). No
   * sggCode: the backend answers for its configured REGION_SGG_CODE.
   */
  regions: (signal?: AbortSignal) => api.get('/regions', { schema: regionListSchema, signal }),
};

function apiUpload(body: FormData, signal?: AbortSignal) {
  return api.post('/media', body, {
    query: { purpose: MediaPurpose.DEAL_REQUEST_PHOTO },
    schema: mediaSchema,
    signal,
    timeoutMs: 60_000,
  });
}
