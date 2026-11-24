import {
  DEFAULT_SGG_CODE,
  ListingStatus,
  type AgencyDisclosure,
  type AssetType,
  type DealRequestPhotoView,
  type DealType,
  type MyDealRequestDetail,
  type MyDealRequestView,
  type ProposalListingView,
  type ProposalView,
} from '@house/shared';
import { mockUuid } from '@/lib/mock';
import { AGENCIES, agencyByKey, COMPLEXES, SINDAE, type MockAgency } from './_fixtures';

/**
 * In-memory state of the deal-requests mock, kept on globalThis so every route handler bundle
 * (and hot reloads) share it. Restarting the dev server resets it to the seed.
 */
export interface MockProposal {
  id: string;
  dealRequestId: string;
  agencyId: string;
  memberName: string | null;
  message: string;
  status: 'SENT' | 'VIEWED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
  listings: Record<string, unknown>[];
  createdAt: string;
  viewedAt: string | null;
  respondedAt: string | null;
}

export interface MockDealRequest {
  id: string;
  userId: string;
  type: 'SELL_OR_LEASE' | 'WANTED';
  status: 'OPEN' | 'MATCHED' | 'CLOSED' | 'CANCELLED' | 'EXPIRED';
  assetType: string;
  dealTypes: string[];
  visibility: 'ALL_AGENCIES_IN_REGION' | 'SELECTED_AGENCIES';
  targetAgencyIds: string[];
  targetAgencyCount: number;
  contactName: string;
  contactPhone: string;
  description: string | null;
  roadAddress: string | null;
  addressDetail: string | null;
  emdCode: string | null;
  emdName: string | null;
  complexId: string | null;
  complexName: string | null;
  exclusiveArea: number | null;
  floor: number | null;
  desiredSalePrice: number | null;
  desiredDeposit: number | null;
  desiredMonthlyRent: number | null;
  photos: Record<string, unknown>[];
  regionCodes: string[];
  complexIds: string[];
  priceMin: number | null;
  priceMax: number | null;
  depositMin: number | null;
  depositMax: number | null;
  rentMin: number | null;
  rentMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  roomsMin: number | null;
  moveInDate: string | null;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  proposals: MockProposal[];
  /** agencyId → grantedAt */
  grants: Record<string, string>;
}

interface Store {
  requests: MockDealRequest[];
  seq: number;
}

type RequestDefaults = Omit<
  MockDealRequest,
  'id' | 'userId' | 'type' | 'status' | 'assetType' | 'dealTypes' | 'createdAt' | 'updatedAt'
>;

/** Fresh defaults per request — the arrays / grant map are mutated by handlers, never share them. */
export const emptyRequest = (): RequestDefaults => ({
  visibility: 'ALL_AGENCIES_IN_REGION',
  targetAgencyIds: [],
  targetAgencyCount: 0,
  contactName: '김하늘',
  contactPhone: '01000001234',
  description: null,
  roadAddress: null,
  addressDetail: null,
  emdCode: null,
  emdName: null,
  complexId: null,
  complexName: null,
  exclusiveArea: null,
  floor: null,
  desiredSalePrice: null,
  desiredDeposit: null,
  desiredMonthlyRent: null,
  photos: [],
  regionCodes: [],
  complexIds: [],
  priceMin: null,
  priceMax: null,
  depositMin: null,
  depositMax: null,
  rentMin: null,
  rentMax: null,
  areaMin: null,
  areaMax: null,
  roomsMin: null,
  moveInDate: null,
  expiresAt: null,
  closedAt: null,
  proposals: [],
  grants: {},
});

/** ISO time `days` days and `hours` hours before the fixture "now" (2026-11-23 15:42 KST). */
const ago = (days: number, hours = 0) =>
  new Date(Date.parse('2026-11-23T15:42:00+09:00') - (days * 24 + hours) * 3_600_000).toISOString();
const ahead = (days: number) =>
  new Date(Date.parse('2026-11-23T15:42:00+09:00') + days * 86_400_000).toISOString();

const listing = (
  key: string,
  title: string,
  dealType: string,
  price: number,
  exclusiveArea: number,
  floorLabel: string,
  assetType = 'APT',
) => ({
  // Canonical listing id of the listings mock (mockListingId).
  id: mockUuid(key),
  title,
  assetType,
  dealType,
  price: dealType === 'MONTHLY' ? null : price,
  deposit: null,
  monthlyRent: null,
  exclusiveArea,
  floorLabel,
  thumbUrl: null,
});

const proposal = (
  requestKey: string,
  agencyKey: string,
  p: Partial<MockProposal> & Pick<MockProposal, 'message' | 'status' | 'createdAt'>,
): MockProposal => ({
  id: mockUuid(`proposal-${requestKey}-${agencyKey}`),
  dealRequestId: mockUuid(`deal-request-${requestKey}`),
  agencyId: agencyByKey(agencyKey).id,
  memberName: agencyByKey(agencyKey).representativeName,
  listings: [],
  viewedAt: null,
  respondedAt: null,
  ...p,
});

function seed(userId: string): MockDealRequest[] {
  const c01 = COMPLEXES[0];
  return [
    {
      ...emptyRequest(),
      id: mockUuid('deal-request-S1'),
      userId,
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      targetAgencyCount: 12,
      description:
        '· 중층 (총 25층)\n· 가격 협의 가능\n· 입주일 협의 가능\n\n남향, 2024년에 주방과 욕실을 수리했습니다. 평일 저녁이나 주말에 집 보기 가능합니다.',
      roadAddress: '전남 순천시 해룡면 신대2로 40',
      addressDetail: '103동 1502호',
      emdCode: SINDAE,
      emdName: '해룡면 신대리',
      complexId: c01?.id ?? null,
      complexName: c01?.name ?? null,
      exclusiveArea: 84.98,
      // The 호-derived floor of a complex unit is private (sent only as the 저/중/고 line above).
      floor: null,
      desiredSalePrice: 44500,
      moveInDate: '2027-02-15',
      expiresAt: ahead(26),
      createdAt: ago(4),
      updatedAt: ago(0, 3),
      proposals: [
        proposal('S1', 'B01', {
          status: 'SENT',
          createdAt: ago(0, 3),
          message:
            '안녕하세요, 신대중앙 김서진입니다. 같은 단지 34평을 이번 달에 2건 중개했습니다. 현재 호가라면 4억 4,000 선에서 2~3주 안에 매수자를 연결해 드릴 수 있을 것 같습니다. 사진 촬영과 광고는 저희가 무료로 진행합니다.',
        }),
        proposal('S1', 'B05', {
          status: 'VIEWED',
          createdAt: ago(1, 5),
          viewedAt: ago(1, 2),
          message:
            '선월 분양권 정민재입니다. 선월 하이츠 입주를 앞두고 신대 34평으로 갈아타려는 매수 대기 손님이 2분 계십니다. 희망가 그대로 먼저 보여 드리고 싶습니다. 통화 가능하실 때 연락처 공개 부탁드립니다.',
        }),
        proposal('S1', 'B02', {
          status: 'SENT',
          createdAt: ago(2, 1),
          message:
            '호수공원 공인중개사사무소 한서윤입니다. 중개보수는 법정 상한 요율 이내에서 협의 가능하며, 매도 일정에 맞춰 전세 낀 매매도 함께 알아봐 드리겠습니다.',
        }),
      ],
    },
    {
      ...emptyRequest(),
      id: mockUuid('deal-request-W1'),
      userId,
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      targetAgencyCount: 12,
      description: '초등학교 도보 통학 가능한 동을 원합니다. 2027년 2월 이사 예정입니다.',
      regionCodes: [SINDAE],
      priceMax: 45000,
      areaMin: 82.64,
      areaMax: 115.7,
      roomsMin: 3,
      moveInDate: '2027-02-01',
      expiresAt: ahead(21),
      createdAt: ago(9),
      updatedAt: ago(1, 4),
      proposals: [
        proposal('W1', 'B01', {
          status: 'SENT',
          createdAt: ago(1, 4),
          message:
            '조건에 맞는 매물 2건을 골랐습니다. 103동은 초등학교까지 도보 5분이고, 3단지 39평은 예산을 조금 넘지만 가격 조정 여지가 있습니다.',
          listings: [
            listing('L01', '신대 레이크파크 1단지 103동', 'SALE', 44500, 84.98, '고/25층'),
            listing('L06', '신대 레이크파크 3단지 301동', 'SALE', 46000, 99.12, '중/24층'),
          ],
        }),
        proposal('W1', 'B05', {
          status: 'VIEWED',
          createdAt: ago(3, 2),
          viewedAt: ago(2, 20),
          message:
            '2027년 3월 입주하는 선월 하이츠 2차 33평 분양권도 함께 보시면 좋겠습니다. 프리미엄 포함 4억 1,900입니다.',
          listings: [listing('L02', '선월 하이츠 2차 205동', 'PRESALE', 41900, 84.94, '중/20층')],
        }),
        proposal('W1', 'B03', {
          status: 'DECLINED',
          createdAt: ago(6),
          viewedAt: ago(5, 20),
          respondedAt: ago(5, 19),
          message: '연향 센트럴 32평 전세 매물도 가능하시면 연락 주세요.',
          listings: [listing('L03', '연향 센트럴 108동', 'JEONSE', 24000, 84.72, '중/15층')],
        }),
      ],
    },
    {
      ...emptyRequest(),
      id: mockUuid('deal-request-S2'),
      userId,
      type: 'SELL_OR_LEASE',
      status: 'MATCHED',
      assetType: 'ONEROOM',
      dealTypes: ['MONTHLY'],
      visibility: 'SELECTED_AGENCIES',
      targetAgencyIds: [agencyByKey('B06').id],
      targetAgencyCount: 1,
      description: '· 즉시 입주 가능\n\n투룸, 풀옵션(에어컨·세탁기·냉장고). 순천대 정문 도보 6분.',
      roadAddress: '전남 순천시 대학로 22',
      addressDetail: '해오름빌 302호',
      emdCode: '1215011000',
      emdName: '석현동',
      exclusiveArea: 39.6,
      floor: 3,
      desiredDeposit: 500,
      desiredMonthlyRent: 42,
      expiresAt: ahead(12),
      createdAt: ago(18),
      updatedAt: ago(15),
      proposals: [
        proposal('S2', 'B06', {
          status: 'ACCEPTED',
          createdAt: ago(17, 20),
          viewedAt: ago(17),
          respondedAt: ago(15),
          message:
            '순천대정문 최유나입니다. 신학기 전에 방을 찾는 학생 문의가 많습니다. 사진 촬영 후 바로 광고 올리겠습니다.',
        }),
      ],
      grants: { [agencyByKey('B06').id]: ago(15) },
    },
    {
      ...emptyRequest(),
      id: mockUuid('deal-request-W2'),
      userId,
      type: 'WANTED',
      status: 'CLOSED',
      assetType: 'APT',
      dealTypes: ['JEONSE', 'MONTHLY'],
      targetAgencyCount: 5,
      regionCodes: ['1215012000', '1215012100'],
      depositMax: 20000,
      rentMax: 60,
      areaMin: 59.5,
      roomsMin: 2,
      closedAt: ago(40),
      createdAt: ago(62),
      updatedAt: ago(40),
      proposals: [
        proposal('W2', 'B02', {
          status: 'ACCEPTED',
          createdAt: ago(60),
          viewedAt: ago(59),
          respondedAt: ago(52),
          message: '조례 호수마을 24평 전세 1억 9,000 매물이 있습니다.',
          listings: [listing('L09', '조례 호수마을 102동', 'JEONSE', 19000, 59.9, '저/18층')],
        }),
      ],
    },
    {
      ...emptyRequest(),
      id: mockUuid('deal-request-S3'),
      userId,
      type: 'SELL_OR_LEASE',
      status: 'EXPIRED',
      assetType: 'LAND',
      dealTypes: ['SALE'],
      targetAgencyCount: 4,
      roadAddress: '전남 순천시 왕지2로 61',
      emdCode: '1215012200',
      emdName: '왕지동',
      exclusiveArea: 330.6,
      desiredSalePrice: 21000,
      expiresAt: ago(20),
      createdAt: ago(50),
      updatedAt: ago(20),
    },
  ];
}

const KEY = '__houseMockDealRequests' as const;
type GlobalWithStore = typeof globalThis & { [KEY]?: Store };

export const MOCK_USER_ID = '0b6f2c1e-0000-4000-8000-000000000001';

export function dealStore(): Store {
  const g = globalThis as GlobalWithStore;
  g[KEY] ??= { requests: seed(MOCK_USER_ID), seq: 0 };
  return g[KEY];
}

export function findAgency(id: string): MockAgency | undefined {
  return AGENCIES.find((a) => a.id === id);
}

const publicAgency = (a: MockAgency) => {
  const { serviceCodes: _serviceCodes, ...rest } = a;
  return rest;
};
export { publicAgency };

/** Mock office → `AgencyDisclosure` (표시·광고 명시사항 block of a proposal). */
function disclosureOf(a: MockAgency): AgencyDisclosure {
  return {
    agencyId: a.id,
    name: a.name,
    address: a.roadAddress,
    roadAddress: a.roadAddress,
    phone: a.phone,
    registrationNumber: `46150-2020-${a.id.slice(-5)}`,
    representativeName: a.representativeName,
  };
}

/** Proposal listing fixture → `ProposalListingView`. */
function proposalListingOf(l: Record<string, unknown>): ProposalListingView {
  const price = typeof l.price === 'number' ? l.price : null;
  const dealType = (typeof l.dealType === 'string' ? l.dealType : 'SALE') as DealType;
  return {
    id: typeof l.id === 'string' ? l.id : '',
    title: typeof l.title === 'string' ? l.title : null,
    assetType: (typeof l.assetType === 'string' ? l.assetType : 'APT') as AssetType,
    dealType,
    status: ListingStatus.ACTIVE,
    salePrice: dealType === 'SALE' ? price : null,
    deposit: dealType === 'JEONSE' ? price : typeof l.deposit === 'number' ? l.deposit : null,
    monthlyRent: typeof l.monthlyRent === 'number' ? l.monthlyRent : null,
    presalePrice: dealType === 'PRESALE' ? price : null,
    premium: null,
    exclusiveArea: typeof l.exclusiveArea === 'number' ? l.exclusiveArea : null,
  };
}

/** Proposal → `ProposalView` (deal-requests module, the requester's view). */
function proposalDto(r: MockDealRequest, p: MockProposal): ProposalView {
  const agency = findAgency(p.agencyId);
  return {
    id: p.id,
    dealRequestId: p.dealRequestId,
    status: p.status,
    message: p.message,
    suggestedPrice: null,
    suggestedDeposit: null,
    suggestedMonthlyRent: null,
    agencyId: p.agencyId,
    agency: agency ? disclosureOf(agency) : null,
    agent: p.memberName ? { displayName: p.memberName, phone: null } : null,
    listings: p.listings.map(proposalListingOf),
    contactShared: p.agencyId in r.grants,
    viewedAt: p.viewedAt,
    respondedAt: p.respondedAt,
    createdAt: p.createdAt,
  };
}

/** Offices the request was delivered to (SELECTED: the picked ones; region: the region's). */
function deliveredTo(r: MockDealRequest): string[] {
  if (r.visibility === 'SELECTED_AGENCIES') return [...r.targetAgencyIds];
  const codes = r.type === 'SELL_OR_LEASE' ? (r.emdCode ? [r.emdCode] : []) : r.regionCodes;
  return agenciesFor(codes)
    .slice(0, r.targetAgencyCount || undefined)
    .map((a) => a.id);
}

/** `DealRequestPhotoView` of a stored photo. */
function photoView(m: Record<string, unknown>): DealRequestPhotoView {
  const variants = (m.variants ?? {}) as Record<string, { url?: string } | undefined>;
  const url = variants.medium?.url ?? variants.thumb?.url ?? '';
  return { mediaId: String(m.id), url, thumbUrl: variants.thumb?.url ?? url };
}

/** List item = `MyDealRequestView` (no proposals). */
export function requestDto(r: MockDealRequest): MyDealRequestView {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    assetType: r.assetType as AssetType,
    dealTypes: r.dealTypes as DealType[],
    visibility: r.visibility,
    sggCode: DEFAULT_SGG_CODE,
    emdCode: r.emdCode,
    roadAddress: r.roadAddress,
    complex: r.complexId ? { id: r.complexId, name: r.complexName ?? '' } : null,
    lat: null,
    lng: null,
    exclusiveArea: r.exclusiveArea,
    floor: r.floor,
    desiredSalePrice: r.desiredSalePrice,
    desiredDeposit: r.desiredDeposit,
    desiredMonthlyRent: r.desiredMonthlyRent,
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
    description: r.description,
    photos: r.photos.map(photoView),
    proposalCount: r.proposals.length,
    expiresAt: r.expiresAt,
    closedAt: r.closedAt,
    createdAt: r.createdAt,
    contactName: r.contactName,
    contactPhone: r.contactPhone,
    addressDetail: r.addressDetail,
    targetAgencyIds: deliveredTo(r),
    closeReason: null,
    extensionCount: 0,
    contactGrants: Object.entries(r.grants).map(([agencyId, grantedAt]) => ({
      agencyId,
      agencyName: findAgency(agencyId)?.name ?? null,
      grantedAt,
    })),
  };
}

/** Detail = `MyDealRequestDetail` (with the proposals, newest first). */
export function requestDetailDto(r: MockDealRequest): MyDealRequestDetail {
  return {
    ...requestDto(r),
    proposals: [...r.proposals]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => proposalDto(r, p)),
  };
}

export function proposalDtoById(proposalId: string) {
  for (const r of dealStore().requests) {
    const p = r.proposals.find((x) => x.id === proposalId);
    if (p) return { request: r, proposal: p, dto: () => proposalDto(r, p) };
  }
  return null;
}

/**
 * Agencies that would receive a request for the given region codes. No codes → every agency.
 * Codes the mock does not know (e.g. a real 법정동코드 from the postcode search) fall back to a
 * small default set so the flow stays demonstrable.
 */
export function agenciesFor(codes: readonly string[]): MockAgency[] {
  if (codes.length === 0) return AGENCIES;
  const hit = AGENCIES.filter((a) => a.serviceCodes.some((s) => codes.includes(s)));
  return hit.length > 0 ? hit : AGENCIES.slice(0, 5);
}

export function newRequestId(): string {
  const store = dealStore();
  store.seq += 1;
  return mockUuid(`deal-request-new-${store.seq}-${Date.now()}`);
}
