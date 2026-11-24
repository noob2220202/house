import { mockUuid } from './ids';
import { MOCK_ACTORS } from './http';

/**
 * Site settings · admin accounts · audit log fixtures (fictional). Rows mirror the Prisma models
 * SiteSetting / AdminUser / AuditLog.
 */

export interface MockSetting {
  value: unknown;
  updatedAt: string | null;
  updatedByAdminName: string | null;
}

export const SETTINGS: Record<string, MockSetting> = {
  BUSINESS_INFO: {
    value: {
      companyName: '주식회사 [상호]',
      ceoName: '[대표]',
      businessNumber: '000-00-00000',
      mailOrderNumber: '제2026-전남순천-0000호',
      address: '전라남도 순천시 [주소]',
      privacyOfficer: '[개인정보보호책임자]',
      phone: '061-000-0000',
      email: 'help@example.com',
    },
    updatedAt: '2026-11-02T10:12:00+09:00',
    updatedByAdminName: '정다은',
  },
  CONTACT: {
    value: {
      phone: '061-000-0000',
      email: 'help@example.com',
      hours: '평일 09:00 – 18:00 · 점심 12:00 – 13:00',
      kakaoChannelUrl: 'https://pf.kakao.com/_example',
    },
    updatedAt: '2026-10-20T09:30:00+09:00',
    updatedByAdminName: '한지우',
  },
  SEO: {
    value: {
      title: '순천 부동산 공동중개',
      description: '순천 공인중개사들이 함께 만드는 공동중개 부동산 서비스',
    },
    updatedAt: '2026-09-15T15:00:00+09:00',
    updatedByAdminName: '한지우',
  },
  FEATURES: {
    value: { appBand: false, community: true, dealRequests: true, tradeHistory: true },
    updatedAt: '2026-11-10T08:50:00+09:00',
    updatedByAdminName: '정다은',
  },
  HOME_LAYOUT: {
    value: {
      sections: [
        { key: 'HERO_SEARCH', visible: true },
        { key: 'CATEGORY_TILES', visible: true },
        { key: 'MAIN_BANNER', visible: true },
        { key: 'POPULAR_COMPLEXES', visible: true },
        { key: 'NEW_LISTINGS', visible: true },
        { key: 'DEAL_REQUEST_CTA', visible: true },
        { key: 'FEATURED_AGENCIES', visible: true },
        { key: 'LOCAL_VIDEOS', visible: true },
        { key: 'NOTICES', visible: true },
        { key: 'APP_BAND', visible: false },
      ],
    },
    updatedAt: '2026-11-08T13:20:00+09:00',
    updatedByAdminName: '한지우',
  },
};

// ---------- 관리자 계정 ----------

export interface MockAdminAccount {
  id: string;
  email: string;
  name: string;
  role: 'OPERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  totpEnabled: boolean;
  ipAllowlist: string[];
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
}

export const ADMIN_ACCOUNTS: MockAdminAccount[] = [
  {
    ...MOCK_ACTORS.SUPER_ADMIN,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    totpEnabled: true,
    ipAllowlist: [],
    lockedUntil: null,
    lastLoginAt: '2026-11-23T14:20:00+09:00',
    lastLoginIp: '203.0.113.24',
    createdAt: '2026-06-15T10:00:00+09:00',
  },
  {
    ...MOCK_ACTORS.ADMIN,
    role: 'ADMIN',
    status: 'ACTIVE',
    totpEnabled: true,
    ipAllowlist: ['203.0.113.0/24'],
    lockedUntil: null,
    lastLoginAt: '2026-11-23T10:02:00+09:00',
    lastLoginIp: '203.0.113.31',
    createdAt: '2026-06-18T09:00:00+09:00',
  },
  {
    ...MOCK_ACTORS.OPERATOR,
    role: 'OPERATOR',
    status: 'ACTIVE',
    totpEnabled: true,
    ipAllowlist: [],
    lockedUntil: null,
    lastLoginAt: '2026-11-22T17:40:00+09:00',
    lastLoginIp: '203.0.113.47',
    createdAt: '2026-07-01T09:00:00+09:00',
  },
  {
    id: mockUuid('admin-4'),
    email: 'cs1@example.com',
    name: '문가은',
    role: 'OPERATOR',
    status: 'ACTIVE',
    totpEnabled: false,
    ipAllowlist: [],
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: '2026-11-20T16:30:00+09:00',
  },
  {
    id: mockUuid('admin-5'),
    email: 'cs2@example.com',
    name: '서지호',
    role: 'OPERATOR',
    status: 'ACTIVE',
    totpEnabled: true,
    ipAllowlist: [],
    // Locked for 25 minutes from the moment the mock starts, so the "잠김" state is always visible.
    lockedUntil: new Date(Date.now() + 25 * 60_000).toISOString(),
    lastLoginAt: '2026-11-21T09:12:00+09:00',
    lastLoginIp: '198.51.100.8',
    createdAt: '2026-08-11T09:00:00+09:00',
  },
  {
    id: mockUuid('admin-6'),
    email: 'ads@example.com',
    name: '오세린',
    role: 'ADMIN',
    status: 'DISABLED',
    totpEnabled: true,
    ipAllowlist: [],
    lockedUntil: null,
    lastLoginAt: '2026-09-30T18:05:00+09:00',
    lastLoginIp: '203.0.113.52',
    createdAt: '2026-06-25T09:00:00+09:00',
  },
];

// ---------- 작업 기록 ----------

export interface MockAuditLog {
  id: string;
  actorType: 'ADMIN' | 'USER' | 'SYSTEM';
  adminUserId: string | null;
  adminName: string | null;
  adminEmail: string | null;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceLabel: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

const UA_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const UA_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

type Who = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'SYSTEM';
let auditSeq = 0;

function log(
  at: string,
  who: Who,
  action: string,
  resourceType: string,
  resourceKey: string | null,
  resourceLabel: string | null,
  before: unknown,
  after: unknown,
): MockAuditLog {
  auditSeq += 1;
  const actor = who === 'SYSTEM' ? null : MOCK_ACTORS[who];
  return {
    id: mockUuid(`audit-${auditSeq}`),
    actorType: actor ? 'ADMIN' : 'SYSTEM',
    adminUserId: actor?.id ?? null,
    adminName: actor?.name ?? null,
    adminEmail: actor?.email ?? null,
    userId: null,
    action,
    resourceType,
    resourceId: resourceKey ? mockUuid(resourceKey) : null,
    resourceLabel,
    before,
    after,
    ip: actor ? (who === 'OPERATOR' ? '203.0.113.47' : '203.0.113.24') : null,
    userAgent: actor ? (who === 'OPERATOR' ? UA_WIN : UA_MAC) : null,
    requestId: `req_${(0x9e3779b1 * auditSeq).toString(36).slice(0, 10)}`,
    createdAt: at,
  };
}

/** Newest first. */
export const AUDIT_LOGS: MockAuditLog[] = [
  log(
    '2026-11-23T14:02:11+09:00',
    'ADMIN',
    'agency.approve',
    'Agency',
    'B09',
    '해룡신대 공인중개사사무소',
    { status: 'PENDING' },
    { status: 'APPROVED', approvedAt: '2026-11-23T14:02:11+09:00' },
  ),
  log(
    '2026-11-23T13:48:30+09:00',
    'OPERATOR',
    'report.resolve',
    'Report',
    'report-31',
    '연향 센트럴 32평 매매 3억 1,000',
    { status: 'IN_REVIEW', action: null, resolutionNote: null },
    {
      status: 'RESOLVED',
      action: 'LISTING_HIDDEN',
      resolutionNote: '중개사무소 확인 결과 11월 초 거래 완료된 매물',
    },
  ),
  log(
    '2026-11-23T13:48:29+09:00',
    'OPERATOR',
    'listing.hide',
    'Listing',
    'L21',
    '연향 센트럴 108동 32평 매매',
    { status: 'ACTIVE', hiddenReason: null },
    { status: 'HIDDEN', hiddenReason: '허위매물 신고 처리 (거래 완료)' },
  ),
  log(
    '2026-11-23T11:30:02+09:00',
    'OPERATOR',
    'notice.create',
    'Notice',
    'notice-n16',
    '12월 정기 점검 안내 (12월 3일 새벽)',
    null,
    { title: '12월 정기 점검 안내 (12월 3일 새벽)', isPinned: false, isPublished: false },
  ),
  log(
    '2026-11-23T10:15:44+09:00',
    'ADMIN',
    'banner.update',
    'Banner',
    'AD-03',
    '순천 이사·입주청소 한 번에 예약',
    {
      title: '순천 이사·입주청소 한 번에',
      startAt: '2026-12-01T00:00:00+09:00',
      endAt: '2026-12-25T23:59:59+09:00',
      sortOrder: 3,
    },
    {
      title: '순천 이사·입주청소 한 번에 예약',
      startAt: '2026-12-01T00:00:00+09:00',
      endAt: '2026-12-31T23:59:59+09:00',
      sortOrder: 2,
    },
  ),
  log(
    '2026-11-22T17:21:09+09:00',
    'OPERATOR',
    'user.suspend',
    'User',
    'user-88',
    '닉네임 순천살이',
    { status: 'ACTIVE' },
    { status: 'SUSPENDED', suspendedReason: '허위 신고 반복 (5회)' },
  ),
  log(
    '2026-11-22T16:05:12+09:00',
    'OPERATOR',
    'user.view_personal_data',
    'User',
    'user-88',
    '닉네임 순천살이',
    null,
    null,
  ),
  log(
    '2026-11-22T10:10:27+09:00',
    'ADMIN',
    'complex.update',
    'Complex',
    'C09',
    '연향들 더 퍼스트',
    { households: 598, floorsMax: 27, builder: null },
    { households: 612, floorsMax: 29, builder: '[시공사 G]' },
  ),
  log(
    '2026-11-21T16:40:55+09:00',
    'SUPER_ADMIN',
    'terms.create',
    'TermsDocument',
    'terms-service-1.1',
    '이용약관 1.1',
    null,
    {
      type: 'SERVICE',
      version: '1.1',
      isRequired: true,
      effectiveAt: '2026-12-15T00:00:00+09:00',
      publishedAt: null,
    },
  ),
  log(
    '2026-11-21T15:10:03+09:00',
    'ADMIN',
    'complex.photo.add',
    'Complex',
    'C01',
    '신대 레이크파크 1단지',
    { photoCount: 4 },
    { photoCount: 5 },
  ),
  log(
    '2026-11-20T16:30:41+09:00',
    'SUPER_ADMIN',
    'admin.create',
    'AdminUser',
    'admin-4',
    '문가은 (cs1@example.com)',
    null,
    { email: 'cs1@example.com', name: '문가은', role: 'OPERATOR', status: 'ACTIVE' },
  ),
  log(
    '2026-11-20T10:12:08+09:00',
    'ADMIN',
    'complex.trade_sync.trigger',
    'TradeSyncRun',
    'sync-r11',
    '2026년 11월 실거래가',
    null,
    { yearMonth: 202611, kinds: ['APT_TRADE', 'APT_RENT'] },
  ),
  log(
    '2026-11-19T18:00:20+09:00',
    'OPERATOR',
    'video.create',
    'LocalVideo',
    'video-V01',
    '신대지구 34평, 지금 사도 될까? 2026 하반기 시세 점검',
    null,
    {
      title: '신대지구 34평, 지금 사도 될까? 2026 하반기 시세 점검',
      youtubeVideoId: 'sc0SinDae34',
      isPublished: true,
    },
  ),
  log(
    '2026-11-18T10:00:13+09:00',
    'ADMIN',
    'notice.publish',
    'Notice',
    'notice-n15',
    '연향들 도시개발사업 분양 단지 정보가 추가되었습니다',
    { isPublished: false, publishedAt: null },
    { isPublished: true, publishedAt: '2026-11-18T10:00:00+09:00' },
  ),
  log(
    '2026-11-15T04:00:02+09:00',
    'SYSTEM',
    'complex.trade_sync.run',
    'TradeSyncRun',
    'sync-r09',
    '2026년 10월 실거래가 (정기)',
    null,
    { yearMonth: 202610, fetchedCount: 431, upsertedCount: 9 },
  ),
  log(
    '2026-11-12T10:00:45+09:00',
    'OPERATOR',
    'faq.update',
    'Faq',
    'faq-d2',
    '구하기 요청은 몇 곳의 중개사무소에 전달되나요?',
    { answer: '고른 지역을 담당하는 중개사무소에 전달됩니다.' },
    {
      answer:
        '고른 지역을 담당하는 중개사무소에 전달됩니다. 예를 들어 신대지구 매매 요청은 신대·선월 지역 사무소 12곳에 전달됩니다.',
    },
  ),
  log(
    '2026-11-10T08:50:19+09:00',
    'SUPER_ADMIN',
    'site_setting.update',
    'SiteSetting',
    null,
    '기능 설정 (FEATURES)',
    { appBand: false, community: false, dealRequests: true, tradeHistory: true },
    { appBand: false, community: true, dealRequests: true, tradeHistory: true },
  ),
  log(
    '2026-11-08T13:20:37+09:00',
    'ADMIN',
    'site_setting.update',
    'SiteSetting',
    null,
    '메인 화면 구성 (HOME_LAYOUT)',
    { order: ['HERO_SEARCH', 'CATEGORY_TILES', 'POPULAR_COMPLEXES', 'MAIN_BANNER'] },
    { order: ['HERO_SEARCH', 'CATEGORY_TILES', 'MAIN_BANNER', 'POPULAR_COMPLEXES'] },
  ),
  log(
    '2026-11-05T11:42:08+09:00',
    'ADMIN',
    'agency.warn',
    'Agency',
    'B07',
    '금당리버 공인중개사사무소',
    { warningCount: 0 },
    { warningCount: 1, lastWarning: '거래 완료 매물 미삭제' },
  ),
  log(
    '2026-11-02T10:12:00+09:00',
    'SUPER_ADMIN',
    'site_setting.update',
    'SiteSetting',
    null,
    '사업자 정보 (BUSINESS_INFO)',
    { phone: '061-000-0001', mailOrderNumber: null },
    { phone: '061-000-0000', mailOrderNumber: '제2026-전남순천-0000호' },
  ),
  log(
    '2026-10-23T10:00:31+09:00',
    'SUPER_ADMIN',
    'terms.publish',
    'TermsDocument',
    'terms-privacy-1.1',
    '개인정보처리방침 1.1',
    { publishedAt: null },
    { publishedAt: '2026-10-23T10:00:00+09:00', effectiveAt: '2026-11-01T00:00:00+09:00' },
  ),
  log(
    '2026-10-12T09:05:17+09:00',
    'SUPER_ADMIN',
    'admin.update',
    'AdminUser',
    'admin-6',
    '오세린 (ads@example.com)',
    { status: 'ACTIVE' },
    { status: 'DISABLED' },
  ),
  log(
    '2026-10-06T10:00:02+09:00',
    'ADMIN',
    'notice.create',
    'Notice',
    'notice-n11',
    '원룸·투룸 지도에 대학가 필터가 생겼어요',
    null,
    { title: '원룸·투룸 지도에 대학가 필터가 생겼어요', isPinned: false, isPublished: true },
  ),
  log(
    '2026-10-01T09:20:15+09:00',
    'SUPER_ADMIN',
    'complex.trade_sync.trigger',
    'TradeSyncRun',
    'sync-r04',
    '2026년 9월 실거래가',
    null,
    { yearMonth: 202609, kinds: ['APT_RENT'] },
  ),
];
