import {
  AgencyMemberRole,
  UserRole,
  type AgencyDocumentType,
  type AgencyInviteCreateInput,
  type AgencyMemberUpdateInput,
  type AgencyRegisterInput,
  type AgencyResubmitInput,
  type MediaPurpose,
} from '@house/shared';
import type { z } from 'zod';
import { API_BASE_PATH, ApiError, api, fetchActionConsents, qk } from '@/lib/api';
import type { BusinessHours } from '../lib/business-hours';
import {
  agencyDashboardSchema,
  agencyDocumentSchema,
  agencyInviteSchema,
  agencyInvitesSchema,
  agencyMemberSchema,
  agencyMembersSchema,
  agencyMembershipSchema,
  geocodeResultSchema,
  mediaSchema,
  myAgencySchema,
  publicAgencySchema,
  staffAgencyOf,
  type MyAgency,
} from './schemas';

/** Query keys of the broker console (resource `agencies`, scope, params). */
export const agencyKeys = {
  mine: qk('agencies', 'mine'),
  dashboard: qk('agencies', 'mine-dashboard'),
  members: qk('agencies', 'mine-members'),
  invites: qk('agencies', 'mine-invites'),
  geocode: (query: string) => qk('geo', 'geocode', query),
} as const;

export interface FetchMyAgencyOptions {
  /**
   * Treat 403 like 404 (`null` = no agency yet). Pass it for a USER-role caller: the application
   * form must still render when the API refuses the endpoint to someone without an agency.
   */
  forbiddenAsNone?: boolean;
  /** Session role: an AGENT whose `/agencies/mine` answers 404 / 403 falls back to the membership. */
  role?: UserRole;
}

/** GET used by both the browser client and the server fetch (cookies forwarded). */
export type AgencyGet = (path: string, schema: z.ZodType) => Promise<unknown>;

/**
 * B2 fallback for 소속 중개사 (AGENT): `GET /agencies/membership` + the public profile
 * `GET /agencies/:id` → the staff view of the office. Null when the caller is not an AGENT member.
 */
export async function fetchStaffAgency(get: AgencyGet): Promise<MyAgency | null> {
  try {
    const membership = agencyMembershipSchema.parse(
      await get('/agencies/membership', agencyMembershipSchema),
    );
    if (membership.role !== AgencyMemberRole.AGENT) return null;
    const profile = publicAgencySchema.parse(
      await get(`/agencies/${encodeURIComponent(membership.agency.id)}`, publicAgencySchema),
    );
    return staffAgencyOf(membership, profile);
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.isForbidden)) return null;
    throw error;
  }
}

/**
 * GET /agencies/mine → the caller's agency, or null when they have none yet (404, or 403 with
 * `forbiddenAsNone`). The API serves staff the reduced view (`myRole: AGENT`); if it answers an
 * AGENT with 404 / 403, the membership is used instead (`fetchStaffAgency`).
 */
export async function fetchMyAgency(
  signal?: AbortSignal,
  options: FetchMyAgencyOptions = {},
): Promise<MyAgency | null> {
  try {
    return await api.get('/agencies/mine', { schema: myAgencySchema.nullable(), signal });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if ((error.isNotFound || error.isForbidden) && options.role === UserRole.AGENT) {
      return fetchStaffAgency((path, schema) => api.get(path, { schema, signal }));
    }
    if (error.isNotFound) return null;
    if (error.isForbidden && options.forbiddenAsNone) return null;
    throw error;
  }
}

export function fetchDashboard(signal?: AbortSignal) {
  return api.get('/agencies/mine/dashboard', { schema: agencyDashboardSchema, signal });
}

/** GET /agencies/mine/members — ACTIVE staff incl. the owner (one page of up to 100). */
export function fetchMembers(signal?: AbortSignal) {
  return api.get('/agencies/mine/members', {
    query: { pageSize: 100 },
    schema: agencyMembersSchema,
    signal,
  });
}

/** GET /agencies/mine/invites — open invitations (code hint only; the code is shown once). */
export function fetchInvites(signal?: AbortSignal) {
  return api.get('/agencies/mine/invites', { schema: agencyInvitesSchema, signal });
}

/** POST /agencies/mine/invites → the new invitation WITH its code (never readable again). */
export function createInvite(input: AgencyInviteCreateInput) {
  return api.post('/agencies/mine/invites', input, { schema: agencyInviteSchema });
}

/** DELETE /agencies/mine/invites/:inviteId — the code stops working. */
export function revokeInvite(inviteId: string) {
  return api.delete(`/agencies/mine/invites/${encodeURIComponent(inviteId)}`);
}

/** PATCH /agencies/mine/members/:memberId — 소속공인중개사 / 중개보조원 (+ 자격증 번호). */
export function updateMember(memberId: string, input: AgencyMemberUpdateInput) {
  return api.patch(`/agencies/mine/members/${encodeURIComponent(memberId)}`, input, {
    schema: agencyMemberSchema,
  });
}

/** GET /geo/geocode?query= — address search with coordinates and the 법정동코드. */
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

/** DELETE /agencies/mine/members/:memberId — the member leaves; their ads move to the 대표. */
export function removeMember(memberId: string) {
  return api.delete(`/agencies/mine/members/${encodeURIComponent(memberId)}`);
}

/**
 * POST /agencies/membership/leave → 204. A 소속 중개사 (AGENT) leaves their office: the server turns
 * the session into a plain member (role USER, no acting agency) and moves their ads to the 대표.
 * The owner cannot leave (400 `AGENCY_OWNER_NOT_REMOVABLE`).
 */
export function leaveAgency() {
  return api.post('/agencies/membership/leave');
}

export interface JoinAgencyInput {
  /** Normalized invite code (`normalizeInviteCode`). */
  code: string;
  /** Name shown to the office (member profile). */
  displayName: string;
  phone?: string;
}

/**
 * POST /agencies/join (`agencyJoinSchema`) with the current version of the 개인정보 수집·이용 동의
 * the user ticked (D8) → `MyAgencyMembership`. A joining member is always a 중개보조원 until the
 * owner records a license.
 */
export async function joinAgency(input: JoinAgencyInput | string) {
  const consents = await fetchActionConsents('AGENCY_JOIN');
  const body = typeof input === 'string' ? { code: input } : input;
  return api.post('/agencies/join', { ...body, consents }, { schema: agencyMembershipSchema });
}

/** URL of a private document stream (opens in a new tab; cookies authorize it). */
export function privateMediaUrl(mediaId: string): string {
  return `${API_BASE_PATH}/media/${encodeURIComponent(mediaId)}/private`;
}
