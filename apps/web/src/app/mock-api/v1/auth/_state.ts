import type { AuthProvider, TermsType } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import type { MockRole } from '@/lib/mock';
import { meState } from '../me/_store';
import { MOCK_TERMS } from '../terms/_fixtures';
import { MOCK_USERS } from './_fixtures';

/**
 * Mock-only account state of the w-auth flows (social signup, consents, interest regions,
 * suspended withdrawal), shaped like the real auth module:
 *
 * - a first-time social login gets **no session**, only a pending signup (httpOnly cookie
 *   `house_signup`, scoped to the signup endpoint like the backend's) completed by POST /auth/signup;
 * - "has this browser finished a mock signup?" lives in a cookie so every browser / Playwright
 *   context is independent: `house_mock_signup = done` (the login page's `as=auto` reads it);
 * - consents and interest regions live in memory per mock role (on `globalThis`, because Next
 *   compiles every route handler into its own module graph).
 */
export const MOCK_SIGNUP_COOKIE = 'house_mock_signup';
export const PENDING_SIGNUP_COOKIE = 'house_signup';
export const PENDING_SIGNUP_PATH = '/mock-api/v1/auth/signup';
export const WITHDRAW_TICKET_COOKIE = 'house_withdraw';
export const WITHDRAW_TICKET_PATH = '/mock-api/v1/auth/withdraw';
const PENDING_TTL_SECONDS = 30 * 60;
const TICKET_TTL_SECONDS = 10 * 60;

export function setMockSignupDone(res: NextResponse): void {
  res.cookies.set(MOCK_SIGNUP_COOKIE, 'done', { path: '/', httpOnly: true, sameSite: 'lax' });
}

export function mockSignupDone(req: NextRequest): boolean {
  return req.cookies.get(MOCK_SIGNUP_COOKIE)?.value === 'done';
}

export interface MockConsent {
  agreed: boolean;
  createdAt: string;
}

export interface AuthMockState {
  /** Latest consent record per terms document id. */
  consents: Record<string, MockConsent>;
  regionKeys: string[];
  notify: boolean;
}

interface PendingSignup {
  provider: AuthProvider;
  returnTo: string | null;
  expiresAt: number;
}

interface Store {
  buckets: Partial<Record<MockRole, AuthMockState>>;
  pending: Record<string, PendingSignup>;
  /** Withdrawal tickets of the fictional suspended member: token → expiry. */
  tickets: Record<string, number>;
}

const KEY = '__houseMockAuthStore_v2';

function store(): Store {
  const g = globalThis as typeof globalThis & { [KEY]?: Store };
  g[KEY] ??= { buckets: {}, pending: {}, tickets: {} };
  return g[KEY];
}

const DAY = 86_400_000;

/** A member who finished signup 37 days ago: required terms agreed, marketing per the fixture user. */
function seed(role: MockRole): AuthMockState {
  const createdAt = new Date(Date.now() - 37 * DAY).toISOString();
  const optIn = MOCK_USERS[role].marketingOptIn;
  return {
    consents: Object.fromEntries(
      MOCK_TERMS.map((doc) => [doc.id, { agreed: doc.isRequired || optIn, createdAt }]),
    ),
    regionKeys: ['sindae', 'seonwol', 'yeonhyang'],
    notify: true,
  };
}

export function authState(role: MockRole): AuthMockState {
  const { buckets } = store();
  buckets[role] ??= seed(role);
  return buckets[role];
}

/** A brand-new account: nothing agreed, no regions. */
export function resetAuthState(role: MockRole): AuthMockState {
  const fresh: AuthMockState = { consents: {}, regionKeys: [], notify: true };
  store().buckets[role] = fresh;
  return fresh;
}

/**
 * A member signs in with a mock role. `reconsent`: they have not agreed to the current PRIVACY
 * version yet. Otherwise a member whose required consents are incomplete (a fresh mock signup reset
 * the shared bucket, or an earlier `reconsent` run) is re-seeded; regions and decisions stay.
 */
export function signInAuthState(role: MockRole, options: { reconsent?: boolean } = {}): void {
  const { buckets } = store();
  const state = authState(role);
  if (options.reconsent) {
    const privacy = MOCK_TERMS.find((doc) => doc.type === 'PRIVACY');
    if (privacy) delete state.consents[privacy.id];
    return;
  }
  const complete = MOCK_TERMS.every((doc) => !doc.isRequired || state.consents[doc.id]?.agreed);
  if (!complete)
    buckets[role] = { ...seed(role), regionKeys: state.regionKeys, notify: state.notify };
}

export function dropAuthState(role: MockRole): void {
  delete store().buckets[role];
}

/** Required current documents the member has not agreed to (`MeResponse.pendingRequiredTerms`). */
export function pendingRequiredTerms(role: MockRole): TermsType[] {
  const { consents } = authState(role);
  return MOCK_TERMS.filter((doc) => doc.isRequired && consents[doc.id]?.agreed !== true).map(
    (doc) => doc.type,
  );
}

/** `ConsentStatus[]` of GET/POST /me/consents: every current account document. */
export function consentStatus(role: MockRole) {
  const { consents } = authState(role);
  return MOCK_TERMS.map((doc) => {
    const record = consents[doc.id];
    return {
      terms: {
        id: doc.id,
        type: doc.type,
        version: doc.version,
        title: doc.title,
        isRequired: doc.isRequired,
        effectiveAt: doc.effectiveAt,
      },
      agreed: record?.agreed ?? false,
      decidedAt: record?.createdAt ?? null,
    };
  });
}

/** `IdentitySummary[]` of the mock member (GET /me/identities, `MeResponse.identities`). */
export function identitySummaries(role: MockRole) {
  return meState(role).identities.map((i) => ({
    provider: i.provider,
    email: i.email ?? null,
    linkedAt: i.createdAt ?? new Date().toISOString(),
    lastUsedAt: i.lastUsedAt ?? null,
  }));
}

/** `MeResponse` of the mock member, with the live profile edits of the /me mocks. */
export function mockMe(role: MockRole) {
  const user = MOCK_USERS[role];
  const { profile } = meState(role);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: profile.nickname,
    phone: profile.phone ?? null,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    marketingOptIn: profile.marketingOptIn,
    marketingOptInAt: profile.marketingOptIn ? (profile.marketingOptInAt ?? null) : null,
    createdAt: profile.createdAt ?? new Date().toISOString(),
    identities: identitySummaries(role),
    agency: user.agency,
    pendingRequiredTerms: pendingRequiredTerms(role),
  };
}

// ---- pending social signup ----------------------------------------------------------------------

const token = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

/** Starts a pending signup (what the backend's OAuth callback does for an unknown identity). */
export function startPendingSignup(
  res: NextResponse,
  provider: AuthProvider,
  returnTo: string | null,
): void {
  const id = token();
  store().pending[id] = { provider, returnTo, expiresAt: Date.now() + PENDING_TTL_SECONDS * 1000 };
  res.cookies.set(PENDING_SIGNUP_COOKIE, id, {
    path: PENDING_SIGNUP_PATH,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: PENDING_TTL_SECONDS,
  });
}

export function readPendingSignup(req: NextRequest): (PendingSignup & { id: string }) | null {
  const id = req.cookies.get(PENDING_SIGNUP_COOKIE)?.value;
  const pending = id ? store().pending[id] : undefined;
  if (!id || !pending || pending.expiresAt < Date.now()) return null;
  return { ...pending, id };
}

export function endPendingSignup(res: NextResponse, id: string): void {
  delete store().pending[id];
  res.cookies.set(PENDING_SIGNUP_COOKIE, '', { path: PENDING_SIGNUP_PATH, maxAge: 0 });
}

// ---- suspended member's withdrawal ticket -------------------------------------------------------

export function issueWithdrawTicket(res: NextResponse): void {
  const id = token();
  store().tickets[id] = Date.now() + TICKET_TTL_SECONDS * 1000;
  res.cookies.set(WITHDRAW_TICKET_COOKIE, id, {
    path: WITHDRAW_TICKET_PATH,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: TICKET_TTL_SECONDS,
  });
}

/** Spends the request's ticket; false when there is no live one. */
export function spendWithdrawTicket(req: NextRequest, res: NextResponse): boolean {
  const id = req.cookies.get(WITHDRAW_TICKET_COOKIE)?.value;
  const expiresAt = id ? store().tickets[id] : undefined;
  if (!id || !expiresAt || expiresAt < Date.now()) return false;
  delete store().tickets[id];
  res.cookies.set(WITHDRAW_TICKET_COOKIE, '', { path: WITHDRAW_TICKET_PATH, maxAge: 0 });
  return true;
}
