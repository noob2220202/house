import { PopupPage, type PopupPage as Page } from '@house/shared';
import { mockUuid } from '@/lib/mock';

/**
 * Notice popup fixtures (mockdata.md §5 AD-04, §6 "공지 팝업 380 × 300", §7). Mirrors the `popups`
 * table. `updatedAt` doubles as the popup "version" for the client-side "N일 동안 보지 않기" key.
 */
export interface MockPopup {
  key: string;
  id: string;
  title: string;
  linkUrl: string | null;
  newWindow: boolean;
  targetPages: readonly Page[];
  startAt: string;
  endAt: string;
  paused: boolean;
  dismissDays: number;
  sortOrder: number;
  updatedAt: string;
  /** Stand-in creative copy (the real popup is an uploaded 760×600 image). */
  art: { badge: string; lines: readonly string[]; caption: string; ground: string; accent: string };
}

export const POPUPS: readonly MockPopup[] = [
  {
    key: 'PP-01',
    id: mockUuid('PP-01'),
    title: '허위매물을 신고하면 확인 후 포상해 드려요',
    linkUrl: '/support/report',
    newWindow: false,
    targetPages: [PopupPage.MAIN],
    startAt: '2026-01-01T00:00:00+09:00',
    endAt: '2099-12-31T23:59:59+09:00',
    paused: false,
    dismissDays: 7,
    sortOrder: 1,
    updatedAt: '2026-11-10T09:00:00+09:00',
    art: {
      badge: '공지',
      lines: ['허위매물을 신고하면', '확인 후 포상해 드려요'],
      caption: '2026.11.10 – 11.30 · 신고 내용은 운영팀이 직접 확인합니다',
      ground: '#0F1B3A',
      accent: '#E9D7A8',
    },
  },
  {
    key: 'PP-02',
    id: mockUuid('PP-02'),
    title: '내놓기·구하기 서비스 오픈 안내',
    linkUrl: '/deal',
    newWindow: false,
    targetPages: [PopupPage.MAP, PopupPage.LISTING_DETAIL, PopupPage.DEAL_REQUEST],
    startAt: '2026-01-01T00:00:00+09:00',
    endAt: '2099-12-31T23:59:59+09:00',
    // Paused in the mock so other page groups' screens stay clean. Set to false to see the popup
    // layer on the map / listing detail / 내놓기·구하기 pages.
    paused: true,
    dismissDays: 1,
    sortOrder: 2,
    updatedAt: '2026-11-18T09:00:00+09:00',
    art: {
      badge: '안내',
      lines: ['집을 내놓으면', '동네 중개사가 먼저 연락해요'],
      caption: '연락처는 내가 선택한 중개사무소에만 공개됩니다',
      ground: '#1539C4',
      accent: '#DCE6FF',
    },
  },
  {
    key: 'PP-03',
    id: mockUuid('PP-03'),
    title: '시스템 점검 안내 (예약)',
    linkUrl: null,
    newWindow: false,
    targetPages: [PopupPage.ALL],
    startAt: '2099-01-01T00:00:00+09:00', // 예약 — must not be served
    endAt: '2099-12-31T23:59:59+09:00',
    paused: false,
    dismissDays: 0,
    sortOrder: 3,
    updatedAt: '2026-11-21T09:00:00+09:00',
    art: {
      badge: '점검',
      lines: ['시스템 점검 안내'],
      caption: '점검 시간 동안 일부 서비스 이용이 제한됩니다',
      ground: '#333D4B',
      accent: '#D1D6DB',
    },
  },
];

export function isPopupLive(p: MockPopup, now = new Date()): boolean {
  return !p.paused && new Date(p.startAt) <= now && now < new Date(p.endAt);
}

export function servePopup(p: MockPopup) {
  return {
    id: p.id,
    title: p.title,
    imageUrl: `/mock-api/v1/popups/creative/${p.key}.svg`,
    linkUrl: p.linkUrl,
    newWindow: p.newWindow,
    dismissDays: p.dismissDays,
    sortOrder: p.sortOrder,
    updatedAt: p.updatedAt,
  };
}

const FONT = "Inter,'Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Stand-in 380×300 popup image (DesignSystem.dc.html "공지 팝업"). */
export function popupSvg(p: MockPopup): string {
  const { art } = p;
  const badgeW = art.badge.length * 12 + 14;
  const lines = art.lines
    .map(
      (line, i) =>
        `<text x="28" y="${96 + i * 34}" font-size="26" font-weight="800" letter-spacing="-1.04" fill="#fff">${esc(line)}</text>`,
    )
    .join('');
  const capY = 96 + (art.lines.length - 1) * 34 + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 300" width="760" height="600" font-family="${FONT}"><rect width="380" height="300" fill="${art.ground}"/><g fill="none" stroke="${art.accent}" stroke-width="1.4" opacity=".55"><path d="M-20 300 C 80 240 200 290 400 230"/><path d="M-6 300 C 90 232 206 284 400 218"/><path d="M8 300 C 100 224 212 278 400 206"/><path d="M22 300 C 110 216 218 272 400 194"/><path d="M36 300 C 120 208 224 266 400 182"/></g><circle cx="306" cy="80" r="34" fill="none" stroke="${art.accent}" stroke-width="1.4"/><path d="M296 80l8 8 14-16" fill="none" stroke="${art.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><rect x="28.5" y="32.5" width="${badgeW}" height="20" rx="4" fill="none" stroke="#fff" stroke-opacity=".55"/><text x="${28.5 + badgeW / 2}" y="46.5" text-anchor="middle" font-size="11" font-weight="800" letter-spacing=".66" fill="#fff">${esc(art.badge)}</text>${lines}<text x="28" y="${capY}" font-size="13" fill="#fff" opacity=".72">${esc(art.caption)}</text></svg>`;
}
