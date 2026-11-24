import { describe, expect, it } from 'vitest';
import { FALLBACK_NICKNAME, isAgent, needsReconsent, sessionUserSchema } from './types';

/** `MeResponse` of the backend (packages/shared/src/schemas/auth.ts). */
const me = {
  id: 'u1',
  email: 'owner@example.com',
  name: '김서진',
  nickname: '신대중앙',
  phone: '01012345678',
  profileImageUrl: null,
  role: 'AGENCY_OWNER',
  status: 'ACTIVE',
  marketingOptIn: true,
  marketingOptInAt: '2026-11-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  identities: [
    { provider: 'KAKAO', email: null, linkedAt: '2026-10-01T00:00:00.000Z', lastUsedAt: null },
  ],
  agency: {
    agencyId: 'a1',
    agencyName: '신대중앙공인중개사사무소',
    agencyStatus: 'APPROVED',
    memberRole: 'OWNER',
  },
  pendingRequiredTerms: [],
};

describe('sessionUserSchema (GET /auth/me)', () => {
  it('reads MeResponse: the acting agency and a finished signup', () => {
    const user = sessionUserSchema.parse(me);
    expect(user).toMatchObject({
      nickname: '신대중앙',
      hasNickname: true,
      agencyId: 'a1',
      agency: { agencyName: '신대중앙공인중개사사무소' },
      signupCompleted: true,
      marketingOptInAt: '2026-11-01T00:00:00.000Z',
      pendingRequiredTerms: [],
    });
    expect(isAgent(user)).toBe(true);
    expect(needsReconsent(user)).toBe(false);
  });

  it('never fails on a missing nickname (scrubbed or cleared profile)', () => {
    for (const nickname of [null, undefined, '  ']) {
      const user = sessionUserSchema.parse({ ...me, nickname });
      expect(user.nickname).toBe(FALLBACK_NICKNAME);
      expect(user.hasNickname).toBe(false);
    }
  });

  it('has no agency for a plain member and reports pending required terms', () => {
    const user = sessionUserSchema.parse({
      ...me,
      role: 'USER',
      agency: null,
      pendingRequiredTerms: ['PRIVACY'],
    });
    expect(user.agencyId).toBeNull();
    expect(isAgent(user)).toBe(false);
    expect(needsReconsent(user)).toBe(true);
  });

  it('defaults the optional parts of a minimal payload', () => {
    const user = sessionUserSchema.parse({ id: 'u2', role: 'USER' });
    expect(user).toMatchObject({
      status: 'ACTIVE',
      identities: [],
      agency: null,
      agencyId: null,
      pendingRequiredTerms: [],
      marketingOptIn: false,
    });
  });
});
