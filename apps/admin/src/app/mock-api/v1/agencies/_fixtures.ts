import { agencyIdOf } from '../admin/banners/_ids';

/** 중개사무소 of mockdata.md §4 — only the fields pickers read. Phone numbers are placeholders. */
export interface MockAgency {
  key: string;
  id: string;
  name: string;
  representativeName: string;
  roadAddress: string;
  emdName: string;
  phone: string;
}

const agency = (
  key: string,
  name: string,
  representativeName: string,
  emdName: string,
  road: string,
): MockAgency => ({
  key,
  id: agencyIdOf(key),
  name: `${name} 공인중개사사무소`,
  representativeName,
  emdName,
  roadAddress: `전라남도 순천시 ${road}`,
  phone: '0610000000',
});

export const AGENCIES: readonly MockAgency[] = [
  agency('B01', '신대중앙', '김서진', '해룡면', '해룡면 신대1로 18'),
  agency('B02', '호수공원', '한서윤', '조례동', '조례동 호수공원길 24'),
  agency('B03', '연향센트럴', '박도현', '연향동', '연향동 연향3로 41'),
  agency('B04', '오천그린', '이하린', '오천동', '오천동 오천2길 7'),
  agency('B05', '선월 분양권', '정민재', '해룡면', '해룡면 선월로 30'),
  agency('B06', '순천대정문', '최유나', '석현동', '석현동 대학로 15'),
  agency('B07', '금당리버', '윤재희', '연향동', '연향동 금당로 9'),
  agency('B08', '왕지숲', '강태오', '왕지동', '왕지동 왕지2로 33'),
];

export const agencyByKey = (key: string): MockAgency => {
  const found = AGENCIES.find((a) => a.key === key);
  if (!found) throw new Error(`unknown mock agency ${key}`);
  return found;
};
export const agencyById = (id: string | null | undefined): MockAgency | undefined =>
  AGENCIES.find((a) => a.id === id);
