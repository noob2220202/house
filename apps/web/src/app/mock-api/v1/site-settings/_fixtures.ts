/**
 * Public site settings fixture. mockdata.md §7: the footer business info uses bracket placeholders
 * until the operator fills in 사이트 설정 — keep them so screenshots match the design.
 */
export const PUBLIC_SITE_SETTINGS = {
  BUSINESS_INFO: {
    companyName: '[상호]',
    ceoName: '[대표]',
    businessNumber: '[사업자등록번호]',
    mailOrderNumber: '[신고번호]',
    address: '[주소]',
    privacyOfficer: '[개인정보보호책임자]',
    phone: '[대표번호]',
    email: '[이메일]',
  },
  CONTACT: {
    phone: '[대표번호]',
    email: '[이메일]',
    hours: '평일 09:00 – 18:00 · 점심 12:00 – 13:00',
  },
  SEO: {
    title: '순천부동산지도 | 공인중개사 공동중개 플랫폼',
    description: '순천 공인중개사들이 함께 만드는 공동중개 부동산 서비스',
  },
  FEATURES: {
    appBand: false,
    community: true,
  },
} as const;
