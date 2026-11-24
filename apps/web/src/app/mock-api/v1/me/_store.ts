import type { NextRequest, NextResponse } from 'next/server';
import {
  mockCsrfOk,
  mockError,
  mockGuard,
  mockSessionRole,
  mockUnauthenticated,
  type MockRole,
} from '@/lib/mock';
import type { Identity, Notification, Profile } from '@/features/w-me/schemas';
import { MOCK_USERS } from '../auth/_fixtures';
import {
  SEED_OFFSETS,
  seedFavoriteComplexes,
  seedFavoriteListings,
  seedIdentities,
  seedNotifications,
  seedRecentViews,
  type MockStamp,
} from './_fixtures';

/**
 * In-memory state of the my-page mocks, one bucket per mock role, so mutations (remove favourite,
 * mark read, edit profile) survive across requests while the dev server runs.
 * Kept on `globalThis` because Next compiles every route handler into its own module graph.
 */
export interface MeMockState {
  favoriteListings: MockStamp[];
  favoriteComplexes: MockStamp[];
  recentViews: MockStamp[];
  notifications: Notification[];
  identities: Identity[];
  profile: Profile;
}

const KEY = '__houseMockMeStore_v2';
type Buckets = Partial<Record<MockRole, MeMockState>>;

function buckets(): Buckets {
  const g = globalThis as typeof globalThis & { [KEY]?: Buckets };
  g[KEY] ??= {};
  return g[KEY];
}

function seed(role: MockRole): MeMockState {
  const now = Date.now();
  const user = MOCK_USERS[role];
  const optIn = user.marketingOptIn === true;
  return {
    favoriteListings: seedFavoriteListings(now),
    favoriteComplexes: seedFavoriteComplexes(now),
    recentViews: seedRecentViews(now),
    notifications: seedNotifications(now),
    identities: seedIdentities(now),
    profile: {
      ...(user as unknown as Profile),
      marketingOptIn: optIn,
      marketingOptInAt: new Date(now - SEED_OFFSETS.marketingChanged).toISOString(),
      createdAt: new Date(now - SEED_OFFSETS.accountAge).toISOString(),
      lastLoginAt: new Date(now - 2 * 3_600_000).toISOString(),
    },
  };
}

export function meState(role: MockRole): MeMockState {
  const all = buckets();
  all[role] ??= seed(role);
  return all[role];
}

type Guarded = { state: MeMockState; role: MockRole; fail?: undefined } | { fail: NextResponse };

/** Common preamble of every /me handler: mock mode on, signed in, CSRF header on mutations. */
export function meGuard(req: NextRequest, options: { mutation?: boolean } = {}): Guarded {
  const off = mockGuard();
  if (off) return { fail: off };
  const role = mockSessionRole(req);
  if (!role) return { fail: mockUnauthenticated() };
  if (options.mutation && !mockCsrfOk(req))
    return {
      fail: mockError(
        403,
        'CSRF_TOKEN_INVALID',
        '보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
      ),
    };
  return { state: meState(role), role };
}

/** `?_fail=1` on any /me mock makes it answer 500 — handy for checking error states by hand. */
export function mockForcedFailure(req: NextRequest): NextResponse | null {
  return req.nextUrl.searchParams.get('_fail') === '1'
    ? mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.')
    : null;
}
