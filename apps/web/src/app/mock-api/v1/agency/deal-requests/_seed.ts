import type { InboxListing } from '@/features/a-inbox/api/schemas';
import { mockUuid } from '@/lib/mock';
import { agencyByKey, SEONWOL, SINDAE } from '../../deal-requests/_fixtures';
import { emptyRequest, type MockDealRequest, type MockProposal } from '../../deal-requests/_store';
import { officeListing } from './_listings';

/**
 * Seeded requests of other (fictional) people in the inbox of the mock office
 * (B01 신대중앙 공인중개사사무소). Names, numbers and addresses are made up
 * (design/drafts/system/mockdata.md). Ids req-01 … req-04 match the a-agency dashboard feed so its
 * links open the same requests.
 */
export const MY_AGENCY_ID = agencyByKey('B01').id;

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();
const dateAhead = (days: number) =>
  new Date(Date.now() + 9 * HOUR + days * DAY).toISOString().slice(0, 10);

const C01 = { id: mockUuid('C01'), name: '신대 레이크파크 1단지' };
const C03 = { id: mockUuid('C03'), name: '선월 하이츠 2차' };
const C06 = { id: mockUuid('C06'), name: '신대 레이크파크 3단지' };
export const COMPLEX_NAMES = new Map([C01, C03, C06].map((c) => [c.id, c.name]));

/** w-deal's ProposalListing shape (what the requester's page renders). */
export function proposalListing(l: InboxListing): Record<string, unknown> {
  return {
    id: l.id,
    title: l.title,
    assetType: l.assetType,
    dealType: l.dealType,
    price: l.price ?? null,
    deposit: l.deposit ?? null,
    monthlyRent: l.monthlyRent ?? null,
    exclusiveArea: l.exclusiveArea ?? null,
    floorLabel: l.floorLabel ?? null,
    thumbUrl: l.thumbUrl ?? null,
  };
}

function mine(
  requestId: string,
  p: Partial<MockProposal> & Pick<MockProposal, 'message' | 'status' | 'createdAt'>,
  listingCodes: string[] = [],
): MockProposal {
  return {
    id: mockUuid(`proposal-${requestId}-B01`),
    dealRequestId: requestId,
    agencyId: MY_AGENCY_ID,
    memberName: '오세린',
    viewedAt: null,
    respondedAt: null,
    listings: listingCodes
      .map((code) => officeListing(mockUuid(code)))
      .filter((l): l is InboxListing => !!l)
      .map(proposalListing),
    ...p,
  };
}

/** A competing office's proposal — only its existence matters here (proposalCount). */
function other(requestId: string, agencyKey: string, days: number): MockProposal {
  const agency = agencyByKey(agencyKey);
  return {
    id: mockUuid(`proposal-${requestId}-${agencyKey}`),
    dealRequestId: requestId,
    agencyId: agency.id,
    memberName: agency.representativeName,
    message: `${agency.name}입니다. 조건에 맞춰 안내해 드리겠습니다.`,
    status: 'SENT',
    listings: [],
    createdAt: ago(days * DAY + HOUR),
    viewedAt: null,
    respondedAt: null,
  };
}

type Seed = Partial<MockDealRequest> &
  Pick<MockDealRequest, 'id' | 'type' | 'status' | 'assetType' | 'dealTypes' | 'createdAt'>;

function request(seed: Seed): MockDealRequest {
  return {
    ...emptyRequest(),
    userId: mockUuid(`requester-${seed.id}`),
    targetAgencyCount: 12,
    expiresAt: ahead(30 * DAY - (Date.now() - Date.parse(seed.createdAt))),
    updatedAt: seed.createdAt,
    ...seed,
  };
}

const SINDAE_EMD = { emdCode: SINDAE, emdName: '해룡면 신대리' };
const SEONWOL_EMD = { emdCode: SEONWOL, emdName: '해룡면 선월리' };

export function seedInboxRequests(): MockDealRequest[] {
  return [
    // ---- 새 요청 ----
    request({
      id: 'req-01',
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      contactName: '이정훈',
      contactPhone: '01000002211',
      description:
        '· 가격 협의 가능\n\n남향 고층이고 올해 초에 도배·장판을 새로 했습니다. 주말 오후에는 언제든 집 보기 가능합니다.',
      roadAddress: '전남 순천시 해룡면 신대2로 40',
      addressDetail: '103동 1803호',
      ...SINDAE_EMD,
      complexId: C01.id,
      complexName: C01.name,
      exclusiveArea: 84.98,
      floor: 18,
      desiredSalePrice: 45000,
      moveInDate: dateAhead(88),
      createdAt: ago(12 * MIN),
      proposals: [other('req-01', 'B09', 0)],
    }),
    request({
      id: 'req-02',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['SALE'],
      contactName: '정다은',
      contactPhone: '01000004570',
      description:
        '아이가 내년에 초등학교에 들어가서 학교 가까운 동이면 좋겠습니다. 2027년 봄 입주를 생각하고 있어요.',
      regionCodes: [SINDAE],
      priceMax: 45000,
      areaMin: 82.64,
      areaMax: 115.7,
      roomsMin: 3,
      moveInDate: dateAhead(97),
      createdAt: ago(38 * MIN),
    }),
    request({
      id: 'req-03',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['PRESALE'],
      visibility: 'SELECTED_AGENCIES',
      targetAgencyIds: [MY_AGENCY_ID, agencyByKey('B05').id, agencyByKey('B11').id],
      targetAgencyCount: 3,
      contactName: '한지우',
      contactPhone: '01000007713',
      description:
        '선월 하이츠 2차 33평 분양권을 찾습니다. 프리미엄 3,000 이하, 남향이면 좋겠습니다.',
      regionCodes: [SEONWOL],
      complexIds: [C03.id],
      priceMax: 43000,
      areaMin: 80,
      areaMax: 90,
      createdAt: ago(2 * HOUR),
      proposals: [other('req-03', 'B05', 0)],
    }),

    // ---- 응답 대기 ----
    request({
      id: 'req-04',
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['JEONSE'],
      contactName: '오민석',
      contactPhone: '01000003324',
      description:
        '· 입주일 협의 가능\n\n현재 공실이라 바로 보실 수 있습니다. 반려동물은 협의 가능합니다.',
      roadAddress: '전남 순천시 해룡면 신대5로 21',
      addressDetail: '301동 1204호',
      ...SINDAE_EMD,
      complexId: C06.id,
      complexName: C06.name,
      exclusiveArea: 99.12,
      floor: 12,
      desiredDeposit: 29000,
      createdAt: ago(1 * DAY + 2 * HOUR),
      proposals: [
        mine('req-04', {
          status: 'VIEWED',
          createdAt: ago(1 * DAY),
          viewedAt: ago(20 * HOUR),
          message:
            '· 예상 전세가 2억 8,500\n\n안녕하세요, 신대중앙 공인중개사사무소 오세린입니다. 3단지 39평 전세는 이번 달에만 2건 계약했고, 지금도 전세를 찾는 대기 손님이 두 분 계십니다. 사진 촬영과 광고는 저희가 무료로 진행하겠습니다.',
        }),
        other('req-04', 'B09', 1),
        other('req-04', 'B10', 1),
      ],
    }),
    request({
      id: 'req-05',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'OFFICETEL',
      dealTypes: ['MONTHLY'],
      contactName: '박서준',
      contactPhone: '01000009935',
      description: '율촌산단으로 출퇴근합니다. 주차 1대 가능하고 풀옵션이면 좋겠습니다.',
      regionCodes: [SINDAE, SEONWOL],
      depositMax: 1000,
      rentMax: 60,
      areaMin: 23,
      roomsMin: 1,
      moveInDate: dateAhead(20),
      createdAt: ago(9 * HOUR),
      proposals: [
        mine(
          'req-05',
          {
            status: 'SENT',
            createdAt: ago(5 * HOUR),
            memberName: '김서진',
            message:
              '안녕하세요, 신대중앙 공인중개사사무소 김서진입니다. 조건에 맞는 오피스텔 2건을 첨부했습니다. 두 곳 모두 주차 1대 무료이고 풀옵션입니다.',
          },
          ['L17', 'L18'],
        ),
      ],
    }),

    // ---- 수락 · 연락처 공개 ----
    request({
      id: 'req-06',
      type: 'SELL_OR_LEASE',
      status: 'MATCHED',
      assetType: 'APT',
      dealTypes: ['PRESALE'],
      contactName: '윤가람',
      contactPhone: '01000003476',
      description:
        '· 가격 협의 가능\n\n중도금 대출 승계 조건입니다. 발코니 확장, 시스템 에어컨 4대 옵션 계약했습니다.',
      roadAddress: '전남 순천시 해룡면 선월로 55',
      addressDetail: '205동 904호',
      ...SEONWOL_EMD,
      complexId: C03.id,
      complexName: C03.name,
      exclusiveArea: 84.94,
      floor: 9,
      desiredSalePrice: 42500,
      createdAt: ago(5 * DAY),
      proposals: [
        mine('req-06', {
          status: 'ACCEPTED',
          createdAt: ago(4 * DAY + 20 * HOUR),
          viewedAt: ago(4 * DAY + 12 * HOUR),
          respondedAt: ago(3 * DAY),
          message:
            '· 예상 매매가 4억 2,000\n\n선월 하이츠 2차 분양권은 저희가 가장 많이 거래하는 단지입니다. 같은 타입을 찾는 매수 대기 손님이 있어 2주 안에 계약까지 진행해 보겠습니다.',
        }),
        other('req-06', 'B05', 4),
        other('req-06', 'B11', 4),
      ],
      grants: { [MY_AGENCY_ID]: ago(2 * DAY + 21 * HOUR) },
    }),
    request({
      id: 'req-07',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['JEONSE'],
      contactName: '서민재',
      contactPhone: '01000006128',
      description: '맞벌이 부부입니다. 평일 저녁 7시 이후나 주말에 통화 가능합니다.',
      regionCodes: [SINDAE],
      depositMax: 30000,
      areaMin: 59,
      roomsMin: 3,
      moveInDate: dateAhead(45),
      createdAt: ago(3 * DAY),
      proposals: [
        mine(
          'req-07',
          {
            status: 'VIEWED',
            createdAt: ago(2 * DAY + 18 * HOUR),
            viewedAt: ago(2 * DAY + 6 * HOUR),
            message:
              '예산 안에서 바로 입주 가능한 전세 2건을 골랐습니다. 104동은 초등학교 바로 앞이고, 302동은 39평이라 조금 더 넓게 쓰실 수 있습니다.',
          },
          ['L14', 'L21'],
        ),
        other('req-07', 'B13', 2),
      ],
      grants: { [MY_AGENCY_ID]: ago(1 * DAY + 3 * HOUR) },
    }),

    // ---- 종료 ----
    request({
      id: 'req-08',
      type: 'WANTED',
      status: 'OPEN',
      assetType: 'HOUSE',
      dealTypes: ['SALE'],
      contactName: '강현우',
      contactPhone: '01000008852',
      description: '마당 있는 단독주택을 찾습니다. 주차 2대 필요합니다.',
      regionCodes: [SINDAE],
      priceMax: 50000,
      areaMin: 99,
      createdAt: ago(8 * DAY),
      proposals: [
        mine(
          'req-08',
          {
            status: 'DECLINED',
            createdAt: ago(7 * DAY + 20 * HOUR),
            viewedAt: ago(7 * DAY),
            respondedAt: ago(6 * DAY),
            message:
              '신대리 2층 단독주택을 추천드립니다. 예산을 조금 넘지만 가격 조정 여지가 있습니다.',
          },
          ['L22'],
        ),
      ],
    }),
    request({
      id: 'req-09',
      type: 'SELL_OR_LEASE',
      status: 'CLOSED',
      assetType: 'COMMERCIAL',
      dealTypes: ['MONTHLY'],
      contactName: '문지호',
      contactPhone: '01000001190',
      description: '1층 코너 상가, 현재 카페로 운영 중이며 시설 권리금은 협의합니다.',
      roadAddress: '전남 순천시 해룡면 신대1로 30',
      addressDetail: '1층 102호',
      ...SINDAE_EMD,
      exclusiveArea: 72.7,
      floor: 1,
      desiredDeposit: 3000,
      desiredMonthlyRent: 190,
      createdAt: ago(16 * DAY),
      closedAt: ago(3 * DAY),
      updatedAt: ago(3 * DAY),
      proposals: [
        other('req-09', 'B10', 14),
        other('req-09', 'B09', 13),
        other('req-09', 'B12', 12),
        other('req-09', 'B13', 12),
      ],
    }),
    request({
      id: 'req-10',
      type: 'WANTED',
      status: 'EXPIRED',
      assetType: 'LAND',
      dealTypes: ['SALE'],
      contactName: '배성민',
      contactPhone: '01000005507',
      description: '전원주택을 지을 대지를 찾습니다. 도로에 접한 100평 이상.',
      regionCodes: [SEONWOL, SINDAE],
      priceMax: 40000,
      areaMin: 330,
      createdAt: ago(41 * DAY),
      expiresAt: ago(11 * DAY),
      updatedAt: ago(11 * DAY),
      proposals: [
        mine(
          'req-10',
          {
            status: 'SENT',
            createdAt: ago(39 * DAY),
            message: '신대리 대지 100평, 6m 도로에 접해 있습니다. 현장 안내 가능합니다.',
          },
          ['T01'],
        ),
      ],
    }),
    request({
      id: 'req-11',
      type: 'SELL_OR_LEASE',
      status: 'OPEN',
      assetType: 'APT',
      dealTypes: ['MONTHLY'],
      contactName: '임수빈',
      contactPhone: '01000002846',
      description: '· 즉시 입주 가능\n\n25평, 에어컨 2대와 붙박이장 있습니다.',
      roadAddress: '전남 순천시 해룡면 신대2로 40',
      addressDetail: '108동 702호',
      ...SINDAE_EMD,
      complexId: C01.id,
      complexName: C01.name,
      exclusiveArea: 59.92,
      floor: 7,
      desiredDeposit: 3000,
      desiredMonthlyRent: 90,
      createdAt: ago(12 * DAY),
      proposals: [
        mine('req-11', {
          status: 'WITHDRAWN',
          createdAt: ago(11 * DAY),
          viewedAt: ago(10 * DAY + 20 * HOUR),
          respondedAt: ago(10 * DAY),
          message:
            '· 예상 보증금/월세 3,000/85\n\n월세 수요가 꾸준한 타입입니다. 빠르게 임차인을 맞춰 드리겠습니다.',
        }),
        other('req-11', 'B13', 11),
      ],
    }),
  ];
}
