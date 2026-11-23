/**
 * FICTIONAL demo data for 순천시 (every complex, office, person and phone number below is made
 * up; phone numbers use the unassigned 000 exchange). Coordinates are in the right 동/지구 so the
 * map looks plausible: 신대지구·선월지구 (해룡면), 오천, 연향, 조례, 금당, 왕지, 원도심.
 */
import { AssetType } from '@prisma/client';

export interface SeedAreaType {
  ex: number; // 전용 ㎡
  sup: number; // 공급 ㎡
  type: string; // 타입명 (84A …)
  households: number;
  rooms: number;
  baths: number;
}

export interface SeedComplex {
  key: string;
  name: string;
  assetType: AssetType;
  emd: string; // region name (regions.ts)
  roadAddress: string;
  jibun: string;
  lat: number;
  lng: number;
  households: number;
  buildings: number;
  floorsMin: number;
  floorsMax: number;
  /** null = 분양권 단지 (사용승인 전). */
  approval: string | null;
  builtYear: number;
  parkingPerHousehold: number;
  far: number;
  bcr: number;
  heating: string;
  builder: string;
  /** 매매 시세 (만원 / 전용㎡). */
  pricePerSqm: number;
  areaTypes: SeedAreaType[];
}

const at = (
  ex: number,
  sup: number,
  type: string,
  households: number,
  rooms = 3,
  baths = 2,
): SeedAreaType => ({ ex, sup, type, households, rooms, baths });

export const COMPLEXES: SeedComplex[] = [
  {
    key: 'sindae-lake',
    name: '신대 호수마을 그린빌',
    assetType: AssetType.APT,
    emd: '신대리',
    roadAddress: '전라남도 순천시 해룡면 호수마을1길 15',
    jibun: '1001',
    lat: 34.9262,
    lng: 127.5418,
    households: 1124,
    buildings: 12,
    floorsMin: 15,
    floorsMax: 25,
    approval: '2014-06-20',
    builtYear: 2014,
    parkingPerHousehold: 1.35,
    far: 229.8,
    bcr: 16.2,
    heating: '개별난방(도시가스)',
    builder: '그린빌건설(가상)',
    pricePerSqm: 470,
    areaTypes: [
      at(59.92, 80.12, '59A', 312),
      at(74.95, 99.2, '74A', 286),
      at(84.97, 112.4, '84A', 446),
      at(101.88, 133.5, '101A', 80, 4, 2),
    ],
  },
  {
    key: 'sindae-central',
    name: '신대 센트럴 파크뷰',
    assetType: AssetType.APT,
    emd: '신대리',
    roadAddress: '전라남도 순천시 해룡면 신대센트럴로 88',
    jibun: '1020',
    lat: 34.9231,
    lng: 127.5472,
    households: 1450,
    buildings: 14,
    floorsMin: 20,
    floorsMax: 29,
    approval: '2018-03-28',
    builtYear: 2018,
    parkingPerHousehold: 1.52,
    far: 249.6,
    bcr: 14.8,
    heating: '지역난방',
    builder: '센트럴종합건설(가상)',
    pricePerSqm: 520,
    areaTypes: [
      at(59.98, 82.3, '59A', 420),
      at(84.99, 113.1, '84A', 760),
      at(114.95, 149.6, '114A', 270, 4, 2),
    ],
  },
  {
    key: 'ocheon-river',
    name: '오천 리버하임',
    assetType: AssetType.APT,
    emd: '오천동',
    roadAddress: '전라남도 순천시 오천강변길 52',
    jibun: '630',
    lat: 34.9381,
    lng: 127.4869,
    households: 868,
    buildings: 9,
    floorsMin: 18,
    floorsMax: 25,
    approval: '2015-11-30',
    builtYear: 2015,
    parkingPerHousehold: 1.3,
    far: 219.4,
    bcr: 17.5,
    heating: '개별난방(도시가스)',
    builder: '리버하임건설(가상)',
    pricePerSqm: 380,
    areaTypes: [
      at(59.96, 81.5, '59A', 240),
      at(84.92, 111.8, '84A', 520),
      at(99.87, 130.2, '99A', 108, 4, 2),
    ],
  },
  {
    key: 'yeonhyang-hanmaeum',
    name: '연향 한마음타운',
    assetType: AssetType.APT,
    emd: '연향동',
    roadAddress: '전라남도 순천시 연향한마음길 30',
    jibun: '1440',
    lat: 34.9466,
    lng: 127.5161,
    households: 1520,
    buildings: 16,
    floorsMin: 13,
    floorsMax: 15,
    approval: '1998-10-15',
    builtYear: 1998,
    parkingPerHousehold: 0.85,
    far: 238.1,
    bcr: 19.3,
    heating: '개별난방(도시가스)',
    builder: '한마음주택(가상)',
    pricePerSqm: 205,
    areaTypes: [
      at(49.5, 66.1, '49A', 380, 2, 1),
      at(59.4, 79.3, '59A', 640, 3, 1),
      at(84.6, 105.8, '84A', 500),
    ],
  },
  {
    key: 'jorye-lakepark',
    name: '조례 호수공원 늘푸른',
    assetType: AssetType.APT,
    emd: '조례동',
    roadAddress: '전라남도 순천시 조례호수길 41',
    jibun: '1650',
    lat: 34.9628,
    lng: 127.5198,
    households: 972,
    buildings: 11,
    floorsMin: 15,
    floorsMax: 20,
    approval: '2003-05-30',
    builtYear: 2003,
    parkingPerHousehold: 1.05,
    far: 245.0,
    bcr: 18.1,
    heating: '개별난방(도시가스)',
    builder: '늘푸른건설(가상)',
    pricePerSqm: 255,
    areaTypes: [
      at(59.82, 79.8, '59A', 400),
      at(84.81, 108.6, '84A', 480),
      at(114.7, 142.3, '114A', 92, 4, 2),
    ],
  },
  {
    key: 'wangji-bonghwa',
    name: '왕지 봉화산 그린타운',
    assetType: AssetType.APT,
    emd: '왕지동',
    roadAddress: '전라남도 순천시 봉화산길 77',
    jibun: '880',
    lat: 34.9702,
    lng: 127.5119,
    households: 640,
    buildings: 7,
    floorsMin: 15,
    floorsMax: 22,
    approval: '2008-12-22',
    builtYear: 2008,
    parkingPerHousehold: 1.2,
    far: 226.3,
    bcr: 16.9,
    heating: '개별난방(도시가스)',
    builder: '봉화산개발(가상)',
    pricePerSqm: 300,
    areaTypes: [
      at(59.91, 80.6, '59A', 200),
      at(84.95, 110.9, '84A', 360),
      at(125.4, 158.7, '125A', 80, 4, 2),
    ],
  },
  {
    key: 'geumdang-sunshine',
    name: '금당 햇살마을',
    assetType: AssetType.APT,
    emd: '조례동',
    roadAddress: '전라남도 순천시 금당햇살로 19',
    jibun: '1820',
    lat: 34.9545,
    lng: 127.5302,
    households: 1210,
    buildings: 14,
    floorsMin: 12,
    floorsMax: 15,
    approval: '1996-08-27',
    builtYear: 1996,
    parkingPerHousehold: 0.7,
    far: 230.5,
    bcr: 20.4,
    heating: '개별난방(도시가스)',
    builder: '햇살주택(가상)',
    pricePerSqm: 165,
    areaTypes: [
      at(39.6, 53.2, '39A', 330, 2, 1),
      at(59.5, 78.4, '59A', 600, 3, 1),
      at(84.3, 104.9, '84A', 280),
    ],
  },
  {
    key: 'seonwol-sky',
    name: '선월 하늘채움 (분양)',
    assetType: AssetType.APT,
    emd: '선월리',
    roadAddress: '전라남도 순천시 해룡면 선월하늘로 100',
    jibun: '500',
    lat: 34.9168,
    lng: 127.5577,
    households: 1380,
    buildings: 13,
    floorsMin: 20,
    floorsMax: 30,
    approval: null,
    builtYear: 2027,
    parkingPerHousehold: 1.45,
    far: 239.9,
    bcr: 15.1,
    heating: '지역난방',
    builder: '하늘채움건설(가상)',
    pricePerSqm: 450,
    areaTypes: [
      at(59.99, 83.7, '59A', 460),
      at(84.98, 114.2, '84A', 820),
      at(101.97, 136.1, '101A', 100, 4, 2),
    ],
  },
  {
    key: 'yeonhyang-station-ot',
    name: '연향 스테이션시티 오피스텔',
    assetType: AssetType.OFFICETEL,
    emd: '연향동',
    roadAddress: '전라남도 순천시 연향중앙로 205',
    jibun: '1395',
    lat: 34.9449,
    lng: 127.5195,
    households: 420,
    buildings: 1,
    floorsMin: 20,
    floorsMax: 20,
    approval: '2019-09-10',
    builtYear: 2019,
    parkingPerHousehold: 0.9,
    far: 799.5,
    bcr: 58.2,
    heating: '개별난방(전기)',
    builder: '스테이션개발(가상)',
    pricePerSqm: 330,
    areaTypes: [
      at(23.1, 46.2, '23A', 260, 1, 1),
      at(39.8, 76.5, '39A', 120, 2, 1),
      at(59.4, 112.0, '59A', 40, 3, 1),
    ],
  },
];

export interface SeedAgency {
  key: string;
  name: string;
  representative: string;
  emd: string;
  roadAddress: string;
  lat: number;
  lng: number;
  phone: string;
  mobile: string;
  regNo: string;
  bizPrefix: string; // 9 digits; check digit computed
  specialties: AssetType[];
  intro: string;
  staff: { name: string; licensed: boolean; title: string }[];
}

export const AGENCIES: SeedAgency[] = [
  {
    key: 'a1',
    name: '신대호수공인중개사사무소',
    representative: '한가람',
    emd: '신대리',
    roadAddress: '전라남도 순천시 해룡면 호수마을1길 9, 상가 101호',
    lat: 34.9255,
    lng: 127.5426,
    phone: '0610000101',
    mobile: '01000000101',
    regNo: '46150-2016-00101',
    bizPrefix: '416810101',
    specialties: [AssetType.APT, AssetType.COMMERCIAL],
    intro: '신대지구 아파트·상가 전문. 단지 내 상가에서 10년째 영업 중입니다. (가상 데이터)',
    staff: [
      { name: '송나래', licensed: true, title: '소속공인중개사' },
      { name: '임도담', licensed: false, title: '중개보조원' },
    ],
  },
  {
    key: 'a2',
    name: '신대센트럴공인중개사사무소',
    representative: '서누리',
    emd: '신대리',
    roadAddress: '전라남도 순천시 해룡면 신대센트럴로 80, 1층',
    lat: 34.9236,
    lng: 127.5463,
    phone: '0610000102',
    mobile: '01000000102',
    regNo: '46150-2018-00102',
    bizPrefix: '416810102',
    specialties: [AssetType.APT, AssetType.OFFICETEL],
    intro: '신대·선월지구 신축 아파트와 분양권 상담. (가상 데이터)',
    staff: [{ name: '권해솔', licensed: true, title: '소속공인중개사' }],
  },
  {
    key: 'a3',
    name: '오천그린공인중개사사무소',
    representative: '오다온',
    emd: '오천동',
    roadAddress: '전라남도 순천시 오천강변길 40, 2층',
    lat: 34.9376,
    lng: 127.4858,
    phone: '0610000103',
    mobile: '01000000103',
    regNo: '46150-2015-00103',
    bizPrefix: '416810103',
    specialties: [AssetType.APT, AssetType.HOUSE],
    intro: '오천지구·순천만 인근 아파트와 주택. (가상 데이터)',
    staff: [{ name: '남새벽', licensed: false, title: '중개보조원' }],
  },
  {
    key: 'a4',
    name: '연향중앙공인중개사사무소',
    representative: '윤새봄',
    emd: '연향동',
    roadAddress: '전라남도 순천시 연향중앙로 180, 1층',
    lat: 34.9458,
    lng: 127.5178,
    phone: '0610000104',
    mobile: '01000000104',
    regNo: '46150-2012-00104',
    bizPrefix: '416810104',
    specialties: [AssetType.ONEROOM, AssetType.OFFICETEL, AssetType.COMMERCIAL],
    intro: '연향동 원룸·투룸, 오피스텔, 상가 임대 전문. (가상 데이터)',
    staff: [
      { name: '차온유', licensed: true, title: '소속공인중개사' },
      { name: '하이든', licensed: false, title: '중개보조원' },
    ],
  },
  {
    key: 'a5',
    name: '조례호수공원공인중개사사무소',
    representative: '백하람',
    emd: '조례동',
    roadAddress: '전라남도 순천시 조례호수길 33, 상가동 105호',
    lat: 34.9619,
    lng: 127.5209,
    phone: '0610000105',
    mobile: '01000000105',
    regNo: '46150-2010-00105',
    bizPrefix: '416810105',
    specialties: [AssetType.APT, AssetType.ONEROOM],
    intro: '조례동·호수공원 주변 아파트와 원룸. (가상 데이터)',
    staff: [{ name: '유가온', licensed: true, title: '소속공인중개사' }],
  },
  {
    key: 'a6',
    name: '왕지봉화공인중개사사무소',
    representative: '문이룸',
    emd: '왕지동',
    roadAddress: '전라남도 순천시 봉화산길 70, 1층',
    lat: 34.9694,
    lng: 127.5128,
    phone: '0610000106',
    mobile: '01000000106',
    regNo: '46150-2017-00106',
    bizPrefix: '416810106',
    specialties: [AssetType.APT, AssetType.LAND],
    intro: '왕지동 아파트, 순천 외곽 토지 상담. (가상 데이터)',
    staff: [{ name: '은가람', licensed: false, title: '중개보조원' }],
  },
  {
    key: 'a7',
    name: '금당햇살공인중개사사무소',
    representative: '진소담',
    emd: '조례동',
    roadAddress: '전라남도 순천시 금당햇살로 12, 상가 3호',
    lat: 34.9539,
    lng: 127.5291,
    phone: '0610000107',
    mobile: '01000000107',
    regNo: '46150-2009-00107',
    bizPrefix: '416810107',
    specialties: [AssetType.APT, AssetType.ONEROOM, AssetType.HOUSE],
    intro: '금당지구 소형 아파트와 원룸 전문. (가상 데이터)',
    staff: [{ name: '방다솜', licensed: true, title: '소속공인중개사' }],
  },
  {
    key: 'a8',
    name: '순천역앞공인중개사사무소',
    representative: '표바다',
    emd: '조곡동',
    roadAddress: '전라남도 순천시 역전광장길 8, 1층',
    lat: 34.9455,
    lng: 127.5022,
    phone: '0610000108',
    mobile: '01000000108',
    regNo: '46150-2008-00108',
    bizPrefix: '416810108',
    specialties: [AssetType.HOUSE, AssetType.COMMERCIAL, AssetType.LAND],
    intro: '원도심 주택·상가, 읍면 토지 매매. (가상 데이터)',
    staff: [
      { name: '탁보람', licensed: true, title: '소속공인중개사' },
      { name: '추하늘', licensed: false, title: '중개보조원' },
    ],
  },
];

/** Where the non-complex listings are spread (원룸·투룸, 주택, 상가, 토지). */
export const SPOTS = {
  ONEROOM: [
    { emd: '석현동', street: '순천대학길', lat: 34.9686, lng: 127.4815, agency: 'a5' },
    { emd: '연향동', street: '연향원룸길', lat: 34.9481, lng: 127.5133, agency: 'a4' },
    { emd: '조례동', street: '조례원룸길', lat: 34.9589, lng: 127.5247, agency: 'a7' },
    { emd: '매곡동', street: '매곡길', lat: 34.9628, lng: 127.4789, agency: 'a8' },
  ],
  HOUSE: [
    { emd: '행동', street: '원도심골목길', lat: 34.9531, lng: 127.4851, agency: 'a8' },
    { emd: '저전동', street: '저전마을길', lat: 34.9561, lng: 127.4818, agency: 'a8' },
    { emd: '별량면', street: '별량들녘길', lat: 34.8766, lng: 127.4262, agency: 'a3' },
    { emd: '낙안면', street: '낙안마을길', lat: 34.9072, lng: 127.3433, agency: 'a7' },
  ],
  COMMERCIAL: [
    { emd: '연향동', street: '패션거리길', lat: 34.9452, lng: 127.5169, agency: 'a4' },
    { emd: '신대리', street: '신대상가로', lat: 34.9244, lng: 127.5439, agency: 'a1' },
    { emd: '조례동', street: '조례상가길', lat: 34.9611, lng: 127.5226, agency: 'a5' },
  ],
  LAND: [
    { emd: '승주읍', street: '승주들길', lat: 35.0091, lng: 127.4105, agency: 'a6' },
    { emd: '해룡면', street: '해룡들판길', lat: 34.9127, lng: 127.5361, agency: 'a6' },
    { emd: '서면', street: '서면산길', lat: 35.0038, lng: 127.4702, agency: 'a8' },
  ],
} as const;

export const NOTICES = [
  {
    key: 'welcome',
    title: '순천 부동산 서비스를 시작합니다 (샘플 공지)',
    pinned: true,
    content:
      '순천 지역 중개사무소들이 함께 매물을 올리는 공동중개 플랫폼입니다.\n\n- 지도에서 아파트·원룸·상가·토지 매물을 찾아보세요.\n- 집을 내놓거나 원하는 조건을 등록하면 지역 중개사무소가 연락드립니다.\n\n*이 공지는 시드 데이터입니다.*',
  },
  {
    key: 'fake-listing',
    title: '허위매물 신고 안내 (샘플 공지)',
    pinned: false,
    content:
      '이미 거래된 매물, 가격·사진이 다른 매물은 매물 상세의 **신고하기**로 알려 주세요. 확인 후 노출을 중단하고 중개사무소에 경고합니다.',
  },
  {
    key: 'verified',
    title: '실매물 확인 표시가 생겼습니다 (샘플 공지)',
    pinned: false,
    content:
      '중개사무소가 소유자 확인·현장 방문 등으로 매물을 확인하면 **확인 날짜**가 표시됩니다. 최근 확인순 정렬도 이용해 보세요.',
  },
];

export const FAQS = [
  {
    category: 'GENERAL',
    q: '어떤 지역의 매물을 볼 수 있나요?',
    a: '전라남도 순천시 전 지역(읍·면·동)의 매물을 제공합니다.',
  },
  {
    category: 'ACCOUNT',
    q: '어떤 방법으로 로그인하나요?',
    a: '카카오, 네이버, Google 계정으로 로그인합니다. 별도 비밀번호나 문자 인증은 없습니다.',
  },
  {
    category: 'ACCOUNT',
    q: '탈퇴하면 내 정보는 어떻게 되나요?',
    a: '탈퇴 즉시 로그인과 요청이 중단되고, 남은 개인정보는 보관 기간이 지나면 파기됩니다.',
  },
  {
    category: 'LISTING',
    q: '공동중개 매물은 무엇인가요?',
    a: '여러 중개사무소가 함께 중개하는 매물입니다. 어느 사무소에 문의해도 같은 매물을 안내받을 수 있습니다.',
  },
  {
    category: 'LISTING',
    q: '“확인 매물”은 무슨 뜻인가요?',
    a: '중개사무소가 소유자 확인, 서류, 현장 방문 등으로 매물이 실제로 있음을 확인한 날짜가 있는 매물입니다.',
  },
  {
    category: 'AGENCY',
    q: '중개사무소로 가입하려면 어떻게 하나요?',
    a: '로그인 후 중개사무소 등록을 신청하고 중개사무소 등록증을 올려 주세요. 운영자 확인 후 승인됩니다.',
  },
  {
    category: 'DEAL_REQUEST',
    q: '집 내놓기를 하면 연락처가 바로 공개되나요?',
    a: '아니요. 내가 허락한 중개사무소에만 연락처가 공개됩니다.',
  },
  {
    category: 'AD',
    q: '배너 광고는 어떻게 신청하나요?',
    a: '고객센터로 문의해 주세요. 위치별 광고 안내를 드립니다.',
  },
] as const;

/** Sample YouTube ids (not real videos): the operator replaces them with real 지역 영상. */
export const VIDEOS = [
  { key: 'v1', title: '(샘플) 순천만 국가정원 산책', id: 'SAMPLEvid01', emd: null },
  { key: 'v2', title: '(샘플) 신대지구 생활권 둘러보기', id: 'SAMPLEvid02', emd: '신대리' },
  { key: 'v3', title: '(샘플) 조례호수공원 주변 단지 소개', id: 'SAMPLEvid03', emd: '조례동' },
] as const;
