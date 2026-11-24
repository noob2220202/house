import type {
  AgencyDocumentType,
  AgencyRegisterInput,
  AgencyResubmitInput,
  MediaPurpose,
} from '@house/shared';
import { z } from 'zod';
import { API_BASE_PATH, ApiError, api, fetchActionConsents, qk } from '@/lib/api';
import type { BusinessHours } from '../lib/business-hours';
import {
  agencyDashboardSchema,
  agencyDocumentSchema,
  agencyMemberSchema,
  agencyMembersSchema,
  geocodeResultSchema,
  mediaSchema,
  myAgencySchema,
  type InviteMemberPayload,
  type MyAgency,
} from './schemas';

/** Query keys of the broker console (resource `agencies`, scope, params). */
export const agencyKeys = {
  mine: qk('agencies', 'mine'),
  dashboard: qk('agencies', 'mine-dashboard'),
  members: qk('agencies', 'mine-members'),
  geocode: (query: string) => qk('geo', 'geocode', query),
} as const;

export interface FetchMyAgencyOptions {
  /**
   * Treat 403 like 404 (`null` = no agency yet). Pass it for a USER-role caller: the agencies
   * README lists GET /agencies/mine as AGENCY_OWNER only, so a backend that follows it answers an
   * applicant (or someone who never applied) with 403 — the application form must still render.
   */
  forbiddenAsNone?: boolean;
}

/**
 * GET /agencies/mine → the caller's agency, or null when they have none yet (404, or 403 with
 * `forbiddenAsNone`). A `200 null` body is accepted as "none" too (preferred by the frontend).
 */
export async function fetchMyAgency(
  signal?: AbortSignal,
  options: FetchMyAgencyOptions = {},
): Promise<MyAgency | null> {
  try {
    return await api.get('/agencies/mine', { schema: myAgencySchema.nullable(), signal });
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    if (error instanceof ApiError && error.isForbidden && options.forbiddenAsNone) return null;
    throw error;
  }
}

export function fetchDashboard(signal?: AbortSignal) {
  return api.get('/agencies/mine/dashboard', { schema: agencyDashboardSchema, signal });
}

export function fetchMembers(signal?: AbortSignal) {
  return api.get('/agencies/mine/members', { schema: agencyMembersSchema, signal });
}

/** GET /geo/geocode?query= — address search with coordinates (ASSUMED endpoint). */
export function geocode(query: string, signal?: AbortSignal) {
  return api.get('/geo/geocode', { query: { query }, schema: geocodeResultSchema, signal });
}

/**
 * Body of POST /agencies without `consents`: `registerAgency` adds the current version of the
 * 개인정보 수집·이용 동의 the applicant ticked (D8).
 */
export type AgencyRegisterRequest = Omit<AgencyRegisterInput, 'consents'>;

export async function registerAgency(body: AgencyRegisterRequest) {
  const consents = await fetchActionConsents('AGENCY_APPLICATION');
  return api.post('/agencies', { ...body, consents }, { schema: myAgencySchema });
}

/** POST /agencies/mine/resubmit — no consents (the application's consent still covers it). */
export function resubmitAgency(body: AgencyResubmitInput) {
  return api.post('/agencies/mine/resubmit', body, { schema: myAgencySchema });
}

/**
 * Body of PATCH /agencies/mine: only the fields the owner changed (`buildProfilePatch`).
 * `agencyUpdateSchema` covers intro / specialties / phone / mobile; `mobile: null` (clear),
 * `businessHours`, `logoMediaId` and `coverMediaId` are REQUIRED ADDITIONS — see
 * docs/frontend-integration/a-agency.md, assumption 3.
 */
export interface AgencyProfilePatch {
  /** '' clears the intro (the shared schema accepts an empty string). */
  intro?: string;
  /** Always sent: `agencyUpdateSchema` still defaults a missing `specialties` to [] (zod 4). */
  specialties: MyAgency['specialties'];
  phone?: string;
  /** null clears the number. */
  mobile?: string | null;
  businessHours?: BusinessHours | null;
  logoMediaId?: string | null;
  coverMediaId?: string | null;
}

export function updateMyAgency(patch: AgencyProfilePatch) {
  return api.patch('/agencies/mine', patch, { schema: myAgencySchema });
}

/** POST /media?purpose= (multipart `file`) → MediaDto. Uploads can take a while → 60s timeout. */
export function uploadMedia(file: File, purpose: MediaPurpose, signal?: AbortSignal) {
  const body = new FormData();
  body.append('file', file);
  return api.post('/media', body, {
    query: { purpose },
    schema: mediaSchema,
    signal,
    timeoutMs: 60_000,
  });
}

/** POST /agencies/mine/documents — attach an uploaded private file to the application. */
export function attachDocument(input: {
  type: AgencyDocumentType;
  mediaId: string;
  fileName?: string;
}) {
  return api.post('/agencies/mine/documents', input, { schema: agencyDocumentSchema });
}

/** POST /agencies/mine/members — body built by `toInvitePayload` (no '' for blank fields). */
export function inviteMember(input: InviteMemberPayload) {
  return api.post('/agencies/mine/members', input, { schema: agencyMemberSchema });
}

export function removeMember(memberId: string) {
  return api.delete(`/agencies/mine/members/${encodeURIComponent(memberId)}`);
}

const joinResultSchema = z.object({
  agencyId: z.string(),
  agencyName: z.string(),
  role: z.string().optional(),
});

/** POST /agencies/join — redeem a staff invite code (ASSUMED endpoint). */
/** POST /agencies/join with the current version of the 개인정보 수집·이용 동의 the user ticked (D8). */
export async function joinAgency(code: string) {
  const consents = await fetchActionConsents('AGENCY_JOIN');
  return api.post('/agencies/join', { code, consents }, { schema: joinResultSchema });
}

/** URL of a private document stream (opens in a new tab; cookies authorize it). */
export function privateMediaUrl(mediaId: string): string {
  return `${API_BASE_PATH}/media/${encodeURIComponent(mediaId)}/private`;
}
