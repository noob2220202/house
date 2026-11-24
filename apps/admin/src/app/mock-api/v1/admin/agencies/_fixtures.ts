import { AgencyDocumentType, type AgencyStatus, type AssetType, AuthProvider } from '@house/shared';
import type {
  AdminAgencyDetail,
  AdminAgencyListItem,
  RegistryCheck,
} from '@/features/m-moderation/api/schemas';
import { ago, mid, mockTable } from '@/features/m-moderation/mock/handler';

/** Fictional 중개사무소 from design/drafts/system/mockdata.md §4 + the AdminDashboard approval queue. */
export const AGENCY_ID = {
  B01: mid('a9', 1),
  B02: mid('a9', 2),
  B03: mid('a9', 3),
  B04: mid('a9', 4),
  B05: mid('a9', 5),
  B06: mid('a9', 6),
  B07: mid('a9', 7),
  B08: mid('a9', 8),
  P1: mid('a9', 11),
  P2: mid('a9', 12),
  P3: mid('a9', 13),
  P4: mid('a9', 14),
  REJECTED: mid('a9', 21),
  SUSPENDED: mid('a9', 22),
} as const;

/** user id of the owner of agency #n (users/_fixtures.ts creates the matching member rows). */
export const ownerUserId = (n: number) => mid('c1', n);

const REGISTRY_SOURCE = '국가공간정보 중개업소 조회';
const DOC_LABEL: Record<AgencyDocumentType, string> = {
  REGISTRATION_CERT: '중개사무소등록증',
  BUSINESS_REG_CERT: '사업자등록증',
  BROKER_LICENSE: '공인중개사자격증',
  OTHER: '공제증서',
};

interface Seed {
  n: number;
  id: string;
  name: string;
  rep: string;
  reg: string;
  road: string;
  detail?: string;
  emd: string;
  status: AgencyStatus;
  appliedDaysAgo: number;
  appliedHoursAgo?: number;
  listings?: number;
  warnings?: number;
  views?: number;
  specialties?: AssetType[];
  intro?: string;
  docs?: AgencyDocumentType[];
  pdfDoc?: AgencyDocumentType;
  registry?: 'MATCHED' | 'MISMATCH' | 'NOT_FOUND' | 'UNAVAILABLE' | null;
  reason?: string;
  staff?: string[];
  provider?: AuthProvider;
  lat: number;
  lng: number;
}

const ALL_DOCS: AgencyDocumentType[] = [
  AgencyDocumentType.REGISTRATION_CERT,
  AgencyDocumentType.BUSINESS_REG_CERT,
  AgencyDocumentType.OTHER,
];

const SEEDS: Seed[] = [
  {
    n: 1,
    id: AGENCY_ID.B01,
    name: '신대중앙 공인중개사사무소',
    rep: '김서진',
    reg: '46150-2019-00012',
    road: '순천시 해룡면 신대1로 18',
    detail: '105호',
    emd: '해룡면 신대리',
    status: 'APPROVED',
    appliedDaysAgo: 612,
    listings: 62,
    views: 18420,
    specialties: ['APT'],
    intro: '신대 레이크파크 단지 전문. 입주 초기부터 신대지구만 중개해 왔습니다.',
    staff: ['박지민', '오현우'],
    pdfDoc: 'BROKER_LICENSE',
    lat: 34.9302,
    lng: 127.5489,
  },
  {
    n: 2,
    id: AGENCY_ID.B02,
    name: '호수공원 공인중개사사무소',
    rep: '한서윤',
    reg: '46150-2017-00031',
    road: '순천시 조례동 호수공원길 24',
    detail: '1층',
    emd: '조례동',
    status: 'APPROVED',
    appliedDaysAgo: 540,
    listings: 46,
    warnings: 1,
    views: 12880,
    specialties: ['APT', 'OFFICETEL'],
    intro: '연향·조례 아파트 전문.',
    staff: ['이도윤'],
    provider: 'NAVER',
    lat: 34.9523,
    lng: 127.5218,
  },
  {
    n: 3,
    id: AGENCY_ID.B03,
    name: '연향센트럴 공인중개사사무소',
    rep: '박도현',
    reg: '46150-2018-00044',
    road: '순천시 연향동 연향3로 41',
    detail: '102호',
    emd: '연향동',
    status: 'APPROVED',
    appliedDaysAgo: 498,
    listings: 38,
    warnings: 1,
    views: 9410,
    specialties: ['APT'],
    intro: '연향 센트럴 단지 전문.',
    lat: 34.9418,
    lng: 127.5226,
  },
  {
    n: 4,
    id: AGENCY_ID.B04,
    name: '오천그린 공인중개사사무소',
    rep: '이하린',
    reg: '46150-2020-00008',
    road: '순천시 오천동 오천2길 7',
    detail: '1층',
    emd: '오천동',
    status: 'APPROVED',
    appliedDaysAgo: 420,
    listings: 29,
    views: 6120,
    specialties: ['APT', 'HOUSE'],
    intro: '오천지구 전문.',
    provider: 'GOOGLE',
    lat: 34.9321,
    lng: 127.5012,
  },
  {
    n: 5,
    id: AGENCY_ID.B05,
    name: '선월 분양권 공인중개사사무소',
    rep: '정민재',
    reg: '46150-2021-00019',
    road: '순천시 해룡면 선월로 30',
    detail: '상가 B동 101호',
    emd: '해룡면 선월리',
    status: 'APPROVED',
    appliedDaysAgo: 365,
    listings: 51,
    views: 15230,
    specialties: ['APT'],
    intro: '분양권 전문. 선월 하이츠 2차 분양권 상담.',
    staff: ['서가은'],
    lat: 34.9224,
    lng: 127.5561,
  },
  {
    n: 6,
    id: AGENCY_ID.B06,
    name: '순천대정문 공인중개사사무소',
    rep: '최유나',
    reg: '46150-2016-00027',
    road: '순천시 석현동 대학로 15',
    detail: '1층',
    emd: '석현동',
    status: 'APPROVED',
    appliedDaysAgo: 701,
    listings: 74,
    warnings: 0,
    views: 22310,
    specialties: ['ONEROOM', 'OFFICETEL'],
    intro: '원룸·투룸 전문. 순천대 앞 15년.',
    staff: ['문예린', '신동혁'],
    provider: 'NAVER',
    lat: 34.9689,
    lng: 127.4801,
  },
  {
    n: 7,
    id: AGENCY_ID.B07,
    name: '금당리버 공인중개사사무소',
    rep: '윤재희',
    reg: '46150-2015-00052',
    road: '순천시 연향동 금당로 9',
    detail: '103호',
    emd: '연향동',
    status: 'APPROVED',
    appliedDaysAgo: 388,
    listings: 22,
    warnings: 2,
    views: 4380,
    specialties: ['APT'],
    intro: '금당지구 전문.',
    lat: 34.9391,
    lng: 127.5302,
  },
  {
    n: 8,
    id: AGENCY_ID.B08,
    name: '왕지숲 공인중개사사무소',
    rep: '강태오',
    reg: '46150-2022-00003',
    road: '순천시 왕지동 왕지2로 33',
    detail: '1층',
    emd: '왕지동',
    status: 'APPROVED',
    appliedDaysAgo: 301,
    listings: 19,
    views: 3950,
    specialties: ['APT', 'LAND'],
    intro: '왕지·조례 전문.',
    provider: 'GOOGLE',
    lat: 34.9612,
    lng: 127.5344,
  },
  {
    n: 11,
    id: AGENCY_ID.P1,
    name: '해룡신대 공인중개사사무소',
    rep: '오세린',
    reg: '46150-2026-00087',
    road: '순천시 해룡면 신대3로 52',
    detail: '1층 103호',
    emd: '해룡면 신대리',
    status: 'PENDING',
    appliedDaysAgo: 4,
    appliedHoursAgo: 3,
    specialties: ['APT', 'COMMERCIAL'],
    intro: '신대지구 상가·아파트 중개를 준비하고 있습니다.',
    registry: 'MATCHED',
    lat: 34.9281,
    lng: 127.5512,
  },
  {
    n: 12,
    id: AGENCY_ID.P2,
    name: '동천로 공인중개사사무소',
    rep: '문지후',
    reg: '46150-2026-00091',
    road: '순천시 풍덕동 동천로 121',
    detail: '1층',
    emd: '풍덕동',
    status: 'PENDING',
    appliedDaysAgo: 3,
    appliedHoursAgo: 1,
    specialties: ['HOUSE', 'LAND'],
    docs: ['REGISTRATION_CERT', 'OTHER'],
    registry: 'MISMATCH',
    provider: 'NAVER',
    lat: 34.9442,
    lng: 127.4979,
  },
  {
    n: 13,
    id: AGENCY_ID.P3,
    name: '순천역앞 공인중개사사무소',
    rep: '배수아',
    reg: '46150-2026-00094',
    road: '순천시 장천동 역전길 8',
    detail: '2층',
    emd: '장천동',
    status: 'PENDING',
    appliedDaysAgo: 2,
    appliedHoursAgo: 5,
    specialties: ['ONEROOM', 'COMMERCIAL'],
    intro: '순천역 역세권 원룸·상가 전문.',
    registry: 'MATCHED',
    provider: 'GOOGLE',
    lat: 34.9458,
    lng: 127.5031,
  },
  {
    n: 14,
    id: AGENCY_ID.P4,
    name: '조례한빛 공인중개사사무소',
    rep: '서준호',
    reg: '46150-2026-00095',
    road: '순천시 조례동 백강로 233',
    detail: '1층',
    emd: '조례동',
    status: 'PENDING',
    appliedDaysAgo: 0,
    appliedHoursAgo: 6,
    specialties: ['APT'],
    registry: 'UNAVAILABLE',
    lat: 34.9556,
    lng: 127.5237,
  },
  {
    n: 21,
    id: AGENCY_ID.REJECTED,
    name: '가곡한울 공인중개사사무소',
    rep: '임채원',
    reg: '46150-2026-00078',
    road: '순천시 가곡동 가곡길 60',
    detail: '1층',
    emd: '가곡동',
    status: 'REJECTED',
    appliedDaysAgo: 12,
    specialties: ['LAND'],
    registry: 'NOT_FOUND',
    reason:
      '중개사무소 등록번호가 국가공간정보 조회 결과와 일치하지 않습니다. 등록증의 번호를 확인한 뒤 다시 신청해 주세요.',
    lat: 34.9742,
    lng: 127.4873,
  },
  {
    n: 22,
    id: AGENCY_ID.SUSPENDED,
    name: '매곡프라임 공인중개사사무소',
    rep: '노건우',
    reg: '46150-2020-00041',
    road: '순천시 매곡동 매산길 17',
    detail: '1층',
    emd: '매곡동',
    status: 'SUSPENDED',
    appliedDaysAgo: 455,
    listings: 0,
    warnings: 3,
    views: 2710,
    specialties: ['ONEROOM', 'HOUSE'],
    reason: '허위매물 신고 3건이 사실로 확인되어(경고 3회 누적) 30일간 이용을 정지합니다.',
    provider: 'NAVER',
    lat: 34.9571,
    lng: 127.4862,
  },
];

function registryOf(seed: Seed): RegistryCheck | null {
  const kind =
    seed.registry === undefined
      ? seed.status === 'APPROVED' || seed.status === 'SUSPENDED'
        ? 'MATCHED'
        : null
      : seed.registry;
  if (!kind) return null;
  const checkedAt = ago({
    d: Math.max(0, seed.appliedDaysAgo - 0),
    h: (seed.appliedHoursAgo ?? 0) - 0,
    m: -2,
  });
  const full = `${seed.road}${seed.detail ? `, ${seed.detail}` : ''}`;
  if (kind === 'NOT_FOUND')
    return {
      status: 'NOT_FOUND',
      checkedAt,
      source: REGISTRY_SOURCE,
      mismatches: [],
      message: '입력한 등록번호로 등록된 중개사무소가 없습니다.',
    };
  if (kind === 'UNAVAILABLE')
    return {
      status: 'UNAVAILABLE',
      checkedAt,
      source: REGISTRY_SOURCE,
      mismatches: [],
      message: '조회 서비스 응답이 지연되어 결과를 받지 못했습니다. 다시 조회해 주세요.',
    };
  const registry = {
    name: seed.name,
    representativeName: seed.rep,
    registrationNumber: seed.reg,
    roadAddress: kind === 'MISMATCH' ? full.replace('동천로 121', '동천로 112') : full,
    businessStatus: '영업중',
    registeredAt: `20${seed.reg.slice(8, 10)}-0${(seed.n % 9) + 1}-1${seed.n % 9}`,
  };
  return {
    status: kind,
    checkedAt,
    source: REGISTRY_SOURCE,
    registry,
    mismatches: kind === 'MISMATCH' ? ['roadAddress'] : [],
    message: kind === 'MISMATCH' ? '소재지 도로명 주소가 등록 정보와 다릅니다.' : null,
  };
}

function build(seed: Seed): AdminAgencyDetail {
  const createdAt = ago({ d: seed.appliedDaysAgo, h: seed.appliedHoursAgo ?? 2 });
  const decidedAt = ago({ d: Math.max(0, seed.appliedDaysAgo - 2), h: 1 });
  const docTypes =
    seed.docs ??
    (seed.status === 'APPROVED' || seed.status === 'SUSPENDED'
      ? [...ALL_DOCS, AgencyDocumentType.BROKER_LICENSE]
      : ALL_DOCS);
  const history: AdminAgencyDetail['statusHistory'] = [
    {
      id: mid('a8', seed.n * 10),
      fromStatus: null,
      toStatus: 'PENDING',
      reason: null,
      decidedByName: null,
      createdAt,
    },
  ];
  if (seed.status === 'APPROVED' || seed.status === 'SUSPENDED')
    history.unshift({
      id: mid('a8', seed.n * 10 + 1),
      fromStatus: 'PENDING',
      toStatus: 'APPROVED',
      reason: null,
      decidedByName: '한지우',
      createdAt: decidedAt,
    });
  if (seed.status === 'REJECTED')
    history.unshift({
      id: mid('a8', seed.n * 10 + 1),
      fromStatus: 'PENDING',
      toStatus: 'REJECTED',
      reason: seed.reason,
      decidedByName: '운영자',
      createdAt: decidedAt,
    });
  if (seed.status === 'SUSPENDED')
    history.unshift({
      id: mid('a8', seed.n * 10 + 2),
      fromStatus: 'APPROVED',
      toStatus: 'SUSPENDED',
      reason: seed.reason,
      decidedByName: '정다은',
      createdAt: ago({ d: 6, h: 4 }),
    });
  const warnings: AdminAgencyDetail['warnings'] = Array.from(
    { length: seed.warnings ?? 0 },
    (_, i) => ({
      id: mid('a7', seed.n * 10 + i),
      reason: [
        '이미 거래된 매물을 계속 광고했습니다.',
        '실제와 다른 가격으로 광고했습니다.',
        '다른 매물의 사진을 사용했습니다.',
      ][i % 3]!,
      reportId: null,
      adminName: '한지우',
      createdAt: ago({ d: 9 + i * 21, h: 3 }),
    }),
  );
  const digits = String(seed.n).padStart(2, '0');
  return {
    id: seed.id,
    name: seed.name,
    representativeName: seed.rep,
    registrationNumber: seed.reg,
    businessNumber: `4160${digits}0${digits}${seed.n % 10}`.slice(0, 10),
    phone: `06100000${digits}`,
    mobile: `01000000${digits}0`.slice(0, 11),
    email: `office${digits}@example.com`,
    roadAddress: seed.road,
    jibunAddress: null,
    addressDetail: seed.detail ?? null,
    zipCode: `579${digits}`,
    emdName: seed.emd,
    lat: seed.lat,
    lng: seed.lng,
    intro: seed.intro ?? null,
    specialties: seed.specialties ?? [],
    status: seed.status,
    statusReason: seed.reason ?? null,
    createdAt,
    updatedAt: seed.status === 'PENDING' ? createdAt : decidedAt,
    approvedAt: seed.status === 'APPROVED' || seed.status === 'SUSPENDED' ? decidedAt : null,
    suspendedAt: seed.status === 'SUSPENDED' ? ago({ d: 6, h: 4 }) : null,
    activeListingCount: seed.listings ?? 0,
    warningCount: seed.warnings ?? 0,
    viewCount: seed.views ?? 0,
    documentTypes: docTypes,
    registryStatus: registryOf(seed)?.status ?? null,
    owner: {
      id: ownerUserId(seed.n),
      name: seed.rep,
      nickname: `${seed.rep.slice(0, 1)}대표`,
      email: `owner${digits}@example.com`,
      phone: `01000000${digits}0`.slice(0, 11),
      createdAt: ago({ d: seed.appliedDaysAgo + 3, h: 5 }),
      providers: [seed.provider ?? AuthProvider.KAKAO],
    },
    documents: docTypes.map((type, i) => {
      const pdf = seed.pdfDoc === type;
      return {
        id: mid('f2', seed.n * 10 + i),
        type,
        mediaId: mid('f1', seed.n * 10 + i),
        fileName: `${DOC_LABEL[type]}_${seed.rep}.${pdf ? 'pdf' : 'jpg'}`,
        mimeType: pdf ? 'application/pdf' : 'image/jpeg',
        sizeBytes: 380_000 + ((seed.n * 37 + i * 91) % 900) * 1000,
        createdAt,
      };
    }),
    registryCheck: registryOf(seed),
    statusHistory: history,
    warnings,
    members: [
      {
        id: mid('a6', seed.n * 10),
        displayName: seed.rep,
        role: 'OWNER',
        status: 'ACTIVE',
        title: '대표',
        isLicensed: true,
        joinedAt: createdAt,
      },
      ...(seed.staff ?? []).map((name, i) => ({
        id: mid('a6', seed.n * 10 + i + 1),
        displayName: name,
        role: 'AGENT' as const,
        status: 'ACTIVE' as const,
        title: i === 0 ? '소속공인중개사' : '중개보조원',
        isLicensed: i === 0,
        joinedAt: ago({ d: Math.max(1, seed.appliedDaysAgo - 30 * (i + 1)) }),
      })),
    ],
  };
}

/** Mutable mock table (shared across route modules). */
export function agenciesDb(): AdminAgencyDetail[] {
  return mockTable('agencies', () => SEEDS.map(build));
}

export function toAgencyListItem(a: AdminAgencyDetail): AdminAgencyListItem {
  return {
    id: a.id,
    name: a.name,
    representativeName: a.representativeName,
    registrationNumber: a.registrationNumber,
    phone: a.phone,
    roadAddress: a.roadAddress,
    emdName: a.emdName,
    status: a.status,
    statusReason: a.statusReason,
    createdAt: a.createdAt,
    approvedAt: a.approvedAt,
    suspendedAt: a.suspendedAt,
    activeListingCount: a.activeListingCount,
    warningCount: a.warningCount,
    documentTypes: a.documentTypes,
    registryStatus: a.registryStatus,
  };
}

/** Adds a warning to an agency (used when a report is resolved with AGENCY_WARNED). */
export function warnAgency(
  agencyId: string,
  reason: string,
  reportId: string,
  adminName: string,
): void {
  const agency = agenciesDb().find((a) => a.id === agencyId);
  if (!agency) return;
  agency.warnings.unshift({
    id: mid('a7', 9000 + agency.warnings.length + agency.warningCount * 7),
    reason,
    reportId,
    adminName,
    createdAt: new Date().toISOString(),
  });
  agency.warningCount += 1;
}

export { DOC_LABEL as MOCK_DOC_LABEL };
