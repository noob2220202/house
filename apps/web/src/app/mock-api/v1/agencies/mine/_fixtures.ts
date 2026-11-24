import type { AgencyDashboard, AgencyMember, MyAgency } from '@/features/a-agency/api/schemas';
import type { MockInvite } from './_store';

/*
 * Fixtures of the broker-console mocks. All names, addresses and numbers are fictional and come
 * from design/drafts/system/mockdata.md (B01 신대중앙 공인중개사사무소, listings L01…, R01…).
 * Timestamps are generated relative to "now" so D-day / relative-time labels stay realistic.
 */

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

export function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}
function ahead(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}

/** Agency of the mock AGENT / AGENCY_OWNER users (MOCK_USERS[*].agencyId). */
export const OFFICE_ID = '0b6f2c1e-0000-4000-8000-0000000000b1';
/** Agency id used for the mock USER's application. */
export const APPLICANT_AGENCY_ID = '0b6f2c1e-0000-4000-8000-0000000000a9';

export function seedOffice(): MyAgency {
  return {
    id: OFFICE_ID,
    name: '신대중앙 공인중개사사무소',
    representativeName: '김서진',
    registrationNumber: '46150-2017-00112',
    businessNumber: '0000000000',
    phone: '0610000000',
    mobile: '01000000000',
    email: 'owner@example.com',
    roadAddress: '전라남도 순천시 해룡면 신대1로 18',
    jibunAddress: '전라남도 순천시 해룡면 신대리 1978',
    addressDetail: '105호',
    zipCode: '58027',
    lat: 34.9362,
    lng: 127.5551,
    intro:
      '신대지구 입주 때부터 9년째 레이크파크 단지만 중개하고 있어요.\n동·호수별 일조와 조망, 관리비까지 직접 확인한 매물만 올립니다. 매매·전세 모두 편하게 문의해 주세요.',
    businessHours: {
      mon: { open: '09:00', close: '19:00' },
      tue: { open: '09:00', close: '19:00' },
      wed: { open: '09:00', close: '19:00' },
      thu: { open: '09:00', close: '19:00' },
      fri: { open: '09:00', close: '19:00' },
      sat: { open: '10:00', close: '15:00' },
      sun: null,
    },
    specialties: ['APT'],
    logo: null,
    cover: null,
    status: 'APPROVED',
    statusReason: null,
    approvedAt: '2025-03-12T10:20:00+09:00',
    createdAt: '2025-03-10T14:05:00+09:00',
    updatedAt: ago(6 * DAY),
    activeListingCount: 62,
    viewCount: 18420,
    warningCount: 0,
    myRole: 'OWNER',
    documents: [
      {
        id: 'doc-office-1',
        type: 'REGISTRATION_CERT',
        mediaId: 'seed-office-registration',
        mimeType: 'application/pdf',
        fileName: '중개사무소등록증.pdf',
        createdAt: '2025-03-10T14:03:00+09:00',
      },
      {
        id: 'doc-office-2',
        type: 'BUSINESS_REG_CERT',
        mediaId: 'seed-office-business',
        mimeType: 'application/pdf',
        fileName: '사업자등록증.pdf',
        createdAt: '2025-03-10T14:04:00+09:00',
      },
      {
        id: 'doc-office-3',
        type: 'OTHER',
        mediaId: 'seed-office-deduction',
        mimeType: 'application/pdf',
        fileName: '공제증서_2026.pdf',
        createdAt: '2026-01-06T09:40:00+09:00',
      },
    ],
    statusHistory: [
      {
        id: 'hist-office-2',
        fromStatus: 'PENDING',
        toStatus: 'APPROVED',
        reason: null,
        createdAt: '2025-03-12T10:20:00+09:00',
      },
      {
        id: 'hist-office-1',
        fromStatus: null,
        toStatus: 'PENDING',
        reason: null,
        createdAt: '2025-03-10T14:05:00+09:00',
      },
    ],
  };
}

/** The mock USER's application, used by the dev-state switch (PENDING / REJECTED / …). */
export function seedApplicant(): MyAgency {
  return {
    id: APPLICANT_AGENCY_ID,
    name: '조례한빛 공인중개사사무소',
    representativeName: '김하늘',
    registrationNumber: '46150-2026-00095',
    businessNumber: '0000000000',
    phone: '0610000000',
    mobile: '01000000000',
    email: 'user@example.com',
    roadAddress: '전라남도 순천시 조례동 호수공원길 31',
    jibunAddress: '전라남도 순천시 조례동 1712',
    addressDetail: '1층 102호',
    zipCode: '57982',
    lat: 34.9573,
    lng: 127.5248,
    intro: '',
    businessHours: null,
    specialties: ['APT', 'ONEROOM'],
    logo: null,
    cover: null,
    status: 'PENDING',
    statusReason: null,
    approvedAt: null,
    createdAt: ago(1 * DAY + 3 * HOUR),
    updatedAt: ago(1 * DAY + 3 * HOUR),
    activeListingCount: 0,
    viewCount: 0,
    warningCount: 0,
    myRole: 'OWNER',
    documents: [
      {
        id: 'doc-app-1',
        type: 'REGISTRATION_CERT',
        mediaId: 'seed-app-registration',
        mimeType: 'application/pdf',
        fileName: '중개사무소등록증.pdf',
        createdAt: ago(1 * DAY + 3 * HOUR),
      },
      {
        id: 'doc-app-2',
        type: 'BUSINESS_REG_CERT',
        mediaId: 'seed-app-business',
        mimeType: 'image/jpeg',
        fileName: '사업자등록증.jpg',
        createdAt: ago(1 * DAY + 3 * HOUR),
      },
    ],
    statusHistory: [
      {
        id: 'hist-app-1',
        fromStatus: null,
        toStatus: 'PENDING',
        reason: null,
        createdAt: ago(1 * DAY + 3 * HOUR),
      },
    ],
  };
}

export const REJECT_REASON =
  '사업자등록증의 상호(조례한빛부동산)가 신청하신 상호와 달라요. 중개사무소 등록증과 같은 상호의 사업자등록증을 다시 올려 주세요.';
export const SUSPEND_REASON =
  '허위매물 신고 3건이 사실로 확인되어 2026.12.07까지 매물 노출이 정지됩니다.';

export function seedMembers(): AgencyMember[] {
  return [
    {
      id: 'mem-1',
      userId: '0b6f2c1e-0000-4000-8000-000000000003',
      role: 'OWNER',
      status: 'ACTIVE',
      displayName: '김서진',
      title: '대표',
      phone: '01000000000',
      isLicensed: true,
      licenseNumber: '전남-2014-00321',
      joinedAt: '2025-03-12T10:20:00+09:00',
      activeListingCount: 31,
    },
    {
      id: 'mem-2',
      userId: '0b6f2c1e-0000-4000-8000-000000000002',
      role: 'AGENT',
      status: 'ACTIVE',
      displayName: '오세린',
      title: '실장',
      phone: '01000000000',
      isLicensed: true,
      licenseNumber: '전남-2019-00847',
      joinedAt: '2025-04-02T09:10:00+09:00',
      activeListingCount: 24,
    },
    {
      id: 'mem-3',
      userId: '0b6f2c1e-0000-4000-8000-000000000004',
      role: 'AGENT',
      status: 'ACTIVE',
      displayName: '박지후',
      title: null,
      phone: '01000000000',
      isLicensed: false,
      licenseNumber: null,
      joinedAt: '2026-02-17T11:30:00+09:00',
      activeListingCount: 7,
    },
  ];
}

/** One open invitation (demo code for /agent/apply → 초대 코드로 합류: K7MQ4-RXD2P). */
export function seedInvites(): MockInvite[] {
  return [
    {
      id: '6f1a2b3c4d5e6f708192a3b4',
      code: 'K7MQ4RXD2P',
      codeHint: 'XD2P',
      label: '이도윤 과장',
      createdAt: ahead(-2 * DAY),
      expiresAt: ahead(5 * DAY),
    },
  ];
}

function dayString(offsetDays: number): string {
  // Calendar date in KST.
  return new Date(Date.now() + 9 * HOUR - offsetDays * DAY).toISOString().slice(0, 10);
}

export function seedDashboard(): AgencyDashboard {
  const dailyViews = [412, 448, 391, 520, 604, 488, 536];
  return {
    listings: { active: 62, reserved: 4, draft: 3, closed30d: 14, coBrokered: 18 },
    views: {
      total7d: dailyViews.reduce((a, b) => a + b, 0),
      changeRatio: 0.086,
      daily: dailyViews.map((views, i) => ({ date: dayString(dailyViews.length - 1 - i), views })),
      profileViews7d: 286,
      favorites7d: 41,
    },
    // Filled from the a-inbox mock store by the route (same rows as /agent/requests).
    dealRequests: { newCount: 0, newSellCount: 0, newWantedCount: 0, items: [] },
    expiringListings: [
      {
        id: 'L01',
        title: '신대 레이크파크 1단지 103동',
        summary: '34평 · 고/25층 · 남향',
        dealType: 'SALE',
        price: 44500,
        expiresAt: ahead(2 * DAY + 5 * HOUR),
        verifiedAt: dayString(1),
      },
      {
        id: 'L06',
        title: '신대 레이크파크 3단지 301동',
        summary: '39평 · 중/24층 · 남향',
        dealType: 'SALE',
        price: 46000,
        expiresAt: ahead(4 * DAY + 2 * HOUR),
        verifiedAt: dayString(3),
      },
      {
        id: 'L11',
        title: '신대 레이크파크 1단지 108동',
        summary: '25평 · 중/25층 · 남동향',
        dealType: 'MONTHLY',
        deposit: 3000,
        monthlyRent: 90,
        expiresAt: ahead(6 * DAY + 8 * HOUR),
        verifiedAt: dayString(9),
      },
    ],
    verificationDue: [
      {
        id: 'L12',
        title: '신대 레이크파크 1단지 111동',
        summary: '41평 · 고/25층 · 남향',
        dealType: 'JEONSE',
        deposit: 31000,
        verifiedAt: dayString(32),
        // Overdue by two days → "2일 지남".
        verificationDueAt: dayString(2),
      },
      {
        id: 'L13',
        title: '신대 레이크파크 3단지 305동',
        summary: '33평 · 저/24층 · 남서향',
        dealType: 'SALE',
        price: 38000,
        verifiedAt: dayString(27),
        verificationDueAt: dayString(-3),
      },
      {
        id: 'L02',
        title: '선월 하이츠 2차 205동',
        summary: '33평 · 중/20층 · 남동향',
        dealType: 'PRESALE',
        price: 41900,
        verifiedAt: dayString(25),
        verificationDueAt: dayString(-5),
      },
      {
        id: 'L14',
        title: '신대 레이크파크 1단지 104동',
        summary: '34평 · 중/25층 · 남향',
        dealType: 'JEONSE',
        deposit: 28000,
        verifiedAt: dayString(24),
        verificationDueAt: dayString(-6),
      },
    ],
  };
}

/** Dashboard of an office that has just been approved (empty states). */
export function emptyDashboard(): AgencyDashboard {
  return {
    listings: { active: 0, reserved: 0, draft: 0, closed30d: 0, coBrokered: 0 },
    views: {
      total7d: 0,
      changeRatio: null,
      daily: Array.from({ length: 7 }, (_, i) => ({ date: dayString(6 - i), views: 0 })),
      profileViews7d: 0,
      favorites7d: 0,
    },
    dealRequests: { newCount: 0, newSellCount: 0, newWantedCount: 0, items: [] },
    expiringListings: [],
    verificationDue: [],
  };
}
