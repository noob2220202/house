import { dealRequestAreaRange, publicDealRequestDescription } from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import type {
  AgencyDealRequest,
  AgencyDealRequestDetail,
  InboxListing,
  InboxStage,
  MyProposal,
} from '@/features/a-inbox/api/schemas';
import { inboxStage } from '@/features/a-inbox/lib/stage';
import type { Notification } from '@/features/w-me/schemas';
import {
  mockCsrfOk,
  mockError,
  mockForbidden,
  mockGuard,
  mockSessionRole,
  mockUnauthenticated,
  mockUuid,
  type MockRole,
} from '@/lib/mock';
import { agencyByKey } from '../../deal-requests/_fixtures';
import { dealStore, type MockDealRequest, type MockProposal } from '../../deal-requests/_store';
import { meState } from '../../me/_store';
import { officeListing } from './_listings';
import { ago, DAY, HOUR, MIN, MY_AGENCY_ID, proposalListing, seedInboxRequests } from './_seed';

/**
 * Agency side of the deal-requests mock (a-inbox).
 *
 * The mock office is B01 신대중앙 공인중개사사무소 for both console roles. Its inbox is
 *   (a) the requests of the mock USER kept by the w-deal mock (`dealStore()`) that reach B01 —
 *       so 내놓기 at /deal/sell → inbox → proposal → /me/requests → contact consent works end to
 *       end, and
 *   (b) seeded requests of other (fictional) people (`_seed.ts`), kept here on `globalThis`.
 * Restarting the dev server resets everything.
 */
export { MY_AGENCY_ID };

const MEMBER_NAME: Record<MockRole, string> = {
  USER: '김서진',
  AGENT: '오세린',
  AGENCY_OWNER: '김서진',
};

interface AgencyInboxStore {
  own: MockDealRequest[];
  notified: Partial<Record<MockRole, boolean>>;
}

const KEY = '__houseMockAgencyInbox_v2';

function store(): AgencyInboxStore {
  const g = globalThis as typeof globalThis & { [KEY]?: AgencyInboxStore };
  g[KEY] ??= { own: seedInboxRequests(), notified: {} };
  return g[KEY];
}

/** Does a request of the w-deal store reach the mock office? */
function reachesOffice(r: MockDealRequest): boolean {
  if (r.visibility === 'SELECTED_AGENCIES') return r.targetAgencyIds.includes(MY_AGENCY_ID);
  const office = agencyByKey('B01');
  const codes = r.type === 'WANTED' ? r.regionCodes : r.emdCode ? [r.emdCode] : [];
  // Codes the mocks do not know (a real 법정동코드 from the postcode search) are delivered to the
  // first offices by the w-deal mock (`agenciesFor`) — B01 is one of them.
  return (
    codes.length === 0 ||
    codes.some((c) => office.serviceCodes.includes(c)) ||
    !codes.some((c) => c.startsWith('12150'))
  );
}

/** Every request in the mock office's inbox, newest first. */
export function inboxRequests(): MockDealRequest[] {
  return [...store().own, ...dealStore().requests.filter(reachesOffice)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function findInboxRequest(id: string): MockDealRequest | undefined {
  return inboxRequests().find((r) => r.id === id);
}

export function findMyProposal(
  proposalId: string,
): { request: MockDealRequest; proposal: MockProposal } | null {
  for (const request of inboxRequests()) {
    const proposal = request.proposals.find(
      (p) => p.id === proposalId && p.agencyId === MY_AGENCY_ID,
    );
    if (proposal) return { request, proposal };
  }
  return null;
}

/** "김하늘" → "김*늘", "이준" → "이*" — the API never sends the full name before consent. */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length <= 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

export function myProposalDto(p: MockProposal, withBody: boolean): MyProposal {
  return {
    id: p.id,
    status: p.status,
    message: withBody ? p.message : '',
    listings: withBody
      ? p.listings.map((l) => officeListing(String(l.id)) ?? (l as unknown as InboxListing))
      : [],
    memberName: p.memberName,
    createdAt: p.createdAt,
    viewedAt: p.viewedAt,
    respondedAt: p.respondedAt,
  };
}

/**
 * List item: location down to 읍면동 / 단지 — no 도로명·동·호, no contact. Like the API, a 내놓기
 * request reaches an office without a grant reduced: area band instead of the area, no floor,
 * photos or own words (only the form's flag lines).
 */
export function agencyRequestDto(r: MockDealRequest, withBody = false): AgencyDealRequest {
  const proposal = r.proposals.find((p) => p.agencyId === MY_AGENCY_ID);
  const shared = MY_AGENCY_ID in r.grants;
  const reduce = !shared && r.type === 'SELL_OR_LEASE';
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    assetType: r.assetType as AgencyDealRequest['assetType'],
    dealTypes: r.dealTypes as AgencyDealRequest['dealTypes'],
    visibility: r.visibility,
    targeted: r.visibility === 'SELECTED_AGENCIES',
    description: reduce ? publicDealRequestDescription(r.description) : r.description,
    emdCode: r.emdCode,
    emdName: r.emdName,
    complexId: r.complexId,
    complexName: r.complexName,
    exclusiveArea: reduce ? null : r.exclusiveArea,
    areaRange: r.type === 'SELL_OR_LEASE' ? dealRequestAreaRange(r.exclusiveArea) : null,
    floor: reduce ? null : r.floor,
    desiredSalePrice: r.desiredSalePrice,
    desiredDeposit: r.desiredDeposit,
    desiredMonthlyRent: r.desiredMonthlyRent,
    photos: reduce ? [] : (r.photos as AgencyDealRequest['photos']),
    photoCount: r.photos.length,
    regionCodes: r.regionCodes,
    complexIds: r.complexIds,
    priceMin: r.priceMin,
    priceMax: r.priceMax,
    depositMin: r.depositMin,
    depositMax: r.depositMax,
    rentMin: r.rentMin,
    rentMax: r.rentMax,
    areaMin: r.areaMin,
    areaMax: r.areaMax,
    roomsMin: r.roomsMin,
    moveInDate: r.moveInDate,
    expiresAt: r.expiresAt,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    proposalCount: r.proposals.length,
    myProposal: proposal ? myProposalDto(proposal, withBody) : null,
    contactGranted: shared,
  };
}

/** Detail: + our full proposal and, only while the grant is active, the requester's contact. */
export function agencyRequestDetailDto(r: MockDealRequest): AgencyDealRequestDetail {
  const grantedAt = r.grants[MY_AGENCY_ID];
  return {
    ...agencyRequestDto(r, true),
    contact: grantedAt
      ? {
          name: r.contactName,
          phone: r.contactPhone,
          roadAddress: r.roadAddress,
          addressDetail: r.addressDetail,
          grantedAt,
        }
      : null,
  };
}

export function stageOf(r: MockDealRequest): InboxStage {
  return inboxStage(agencyRequestDto(r));
}

/** Builds and stores a proposal of the mock office. */
export function addProposal(
  r: MockDealRequest,
  role: MockRole,
  input: { message: string; listings: InboxListing[] },
): MockProposal {
  const now = new Date().toISOString();
  const proposal: MockProposal = {
    id: mockUuid(`proposal-${r.id}-B01-${Date.now()}`),
    dealRequestId: r.id,
    agencyId: MY_AGENCY_ID,
    memberName: MEMBER_NAME[role],
    // Both mock senders are 공인중개사 (오세린 is a licensed member of B01, mem-2).
    memberIsAssistant: false,
    message: input.message,
    status: 'SENT',
    listings: input.listings.map(proposalListing),
    createdAt: now,
    viewedAt: null,
    respondedAt: null,
  };
  r.proposals.push(proposal);
  r.updatedAt = now;
  // The requester of a w-deal mock request is the mock USER → tell their notification feed.
  if (dealStore().requests.includes(r)) {
    pushNotification('USER', {
      type: 'PROPOSAL_RECEIVED',
      title: `${agencyByKey('B01').name}가 제안을 보냈어요`,
      body:
        input.listings.length > 0
          ? `매물 ${input.listings.length}건과 함께 제안이 도착했습니다.`
          : '요청하신 조건에 대한 제안이 도착했습니다.',
      data: { dealRequestId: r.id },
    });
  }
  return proposal;
}

// ---- notifications (the console reads the user's own feed: GET /me/notifications) ---------------

type NotificationSeed = Pick<Notification, 'type' | 'title' | 'body' | 'data'>;

function pushNotification(role: MockRole, n: NotificationSeed, ageMs = 0, read = false) {
  const state = meState(role);
  const createdAt = ago(ageMs);
  state.notifications.push({
    ...n,
    id: mockUuid(`agency-notification-${role}-${state.notifications.length}-${n.title}`),
    createdAt,
    readAt: read ? createdAt : null,
  });
  state.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Turns the w-me notification mock of a console role into a broker's feed (once per role): the
 * requester-side seeds (제안 도착, 신고 처리 …) are dropped, general notices stay, agency events are
 * added. Agency events carry `data.agencyId` — see features/a-inbox/lib/notifications.ts.
 */
export function ensureAgencyNotifications(role: MockRole) {
  if (role === 'USER') return;
  const s = store();
  if (s.notified[role]) return;
  s.notified[role] = true;
  const agencyId = MY_AGENCY_ID;
  const feed = meState(role).notifications;
  const general = feed.filter(
    (n) => n.type === 'SYSTEM' && !n.data?.listingId && !n.data?.agencyId,
  );
  feed.length = 0;
  feed.push(...general.map((n) => ({ ...n, readAt: n.readAt ?? n.createdAt })));
  const rows: [NotificationSeed, number, boolean][] = [
    [
      {
        type: 'DEAL_REQUEST_RECEIVED',
        title: '새 내놓기 요청이 도착했어요',
        body: '신대 레이크파크 1단지 · 매매 · 희망가 4억 5,000. 먼저 제안해 보세요.',
        data: { agencyId, dealRequestId: 'req-01' },
      },
      12 * MIN,
      false,
    ],
    [
      {
        type: 'DEAL_REQUEST_RECEIVED',
        title: '새 구하기 요청이 도착했어요',
        body: '신대지구 아파트 · 매매 · 4억 5,000 이하. 조건에 맞는 내 매물을 추천해 보세요.',
        data: { agencyId, dealRequestId: 'req-02' },
      },
      38 * MIN,
      false,
    ],
    [
      {
        type: 'DEAL_REQUEST_RECEIVED',
        title: '우리 사무소를 지정한 구하기 요청이 도착했어요',
        body: '선월지구 아파트 · 분양권 · 4억 3,000 이하. 요청자가 중개사무소 3곳을 직접 골랐어요.',
        data: { agencyId, dealRequestId: 'req-03' },
      },
      2 * HOUR,
      false,
    ],
    [
      {
        type: 'CONTACT_GRANTED',
        title: '요청자가 연락처를 공개했어요',
        body: '구하기 요청 “신대지구 아파트 · 전세”의 요청자가 연락처를 공개했습니다. 지금 연락해 보세요.',
        data: { agencyId, dealRequestId: 'req-07' },
      },
      1 * DAY + 3 * HOUR,
      true,
    ],
    [
      {
        type: 'PROPOSAL_ACCEPTED',
        title: '보낸 제안이 수락됐어요',
        body: '내놓기 요청 “선월 하이츠 2차 · 분양권”의 요청자가 우리 사무소의 제안을 수락했습니다.',
        data: { agencyId, dealRequestId: 'req-06' },
      },
      3 * DAY,
      true,
    ],
    [
      {
        type: 'LISTING_HIDDEN',
        title: '실매물 확인 기한이 지난 매물이 숨김 처리됐어요',
        body: '신대 레이크파크 3단지 305동 · 매매 3억 8,000. 확인 기록을 남기면 다시 노출됩니다.',
        data: { agencyId, url: '/agent/listings' },
      },
      5 * DAY,
      true,
    ],
  ];
  for (const [n, age, read] of rows) pushNotification(role, n, age, read);
}

// ---- guards --------------------------------------------------------------------------------------

type Guarded = { role: MockRole; fail?: undefined } | { fail: NextResponse };

/** Preamble of the agency handlers: mock on → signed in → AGENT / AGENCY_OWNER → CSRF on mutations. */
export function agencyGuard(req: NextRequest, options: { mutation?: boolean } = {}): Guarded {
  const off = mockGuard();
  if (off) return { fail: off };
  const role = mockSessionRole(req);
  if (!role) return { fail: mockUnauthenticated() };
  if (role === 'USER') return { fail: mockForbidden() };
  if (options.mutation && !mockCsrfOk(req))
    return {
      fail: mockError(
        403,
        'CSRF_FAILED',
        '요청이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
      ),
    };
  ensureAgencyNotifications(role);
  return { role };
}

export const forcedFailure = (req: NextRequest): NextResponse | null =>
  req.nextUrl.searchParams.get('_fail') === '1'
    ? mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.')
    : null;

export const requestNotFound = () =>
  mockError(404, 'DEAL_REQUEST_NOT_FOUND', '요청을 찾을 수 없습니다.');
export const requestClosed = () => mockError(409, 'DEAL_REQUEST_CLOSED', '종료된 요청입니다.');
