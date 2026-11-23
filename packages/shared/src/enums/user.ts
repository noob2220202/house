import type { EnumValue } from './define';

/** Every role a principal can hold. User accounts hold USER/AGENT/AGENCY_OWNER, admin accounts the rest. */
export const Role = {
  USER: 'USER',
  AGENT: 'AGENT',
  AGENCY_OWNER: 'AGENCY_OWNER',
  OPERATOR: 'OPERATOR',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type Role = EnumValue<typeof Role>;

export const UserRole = {
  USER: 'USER',
  AGENT: 'AGENT',
  AGENCY_OWNER: 'AGENCY_OWNER',
} as const;
export type UserRole = EnumValue<typeof UserRole>;

export const AdminRole = {
  OPERATOR: 'OPERATOR',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type AdminRole = EnumValue<typeof AdminRole>;

export const USER_ROLES: readonly Role[] = [Role.USER, Role.AGENT, Role.AGENCY_OWNER];
export const AGENCY_ROLES: readonly Role[] = [Role.AGENT, Role.AGENCY_OWNER];
export const ADMIN_ROLES: readonly Role[] = [Role.OPERATOR, Role.ADMIN, Role.SUPER_ADMIN];

/** Admin privilege order; a higher rank includes the lower ones. */
export const ADMIN_ROLE_RANK: Record<AdminRole, number> = {
  OPERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export const ROLE_LABEL: Record<Role, string> = {
  USER: '일반회원',
  AGENT: '소속공인중개사·중개보조원',
  AGENCY_OWNER: '개업공인중개사',
  OPERATOR: '운영자',
  ADMIN: '관리자',
  SUPER_ADMIN: '최고관리자',
};

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type UserStatus = EnumValue<typeof UserStatus>;

export const AdminStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type AdminStatus = EnumValue<typeof AdminStatus>;

export const AuthProvider = {
  KAKAO: 'KAKAO',
  NAVER: 'NAVER',
  GOOGLE: 'GOOGLE',
} as const;
export type AuthProvider = EnumValue<typeof AuthProvider>;

export const AUTH_PROVIDER_LABEL: Record<AuthProvider, string> = {
  KAKAO: '카카오',
  NAVER: '네이버',
  GOOGLE: 'Google',
};

/**
 * URL slug per provider. OAuth routes are fixed (registered in each provider console):
 *   GET /api/v1/auth/oauth/{slug}/start, GET /api/v1/auth/oauth/{slug}/callback
 * Only 카카오 / 네이버 / Google are supported (owner decision: no Apple, no SMS).
 */
export const AUTH_PROVIDER_SLUG: Record<AuthProvider, string> = {
  KAKAO: 'kakao',
  NAVER: 'naver',
  GOOGLE: 'google',
};

export function authProviderFromSlug(slug: string): AuthProvider | null {
  const entry = (Object.entries(AUTH_PROVIDER_SLUG) as [AuthProvider, string][]).find(
    ([, s]) => s === slug,
  );
  return entry ? entry[0] : null;
}

export const TermsType = {
  SERVICE: 'SERVICE',
  PRIVACY: 'PRIVACY',
  LOCATION: 'LOCATION',
  MARKETING: 'MARKETING',
} as const;
export type TermsType = EnumValue<typeof TermsType>;

export const TERMS_TYPE_LABEL: Record<TermsType, string> = {
  SERVICE: '이용약관',
  PRIVACY: '개인정보처리방침',
  LOCATION: '위치기반서비스 이용약관',
  MARKETING: '마케팅 정보 수신 동의',
};

export const NotificationType = {
  DEAL_REQUEST_RECEIVED: 'DEAL_REQUEST_RECEIVED',
  PROPOSAL_RECEIVED: 'PROPOSAL_RECEIVED',
  PROPOSAL_ACCEPTED: 'PROPOSAL_ACCEPTED',
  CONTACT_GRANTED: 'CONTACT_GRANTED',
  AGENCY_APPROVED: 'AGENCY_APPROVED',
  AGENCY_REJECTED: 'AGENCY_REJECTED',
  AGENCY_WARNED: 'AGENCY_WARNED',
  LISTING_HIDDEN: 'LISTING_HIDDEN',
  REPORT_RESOLVED: 'REPORT_RESOLVED',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = EnumValue<typeof NotificationType>;
