import type { EnumValue } from './define';

export const AgencyStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type AgencyStatus = EnumValue<typeof AgencyStatus>;

export const AGENCY_STATUS_LABEL: Record<AgencyStatus, string> = {
  PENDING: '승인대기',
  APPROVED: '승인',
  REJECTED: '반려',
  SUSPENDED: '정지',
};

export const AgencyMemberRole = {
  OWNER: 'OWNER',
  AGENT: 'AGENT',
} as const;
export type AgencyMemberRole = EnumValue<typeof AgencyMemberRole>;

export const AgencyMemberStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;
export type AgencyMemberStatus = EnumValue<typeof AgencyMemberStatus>;

export const AgencyDocumentType = {
  REGISTRATION_CERT: 'REGISTRATION_CERT',
  BUSINESS_REG_CERT: 'BUSINESS_REG_CERT',
  BROKER_LICENSE: 'BROKER_LICENSE',
  OTHER: 'OTHER',
} as const;
export type AgencyDocumentType = EnumValue<typeof AgencyDocumentType>;

export const AGENCY_DOCUMENT_TYPE_LABEL: Record<AgencyDocumentType, string> = {
  REGISTRATION_CERT: '중개사무소 등록증',
  BUSINESS_REG_CERT: '사업자등록증',
  BROKER_LICENSE: '공인중개사 자격증',
  OTHER: '기타',
};

/**
 * 사무소 홈페이지 (`<slug>.<root domain>`) lifecycle: the owner requests a slug (REQUESTED), an
 * admin approves (ACTIVE), rejects (REJECTED) or later suspends (SUSPENDED) it.
 */
export const AgencySiteStatus = {
  REQUESTED: 'REQUESTED',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type AgencySiteStatus = EnumValue<typeof AgencySiteStatus>;

export const AGENCY_SITE_STATUS_LABEL: Record<AgencySiteStatus, string> = {
  REQUESTED: '신청 중',
  ACTIVE: '운영 중',
  REJECTED: '반려',
  SUSPENDED: '정지',
};

/** Paid products of an office (both free for now: admins record periods, enforcement is off). */
export const SubscriptionProduct = {
  SITE: 'SITE',
  PLATFORM: 'PLATFORM',
} as const;
export type SubscriptionProduct = EnumValue<typeof SubscriptionProduct>;

export const SUBSCRIPTION_PRODUCT_LABEL: Record<SubscriptionProduct, string> = {
  SITE: '사무소 홈페이지',
  PLATFORM: '메인 사이트 입점',
};
