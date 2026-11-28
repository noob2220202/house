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
  /** 중개사무소 등록 신청 — 개인정보 수집·이용 동의 (POST /agencies). */
  PRIVACY_AGENCY_APPLICATION: 'PRIVACY_AGENCY_APPLICATION',
  /** 소속 중개사 합류 — 개인정보 수집·이용 동의 (POST /agencies/join). */
  PRIVACY_AGENCY_JOIN: 'PRIVACY_AGENCY_JOIN',
  /** 내놓기·구하기 — 개인정보 수집·이용 동의 (POST /deal-requests). */
  DEAL_REQUEST_PRIVACY: 'DEAL_REQUEST_PRIVACY',
  /** 내놓기·구하기 — 개인정보 제3자(중개사무소) 제공 동의 (POST /deal-requests). */
  DEAL_REQUEST_PROVIDE: 'DEAL_REQUEST_PROVIDE',
  /**
   * 문의 남기기 — 개인정보 수집·이용 및 (문의를 받는) 중개사무소 제공 동의 (POST /inquiries).
   * Members get a consent row; a guest's verified document ids are stored on the inquiry row.
   */
  INQUIRY_PRIVACY: 'INQUIRY_PRIVACY',
} as const;
export type TermsType = EnumValue<typeof TermsType>;

export const TERMS_TYPE_LABEL: Record<TermsType, string> = {
  SERVICE: '이용약관',
  PRIVACY: '개인정보처리방침',
  LOCATION: '위치기반서비스 이용약관',
  MARKETING: '마케팅 정보 수신 동의',
  PRIVACY_AGENCY_APPLICATION: '중개사무소 등록 신청 개인정보 수집·이용 동의',
  PRIVACY_AGENCY_JOIN: '소속 중개사 합류 개인정보 수집·이용 동의',
  DEAL_REQUEST_PRIVACY: '내놓기·구하기 개인정보 수집·이용 동의',
  DEAL_REQUEST_PROVIDE: '내놓기·구하기 개인정보 제3자 제공 동의',
  INQUIRY_PRIVACY: '문의 개인정보 수집·이용 및 제공 동의',
};

/**
 * Account terms: agreed at signup, re-consented through /me/consents, listed by GET /terms and
 * enforced on every write by the terms guard (when required).
 */
export const ACCOUNT_TERMS_TYPES: readonly TermsType[] = [
  TermsType.SERVICE,
  TermsType.PRIVACY,
  TermsType.LOCATION,
  TermsType.MARKETING,
];

/**
 * Purpose consents (D8): given with one submission, sent as `consents: [{ type, version }]` in its
 * body. The server requires the current published version of every listed type (whatever the
 * document's isRequired flag says) and records a consent row per type in the same transaction.
 */
export const ACTION_CONSENT_TERMS = {
  /** POST /agencies */
  AGENCY_APPLICATION: [TermsType.PRIVACY_AGENCY_APPLICATION],
  /** POST /agencies/join */
  AGENCY_JOIN: [TermsType.PRIVACY_AGENCY_JOIN],
  /** POST /deal-requests */
  DEAL_REQUEST: [TermsType.DEAL_REQUEST_PRIVACY, TermsType.DEAL_REQUEST_PROVIDE],
  /** POST /inquiries (members and guests) */
  INQUIRY: [TermsType.INQUIRY_PRIVACY],
} as const satisfies Record<string, readonly TermsType[]>;
export type ConsentAction = keyof typeof ACTION_CONSENT_TERMS;

export function isAccountTermsType(type: TermsType): boolean {
  return ACCOUNT_TERMS_TYPES.includes(type);
}

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
  LISTING_EXPIRED: 'LISTING_EXPIRED',
  CO_BROKER_REQUESTED: 'CO_BROKER_REQUESTED',
  /**
   * To every ACTIVE member of the office: a new written inquiry or a customer follow-up
   * (data `{ agencyId, inquiryId, followUp? }`). Agency feed.
   */
  INQUIRY_RECEIVED: 'INQUIRY_RECEIVED',
  /**
   * To the member who asked: the office answered (data `{ inquiryId, agencyName }` — never
   * `agencyId`, which would route it to the agency feed). Member feed.
   */
  INQUIRY_REPLIED: 'INQUIRY_REPLIED',
  /** To the owner: the 사무소 홈페이지 was approved (data `{ agencyId, siteId, slug }`). Agency feed. */
  AGENCY_SITE_APPROVED: 'AGENCY_SITE_APPROVED',
  /** To the owner: the 사무소 홈페이지 request was rejected (data `{ agencyId, siteId }`). Agency feed. */
  AGENCY_SITE_REJECTED: 'AGENCY_SITE_REJECTED',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = EnumValue<typeof NotificationType>;

/** Korean name of each notification type (fallback captions; the web keeps its own icon/tone meta). */
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  DEAL_REQUEST_RECEIVED: '새 요청 도착',
  PROPOSAL_RECEIVED: '제안 도착',
  PROPOSAL_ACCEPTED: '제안 수락',
  CONTACT_GRANTED: '연락처 공개',
  AGENCY_APPROVED: '중개사무소 승인',
  AGENCY_REJECTED: '중개사무소 반려',
  AGENCY_WARNED: '운영 안내',
  LISTING_HIDDEN: '매물 안내',
  REPORT_RESOLVED: '신고 처리',
  LISTING_EXPIRED: '광고기간 만료',
  CO_BROKER_REQUESTED: '공동중개 요청',
  INQUIRY_RECEIVED: '새 문의',
  INQUIRY_REPLIED: '문의 답변',
  AGENCY_SITE_APPROVED: '홈페이지 승인',
  AGENCY_SITE_REJECTED: '홈페이지 반려',
  SYSTEM: '알림',
};
