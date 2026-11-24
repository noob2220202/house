import { AssetType } from '@house/shared';
import { STATIC_MAP_BOUNDS } from '@/lib/map/geo';
import type { AgencyDetail, BusinessHours } from '@/features/w-agencies/api/schemas';

/**
 * Mock broker offices of the public search (w-agencies). Names, people, addresses and numbers are
 * FICTIONAL: B01–B08 come from design/drafts/system/mockdata.md §4, B09–B14 are the small offices
 * drawn on the Agents design map, the rest fill the 석현동 / 신대지구 clusters and the other 동.
 * Positions are in % of the stylized Suncheon map so the static map reproduces the design layout.
 * 읍면동 codes are made-up 8-digit codes under 12150 (순천시).
 */

const B = STATIC_MAP_BOUNDS;

/** Art-space % (x from the west edge, y from the north edge) → lat/lng. */
export function at(xPct: number, yPct: number): { lat: number; lng: number } {
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    lng: round(B.swLng + (xPct / 100) * (B.neLng - B.swLng)),
    lat: round(B.neLat - (yPct / 100) * (B.neLat - B.swLat)),
  };
}

export const EMD = {
  haeryong: { emdCode: '12150360', name: '해룡면', center: at(62, 84) },
  jorye: { emdCode: '12150127', name: '조례동', center: at(52, 22) },
  yeonhyang: { emdCode: '12150128', name: '연향동', center: at(50, 55) },
  wangji: { emdCode: '12150126', name: '왕지동', center: at(78, 18) },
  seokhyeon: { emdCode: '12150113', name: '석현동', center: at(32, 16) },
  ocheon: { emdCode: '12150131', name: '오천동', center: at(36, 88) },
  deogyeon: { emdCode: '12150121', name: '덕연동', center: at(22, 30) },
  jangcheon: { emdCode: '12150105', name: '장천동', center: at(19, 72) },
  pungdeok: { emdCode: '12150130', name: '풍덕동', center: at(66, 92) },
} as const;
export type EmdKey = keyof typeof EMD;

type Range = [string, string];
function hours(weekday: Range, sat?: Range | null, sun?: Range | null): BusinessHours {
  const day = (h?: Range | null) => (h ? { open: h[0], close: h[1] } : null);
  const wd = day(weekday);
  return { mon: wd, tue: wd, wed: wd, thu: wd, fri: wd, sat: day(sat), sun: day(sun) };
}
const H = {
  standard: hours(['09:00', '18:00'], ['10:00', '14:00']),
  long: hours(['09:00', '19:00'], ['10:00', '15:00']),
  campus: hours(['10:00', '20:00'], ['10:00', '18:00'], ['12:00', '17:00']),
  weekdays: hours(['09:30', '18:30']),
} as const;

export interface OfficeDef {
  key: string;
  name: string;
  ceo: string;
  emd: EmdKey;
  /** Road name + building number after "순천시 <읍면동>". */
  street: string;
  detail: string;
  /** Position in % of the map art. */
  pos: [number, number];
  reg: string;
  specialties: AssetType[];
  /** Active listings: 분양 / 매매 / 전세 / 월세. */
  deals: [number, number, number, number];
  /** Complex codes (C01…) the office mostly lists. */
  complexes: string[];
  hours: BusinessHours | null;
  tagline?: string;
  intro?: string;
  deals30d?: number;
  responseMin?: number;
  members?: AgencyDetail['members'];
}

const A = AssetType;

/** Compact row for the generated offices. */
function office(
  key: string,
  name: string,
  ceo: string,
  emd: EmdKey,
  address: [street: string, detail: string],
  pos: [number, number],
  reg: string,
  specialties: AssetType[],
  deals: [number, number, number, number],
  complexes: string[] = [],
  officeHours: BusinessHours | null = H.standard,
): OfficeDef {
  return {
    key,
    name: `${name} 공인중개사사무소`,
    ceo,
    emd,
    street: address[0],
    detail: address[1],
    pos,
    reg: `46150-${reg}`,
    specialties,
    deals,
    complexes,
    hours: officeHours,
  };
}

const FEATURED: OfficeDef[] = [
  {
    ...office(
      'B01',
      '신대중앙',
      '김서진',
      'haeryong',
      ['신대1로 18', '105호'],
      [61.2, 82.4],
      '2017-00112',
      [A.APT],
      [0, 38, 16, 8],
      ['C01', 'C06'],
      H.long,
    ),
    tagline: '신대 레이크파크 단지 전문',
    intro:
      '신대지구 입주 첫해부터 레이크파크 단지만 봐 왔습니다. 동·호수별 일조와 조망 차이를 사진과 함께 정리해 드려요.',
    deals30d: 14,
    responseMin: 12,
    members: [
      { displayName: '김서진', title: '대표', isLicensed: true, role: 'OWNER' },
      { displayName: '문가은', title: '소속공인중개사', isLicensed: true, role: 'AGENT' },
      { displayName: '서도윤', title: '중개보조원', isLicensed: false, role: 'AGENT' },
    ],
  },
  {
    ...office(
      'B02',
      '호수공원',
      '한서윤',
      'jorye',
      ['호수공원길 24', '1층'],
      [59.33, 29.72],
      '2014-00038',
      [A.APT],
      [0, 24, 13, 9],
      ['C04', 'C02'],
      H.long,
    ),
    tagline: '연향·조례 아파트 전문',
    intro:
      '조례호수공원 앞에서 12년째 연향·조례 아파트만 중개합니다. 일조와 관리비까지 직접 확인한 매물만 올려요.',
    deals30d: 9,
    responseMin: 8,
    members: [
      { displayName: '한서윤', title: '대표', isLicensed: true, role: 'OWNER' },
      { displayName: '오지후', title: '소속공인중개사', isLicensed: true, role: 'AGENT' },
    ],
  },
  {
    ...office(
      'B03',
      '연향센트럴',
      '박도현',
      'yeonhyang',
      ['연향3로 41', '102호'],
      [47.08, 55.56],
      '2016-00071',
      [A.APT],
      [0, 22, 10, 6],
      ['C02', 'C07'],
    ),
    tagline: '연향 센트럴 단지 전문',
    intro:
      '연향 센트럴 상가에 있는 사무소입니다. 같은 평형이라도 동마다 다른 소음과 주차 여건을 솔직하게 알려 드립니다.',
    deals30d: 7,
    responseMin: 20,
  },
  {
    ...office(
      'B04',
      '오천그린',
      '이하린',
      'ocheon',
      ['오천2길 7', '1층'],
      [36, 88],
      '2012-00026',
      [A.APT, A.HOUSE],
      [0, 15, 6, 8],
      ['C05'],
    ),
    tagline: '오천지구 전문',
    intro:
      '오천지구 아파트와 단독주택을 함께 봅니다. 아이 키우는 집 기준으로 학교와 통학로부터 안내해 드려요.',
    deals30d: 6,
    responseMin: 15,
  },
  {
    ...office(
      'B05',
      '선월 분양권',
      '정민재',
      'haeryong',
      ['선월로 30', '상가 B동 101호'],
      [78, 88],
      '2021-00045',
      [A.APT],
      [40, 6, 2, 3],
      ['C03', 'C09'],
      H.long,
    ),
    tagline: '분양권 전문',
    intro:
      '선월지구와 연향들 분양권을 전문으로 합니다. 프리미엄 추이와 중도금·잔금 일정까지 표로 정리해 드립니다.',
    deals30d: 11,
    responseMin: 10,
  },
  {
    ...office(
      'B06',
      '순천대정문',
      '최유나',
      'seokhyeon',
      ['대학로 15', '1층'],
      [31, 15.3],
      '2015-00064',
      [A.ONEROOM, A.OFFICETEL],
      [0, 4, 12, 58],
      [],
      H.campus,
    ),
    tagline: '원룸·투룸 전문',
    intro:
      '국립순천대 정문 앞에서 원룸·투룸만 중개합니다. 직접 찍은 사진과 관리비 포함 내역을 그대로 올립니다.',
    deals30d: 22,
    responseMin: 6,
  },
  {
    ...office(
      'B07',
      '금당리버',
      '윤재희',
      'yeonhyang',
      ['금당로 9', '103호'],
      [62.5, 68.06],
      '2019-00090',
      [A.APT],
      [0, 14, 5, 3],
      ['C07'],
    ),
    tagline: '금당지구 전문',
    intro: '금당 리버뷰를 중심으로 금당지구 아파트를 중개합니다.',
    deals30d: 4,
    responseMin: 25,
  },
  {
    ...office(
      'B08',
      '왕지숲',
      '강태오',
      'wangji',
      ['왕지2로 33', '1층'],
      [75.42, 24.72],
      '2018-00057',
      [A.APT, A.LAND],
      [0, 10, 4, 5],
      ['C08', 'C04'],
      H.weekdays,
    ),
    tagline: '왕지·조례 전문',
    intro: '왕지 숲속마을과 조례동 아파트, 왕지동 일대 토지를 함께 봅니다.',
    deals30d: 3,
    responseMin: 30,
  },
];

// prettier-ignore
const OTHERS: OfficeDef[] = [
  // Small offices drawn as dots on the design map (조례·연향 일대)
  office('B09', '연향역전', '임수아', 'yeonhyang', ['연향1로 62', '1층'], [52.33, 41.67], '2020-00018', [A.APT, A.COMMERCIAL], [0, 6, 3, 2], ['C02']),
  office('B10', '연향 한빛', '조은호', 'yeonhyang', ['연향번영길 14', '2층'], [40.67, 66.94], '2013-00041', [A.APT], [0, 5, 2, 2], ['C07'], H.weekdays),
  office('B11', '금당 제일', '배성민', 'yeonhyang', ['금당1길 27', '101호'], [55.33, 61.11], '2011-00009', [A.APT, A.ONEROOM], [0, 7, 3, 2], ['C07', 'C02']),
  office('B12', '조례 그린', '신예린', 'jorye', ['조례1길 8', '1층'], [49.67, 23.06], '2016-00102', [A.APT], [0, 4, 2, 2], ['C04']),
  office('B13', '금당 중앙', '권하준', 'yeonhyang', ['금당중앙로 51', '105호'], [65.83, 45.83], '2019-00033', [A.COMMERCIAL, A.APT], [0, 4, 1, 2], ['C07'], H.weekdays),
  office('B14', '연향 우리', '황보람', 'yeonhyang', ['연향2로 19', '1층'], [37.17, 44.17], '2010-00077', [A.APT, A.HOUSE], [0, 3, 2, 1], ['C02'], null),
  // 석현동 (국립순천대 앞) — one cluster on the default view together with B06
  office('B15', '대학로', '유채원', 'seokhyeon', ['대학로 22', '1층'], [32.6, 13.4], '2018-00021', [A.ONEROOM], [0, 1, 6, 24], [], H.campus),
  office('B16', '석현캠퍼스', '남궁현', 'seokhyeon', ['석현길 31', '102호'], [30.2, 17.6], '2020-00066', [A.ONEROOM], [0, 0, 4, 19], [], H.campus),
  office('B17', '향림', '차민서', 'seokhyeon', ['향림길 5', '1층'], [34.4, 16.8], '2009-00015', [A.ONEROOM, A.HOUSE], [0, 3, 3, 11]),
  office('B18', '한솔', '표지안', 'seokhyeon', ['대학로 40', '2층'], [35.6, 12.6], '2022-00008', [A.ONEROOM], [0, 0, 2, 12], [], H.campus),
  office('B19', '청춘원룸', '도하윤', 'seokhyeon', ['석현1길 12', '1층'], [29.8, 19.4], '2023-00031', [A.ONEROOM], [0, 0, 1, 9], [], H.campus),
  // 신대지구 (해룡면) — one cluster together with B01
  office('B20', '신대호수', '고은채', 'haeryong', ['신대2로 6', '103호'], [58.6, 81.4], '2018-00093', [A.APT], [0, 19, 8, 4], ['C06', 'C01'], H.long),
  office('B21', '레이크파크', '진서후', 'haeryong', ['신대1로 44', '101호'], [60.1, 84.8], '2019-00012', [A.APT], [0, 16, 7, 3], ['C01']),
  office('B22', '신대으뜸', '변지호', 'haeryong', ['신대3로 15', '1층'], [56.4, 83.2], '2019-00054', [A.APT, A.COMMERCIAL], [0, 12, 5, 4], ['C06']),
  office('B23', '신대새봄', '엄다인', 'haeryong', ['신대2로 28', '104호'], [57.8, 86.6], '2020-00027', [A.APT], [0, 11, 4, 3], ['C01', 'C06']),
  office('B24', '해룡탑', '석민규', 'haeryong', ['신대4로 9', '1층'], [61.9, 87.2], '2015-00088', [A.LAND, A.HOUSE], [0, 13, 1, 1], [], H.weekdays),
  office('B25', '신대한결', '방소율', 'haeryong', ['신대1로 71', '102호'], [59.2, 88.4], '2021-00014', [A.APT], [1, 8, 3, 2], ['C01', 'C03']),
  office('B26', '신대푸른', '옥재윤', 'haeryong', ['신대3로 33', '201호'], [55.6, 85.6], '2021-00059', [A.APT], [0, 7, 3, 2], ['C06']),
  office('B27', '신대프라임', '탁유진', 'haeryong', ['신대2로 52', '1층'], [60.8, 89.6], '2022-00036', [A.APT, A.COMMERCIAL], [2, 5, 2, 2], ['C01', 'C03'], H.long),
  office('B28', '신대드림', '길하람', 'haeryong', ['신대5로 3', '105호'], [57.1, 89.2], '2022-00071', [A.APT], [0, 5, 2, 1], ['C06'], H.weekdays),
  office('B29', '신대미소', '어진우', 'haeryong', ['신대1로 90', '1층'], [62.2, 84.6], '2023-00019', [A.APT], [0, 4, 2, 1], ['C01']),
  office('B30', '신대행복', '함서아', 'haeryong', ['신대4로 26', '102호'], [58.9, 83.6], '2024-00007', [A.APT, A.ONEROOM], [0, 3, 1, 2], ['C06'], null),
  // 그 밖의 동
  office('B31', '오천사랑', '제갈민', 'ocheon', ['오천1길 21', '1층'], [30, 84], '2017-00048', [A.APT], [0, 8, 3, 3], ['C05']),
  office('B32', '오천정원', '소유빈', 'ocheon', ['오천3길 4', '101호'], [41, 93], '2020-00083', [A.APT, A.LAND], [0, 6, 2, 1], ['C05'], H.weekdays),
  office('B33', '왕지으뜸', '여준서', 'wangji', ['왕지1로 12', '1층'], [82, 14], '2014-00091', [A.APT, A.HOUSE], [0, 7, 3, 2], ['C08']),
  office('B34', '왕지푸른', '모아린', 'wangji', ['왕지3길 8', '2층'], [71, 17], '2021-00025', [A.APT], [0, 5, 2, 2], ['C08']),
  office('B35', '덕연', '은시우', 'deogyeon', ['덕연길 17', '1층'], [24, 27], '2008-00033', [A.HOUSE, A.COMMERCIAL], [0, 9, 2, 5]),
  office('B36', '덕연새집', '추하은', 'deogyeon', ['덕연2길 30', '1층'], [19.5, 34], '2019-00067', [A.HOUSE, A.ONEROOM], [0, 4, 2, 6], [], H.weekdays),
  office('B37', '순천역', '반도겸', 'jangcheon', ['역전길 11', '1층'], [17, 74], '2012-00058', [A.ONEROOM, A.COMMERCIAL], [0, 5, 3, 13], [], H.long),
  office('B38', '장천', '설가온', 'jangcheon', ['장천3길 2', '1층'], [23, 68], '2007-00014', [A.COMMERCIAL, A.HOUSE], [0, 8, 1, 4]),
  office('B39', '풍덕정원', '명하늘', 'pungdeok', ['풍덕길 45', '1층'], [66, 92], '2016-00039', [A.LAND, A.HOUSE], [0, 11, 0, 1], [], H.weekdays),
  office('B40', '조례중앙', '봉지율', 'jorye', ['조례못등길 9', '102호'], [44, 12], '2013-00084', [A.APT, A.COMMERCIAL], [0, 9, 4, 4], ['C04']),
  office('B41', '조례한마음', '천유준', 'jorye', ['조례3길 16', '1층'], [55, 14], '2018-00076', [A.APT], [0, 6, 3, 1], ['C04', 'C02']),
];

export const OFFICES: readonly OfficeDef[] = [...FEATURED, ...OTHERS];
