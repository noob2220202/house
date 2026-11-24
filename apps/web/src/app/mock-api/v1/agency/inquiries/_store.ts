import type { Inquiry, InquiryChannel, InquiryStatus } from '@/features/a-inbox/api/schemas';
import { mockError, mockUuid, type MockRole } from '@/lib/mock';
import { officeListing } from '../deal-requests/_listings';

/**
 * Inquiries of the mock office (ASSUMED resource — there is no inquiry backend yet; see
 * docs/frontend-integration/a-inbox.md). MESSAGE rows are texts customers left; CALL / SMS / COPY
 * rows are contact actions on a listing or the office page. The first three match the a-agency
 * dashboard feed (inq-01 … inq-03, two unread). Kept on `globalThis`; a restart resets it.
 */
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

interface Seed {
  id: string;
  channel: InquiryChannel;
  /** Listing code (L01 …) or null for the office page. */
  listing: string | null;
  customer: string | null;
  age: number;
  status: InquiryStatus;
  message?: string;
  unread?: boolean;
  memo?: string;
  handledBy?: string;
  replies?: { message: string; memberName: string; age: number }[];
}

const SEEDS: Seed[] = [
  {
    id: 'inq-01',
    channel: 'MESSAGE',
    listing: 'L01',
    customer: '박*연',
    age: 25 * MIN,
    status: 'NEW',
    unread: true,
    message: '이번 주 토요일 오전에 집 볼 수 있을까요? 잔금은 2월 말 생각하고 있어요.',
  },
  {
    id: 'inq-04',
    channel: 'CALL',
    listing: 'L01',
    customer: '김*우',
    age: 70 * MIN,
    status: 'IN_PROGRESS',
    memo: '오후 3시 통화. 토요일 2시 방문 예약, 배우자와 함께 오실 예정.',
    handledBy: '오세린',
  },
  {
    id: 'inq-02',
    channel: 'MESSAGE',
    listing: 'L06',
    customer: '이*호',
    age: 3 * HOUR,
    status: 'NEW',
    unread: true,
    message: '확장 여부와 관리비가 어느 정도 나오는지 궁금합니다.',
  },
  { id: 'inq-05', channel: 'SMS', listing: 'L17', customer: null, age: 4 * HOUR, status: 'NEW' },
  {
    id: 'inq-06',
    channel: 'COPY',
    listing: 'L02',
    customer: '정*아',
    age: 6 * HOUR,
    status: 'NEW',
  },
  {
    id: 'inq-03',
    channel: 'MESSAGE',
    listing: 'L02',
    customer: '최*원',
    age: 1 * DAY + 5 * HOUR,
    status: 'DONE',
    message: '중도금 대출 승계 조건 알려 주세요.',
    handledBy: '김서진',
    replies: [
      {
        message:
          '안녕하세요, 신대중앙 김서진입니다. 중도금 60% 무이자 대출은 그대로 승계 가능합니다. 승계 절차와 필요한 서류는 전화로 자세히 안내해 드리겠습니다.',
        memberName: '김서진',
        age: 1 * DAY + 3 * HOUR,
      },
    ],
  },
  {
    id: 'inq-07',
    channel: 'CALL',
    listing: null,
    customer: '한*민',
    age: 1 * DAY + 8 * HOUR,
    status: 'DONE',
    memo: '신대지구 1층 상가 임대 문의. 조건에 맞는 매물이 없어 대기 고객으로 등록.',
    handledBy: '김서진',
  },
  {
    id: 'inq-08',
    channel: 'CALL',
    listing: 'L12',
    customer: null,
    age: 2 * DAY,
    status: 'DONE',
    memo: '입주 가능일 문의. 2월 초 가능하다고 안내.',
    handledBy: '오세린',
  },
  {
    id: 'inq-09',
    channel: 'MESSAGE',
    listing: 'L11',
    customer: '송*은',
    age: 2 * DAY + 3 * HOUR,
    status: 'IN_PROGRESS',
    message: '소형견 한 마리를 키우는데 입주 가능할까요? 보증금 조정도 되는지 궁금합니다.',
    memo: '임대인에게 반려동물 가능 여부 확인 중.',
    handledBy: '오세린',
  },
  {
    id: 'inq-10',
    channel: 'SMS',
    listing: 'L21',
    customer: '조*현',
    age: 3 * DAY,
    status: 'DONE',
    memo: '문자로 방문 일정 조율, 일요일 11시 방문 완료.',
    handledBy: '오세린',
  },
  {
    id: 'inq-11',
    channel: 'COPY',
    listing: 'L06',
    customer: null,
    age: 3 * DAY + 5 * HOUR,
    status: 'NEW',
  },
  {
    id: 'inq-12',
    channel: 'CALL',
    listing: 'L15',
    customer: '유*진',
    age: 4 * DAY,
    status: 'DONE',
    memo: '가계약금 입금. 12월 5일 잔금 예정.',
    handledBy: '김서진',
  },
  {
    id: 'inq-13',
    channel: 'MESSAGE',
    listing: 'L20',
    customer: '신*철',
    age: 5 * DAY,
    status: 'DONE',
    message: '권리금이 있나요? 업종 제한이 있는지도 알려 주세요.',
    handledBy: '김서진',
    replies: [
      {
        message:
          '시설 권리금은 협의 가능하며, 같은 건물에 카페가 있어 카페 업종만 제한됩니다. 현장 안내 가능하니 편하신 시간 알려 주세요.',
        memberName: '김서진',
        age: 4 * DAY + 20 * HOUR,
      },
    ],
  },
  {
    id: 'inq-14',
    channel: 'CALL',
    listing: 'L18',
    customer: null,
    age: 6 * DAY,
    status: 'DONE',
    handledBy: '오세린',
  },
  {
    id: 'inq-15',
    channel: 'COPY',
    listing: 'L22',
    customer: '홍*기',
    age: 6 * DAY + 7 * HOUR,
    status: 'NEW',
  },
];

function seed(): Inquiry[] {
  return SEEDS.map((s) => {
    const createdAt = ago(s.age);
    return {
      id: s.id,
      channel: s.channel,
      listing: s.listing ? (officeListing(mockUuid(s.listing)) ?? null) : null,
      customerName: s.customer,
      message: s.message ?? null,
      status: s.status,
      memo: s.memo ?? null,
      handledByName: s.handledBy ?? null,
      readAt: s.unread ? null : ago(Math.max(0, s.age - 20 * MIN)),
      createdAt,
      // Written answers only make sense for messages left on the site.
      canReply: s.channel === 'MESSAGE',
      replies: (s.replies ?? []).map((r, i) => ({
        id: `${s.id}-reply-${i + 1}`,
        message: r.message,
        memberName: r.memberName,
        createdAt: ago(r.age),
      })),
    };
  });
}

const KEY = '__houseMockAgencyInquiries_v1';

export function inquiryStore(): { items: Inquiry[] } {
  const g = globalThis as typeof globalThis & { [KEY]?: { items: Inquiry[] } };
  g[KEY] ??= { items: seed() };
  return g[KEY];
}

export function findInquiry(id: string): Inquiry | undefined {
  return inquiryStore().items.find((i) => i.id === id);
}

export function unreadInquiryCount(): number {
  return inquiryStore().items.filter((i) => !i.readAt).length;
}

export const MEMBER_NAME: Record<MockRole, string> = {
  USER: '김서진',
  AGENT: '오세린',
  AGENCY_OWNER: '김서진',
};

export const inquiryNotFound = () => mockError(404, 'NOT_FOUND', '문의를 찾을 수 없습니다.');
