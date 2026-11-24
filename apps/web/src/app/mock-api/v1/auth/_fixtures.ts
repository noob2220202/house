import type { MockRole } from '@/lib/mock';

/**
 * Mock users per role (fictional): the profile part of `MeResponse` (packages/shared
 * src/schemas/auth.ts). `auth/_state.ts` `mockMe()` adds identities, consents and the live profile
 * edits of the /me mocks.
 */
export interface MockUser {
  id: string;
  role: MockRole;
  status: 'ACTIVE';
  nickname: string;
  name: string;
  email: string;
  phone: string | null;
  profileImageUrl: string | null;
  marketingOptIn: boolean;
  /** Agency the session acts for (`MeResponse.agency`). */
  agency: { agencyId: string; agencyName: string; agencyStatus: string; memberRole: string } | null;
}

const AGENCY_ID = '0b6f2c1e-0000-4000-8000-0000000000b1';
const AGENCY_NAME = '신대중앙공인중개사사무소';

export const MOCK_USERS: Record<MockRole, MockUser> = {
  USER: {
    id: '0b6f2c1e-0000-4000-8000-000000000001',
    role: 'USER',
    status: 'ACTIVE',
    nickname: '순천살이',
    name: '김하늘',
    email: 'user@example.com',
    phone: '01000000000',
    profileImageUrl: null,
    marketingOptIn: false,
    agency: null,
  },
  AGENT: {
    id: '0b6f2c1e-0000-4000-8000-000000000002',
    role: 'AGENT',
    status: 'ACTIVE',
    nickname: '신대중앙실장',
    name: '오세린',
    email: 'agent@example.com',
    phone: '01000000000',
    profileImageUrl: null,
    marketingOptIn: true,
    agency: {
      agencyId: AGENCY_ID,
      agencyName: AGENCY_NAME,
      agencyStatus: 'APPROVED',
      memberRole: 'AGENT',
    },
  },
  AGENCY_OWNER: {
    id: '0b6f2c1e-0000-4000-8000-000000000003',
    role: 'AGENCY_OWNER',
    status: 'ACTIVE',
    nickname: '신대중앙김서진',
    name: '김서진',
    email: 'owner@example.com',
    phone: '01000000000',
    profileImageUrl: null,
    marketingOptIn: true,
    agency: {
      agencyId: AGENCY_ID,
      agencyName: AGENCY_NAME,
      agencyStatus: 'APPROVED',
      memberRole: 'OWNER',
    },
  },
};
