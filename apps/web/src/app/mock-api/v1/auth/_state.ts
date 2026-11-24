import type { NextRequest, NextResponse } from 'next/server';
import type { MockRole } from '@/lib/mock';
import { MOCK_TERMS } from '../terms/_fixtures';
import { MOCK_USERS } from './_fixtures';

/**
 * Mock-only account state of the w-auth flows (signup completion, consents, interest regions).
 *
 * - "Has this browser finished signup?" lives in a cookie so every browser / Playwright context is
 *   independent: `house_mock_signup = pending | done`.
 * - Consents and interest regions live in memory per mock role (on `globalThis`, because Next
 *   compiles every route handler into its own module graph).
 */
export const MOCK_SIGNUP_COOKIE = 'house_mock_signup';

export function mockSignupPending(req: NextRequest): boolean {
  return req.cookies.get(MOCK_SIGNUP_COOKIE)?.value === 'pending';
}

export function setMockSignup(res: NextResponse, value: 'pending' | 'done'): void {
  res.cookies.set(MOCK_SIGNUP_COOKIE, value, { path: '/', httpOnly: true, sameSite: 'lax' });
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

const KEY = '__houseMockAuthStore_v1';
type Buckets = Partial<Record<MockRole, AuthMockState>>;

function buckets(): Buckets {
  const g = globalThis as typeof globalThis & { [KEY]?: Buckets };
  g[KEY] ??= {};
  return g[KEY];
}

const DAY = 86_400_000;

/** A member who finished signup 37 days ago: required terms agreed, marketing per the fixture user. */
function seed(role: MockRole): AuthMockState {
  const createdAt = new Date(Date.now() - 37 * DAY).toISOString();
  const optIn = MOCK_USERS[role].marketingOptIn === true;
  return {
    consents: Object.fromEntries(
      MOCK_TERMS.map((doc) => [doc.id, { agreed: doc.isRequired || optIn, createdAt }]),
    ),
    regionKeys: ['sindae', 'seonwol', 'yeonhyang'],
    notify: true,
  };
}

export function authState(role: MockRole): AuthMockState {
  const all = buckets();
  all[role] ??= seed(role);
  return all[role];
}

/**
 * State of a member who has finished signup. Another browser may have reset the shared bucket with
 * a fresh signup (as=new) — a finished member always has consents, so re-seed in that case.
 */
export function memberAuthState(role: MockRole): AuthMockState {
  const state = authState(role);
  if (Object.keys(state.consents).length > 0) return state;
  const fresh = seed(role);
  buckets()[role] = fresh;
  return fresh;
}

/** A brand-new account: nothing agreed, no regions. */
export function resetAuthState(role: MockRole): AuthMockState {
  const fresh: AuthMockState = { consents: {}, regionKeys: [], notify: true };
  buckets()[role] = fresh;
  return fresh;
}

export function dropAuthState(role: MockRole): void {
  delete buckets()[role];
}
