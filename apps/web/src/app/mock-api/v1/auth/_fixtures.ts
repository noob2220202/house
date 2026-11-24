import type { MockRole } from '@/lib/mock';

/** Mock users per role (fictional). Shape = SessionUser in src/lib/auth/types.ts. */
export const MOCK_USERS: Record<MockRole, Record<string, unknown>> = {
  USER: {
    id: '0b6f2c1e-0000-4000-8000-000000000001',
    role: 'USER',
    status: 'ACTIVE',
    nickname: '순천살이',
    name: '김하늘',
    email: 'user@example.com',
    phone: '01000000000',
    profileImageUrl: null,
    agencyId: null,
    marketingOptIn: false,
    signupCompleted: true,
  },
  AGENT: {
    id: '0b6f2c1e-0000-4000-8000-000000000002',
    role: 'AGENT',
    status: 'ACTIVE',
    nickname: '신대중앙 실장',
    name: '오세린',
    email: 'agent@example.com',
    phone: '01000000000',
    profileImageUrl: null,
    agencyId: '0b6f2c1e-0000-4000-8000-0000000000b1',
    marketingOptIn: true,
    signupCompleted: true,
  },
  AGENCY_OWNER: {
    id: '0b6f2c1e-0000-4000-8000-000000000003',
    role: 'AGENCY_OWNER',
    status: 'ACTIVE',
    nickname: '신대중앙 김서진',
    name: '김서진',
    email: 'owner@example.com',
    phone: '01000000000',
    profileImageUrl: null,
    agencyId: '0b6f2c1e-0000-4000-8000-0000000000b1',
    marketingOptIn: true,
    signupCompleted: true,
  },
};
