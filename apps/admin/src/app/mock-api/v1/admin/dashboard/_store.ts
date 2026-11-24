/**
 * MOCK ONLY — in-memory state behind the dashboard, decision and notification mock routes.
 * Kept on `globalThis` so every route bundle of the dev server sees the same state.
 * Fixtures follow design/drafts/system/mockdata.md (all fictional); times are relative to "now" so
 * the relative labels ("12분 전", "3일째 대기", "D-3") always render like the design.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export interface MockPendingAgency {
  id: string;
  name: string;
  areaName: string;
  representativeName: string;
  registrationNumber: string;
  status: 'PENDING';
  /** Days ago the application was filed. */
  daysAgo: number;
  documents: {
    submitted: number;
    required: number;
    missing: string[];
    missingLabel: string | null;
  };
  /** Same 중개업 lookup result as the agencies mock (admin/agencies/_fixtures.ts). */
  registryStatus: 'MATCHED' | 'MISMATCH' | 'NOT_FOUND' | 'UNAVAILABLE' | null;
}

export interface MockNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  /** Minutes ago. */
  minutesAgo: number;
  read: boolean;
}

interface MockCoreState {
  pendingAgencies: MockPendingAgency[];
  notifications: MockNotification[];
}

/** Older-feed padding (mockdata.md): handled report targets and approved offices. */
const OLDER_REPORTS = ['금당 리버뷰 31평 매매', '왕지 숲속마을 25평 전세', '오천 그린빌 24평 매매'];
const OLDER_AGENCIES = [
  '왕지숲 공인중개사사무소 · 대표 강태오',
  '금당리버 공인중개사사무소 · 대표 윤재희',
  '오천그린 공인중개사사무소 · 대표 이하린',
];

const uuid = (group: string, n: number) =>
  `0d${group}0000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function initialState(): MockCoreState {
  const agencies: MockPendingAgency[] = [
    {
      id: uuid('a1', 87),
      name: '해룡신대 공인중개사사무소',
      areaName: '해룡면 신대리',
      representativeName: '오세린',
      registrationNumber: '46150-2026-00087',
      status: 'PENDING',
      daysAgo: 3,
      documents: { submitted: 3, required: 3, missing: [], missingLabel: null },
      registryStatus: 'MATCHED',
    },
    {
      id: uuid('a1', 91),
      name: '동천로 공인중개사사무소',
      areaName: '풍덕동',
      representativeName: '문지후',
      registrationNumber: '46150-2026-00091',
      status: 'PENDING',
      daysAgo: 2,
      documents: { submitted: 2, required: 3, missing: [], missingLabel: '공제증서' },
      registryStatus: 'MISMATCH',
    },
    {
      id: uuid('a1', 94),
      name: '순천역앞 공인중개사사무소',
      areaName: '장천동',
      representativeName: '배수아',
      registrationNumber: '46150-2026-00094',
      status: 'PENDING',
      daysAgo: 1,
      documents: { submitted: 3, required: 3, missing: [], missingLabel: null },
      registryStatus: 'MATCHED',
    },
    {
      id: uuid('a1', 95),
      name: '조례한빛 공인중개사사무소',
      areaName: '조례동',
      representativeName: '서준호',
      registrationNumber: '46150-2026-00095',
      status: 'PENDING',
      daysAgo: 0,
      documents: { submitted: 3, required: 3, missing: [], missingLabel: null },
      registryStatus: 'UNAVAILABLE',
    },
  ];

  const seed: Omit<MockNotification, 'id' | 'read'>[] = [
    {
      kind: 'DEAL_REQUEST_UNASSIGNED',
      title: '내놓기 요청이 배정을 기다리고 있어요',
      body: '신대 레이크파크 1단지 · 34평 매매 · 희망가 4억 5,000',
      link: '/deal-requests',
      minutesAgo: 12,
    },
    {
      kind: 'REPORT_RECEIVED',
      title: '허위매물 신고가 접수됐어요 (2건째)',
      body: '연향 센트럴 32평 매매 3억 1,000 · 연향센트럴 공인중개사사무소',
      link: '/reports',
      minutesAgo: 40,
    },
    {
      kind: 'AGENCY_APPLIED',
      title: '중개사무소 승인 요청',
      body: '조례한빛 공인중개사사무소 · 대표 서준호 · 서류 3종 확인',
      link: '/agencies',
      minutesAgo: 95,
    },
    {
      kind: 'LISTING_REVIEW',
      title: '매물 12건이 검수를 기다리고 있어요',
      body: '오늘 등록된 신규 매물 47건 중 12건',
      link: '/listings',
      minutesAgo: 130,
    },
    {
      kind: 'REPORT_RECEIVED',
      title: '허위매물 신고가 접수됐어요',
      body: '조례 호수마을 24평 월세 2,000/65 · 호수공원 공인중개사사무소',
      link: '/reports',
      minutesAgo: 150,
    },
    {
      kind: 'AD_EXPIRING',
      title: '광고 종료 3일 전',
      body: '신대중앙 공인중개사사무소 · 지도 플로팅 카드',
      link: '/banners',
      minutesAgo: 260,
    },
    {
      kind: 'AGENCY_APPLIED',
      title: '중개사무소 승인 요청',
      body: '순천역앞 공인중개사사무소 · 대표 배수아 · 서류 3종 확인',
      link: '/agencies',
      minutesAgo: 60 * 22,
    },
    {
      kind: 'SECURITY',
      title: '새 기기에서 관리자 로그인',
      body: 'Windows · Chrome · 순천 (KT) — 본인이 아니라면 비밀번호를 바꿔 주세요',
      link: '/settings/account',
      minutesAgo: 60 * 26,
    },
    {
      kind: 'REPORT_RECEIVED',
      title: '허위매물 신고가 접수됐어요',
      body: '석현동 해오름빌 투룸 월세 500/42 · 순천대정문 공인중개사사무소',
      link: '/reports',
      minutesAgo: 60 * 27,
    },
    {
      kind: 'AGENCY_APPLIED',
      title: '서류 보완이 필요한 승인 요청',
      body: '동천로 공인중개사사무소 · 공제증서 누락',
      link: '/agencies',
      minutesAgo: 60 * 47,
    },
    {
      kind: 'AD_EXPIRING',
      title: '광고 종료 7일 전',
      body: '연향들 더 퍼스트 · 메인 와이드 배너 1/3',
      link: '/banners',
      minutesAgo: 60 * 50,
    },
    {
      kind: 'SYSTEM',
      title: '실거래가 데이터 동기화 완료',
      body: '국토교통부 실거래가 11월 3주차 · 순천시 214건 반영',
      link: null,
      minutesAgo: 60 * 55,
    },
    {
      kind: 'DEAL_REQUEST_UNASSIGNED',
      title: '구하기 요청이 12곳에 전달됐어요',
      body: '신대지구 · 34평 매매 · 4억 5,000 이하',
      link: '/deal-requests',
      minutesAgo: 60 * 72,
    },
    {
      kind: 'AGENCY_APPLIED',
      title: '중개사무소 승인 요청',
      body: '해룡신대 공인중개사사무소 · 대표 오세린 · 서류 3종 확인',
      link: '/agencies',
      minutesAgo: 60 * 74,
    },
    {
      kind: 'LISTING_REVIEW',
      title: '실매물 확인 기한이 지난 매물 9건',
      body: '14일 이상 확인되지 않은 매물은 자동으로 숨김 처리됩니다',
      link: '/listings',
      minutesAgo: 60 * 98,
    },
    {
      kind: 'SYSTEM',
      title: '공지 팝업이 게시됐어요',
      body: '허위매물을 신고하면 확인 후 포상해 드려요 (11.10 – 11.30)',
      link: '/banners/popups',
      minutesAgo: 60 * 24 * 6,
    },
  ];
  // Pad the feed so "더 보기" (cursor paging) can be exercised.
  const older: Omit<MockNotification, 'id' | 'read'>[] = Array.from({ length: 14 }, (_, i) => ({
    kind: i % 3 === 0 ? 'REPORT_RECEIVED' : i % 3 === 1 ? 'AGENCY_APPLIED' : 'LISTING_REVIEW',
    title:
      i % 3 === 0
        ? '신고 처리가 완료됐어요'
        : i % 3 === 1
          ? '중개사무소가 승인됐어요'
          : '매물 검수가 완료됐어요',
    // Varied bodies: identical rows next to each other read like a duplicated feed page.
    body:
      i % 3 === 0
        ? `${OLDER_REPORTS[(i / 3) % OLDER_REPORTS.length]!} · 매물 숨김 처리`
        : i % 3 === 1
          ? OLDER_AGENCIES[((i - 1) / 3) % OLDER_AGENCIES.length]!
          : `오천 그린빌 외 ${5 + i}건`,
    link: i % 3 === 0 ? '/reports' : i % 3 === 1 ? '/agencies' : '/listings',
    minutesAgo: 60 * 24 * (7 + i),
  }));
  const notifications = [...seed, ...older].map((n, i) => ({
    ...n,
    id: uuid('n1', i + 1),
    read: i >= 8,
  }));
  return { pendingAgencies: agencies, notifications };
}

const KEY = Symbol.for('house.mock.admin.m-core');
type GlobalWithState = typeof globalThis & { [KEY]?: MockCoreState };

export function mockCoreState(): MockCoreState {
  const g = globalThis as GlobalWithState;
  g[KEY] ??= initialState();
  return g[KEY];
}

/** Dev helper: restore the initial fixtures (GET /mock-api/v1/admin/dashboard?_reset=1). */
export function resetMockCoreState(): void {
  (globalThis as GlobalWithState)[KEY] = initialState();
}

export const ago = (ms: number, now = Date.now()) => new Date(now - ms).toISOString();
export const TIME = { MIN, HOUR, DAY } as const;
export { uuid as mockCoreId };
