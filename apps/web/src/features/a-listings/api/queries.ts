import { MediaPurpose, type ListingStatus, type VerificationMethod } from '@house/shared';
import { api, qk } from '@/lib/api';
import type { DraftPayload } from '../lib/form';
import { toApiQuery, type ListParams } from '../lib/list-params';
import { toPhotosPayload, type PhotoValue } from '../lib/photos';
import {
  agencyListingPageSchema,
  agencyListingSchema,
  agencyListingSummarySchema,
  coBrokerCandidatePageSchema,
  complexForListingSchema,
  complexSearchPageSchema,
  geocodeResultSchema,
  mediaSchema,
} from './schemas';

/** Query keys: resource `agency-listings` (invalidate the whole resource after any mutation). */
export const listingKeys = {
  all: qk('agency-listings'),
  list: (params: ListParams) => qk('agency-listings', 'list', params),
  summary: qk('agency-listings', 'summary'),
  detail: (id: string) => qk('agency-listings', 'detail', id),
  candidates: (params: CandidateParams) => qk('agency-listings', 'co-broker-candidates', params),
  complexSearch: (q: string) => qk('complexes', 'search', q),
  complex: (id: string) => qk('complexes', 'for-listing', id),
  geocode: (q: string) => qk('geo', 'geocode', q),
} as const;

const path = (id: string, tail = '') => `/agency/listings/${encodeURIComponent(id)}${tail}`;

// ---- reads ----------------------------------------------------------------------------------------

/** GET /agency/listings — the caller's agency's listings (own + co-brokered). ASSUMED endpoint. */
export function fetchListings(params: ListParams, signal?: AbortSignal) {
  return api.get('/agency/listings', {
    query: toApiQuery(params),
    schema: agencyListingPageSchema,
    signal,
  });
}

/** GET /agency/listings/summary — status counters. ASSUMED endpoint. */
export function fetchSummary(signal?: AbortSignal) {
  return api.get('/agency/listings/summary', { schema: agencyListingSummarySchema, signal });
}

/** GET /agency/listings/:id — full editable listing (incl. 호수). ASSUMED endpoint. */
export function fetchListing(id: string, signal?: AbortSignal) {
  return api.get(path(id), { schema: agencyListingSchema, signal });
}

export interface CandidateParams {
  complexId: string;
  dong?: string;
  q?: string;
  page?: number;
}

/** GET /agency/listings/co-broker-candidates — other offices' listings in a complex. ASSUMED. */
export function fetchCoBrokerCandidates(params: CandidateParams, signal?: AbortSignal) {
  return api.get('/agency/listings/co-broker-candidates', {
    query: {
      complexId: params.complexId,
      dong: params.dong || undefined,
      q: params.q || undefined,
      page: params.page && params.page > 1 ? params.page : undefined,
    },
    schema: coBrokerCandidatePageSchema,
    signal,
  });
}

/** GET /complexes?q= — complex name / address search (complexes README). */
export function searchComplexes(q: string, signal?: AbortSignal) {
  return api.get('/complexes', {
    query: { q, pageSize: 8 },
    schema: complexSearchPageSchema,
    signal,
  });
}

/** GET /complexes/:id — 평형, 층수, 사용승인일, 주차 for the pre-fill. */
export function fetchComplex(id: string, signal?: AbortSignal) {
  return api.get(`/complexes/${encodeURIComponent(id)}`, {
    schema: complexForListingSchema,
    signal,
  });
}

/** GET /geo/geocode?query= — address search with coordinates (ASSUMED, shared with a-agency). */
export function geocode(query: string, signal?: AbortSignal) {
  return api.get('/geo/geocode', { query: { query }, schema: geocodeResultSchema, signal });
}

// ---- writes ---------------------------------------------------------------------------------------

/** POST /agency/listings — creates a DRAFT (`listingDraftSchema`). */
export function createListing(body: DraftPayload) {
  return api.post('/agency/listings', body, { schema: agencyListingSchema });
}

/** PATCH /agency/listings/:id — replaces the draft fields (omitted optional fields are cleared). */
export function updateListing(id: string, body: DraftPayload) {
  return api.patch(path(id), body, { schema: agencyListingSchema });
}

/** DELETE /agency/listings/:id — drafts are removed, published listings soft-deleted. */
export function deleteListing(id: string) {
  return api.delete(path(id));
}

/** POST /agency/listings/:id/publish — runs the publish validator (LISTING_PUBLISH_REQUIREMENTS). */
export function publishListing(id: string) {
  return api.post(path(id, '/publish'), undefined, { schema: agencyListingSchema });
}

/** POST /agency/listings/:id/status (`listingStatusChangeSchema`). */
export function changeListingStatus(id: string, status: ListingStatus) {
  return api.post(path(id, '/status'), { status }, { schema: agencyListingSchema });
}

export interface VerificationInput {
  method: VerificationMethod;
  /** YYYY-MM-DD */
  verifiedAt: string;
  note?: string;
}

/** POST /agency/listings/:id/verifications (`listingVerificationSchema`). */
export function addVerification(id: string, input: VerificationInput) {
  return api.post(path(id, '/verifications'), input, { schema: agencyListingSchema });
}

/** PUT /agency/listings/:id/photos — full ordered list incl. the cover. */
export function saveListingPhotos(id: string, photos: readonly PhotoValue[]) {
  return api.put(path(id, '/photos'), toPhotosPayload(photos), { schema: agencyListingSchema });
}

export interface CoBrokerContact {
  contactName?: string;
  contactPhone?: string;
}

/** POST /agency/listings/:id/co-brokers — the caller's agency joins as a co-broker (owner only). */
export function joinCoBroker(id: string, contact: CoBrokerContact) {
  return api.post(path(id, '/co-brokers'), contact);
}

/** DELETE /agency/listings/:id/co-brokers — the caller's agency withdraws (owner only). */
export function leaveCoBroker(id: string) {
  return api.delete(path(id, '/co-brokers'));
}

/** GET /media/:id — metadata + variant URLs (filled once the processing queue is done). */
export function fetchMedia(id: string, signal?: AbortSignal) {
  return api.get(`/media/${encodeURIComponent(id)}`, { schema: mediaSchema, signal });
}

/** POST /media?purpose=LISTING_PHOTO (multipart `file`) → MediaDto. */
export function uploadListingPhoto(file: File, signal?: AbortSignal) {
  const body = new FormData();
  body.append('file', file);
  return api.post('/media', body, {
    query: { purpose: MediaPurpose.LISTING_PHOTO },
    schema: mediaSchema,
    signal,
    timeoutMs: 60_000,
  });
}
