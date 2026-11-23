import type { EnumValue } from './define';

export const ReportTargetType = {
  LISTING: 'LISTING',
  AGENCY: 'AGENCY',
} as const;
export type ReportTargetType = EnumValue<typeof ReportTargetType>;

export const ReportReason = {
  NOT_EXIST: 'NOT_EXIST',
  ALREADY_DEALT: 'ALREADY_DEALT',
  WRONG_PRICE: 'WRONG_PRICE',
  WRONG_INFO: 'WRONG_INFO',
  WRONG_PHOTO: 'WRONG_PHOTO',
  DUPLICATE: 'DUPLICATE',
  UNREACHABLE: 'UNREACHABLE',
  OTHER: 'OTHER',
} as const;
export type ReportReason = EnumValue<typeof ReportReason>;

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  NOT_EXIST: '존재하지 않는 매물',
  ALREADY_DEALT: '이미 거래된 매물',
  WRONG_PRICE: '가격 정보가 다름',
  WRONG_INFO: '매물 정보가 다름',
  WRONG_PHOTO: '사진이 다름',
  DUPLICATE: '중복 매물',
  UNREACHABLE: '중개사 연락 불가',
  OTHER: '기타',
};

export const ReportStatus = {
  RECEIVED: 'RECEIVED',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
} as const;
export type ReportStatus = EnumValue<typeof ReportStatus>;

export const ReportAction = {
  NONE: 'NONE',
  LISTING_HIDDEN: 'LISTING_HIDDEN',
  AGENCY_WARNED: 'AGENCY_WARNED',
  LISTING_HIDDEN_AGENCY_WARNED: 'LISTING_HIDDEN_AGENCY_WARNED',
} as const;
export type ReportAction = EnumValue<typeof ReportAction>;

export const FaqCategory = {
  GENERAL: 'GENERAL',
  ACCOUNT: 'ACCOUNT',
  LISTING: 'LISTING',
  AGENCY: 'AGENCY',
  DEAL_REQUEST: 'DEAL_REQUEST',
  AD: 'AD',
} as const;
export type FaqCategory = EnumValue<typeof FaqCategory>;

export const AuditActorType = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;
export type AuditActorType = EnumValue<typeof AuditActorType>;

/** Keys of the key/value site_settings table; each key's value has a zod schema in schemas/admin. */
export const SiteSettingKey = {
  BUSINESS_INFO: 'BUSINESS_INFO',
  CONTACT: 'CONTACT',
  SEO: 'SEO',
  FEATURES: 'FEATURES',
} as const;
export type SiteSettingKey = EnumValue<typeof SiteSettingKey>;
