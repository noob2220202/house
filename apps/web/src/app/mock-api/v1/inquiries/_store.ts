import {
  AssetType,
  DealType,
  InquiryAuthor,
  type InquiryChannel,
  type InquirySource,
  type InquiryStatus,
  NotificationType,
  type AgencyInquiryView,
  type InquiryListingRef,
  type InquiryMessageView,
  type MyInquiryDetail,
  type MyInquiryListItem,
} from '@house/shared';
import type { NextRequest, NextResponse } from 'next/server';
import type { InboxListing } from '@/features/a-inbox/api/schemas';
import type { Notification } from '@/features/w-me/schemas';
import {
  mockCsrfOk,
  mockError,
  mockGuard,
  mockSessionRole,
  mockUnauthenticated,
  mockUuid,
  type MockRole,
} from '@/lib/mock';
import { findAgencySummary } from '../agencies/_fixtures';
import { officeListing } from '../agency/deal-requests/_listings';
import { ensureAgencyNotifications } from '../agency/deal-requests/_store';
import { MY_AGENCY_ID } from '../agency/deal-requests/_seed';
import { agencyByKey } from '../deal-requests/_fixtures';
import { findMockListingDetail } from '../listings/_detail-fixtures';
import { meState } from '../me/_store';

/**
 * One store for both sides of 문의 (SPEC §3.5): rows the customer side creates
 * (POST /inquiries, /inquiries/contact-events) show up in the console inbox of the mock office
 * (B01 신대중앙, `GET /agency/inquiries`), and the office's replies appear under MY > 문의 내역
 * of the mock member who wrote them (`owner`). Seeds: the B01 inbox (customers are fictional) and
 * three inquiries of the mock USER (one answered by B01, one by another office, one waiting).
 * Kept on `globalThis`; restarting the dev server resets it.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export interface MockInquiry {
  id: string;
  agencyId: string;
  listing: InquiryListingRef | null;
  /** Mock member who sent it (their MY > 문의 내역); null = a guest or another (fictional) member. */
  owner: MockRole | null;
  /** Sent while signed in (answers go to the member's thread). */
  member: boolean;
  channel: InquiryChannel;
  status: InquiryStatus;
  source: InquirySource;
  customerName: string | null;
  customerPhone: string | null;
  message: string | null;
  memo: string | null;
  handledByName: string | null;
  readAt: string | null;
  customerReadAt: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deleteReason: string | null;
  messages: InquiryMessageView[];
}

export const MEMBER_NAME: Record<MockRole, string> = {
  USER: '김서진',
  AGENT: '오세린',
  AGENCY_OWNER: '김서진',
};

/** InboxListing (mock office listings) → `InquiryListingRef`. */
function refFromOffice(l: InboxListing): InquiryListingRef {
  const presale = l.dealType === DealType.PRESALE;
  return {
    id: l.id,
    title: l.title,
    assetType: l.assetType,
    dealType: l.dealType,
    salePrice: presale ? null : (l.price ?? null),
    deposit: l.deposit ?? null,
    monthlyRent: l.monthlyRent ?? null,
    presalePrice: presale ? (l.price ?? null) : null,
    coverPhotoUrl: l.thumbUrl ?? null,
  };
}

/** The listing an inquiry names, from any listing mock (null = unknown id). */
export function listingRef(id: string): InquiryListingRef | null {
  const office = officeListing(id);
  if (office) return refFromOffice(office);
  const d = findMockListingDetail(id);
  if (!d) return null;
  const name = [d.complex?.name, d.property.dong].filter(Boolean).join(' ');
  const cover = d.photos.find((p) => p.isCover) ?? d.photos[0];
  return {
    id: d.id,
    title: name || d.title || '매물',
    assetType: d.assetType ?? AssetType.APT,
    dealType: d.dealType,
    salePrice: d.salePrice ?? null,
    deposit: d.deposit ?? null,
    monthlyRent: d.monthlyRent ?? null,
    presalePrice: d.presalePrice ?? null,
    coverPhotoUrl: cover?.thumbUrl ?? cover?.url ?? null,
  };
}

const office = (code: string) => {
  const l = officeListing(mockUuid(code));
  return l ? refFromOffice(l) : null;
};

interface Seed {
  id: string;
  agency?: string;
  channel: InquiryChannel;
  listing: string | null;
  owner?: MockRole;
  member?: boolean;
  name: string | null;
  phone?: string;
  age: number;
  status: InquiryStatus;
  message?: string;
  unread?: boolean;
  memo?: string;
  handledBy?: string;
  source?: InquirySource;
  thread?: { author: InquiryAuthor; body: string; by: string; age: number }[];
  /** The customer has read the latest reply. */
  seen?: boolean;
}

const A = InquiryAuthor.AGENCY;
const C = InquiryAuthor.CUSTOMER;

const SEEDS: Seed[] = [
  {
    id: 'inq-01',
    channel: 'MESSAGE',
    listing: 'L01',
    member: true,
    name: '박서연',
    phone: '01045213387',
    age: 25 * MIN,
    status: 'NEW',
    unread: true,
    message: '이번 주 토요일 오전에 집 볼 수 있을까요? 잔금은 2월 말 생각하고 있어요.',
  },
  {
    id: 'inq-04',
    channel: 'CALL',
    listing: 'L01',
    member: true,
    name: null,
    age: 70 * MIN,
    status: 'IN_PROGRESS',
    memo: '오후 3시 통화. 토요일 2시 방문 예약, 배우자와 함께 오실 예정.',
    handledBy: '오세린',
  },
  {
    id: 'inq-02',
    channel: 'MESSAGE',
    listing: 'L06',
    name: '이정호',
    phone: '01092748810',
    age: 3 * HOUR,
    status: 'NEW',
    unread: true,
    source: 'SITE',
    message: '확장 여부와 관리비가 어느 정도 나오는지 궁금합니다. 저녁에 전화 주셔도 괜찮아요.',
  },
  { id: 'inq-05', channel: 'SMS', listing: 'L17', name: null, age: 4 * HOUR, status: 'DONE' },
  {
    id: 'inq-06',
    channel: 'COPY',
    listing: 'L02',
    member: true,
    name: null,
    age: 6 * HOUR,
    status: 'DONE',
  },
  {
    id: 'inq-u1',
    channel: 'MESSAGE',
    listing: 'L02',
    owner: 'USER',
    name: '김하늘',
    phone: '01000000000',
    age: 1 * DAY + 5 * HOUR,
    status: 'IN_PROGRESS',
    message: '중도금 대출 승계 조건 알려 주세요. 다음 주 평일 저녁에 방문 가능합니다.',
    handledBy: '김서진',
    thread: [
      {
        author: A,
        by: '김서진',
        body: '안녕하세요, 신대중앙 김서진입니다. 중도금 60% 무이자 대출은 그대로 승계 가능합니다. 승계 절차와 필요한 서류는 방문하실 때 자세히 안내해 드릴게요. 화요일이나 목요일 저녁 7시 어떠세요?',
        age: 1 * DAY + 3 * HOUR,
      },
    ],
  },
  {
    id: 'inq-07',
    channel: 'CALL',
    listing: null,
    member: true,
    name: null,
    age: 1 * DAY + 8 * HOUR,
    status: 'DONE',
    memo: '신대지구 1층 상가 임대 문의. 조건에 맞는 매물이 없어 대기 고객으로 등록.',
    handledBy: '김서진',
  },
  {
    id: 'inq-08',
    channel: 'MESSAGE',
    listing: null,
    name: '최민준',
    phone: '0617201188',
    age: 2 * DAY,
    status: 'DONE',
    message: '신대지구 30평대 전세 매물 나오면 연락 부탁드립니다. 예산은 2억 5천 정도예요.',
    memo: '전세 대기 고객. 2월 입주 희망, 연락 완료.',
    handledBy: '오세린',
  },
  {
    id: 'inq-09',
    channel: 'MESSAGE',
    listing: 'L11',
    member: true,
    name: '송지은',
    phone: '01033904471',
    age: 2 * DAY + 3 * HOUR,
    status: 'IN_PROGRESS',
    message: '소형견 한 마리를 키우는데 입주 가능할까요? 보증금 조정도 되는지 궁금합니다.',
    memo: '임대인에게 반려동물 가능 여부 확인 중.',
    handledBy: '오세린',
    thread: [
      {
        author: A,
        by: '오세린',
        body: '안녕하세요. 임대인께 반려동물 가능 여부를 여쭤보고 오늘 중으로 다시 답변드릴게요.',
        age: 2 * DAY + 1 * HOUR,
      },
      {
        author: C,
        by: '송지은',
        body: '감사합니다. 보증금은 500만 원 정도 조정 가능한지도 함께 여쭤봐 주세요.',
        age: 2 * DAY,
      },
    ],
  },
  {
    id: 'inq-10',
    channel: 'SMS',
    listing: 'L21',
    member: true,
    name: null,
    age: 3 * DAY,
    status: 'DONE',
    memo: '문자로 방문 일정 조율, 일요일 11시 방문 완료.',
    handledBy: '오세린',
  },
  {
    id: 'inq-11',
    channel: 'COPY',
    listing: 'L06',
    name: null,
    age: 3 * DAY + 5 * HOUR,
    status: 'DONE',
  },
  {
    id: 'inq-12',
    channel: 'CALL',
    listing: 'L15',
    member: true,
    name: null,
    age: 4 * DAY,
    status: 'DONE',
    memo: '가계약금 입금. 12월 5일 잔금 예정.',
    handledBy: '김서진',
  },
  {
    id: 'inq-13',
    channel: 'MESSAGE',
    listing: 'L20',
    member: true,
    name: '신동철',
    phone: '01077120934',
    age: 5 * DAY,
    status: 'DONE',
    message: '권리금이 있나요? 업종 제한이 있는지도 알려 주세요.',
    handledBy: '김서진',
    thread: [
      {
        author: A,
        by: '김서진',
        body: '시설 권리금은 협의 가능하며, 같은 건물에 카페가 있어 카페 업종만 제한됩니다. 현장 안내 가능하니 편하신 시간 알려 주세요.',
        age: 4 * DAY + 20 * HOUR,
      },
    ],
    seen: true,
  },
  { id: 'inq-14', channel: 'CALL', listing: 'L18', name: null, age: 6 * DAY, status: 'DONE' },
  {
    id: 'inq-u2',
    agency: 'B02',
    channel: 'MESSAGE',
    listing: null,
    owner: 'USER',
    name: '김하늘',
    phone: '01000000000',
    age: 8 * DAY,
    status: 'DONE',
    message: '조례동 호수공원 근처 20평대 매매 매물 있으면 추천 부탁드려요. 예산은 3억 이하입니다.',
    handledBy: '한서윤',
    thread: [
      {
        author: A,
        by: '한서윤',
        body: '안녕하세요, 호수공원 공인중개사사무소입니다. 조건에 맞는 매물 2건을 사무소 페이지에 올려 두었어요. 편하실 때 방문 예약해 주세요.',
        age: 7 * DAY + 22 * HOUR,
      },
    ],
    seen: true,
  },
  {
    id: 'inq-u3',
    agency: 'B05',
    channel: 'MESSAGE',
    listing: null,
    owner: 'USER',
    name: '김하늘',
    age: 2 * HOUR,
    status: 'NEW',
    message: '선월지구 분양권 전매 가능 시기가 언제부터인지 궁금합니다.',
  },
];

function seedOne(s: Seed): MockInquiry {
  const createdAt = ago(s.age);
  const messages: InquiryMessageView[] = (s.thread ?? []).map((m, i) => ({
    id: `${s.id}-m${i + 1}`,
    author: m.author,
    body: m.body,
    authorName: m.by,
    createdAt: ago(m.age),
  }));
  const last = messages[messages.length - 1]?.createdAt ?? createdAt;
  const member = s.member ?? s.owner !== undefined;
  return {
    id: s.id,
    agencyId: s.agency ? agencyByKey(s.agency).id : MY_AGENCY_ID,
    listing: s.listing ? office(s.listing) : null,
    owner: s.owner ?? null,
    member,
    channel: s.channel,
    status: s.status,
    source: s.source ?? 'MAIN',
    customerName: s.name,
    customerPhone: s.channel === 'MESSAGE' ? (s.phone ?? null) : null,
    message: s.message ?? null,
    memo: s.memo ?? null,
    handledByName: s.handledBy ?? null,
    // Contact events are logged as read (like the API): only written inquiries count as unread.
    readAt:
      s.channel !== 'MESSAGE' ? createdAt : s.unread ? null : ago(Math.max(0, s.age - 20 * MIN)),
    customerReadAt: s.seen ? last : null,
    lastMessageAt: last,
    createdAt,
    updatedAt: last,
    deletedAt: null,
    deleteReason: null,
    messages,
  };
}

interface InquiryStore {
  items: MockInquiry[];
  /** Contact-event dedupe: key → last logged (ms). */
  contactSeen: Record<string, number>;
  /** Written inquiries per sender and KST day (daily cap). */
  sentToday: Record<string, number>;
  /** Roles whose notification feed already got the seeded inquiry notifications. */
  notified: Partial<Record<MockRole, boolean>>;
}

const KEY = '__houseMockInquiries_v1';

export function inquiryStore(): InquiryStore {
  const g = globalThis as typeof globalThis & { [KEY]?: InquiryStore };
  g[KEY] ??= { items: SEEDS.map(seedOne), contactSeen: {}, sentToday: {}, notified: {} };
  return g[KEY];
}

export function findInquiry(id: string): MockInquiry | undefined {
  return inquiryStore().items.find((i) => i.id === id && !i.deletedAt);
}

/** Rows of the mock office's inbox (not deleted), newest activity first. */
export function officeInquiries(): MockInquiry[] {
  return inquiryStore()
    .items.filter((i) => i.agencyId === MY_AGENCY_ID && !i.deletedAt)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function findOfficeInquiry(id: string): MockInquiry | undefined {
  const found = findInquiry(id);
  return found && found.agencyId === MY_AGENCY_ID ? found : undefined;
}

export function unreadOfficeCount(): number {
  return officeInquiries().filter((i) => !i.readAt).length;
}

// ---------- DTOs ----------

export function agencyInquiryView(i: MockInquiry, detail = false): AgencyInquiryView {
  return {
    id: i.id,
    channel: i.channel,
    status: i.status,
    source: i.source,
    listing: i.listing,
    customerName: i.customerName,
    customerPhone: i.channel === 'MESSAGE' ? i.customerPhone : null,
    isMember: i.member,
    canReply: i.channel === 'MESSAGE' && i.member,
    message: i.message,
    memo: i.memo,
    handledByName: i.handledByName,
    readAt: i.readAt,
    lastMessageAt: i.lastMessageAt,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    ...(detail ? { messages: i.messages } : {}),
  };
}

function agencyRef(agencyId: string) {
  const a = findAgencySummary(agencyId);
  return {
    id: agencyId,
    name: a?.name ?? '중개사무소',
    logoUrl: a?.logoUrl ?? null,
    phone: a?.phone ?? '',
  };
}

function hasUnreadReply(i: MockInquiry): boolean {
  return i.messages.some(
    (m) =>
      m.author === InquiryAuthor.AGENCY && (!i.customerReadAt || m.createdAt > i.customerReadAt),
  );
}

export function myInquiryItem(i: MockInquiry): MyInquiryListItem {
  const { phone: _phone, ...agency } = agencyRef(i.agencyId);
  const last = i.messages[i.messages.length - 1];
  return {
    id: i.id,
    agency,
    listing: i.listing,
    status: i.status,
    preview: (last?.body ?? i.message ?? '').slice(0, 120),
    replyCount: i.messages.filter((m) => m.author === InquiryAuthor.AGENCY).length,
    hasUnreadReply: hasUnreadReply(i),
    lastMessageAt: i.lastMessageAt,
    createdAt: i.createdAt,
  };
}

export function myInquiryDetail(i: MockInquiry): MyInquiryDetail {
  return {
    id: i.id,
    agency: agencyRef(i.agencyId),
    listing: i.listing,
    status: i.status,
    name: i.customerName,
    phone: i.customerPhone,
    message: i.message ?? '',
    messages: i.messages,
    createdAt: i.createdAt,
  };
}

/** The mock member's own written inquiries (MY > 문의 내역). */
export function myInquiries(role: MockRole): MockInquiry[] {
  return inquiryStore()
    .items.filter((i) => i.owner === role && i.channel === 'MESSAGE' && !i.deletedAt)
    .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

// ---------- notifications ----------

type NotificationSeed = Pick<Notification, 'type' | 'title' | 'body' | 'data'>;

function pushFeed(role: MockRole, n: NotificationSeed, createdAt = new Date().toISOString()) {
  const feed = meState(role).notifications;
  feed.push({
    ...n,
    id: mockUuid(`inquiry-notification-${role}-${feed.length}-${createdAt}`),
    readAt: null,
    createdAt,
  });
  feed.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const CONSOLE_ROLES: MockRole[] = ['AGENT', 'AGENCY_OWNER'];

function receivedNotification(i: MockInquiry, followUp: boolean): NotificationSeed {
  const who = i.customerName ? `${i.customerName} 님` : '비회원 고객';
  const about = i.listing ? i.listing.title : '사무소';
  const text = (followUp ? i.messages[i.messages.length - 1]?.body : i.message) ?? '';
  return {
    type: NotificationType.INQUIRY_RECEIVED,
    title: followUp ? `${who}이 추가 문의를 남겼어요` : `${about} 문의가 도착했어요`,
    body: `${who} — “${text.slice(0, 60)}${text.length > 60 ? '…' : ''}”`,
    data: { agencyId: i.agencyId, inquiryId: i.id, ...(followUp ? { followUp: true } : {}) },
  };
}

/** The office members (both console roles of the mock office) learn about a new / follow-up text. */
export function notifyOffice(i: MockInquiry, followUp = false) {
  if (i.agencyId !== MY_AGENCY_ID) return;
  for (const role of CONSOLE_ROLES) {
    ensureInquiryNotifications(role);
    pushFeed(role, receivedNotification(i, followUp));
  }
}

/** The customer (a mock member) learns that the office answered. No `agencyId` in data (§1.1). */
export function notifyCustomer(i: MockInquiry) {
  if (!i.owner) return;
  const agencyName = agencyRef(i.agencyId).name;
  pushFeed(i.owner, {
    type: NotificationType.INQUIRY_REPLIED,
    title: `${agencyName}에서 문의에 답변했어요`,
    body: i.messages[i.messages.length - 1]?.body.slice(0, 80) ?? null,
    data: { inquiryId: i.id, agencyName },
  });
}

/**
 * Seeded inquiry notifications, once per role: the console roles get "문의 도착" rows for the two
 * unread texts (after the agency feed is set up, which replaces the role's feed once); the mock
 * USER gets the reply notification of inq-u1.
 */
export function ensureInquiryNotifications(role: MockRole) {
  const s = inquiryStore();
  if (s.notified[role]) return;
  s.notified[role] = true;
  if (role === 'USER') {
    const answered = s.items.find((i) => i.id === 'inq-u1');
    if (answered) {
      const agencyName = agencyRef(answered.agencyId).name;
      pushFeed(
        'USER',
        {
          type: NotificationType.INQUIRY_REPLIED,
          title: `${agencyName}에서 문의에 답변했어요`,
          body: answered.messages[0]?.body.slice(0, 80) ?? null,
          data: { inquiryId: answered.id, agencyName },
        },
        answered.lastMessageAt,
      );
    }
    return;
  }
  ensureAgencyNotifications(role);
  for (const id of ['inq-01', 'inq-02']) {
    const i = s.items.find((x) => x.id === id);
    if (i) pushFeed(role, receivedNotification(i, false), i.createdAt);
  }
}

// ---------- request helpers ----------

type Guarded = { role: MockRole | null; fail?: undefined } | { fail: NextResponse };

/** Public inquiry endpoints: mock on; a signed-in caller must send the CSRF header. */
export function publicGuard(req: NextRequest): Guarded {
  const off = mockGuard();
  if (off) return { fail: off };
  const role = mockSessionRole(req);
  if (role && !mockCsrfOk(req))
    return {
      fail: mockError(
        403,
        'CSRF_FAILED',
        '요청이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
      ),
    };
  if (role) ensureInquiryNotifications(role);
  return { role };
}

type MeGuarded = { role: MockRole; fail?: undefined } | { fail: NextResponse };

/** /me/inquiries handlers: mock on → signed in → CSRF header on mutations. */
export function memberGuard(req: NextRequest, options: { mutation?: boolean } = {}): MeGuarded {
  const off = mockGuard();
  if (off) return { fail: off };
  const role = mockSessionRole(req);
  if (!role) return { fail: mockUnauthenticated() };
  if (options.mutation && !mockCsrfOk(req))
    return {
      fail: mockError(
        403,
        'CSRF_FAILED',
        '요청이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
      ),
    };
  ensureInquiryNotifications(role);
  return { role };
}

export const inquiryNotFound = () =>
  mockError(404, 'INQUIRY_NOT_FOUND', '문의를 찾을 수 없습니다.');

/** Zod issues → the API's VALIDATION_FAILED body. */
export function validationFailed(issues: readonly { path: PropertyKey[]; message: string }[]) {
  return mockError(
    400,
    'VALIDATION_FAILED',
    '입력값을 확인해 주세요.',
    issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
  );
}

/** KST calendar day (daily cap bucket). */
export function kstDay(now = Date.now()): string {
  return new Date(now + 9 * HOUR).toISOString().slice(0, 10);
}

export const forcedFailure = (req: NextRequest): NextResponse | null =>
  req.nextUrl.searchParams.get('_fail') === '1'
    ? mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.')
    : null;
