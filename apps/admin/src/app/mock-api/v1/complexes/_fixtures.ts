import { complexIdOf } from '../admin/banners/_ids';

/** Complexes of mockdata.md §1 (+ the 분양 단지 used by AD-01) — only the fields pickers read. */
export interface MockComplex {
  code: string;
  id: string;
  name: string;
  emdName: string;
  roadAddress: string;
  households: number;
  builtYear: number | null;
}

const complex = (
  code: string,
  name: string,
  emdName: string,
  road: string,
  households: number,
  builtYear: number | null,
): MockComplex => ({
  code,
  id: complexIdOf(code),
  name,
  emdName,
  roadAddress: `전라남도 순천시 ${road}`,
  households,
  builtYear,
});

export const COMPLEXES: readonly MockComplex[] = [
  complex('C01', '신대 레이크파크 1단지', '해룡면 신대리', '해룡면 신대1로 30', 1412, 2019),
  complex('C02', '연향 센트럴', '연향동', '연향3로 12', 980, 2016),
  complex('C03', '선월 하이츠 2차', '해룡면 선월리', '해룡면 선월로 45', 1120, null),
  complex('C04', '조례 호수마을', '조례동', '호수공원길 8', 860, 2009),
  complex('C05', '오천 그린빌', '오천동', '오천2길 21', 724, 2012),
  complex('C06', '신대 레이크파크 3단지', '해룡면 신대리', '해룡면 신대3로 11', 1036, 2020),
  complex('C07', '금당 리버뷰', '연향동', '금당로 27', 808, 2005),
  complex('C08', '왕지 숲속마을', '왕지동', '왕지2로 40', 652, 2011),
  complex('C09', '연향들 더 퍼스트', '연향동', '연향들로 1', 612, null),
];

export const complexByCode = (code: string): MockComplex => {
  const found = COMPLEXES.find((c) => c.code === code);
  if (!found) throw new Error(`unknown mock complex ${code}`);
  return found;
};
