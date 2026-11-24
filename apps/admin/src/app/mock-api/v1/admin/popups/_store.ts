import { PopupPage, computeScheduleStatus, type PopupPage as Page } from '@house/shared';
import type { CreativeSpec } from '../banners/_creatives';
import { endOfKstDay, kstDay, mockUuid, startOfKstDay } from '../banners/_ids';
import { adMediaView, registerFixtureMedia } from '../media/_store';

/**
 * Mutable in-memory popups of the admin mock (mirrors the `popups` table of the ads module).
 * mockdata.md §5 AD-04 / §6 "공지 팝업 380 × 300 (업로드 760 × 600)" / §7.
 */
export interface MockPopup {
  id: string;
  code: string;
  title: string;
  mediaId: string;
  linkUrl: string | null;
  newWindow: boolean;
  targetPages: Page[];
  startAt: string;
  endAt: string;
  paused: boolean;
  dismissDays: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  totals: { impressions: number; clicks: number };
  creative?: CreativeSpec;
}

interface PopupState {
  popups: MockPopup[];
  seq: number;
}

const KEY = '__houseAdminMockPopups' as const;
type GlobalWithPopups = typeof globalThis & { [KEY]?: PopupState };

export const POPUP_IMAGE = { width: 760, height: 600 } as const;

function seed(
  code: string,
  sortOrder: number,
  rest: Pick<MockPopup, 'title' | 'targetPages' | 'dismissDays' | 'linkUrl' | 'totals'> & {
    window: [number, number];
    creative: CreativeSpec;
  },
): MockPopup {
  const { window, ...fields } = rest;
  const created = startOfKstDay(kstDay(Math.min(window[0], 0) - 2));
  return {
    id: mockUuid(code),
    code,
    mediaId: registerFixtureMedia({
      id: mockUuid(`${code}-popup`),
      purpose: 'POPUP',
      mimeType: 'image/svg+xml',
      width: POPUP_IMAGE.width,
      height: POPUP_IMAGE.height,
      url: `/mock-api/v1/admin/popups/creative/${code}.svg`,
    }),
    newWindow: false,
    startAt: startOfKstDay(kstDay(window[0])),
    endAt: endOfKstDay(kstDay(window[1])),
    paused: false,
    sortOrder,
    createdAt: created,
    updatedAt: created,
    ...fields,
  };
}

function seedPopups(): MockPopup[] {
  return [
    seed('AD-04', 1, {
      title: '허위매물 신고 포상 안내',
      targetPages: [PopupPage.MAIN, PopupPage.MAP],
      dismissDays: 7,
      linkUrl: '/notices',
      window: [-13, 7],
      totals: { impressions: 22415, clicks: 905 },
      creative: {
        ground: '#0F1B3A',
        accent: '#E9D7A8',
        badge: '공지',
        headline: ['허위매물을 신고하면', '확인 후 포상해 드려요'],
        motif: 'check',
      },
    }),
    seed('AD-08', 2, {
      title: '내놓기·구하기 서비스 오픈 안내',
      targetPages: [PopupPage.MAIN, PopupPage.DEAL_REQUEST],
      dismissDays: 1,
      linkUrl: '/deal',
      window: [5, 35],
      totals: { impressions: 0, clicks: 0 },
      creative: {
        ground: '#1D4FF2',
        accent: '#DCE6FF',
        badge: '새 서비스',
        headline: ['집을 내놓으면', '순천 중개사가 먼저 연락해요'],
        motif: 'office',
      },
    }),
  ];
}

export function popupState(): PopupState {
  const g = globalThis as GlobalWithPopups;
  g[KEY] ??= { popups: seedPopups(), seq: 40 };
  return g[KEY];
}

export const popupStatusOf = (p: Pick<MockPopup, 'paused' | 'startAt' | 'endAt'>) =>
  computeScheduleStatus({
    paused: p.paused,
    startAt: new Date(p.startAt),
    endAt: new Date(p.endAt),
  });

export function sortedPopups(): MockPopup[] {
  return [...popupState().popups].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findPopup(id: string): MockPopup | undefined {
  return popupState().popups.find((p) => p.id === id);
}

export function renumberPopups(): void {
  sortedPopups().forEach((p, i) => {
    p.sortOrder = i + 1;
  });
}

/** Shared `AdminPopupView` — what GET/POST/PATCH /admin/popups return. */
export function toAdminPopup(p: MockPopup) {
  return {
    id: p.id,
    title: p.title,
    image: adMediaView(p.mediaId) ?? { id: p.mediaId, url: '', width: null, height: null },
    linkUrl: p.linkUrl,
    newWindow: p.newWindow,
    targetPages: p.targetPages,
    startAt: p.startAt,
    endAt: p.endAt,
    paused: p.paused,
    status: popupStatusOf(p),
    dismissDays: p.dismissDays,
    sortOrder: p.sortOrder,
    createdByAdminId: null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
