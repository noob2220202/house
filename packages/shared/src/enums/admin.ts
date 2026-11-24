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
  FOOTER: 'FOOTER',
  /** 메인 화면 구성: section order + visibility (admin "메인 화면 편집", D9). */
  HOME_LAYOUT: 'HOME_LAYOUT',
  /** App store links for the home app band (D9). */
  APP_LINKS: 'APP_LINKS',
} as const;
export type SiteSettingKey = EnumValue<typeof SiteSettingKey>;

export const SITE_SETTING_KEY_LABEL: Record<SiteSettingKey, string> = {
  BUSINESS_INFO: '사업자 정보',
  CONTACT: '고객센터',
  SEO: '검색엔진 최적화',
  FEATURES: '기능 설정',
  FOOTER: '하단(푸터) 정보',
  HOME_LAYOUT: '메인 화면 구성',
  APP_LINKS: '앱 다운로드 링크',
};

/** Sections of the user-site home page, in their default order (HOME_LAYOUT keys). */
export const HomeSectionKey = {
  HERO_SEARCH: 'HERO_SEARCH',
  CATEGORY_TILES: 'CATEGORY_TILES',
  MAIN_BANNER: 'MAIN_BANNER',
  POPULAR_COMPLEXES: 'POPULAR_COMPLEXES',
  NEW_LISTINGS: 'NEW_LISTINGS',
  DEAL_REQUEST_CTA: 'DEAL_REQUEST_CTA',
  FEATURED_AGENCIES: 'FEATURED_AGENCIES',
  LOCAL_VIDEOS: 'LOCAL_VIDEOS',
  NOTICES: 'NOTICES',
  APP_BAND: 'APP_BAND',
} as const;
export type HomeSectionKey = EnumValue<typeof HomeSectionKey>;

export const HOME_SECTION_LABEL: Record<HomeSectionKey, string> = {
  HERO_SEARCH: '히어로 검색 · 지도',
  CATEGORY_TILES: '매물 종류 바로가기',
  MAIN_BANNER: '메인 배너',
  POPULAR_COMPLEXES: '자주 찾는 단지',
  NEW_LISTINGS: '새로 올라온 매물',
  DEAL_REQUEST_CTA: '내놓기 · 구하기 안내',
  FEATURED_AGENCIES: '우리 동네 중개사무소',
  LOCAL_VIDEOS: '동네TV',
  NOTICES: '공지사항',
  APP_BAND: '앱 안내 띠',
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  RECEIVED: '접수',
  IN_REVIEW: '검토중',
  RESOLVED: '처리완료',
  REJECTED: '반려',
};

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  NONE: '조치 없음',
  LISTING_HIDDEN: '매물 숨김',
  AGENCY_WARNED: '중개사무소 경고',
  LISTING_HIDDEN_AGENCY_WARNED: '매물 숨김 + 중개사무소 경고',
};

export const FAQ_CATEGORY_LABEL: Record<FaqCategory, string> = {
  GENERAL: '일반',
  ACCOUNT: '회원',
  LISTING: '매물',
  AGENCY: '중개사무소',
  DEAL_REQUEST: '내놓기·구하기',
  AD: '광고',
};
