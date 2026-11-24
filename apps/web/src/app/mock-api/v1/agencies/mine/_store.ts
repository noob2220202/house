import type { NextRequest, NextResponse } from 'next/server';
import { AGENCY_INVITE_CODE_ALPHABET, AGENCY_INVITE_CODE_LENGTH } from '@house/shared';
import type { AgencyInvite, AgencyMember, MyAgency } from '@/features/a-agency/api/schemas';
import {
  mockCsrfOk,
  mockError,
  mockGuard,
  mockSessionRole,
  mockUnauthenticated,
  type MockRole,
} from '@/lib/mock';
import { seedInvites, seedMembers, seedOffice } from './_fixtures';
import { ensureSeedDocumentFiles } from './_seed-files';

/** A stored invitation: the API keeps only a hash; the mock keeps the code to redeem it. */
export interface MockInvite extends AgencyInvite {
  code: string;
}

/**
 * In-memory state of the agencies mocks (a-agency). Kept on `globalThis` because Next compiles
 * every route handler into its own module graph; it resets when the dev server restarts.
 *
 * - `applicant`: the agency application of the mock USER session (null = not applied yet).
 * - `office` / `members`: the approved agency (B01) of the mock AGENT / AGENCY_OWNER sessions.
 * - `invites`: open invite codes of that agency (single use, removed on join / revoke).
 * - `emptyDashboard`: dev switch for the dashboard empty states.
 */
export interface AgencyMockState {
  applicant: MyAgency | null;
  office: MyAgency;
  members: AgencyMember[];
  invites: MockInvite[];
  emptyDashboard: boolean;
}

const KEY = '__houseMockAgencyStore_v1';

export function agencyState(): AgencyMockState {
  ensureSeedDocumentFiles();
  const g = globalThis as typeof globalThis & { [KEY]?: AgencyMockState };
  g[KEY] ??= {
    applicant: null,
    office: seedOffice(),
    members: seedMembers(),
    invites: seedInvites(),
    emptyDashboard: false,
  };
  return g[KEY];
}

export function resetAgencyState(): AgencyMockState {
  const g = globalThis as typeof globalThis & { [KEY]?: AgencyMockState };
  delete g[KEY];
  return agencyState();
}

export interface MockAgencyContext {
  role: MockRole;
  state: AgencyMockState;
  /** The caller's agency (null when a USER has not applied). `myRole` reflects the session. */
  agency: MyAgency | null;
  isOwner: boolean;
}

/**
 * Common preamble of the agencies handlers: mock guard → session → (CSRF for mutations).
 * Returns either an early response or the caller's context.
 */
export function agencyContext(
  req: NextRequest,
  options: { mutation?: boolean } = {},
): NextResponse | MockAgencyContext {
  const off = mockGuard();
  if (off) return off;
  const role = mockSessionRole(req);
  if (!role) return mockUnauthenticated();
  if (options.mutation && !mockCsrfOk(req)) {
    return mockError(403, 'CSRF_TOKEN_INVALID', '요청을 확인할 수 없습니다.');
  }
  const state = agencyState();
  if (role === 'USER') {
    return { role, state, agency: state.applicant, isOwner: !!state.applicant };
  }
  const isOwner = role === 'AGENCY_OWNER';
  return {
    role,
    state,
    agency: { ...state.office, myRole: isOwner ? 'OWNER' : 'AGENT' },
    isOwner,
  };
}

/** Writes back a changed agency to the bucket it came from. */
export function saveAgency(ctx: MockAgencyContext, next: MyAgency): MyAgency {
  const stored = { ...next, updatedAt: new Date().toISOString() };
  if (ctx.role === 'USER') ctx.state.applicant = { ...stored, myRole: 'OWNER' };
  else ctx.state.office = { ...stored, myRole: 'OWNER' };
  return { ...stored, myRole: ctx.isOwner ? 'OWNER' : 'AGENT' };
}

export const agencyNotFound = () =>
  mockError(404, 'AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');

/**
 * Staff payload: private fields are only visible to the owner — the application (사업자번호,
 * documents, history) and the representative's private contact data (mobile, email).
 */
export function forViewer(agency: MyAgency, isOwner: boolean): MyAgency {
  if (isOwner) return agency;
  return {
    ...agency,
    businessNumber: null,
    mobile: null,
    email: null,
    documents: [],
    statusHistory: [],
  };
}

let seq = 0;
export function mockId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}`;
}

/** A fresh code of the shared alphabet / length (the API: 10 chars, no 0/O/1/I). */
export function newInviteCode(): string {
  return Array.from(
    { length: AGENCY_INVITE_CODE_LENGTH },
    () =>
      AGENCY_INVITE_CODE_ALPHABET[Math.floor(Math.random() * AGENCY_INVITE_CODE_ALPHABET.length)],
  ).join('');
}

/** 24-hex invite id (`agencyInviteIdSchema`). */
export function newInviteId(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** API view of an invite: the code is never returned again after creation. */
export function inviteView({ code: _code, ...invite }: MockInvite): AgencyInvite {
  return invite;
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** zod issues → backend validation error (`details[].path` = dot path of the field). */
export function validationError(
  issues: readonly { path: PropertyKey[]; message: string }[],
): NextResponse {
  return mockError(
    400,
    'VALIDATION_FAILED',
    '입력 내용을 확인해 주세요.',
    issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  );
}
