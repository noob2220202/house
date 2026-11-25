import type {
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealType,
  ProposalStatus,
} from '@house/shared';
import type {
  AdminDealRequestDetail,
  AdminDealRequestListItem,
} from '@/features/m-moderation/api/schemas';
import { ago, dateFromNow, mid, mockTable } from '@/features/m-moderation/mock/handler';
import { AGENCY_ID, agenciesDb } from '../agencies/_fixtures';
import { memberId, usersDb } from '../users/_fixtures';

type AgencyKey = keyof typeof AGENCY_ID;

interface Seed {
  n: number;
  type: DealRequestType;
  asset: AssetType;
  deals: DealType[];
  status?: DealRequestStatus;
  member: number;
  /** Age: [days, hours, minutes]. */
  age: [number, number, number];
  // 내놓기
  complex?: string;
  emd?: string;
  road?: string;
  detail?: string;
  excl?: number;
  floor?: number;
  sale?: number;
  deposit?: number;
  rent?: number;
  // 구하기
  regions?: string[];
  priceMax?: number;
  depositMax?: number;
  rentMax?: number;
  areaMin?: number;
  areaMax?: number;
  rooms?: number;
  moveInDays?: number;
  description?: string;
  targets: AgencyKey[];
  selected?: boolean;
  proposals?: [AgencyKey, ProposalStatus, string][];
  grants?: AgencyKey[];
  spam?: { flagged: boolean; reason?: string; signals: string[] };
  closeReason?: string;
}

const SINDAE: AgencyKey[] = ['B01', 'B05', 'B03', 'B02'];

const SEEDS: Seed[] = [
  {
    n: 1,
    type: 'SELL_OR_LEASE',
    asset: 'APT',
    deals: ['SALE'],
    member: 0,
    age: [0, 0, 12],
    complex: '신대 레이크파크 1단지',
    emd: '해룡면 신대리',
    road: '순천시 해룡면 신대1로 60',
    detail: '103동 고층',
    excl: 84.98,
    floor: 21,
    sale: 45000,
    description:
      '내년 2월 이사 예정이라 그 전에 매도하고 싶어요. 주말 오후에 집 보여 드릴 수 있습니다.',
    targets: SINDAE,
  },
  {
    n: 2,
    type: 'WANTED',
    asset: 'APT',
    deals: ['SALE'],
    member: 1,
    age: [0, 0, 38],
    regions: ['신대지구', '선월지구'],
    priceMax: 45000,
    areaMin: 84,
    areaMax: 85,
    rooms: 3,
    moveInDays: 120,
    description: '2027년 봄 입주 희망합니다. 초등학교 도보권이면 좋겠어요.',
    targets: SINDAE,
  },
  {
    n: 3,
    type: 'SELL_OR_LEASE',
    asset: 'APT',
    deals: ['JEONSE'],
    member: 2,
    age: [0, 1, 4],
    complex: '오천 그린빌',
    emd: '오천동',
    road: '순천시 오천동 오천2길 31',
    detail: '107동 중층',
    excl: 59.8,
    floor: 7,
    deposit: 19000,
    description: '세입자 만기가 1월 말입니다. 전세 재계약 대신 새 세입자를 구해요.',
    targets: ['B04', 'B02'],
    proposals: [
      [
        'B04',
        'VIEWED',
        '오천 그린빌 전세 대기 손님이 두 팀 있습니다. 내일 오전 통화 가능하실까요?',
      ],
      ['B02', 'SENT', '최근 같은 평형 전세 1억 9,500에 계약됐습니다. 시세 자료 보내 드릴게요.'],
    ],
  },
  {
    n: 4,
    type: 'WANTED',
    asset: 'ONEROOM',
    deals: ['MONTHLY'],
    member: 4,
    age: [0, 2, 9],
    regions: ['석현동'],
    depositMax: 500,
    rentMax: 40,
    moveInDays: 30,
    description: '순천대 정문에서 걸어서 10분 이내, 2층 이상 원룸이나 투룸 찾습니다.',
    targets: ['B06', 'B02', 'B08', 'B04'],
  },
  {
    n: 5,
    type: 'SELL_OR_LEASE',
    asset: 'APT',
    deals: ['SALE'],
    member: 8,
    age: [0, 3, 2],
    complex: '왕지 숲속마을',
    emd: '왕지동',
    road: '순천시 왕지동 왕지2로 50',
    detail: '104동 고층',
    excl: 59.9,
    floor: 13,
    sale: 24000,
    targets: ['B08', 'B02'],
    proposals: [
      ['B08', 'SENT', '왕지 숲속마을 25평 매수 문의가 꾸준합니다. 방문 상담 드리고 싶습니다.'],
    ],
  },
  {
    n: 6,
    type: 'SELL_OR_LEASE',
    asset: 'APT',
    deals: ['MONTHLY'],
    member: 11,
    age: [0, 6, 20],
    complex: '조례 호수마을',
    emd: '조례동',
    road: '순천시 조례동 호수공원길 11',
    detail: '102동 저층',
    excl: 59.9,
    floor: 3,
    deposit: 2000,
    rent: 65,
    targets: ['B02', 'B08', 'B03'],
    proposals: [
      ['B02', 'ACCEPTED', '호수마을 월세 손님 바로 연결 가능합니다.'],
      ['B08', 'VIEWED', '조례동 월세 수요 많습니다. 사진 촬영 도와드릴게요.'],
      ['B03', 'SENT', '연향·조례 월세 전문입니다.'],
    ],
    grants: ['B02'],
  },
  {
    n: 7,
    type: 'WANTED',
    asset: 'ONEROOM',
    deals: ['MONTHLY'],
    member: 7,
    age: [0, 5, 0],
    regions: ['석현동', '덕월동', '장천동', '매곡동', '조례동'],
    rentMax: 20,
    description:
      '보증금 없이 당일 입주 가능한 방 구합니다. 급하신 집주인분 오픈채팅 「순천방구함」으로 바로 연락 주세요. 대출 상담도 해 드립니다.',
    targets: ['B06', 'B02', 'B08', 'B04'],
    spam: {
      flagged: false,
      signals: [
        '24시간 안에 같은 회원이 5건 등록',
        '본문에 외부 연락 유도 문구(오픈채팅) 포함',
        '희망 금액이 지역 시세 하한보다 낮음',
      ],
    },
  },
  {
    n: 8,
    type: 'WANTED',
    asset: 'ONEROOM',
    deals: ['MONTHLY'],
    member: 7,
    age: [0, 9, 30],
    regions: ['석현동', '덕월동', '장천동'],
    rentMax: 20,
    description:
      '보증금 없이 당일 입주 가능한 방 구합니다. 오픈채팅 「순천방구함」. 대출 상담 가능.',
    targets: ['B06', 'B08'],
    spam: {
      flagged: true,
      reason: '대출 광고성 문구와 외부 연락 유도가 포함된 반복 등록입니다.',
      signals: ['24시간 안에 같은 회원이 5건 등록', '본문에 외부 연락 유도 문구(오픈채팅) 포함'],
    },
  },
  {
    n: 9,
    type: 'WANTED',
    asset: 'APT',
    deals: ['JEONSE', 'MONTHLY'],
    status: 'MATCHED',
    member: 13,
    age: [1, 4, 0],
    regions: ['연향동', '조례동'],
    depositMax: 25000,
    areaMin: 59,
    areaMax: 85,
    rooms: 3,
    moveInDays: 45,
    description: '아이 학교 때문에 연향초 근처를 선호해요.',
    targets: ['B03', 'B02', 'B07', 'B08'],
    proposals: [
      ['B03', 'ACCEPTED', '연향 센트럴 32평 전세 2억 4,000 매물 추천드립니다.'],
      ['B02', 'DECLINED', '조례 호수마을 전세 1억 9,000 있습니다.'],
      ['B07', 'VIEWED', '금당 리버뷰 전세 매물 안내드려요.'],
      ['B08', 'WITHDRAWN', '왕지 숲속마을 전세 1억 6,500.'],
    ],
    grants: ['B03'],
  },
  {
    n: 10,
    type: 'SELL_OR_LEASE',
    asset: 'HOUSE',
    deals: ['SALE'],
    member: 15,
    age: [2, 3, 0],
    emd: '왕지동',
    road: '순천시 왕지동 왕지4길 12',
    excl: 132.2,
    floor: 1,
    sale: 39000,
    description: '마당 있는 2층 단독주택입니다. 급하지 않아 제값 받고 싶어요.',
    targets: ['B08', 'B04'],
    selected: true,
    proposals: [['B08', 'VIEWED', '주택 전문으로 현장 확인 후 적정 가격 상담드리겠습니다.']],
  },
  {
    n: 11,
    type: 'WANTED',
    asset: 'COMMERCIAL',
    deals: ['MONTHLY'],
    status: 'CLOSED',
    member: 16,
    age: [3, 6, 0],
    regions: ['연향동'],
    depositMax: 3000,
    rentMax: 200,
    areaMin: 40,
    areaMax: 66,
    description: '카페 창업용 1층 상가를 찾습니다.',
    targets: ['B03', 'B07'],
    proposals: [['B03', 'ACCEPTED', '패션거리 1층 코너 상가 49.5㎡ 추천드립니다.']],
    grants: ['B03'],
    closeReason: '요청자가 계약을 마치고 직접 종료했습니다.',
  },
  {
    n: 12,
    type: 'WANTED',
    asset: 'APT',
    deals: ['PRESALE'],
    status: 'CANCELLED',
    member: 19,
    age: [4, 2, 0],
    regions: ['선월지구'],
    priceMax: 42000,
    areaMin: 84,
    areaMax: 85,
    targets: ['B05', 'B01'],
  },
  {
    n: 13,
    type: 'SELL_OR_LEASE',
    asset: 'LAND',
    deals: ['SALE'],
    status: 'EXPIRED',
    member: 21,
    age: [36, 1, 0],
    emd: '별량면 덕정리',
    road: '순천시 별량면 덕정길 일대',
    excl: 482,
    sale: 9800,
    description: '계획관리지역 밭입니다.',
    targets: ['B08'],
  },
  {
    n: 14,
    type: 'WANTED',
    asset: 'APT',
    deals: ['SALE'],
    // A withdrawn member's request (requester.status WITHDRAWN, nickname null).
    member: 12,
    age: [0, 20, 0],
    regions: ['오천지구'],
    priceMax: 30000,
    areaMin: 59,
    areaMax: 60,
    rooms: 3,
    moveInDays: 90,
    targets: ['B04', 'B02'],
    proposals: [['B04', 'SENT', '오천 그린빌 24평 2억 5,200 매물 있습니다.']],
  },
];

function build(s: Seed): AdminDealRequestDetail {
  const id = mid('d3', s.n);
  const agencies = agenciesDb();
  const office = (key: AgencyKey) => agencies.find((a) => a.id === AGENCY_ID[key])!;
  const user = usersDb().find((u) => u.id === memberId(s.member));
  const [d, h, m] = s.age;
  const createdAt = ago({ d, h, m });
  const status = s.status ?? 'OPEN';
  const proposals = (s.proposals ?? []).map(([key, pStatus, message], i) => ({
    id: mid('d2', s.n * 10 + i),
    agencyId: AGENCY_ID[key],
    agencyName: office(key).name,
    status: pStatus,
    message,
    listingCount: (s.n + i) % 3,
    createdAt: ago({ d, h: Math.max(0, h - 1 - i), m: Math.max(1, m - 5 * (i + 1)) }),
  }));
  const history: AdminDealRequestDetail['history'] = [];
  const add = (
    action: string,
    when: string,
    actorName: string | null,
    note: string | null = null,
  ) =>
    history.push({
      id: mid('d1', s.n * 20 + history.length),
      action,
      actorName,
      note,
      createdAt: when,
    });
  if (s.spam?.flagged)
    add('DEAL_REQUEST_SPAM_FLAGGED', ago({ h: 4 }), '한지우', s.spam.reason ?? null);
  if (status === 'CLOSED')
    add(
      'DEAL_REQUEST_CLOSED',
      ago({ d: Math.max(0, d - 2), h: 2 }),
      '한지우',
      s.closeReason ?? null,
    );
  if (status === 'CANCELLED')
    add('DEAL_REQUEST_CANCELLED', ago({ d: Math.max(0, d - 1), h: 2 }), null);
  if (status === 'EXPIRED')
    add('DEAL_REQUEST_EXPIRED', ago({ d: Math.max(0, d - 30) }), null, '등록 후 30일 경과');
  if (status === 'MATCHED') add('DEAL_REQUEST_MATCHED', ago({ h: 6 }), null);
  (s.grants ?? []).forEach((key) =>
    add('CONTACT_GRANTED', ago({ d: Math.max(0, d - 1), h: Math.max(1, h - 2) }), office(key).name),
  );
  proposals.forEach((p) => add('PROPOSAL_SENT', p.createdAt, p.agencyName));
  add('DEAL_REQUEST_CREATED', createdAt, null);
  history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    id,
    type: s.type,
    status,
    assetType: s.asset,
    dealTypes: s.deals,
    visibility: s.selected ? 'SELECTED_AGENCIES' : 'ALL_AGENCIES_IN_REGION',
    complexName: s.complex ?? null,
    emdName: s.emd ?? null,
    roadAddress: s.road ?? null,
    addressDetail: s.detail ?? null,
    exclusiveArea: s.excl ?? null,
    floor: s.floor ?? null,
    desiredSalePrice: s.sale ?? null,
    desiredDeposit: s.deposit ?? null,
    desiredMonthlyRent: s.rent ?? null,
    regionNames: s.regions ?? [],
    priceMin: null,
    priceMax: s.priceMax ?? null,
    depositMin: null,
    depositMax: s.depositMax ?? null,
    rentMin: null,
    rentMax: s.rentMax ?? null,
    areaMin: s.areaMin ?? null,
    areaMax: s.areaMax ?? null,
    roomsMin: s.rooms ?? null,
    moveInDate: s.moveInDays ? dateFromNow(s.moveInDays) : null,
    description: s.description ?? null,
    targetAgencyCount: s.targets.length,
    proposalCount: proposals.length,
    // Real API: the requester summary; a withdrawn member has no nickname.
    requester: {
      id: memberId(s.member),
      nickname: user?.status === 'WITHDRAWN' ? null : (user?.nickname ?? null),
      status: user?.status ?? 'ACTIVE',
      createdAt: user?.createdAt ?? null,
      dealRequestCount: Math.max(
        SEEDS.filter((x) => x.member === s.member).length,
        user?.activity?.dealRequestCount ?? 0,
      ),
    },
    contactName: user?.name ?? '요청자',
    contactPhone: `0100000${String(2000 + s.n).slice(-4)}`,
    spamFlaggedAt: s.spam?.flagged ? ago({ h: 4 }) : null,
    spamReason: s.spam?.flagged ? (s.spam.reason ?? null) : null,
    spamSignals: s.spam?.signals ?? [],
    spamSignalCount: s.spam?.signals.length ?? 0,
    closeReason: s.closeReason ?? null,
    createdAt,
    expiresAt: ago({ d: d - 30, h }),
    closedAt: status === 'CLOSED' ? ago({ d: Math.max(0, d - 2), h: 2 }) : null,
    targets: s.targets.map((key) => ({ agencyId: AGENCY_ID[key], name: office(key).name })),
    proposals,
    contactGrants: (s.grants ?? []).map((key) => ({
      agencyId: AGENCY_ID[key],
      agencyName: office(key).name,
      grantedAt: ago({ d: Math.max(0, d - 1), h: Math.max(1, h - 2) }),
    })),
    history,
  };
}

export function dealRequestsDb(): AdminDealRequestDetail[] {
  return mockTable('deal-requests', () =>
    SEEDS.map(build).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function toDealRequestListItem(r: AdminDealRequestDetail): AdminDealRequestListItem {
  /* eslint-disable @typescript-eslint/no-unused-vars -- strip the detail-only fields */
  const {
    contactPhone,
    description,
    roadAddress,
    addressDetail,
    floor,
    roomsMin,
    moveInDate,
    spamReason,
    spamSignals,
    closeReason,
    targets,
    proposals,
    contactGrants,
    history,
    ...item
  } = r;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return item;
}

export function addDealRequestHistory(
  r: AdminDealRequestDetail,
  action: string,
  actorName: string,
  note: string | null,
): void {
  r.history.unshift({
    id: mid('d1', 900_000 + r.history.length + (Date.now() % 10_000)),
    action,
    actorName,
    note,
    createdAt: new Date().toISOString(),
  });
}
