import { DEFAULT_SIDO_CODE, DEFAULT_SIDO_NAME } from '@house/shared';

/**
 * 법정동 reference data for 전남광주통합특별시 순천시 (시군구 12150): 33 동 + 1 읍 10 면 and their 리.
 * Source: 행정안전부 법정동코드 (active codes), verified against Kakao Local on 2026-11-25.
 * 읍면동 codes are 8 digits (법정동코드 without the trailing 00), 리 codes 10.
 * On 2026-07-01 전라남도 순천시 (46150) became 전남광주통합특별시 순천시 (12150); only the
 * 시도·시군구 digits changed, so every code below is the former code with 46150 → 12150
 * (왕지동 46150132 → 12150132, 신대리 4615031022 → 1215031022).
 * When REGION_SGG_CODE does not match SUNCHEON_SGG_CODE the bundled seed refuses to run and
 * regions are maintained through PUT /api/v1/admin/regions/:code instead.
 */
export const SUNCHEON_SGG_CODE = '12150';
export const SUNCHEON_SIDO = { code: DEFAULT_SIDO_CODE, name: DEFAULT_SIDO_NAME } as const;
export const SUNCHEON_SGG = {
  name: '순천시',
  fullName: `${DEFAULT_SIDO_NAME} 순천시`,
  lat: 34.950637,
  lng: 127.487214,
} as const;

/** One 법정동 (읍면동 or 리) of 순천시. */
export interface SuncheonRegion {
  /** 8 digits for a 읍면동, 10 for a 리 (법정동코드 without the trailing 00 of a 읍면동). */
  code: string;
  name: string;
  level: 'EMD' | 'RI';
  /** 시군구 12150 for a 읍면동, the 8-digit 읍면 for a 리. */
  parentCode: string;
  /** Representative point (Kakao Local 주소 검색 result for the name; 읍·면: around the 사무소). */
  lat: number;
  lng: number;
}

/**
 * Every active 법정동 of 순천시 in 법정동코드 order (33 동, 1 읍, 10 면, 163 리 = 207), each 리 after
 * its 읍면. Verified 2026-11-25 against Kakao Local (which serves the 행안부 법정동코드): 207 exact
 * address searches plus ~1,000 coord2regioncode grid points over the city found no wrong,
 * missing or extra code. 주암면 has no 1215035027 (gap in the official numbering).
 * Some 리 names repeat under different 읍면 (신성리: 승주읍 and 해룡면) — look 리 up by code or
 * by (읍면, 리), never by name alone.
 */
// prettier-ignore
export const SUNCHEON_REGIONS: readonly SuncheonRegion[] = [
  { code: '12150101', name: '삼거동', level: 'EMD', parentCode: '12150', lat: 34.986874, lng: 127.423876 },
  { code: '12150102', name: '와룡동', level: 'EMD', parentCode: '12150', lat: 34.959152, lng: 127.451749 },
  { code: '12150103', name: '영동', level: 'EMD', parentCode: '12150', lat: 34.954001, lng: 127.482428 },
  { code: '12150104', name: '옥천동', level: 'EMD', parentCode: '12150', lat: 34.951993, lng: 127.472147 },
  { code: '12150105', name: '행동', level: 'EMD', parentCode: '12150', lat: 34.955738, lng: 127.482452 },
  { code: '12150106', name: '금곡동', level: 'EMD', parentCode: '12150', lat: 34.961393, lng: 127.467397 },
  { code: '12150107', name: '매곡동', level: 'EMD', parentCode: '12150', lat: 34.964091, lng: 127.482763 },
  { code: '12150108', name: '석현동', level: 'EMD', parentCode: '12150', lat: 34.984874, lng: 127.455588 },
  { code: '12150109', name: '가곡동', level: 'EMD', parentCode: '12150', lat: 34.98461, lng: 127.479037 },
  { code: '12150110', name: '용당동', level: 'EMD', parentCode: '12150', lat: 34.970791, lng: 127.497756 },
  { code: '12150111', name: '조곡동', level: 'EMD', parentCode: '12150', lat: 34.950081, lng: 127.498559 },
  { code: '12150112', name: '생목동', level: 'EMD', parentCode: '12150', lat: 34.953773, lng: 127.508115 },
  { code: '12150113', name: '덕암동', level: 'EMD', parentCode: '12150', lat: 34.945869, lng: 127.50667 },
  { code: '12150114', name: '연향동', level: 'EMD', parentCode: '12150', lat: 34.939582, lng: 127.521019 },
  { code: '12150115', name: '풍덕동', level: 'EMD', parentCode: '12150', lat: 34.941855, lng: 127.497301 },
  { code: '12150116', name: '남정동', level: 'EMD', parentCode: '12150', lat: 34.93977, lng: 127.484245 },
  { code: '12150117', name: '인제동', level: 'EMD', parentCode: '12150', lat: 34.942232, lng: 127.476045 },
  { code: '12150118', name: '저전동', level: 'EMD', parentCode: '12150', lat: 34.948135, lng: 127.484084 },
  { code: '12150119', name: '장천동', level: 'EMD', parentCode: '12150', lat: 34.948474, lng: 127.48677 },
  { code: '12150120', name: '남내동', level: 'EMD', parentCode: '12150', lat: 34.954018, lng: 127.485209 },
  { code: '12150121', name: '중앙동', level: 'EMD', parentCode: '12150', lat: 34.956057, lng: 127.484897 },
  { code: '12150122', name: '동외동', level: 'EMD', parentCode: '12150', lat: 34.957023, lng: 127.487671 },
  { code: '12150123', name: '교량동', level: 'EMD', parentCode: '12150', lat: 34.903583, lng: 127.512813 },
  { code: '12150124', name: '대룡동', level: 'EMD', parentCode: '12150', lat: 34.905964, lng: 127.490572 },
  { code: '12150125', name: '홍내동', level: 'EMD', parentCode: '12150', lat: 34.916316, lng: 127.509683 },
  { code: '12150126', name: '오천동', level: 'EMD', parentCode: '12150', lat: 34.927938, lng: 127.497287 },
  { code: '12150127', name: '덕월동', level: 'EMD', parentCode: '12150', lat: 34.927552, lng: 127.479222 },
  { code: '12150128', name: '야흥동', level: 'EMD', parentCode: '12150', lat: 34.913049, lng: 127.480762 },
  { code: '12150129', name: '인월동', level: 'EMD', parentCode: '12150', lat: 34.891564, lng: 127.48142 },
  { code: '12150130', name: '안풍동', level: 'EMD', parentCode: '12150', lat: 34.887617, lng: 127.494607 },
  { code: '12150131', name: '대대동', level: 'EMD', parentCode: '12150', lat: 34.890784, lng: 127.510025 },
  { code: '12150132', name: '왕지동', level: 'EMD', parentCode: '12150', lat: 34.975169, lng: 127.538021 },
  { code: '12150133', name: '조례동', level: 'EMD', parentCode: '12150', lat: 34.961766, lng: 127.523528 },
  { code: '12150250', name: '승주읍', level: 'EMD', parentCode: '12150', lat: 35.014426, lng: 127.389866 },
  { code: '1215025021', name: '두월리', level: 'RI', parentCode: '12150250', lat: 35.03908, lng: 127.325059 },
  { code: '1215025022', name: '신전리', level: 'RI', parentCode: '12150250', lat: 35.017844, lng: 127.330462 },
  { code: '1215025023', name: '유흥리', level: 'RI', parentCode: '12150250', lat: 35.0522, lng: 127.338471 },
  { code: '1215025024', name: '봉덕리', level: 'RI', parentCode: '12150250', lat: 35.021938, lng: 127.355365 },
  { code: '1215025025', name: '평중리', level: 'RI', parentCode: '12150250', lat: 35.022383, lng: 127.370417 },
  { code: '1215025026', name: '구강리', level: 'RI', parentCode: '12150250', lat: 35.034001, lng: 127.37822 },
  { code: '1215025027', name: '도정리', level: 'RI', parentCode: '12150250', lat: 35.055288, lng: 127.366589 },
  { code: '1215025028', name: '월계리', level: 'RI', parentCode: '12150250', lat: 35.022866, lng: 127.407701 },
  { code: '1215025029', name: '서평리', level: 'RI', parentCode: '12150250', lat: 35.018451, lng: 127.389421 },
  { code: '1215025030', name: '신성리', level: 'RI', parentCode: '12150250', lat: 35.002476, lng: 127.392592 },
  { code: '1215025031', name: '신학리', level: 'RI', parentCode: '12150250', lat: 35.000799, lng: 127.362442 },
  { code: '1215025032', name: '죽학리', level: 'RI', parentCode: '12150250', lat: 34.992635, lng: 127.33798 },
  { code: '1215025033', name: '유평리', level: 'RI', parentCode: '12150250', lat: 34.986949, lng: 127.379668 },
  { code: '1215025034', name: '남강리', level: 'RI', parentCode: '12150250', lat: 34.972311, lng: 127.356937 },
  { code: '12150310', name: '해룡면', level: 'EMD', parentCode: '12150', lat: 34.913722, lng: 127.537707 },
  { code: '1215031021', name: '복성리', level: 'RI', parentCode: '12150310', lat: 34.954538, lng: 127.547152 },
  { code: '1215031022', name: '신대리', level: 'RI', parentCode: '12150310', lat: 34.933343, lng: 127.560128 },
  { code: '1215031023', name: '상삼리', level: 'RI', parentCode: '12150310', lat: 34.942299, lng: 127.537705 },
  { code: '1215031024', name: '대안리', level: 'RI', parentCode: '12150310', lat: 34.918542, lng: 127.524659 },
  { code: '1215031025', name: '남가리', level: 'RI', parentCode: '12150310', lat: 34.929187, lng: 127.539042 },
  { code: '1215031026', name: '월전리', level: 'RI', parentCode: '12150310', lat: 34.911542, lng: 127.535084 },
  { code: '1215031027', name: '성산리', level: 'RI', parentCode: '12150310', lat: 34.914497, lng: 127.549018 },
  { code: '1215031028', name: '선월리', level: 'RI', parentCode: '12150310', lat: 34.9105, lng: 127.560507 },
  { code: '1215031029', name: '신성리', level: 'RI', parentCode: '12150310', lat: 34.906896, lng: 127.581657 },
  { code: '1215031030', name: '호두리', level: 'RI', parentCode: '12150310', lat: 34.896885, lng: 127.566077 },
  { code: '1215031031', name: '용전리', level: 'RI', parentCode: '12150310', lat: 34.894155, lng: 127.549754 },
  { code: '1215031032', name: '도롱리', level: 'RI', parentCode: '12150310', lat: 34.902771, lng: 127.533863 },
  { code: '1215031033', name: '중흥리', level: 'RI', parentCode: '12150310', lat: 34.897053, lng: 127.534522 },
  { code: '1215031034', name: '해창리', level: 'RI', parentCode: '12150310', lat: 34.890525, lng: 127.533311 },
  { code: '1215031035', name: '선학리', level: 'RI', parentCode: '12150310', lat: 34.877715, lng: 127.526692 },
  { code: '1215031036', name: '농주리', level: 'RI', parentCode: '12150310', lat: 34.86459, lng: 127.527789 },
  { code: '1215031037', name: '상내리', level: 'RI', parentCode: '12150310', lat: 34.848014, lng: 127.534476 },
  { code: '1215031038', name: '하사리', level: 'RI', parentCode: '12150310', lat: 34.859883, lng: 127.543734 },
  { code: '12150320', name: '서면', level: 'EMD', parentCode: '12150', lat: 34.994719, lng: 127.488354 },
  { code: '1215032021', name: '학구리', level: 'RI', parentCode: '12150320', lat: 35.042523, lng: 127.437697 },
  { code: '1215032022', name: '대구리', level: 'RI', parentCode: '12150320', lat: 35.032429, lng: 127.424147 },
  { code: '1215032023', name: '구만리', level: 'RI', parentCode: '12150320', lat: 35.029759, lng: 127.453623 },
  { code: '1215032024', name: '비월리', level: 'RI', parentCode: '12150320', lat: 35.010724, lng: 127.448233 },
  { code: '1215032025', name: '동산리', level: 'RI', parentCode: '12150320', lat: 35.001283, lng: 127.472514 },
  { code: '1215032026', name: '운평리', level: 'RI', parentCode: '12150320', lat: 35.029189, lng: 127.476146 },
  { code: '1215032027', name: '죽평리', level: 'RI', parentCode: '12150320', lat: 35.003572, lng: 127.492569 },
  { code: '1215032028', name: '선평리', level: 'RI', parentCode: '12150320', lat: 34.987937, lng: 127.499932 },
  { code: '1215032029', name: '압곡리', level: 'RI', parentCode: '12150320', lat: 34.995393, lng: 127.528133 },
  { code: '1215032030', name: '구상리', level: 'RI', parentCode: '12150320', lat: 35.014716, lng: 127.542425 },
  { code: '1215032031', name: '흥대리', level: 'RI', parentCode: '12150320', lat: 35.020833, lng: 127.554856 },
  { code: '1215032032', name: '지본리', level: 'RI', parentCode: '12150320', lat: 35.002524, lng: 127.509692 },
  { code: '1215032033', name: '판교리', level: 'RI', parentCode: '12150320', lat: 35.028974, lng: 127.510448 },
  { code: '1215032034', name: '청소리', level: 'RI', parentCode: '12150320', lat: 35.063283, lng: 127.506267 },
  { code: '12150330', name: '황전면', level: 'EMD', parentCode: '12150', lat: 35.101366, lng: 127.427013 },
  { code: '1215033021', name: '죽청리', level: 'RI', parentCode: '12150330', lat: 35.07259, lng: 127.453952 },
  { code: '1215033022', name: '평촌리', level: 'RI', parentCode: '12150330', lat: 35.082762, lng: 127.478211 },
  { code: '1215033023', name: '수평리', level: 'RI', parentCode: '12150330', lat: 35.097329, lng: 127.438718 },
  { code: '1215033024', name: '괴목리', level: 'RI', parentCode: '12150330', lat: 35.092762, lng: 127.422261 },
  { code: '1215033025', name: '죽내리', level: 'RI', parentCode: '12150330', lat: 35.123647, lng: 127.418831 },
  { code: '1215033026', name: '황학리', level: 'RI', parentCode: '12150330', lat: 35.104408, lng: 127.45509 },
  { code: '1215033027', name: '월산리', level: 'RI', parentCode: '12150330', lat: 35.122285, lng: 127.437961 },
  { code: '1215033028', name: '내구리', level: 'RI', parentCode: '12150330', lat: 35.122602, lng: 127.456718 },
  { code: '1215033029', name: '봉덕리', level: 'RI', parentCode: '12150330', lat: 35.14039, lng: 127.431456 },
  { code: '1215033030', name: '선변리', level: 'RI', parentCode: '12150330', lat: 35.148637, lng: 127.454563 },
  { code: '1215033031', name: '비촌리', level: 'RI', parentCode: '12150330', lat: 35.168442, lng: 127.428689 },
  { code: '1215033032', name: '금평리', level: 'RI', parentCode: '12150330', lat: 35.143839, lng: 127.474104 },
  { code: '1215033033', name: '대치리', level: 'RI', parentCode: '12150330', lat: 35.130082, lng: 127.48493 },
  { code: '1215033034', name: '모전리', level: 'RI', parentCode: '12150330', lat: 35.111359, lng: 127.474855 },
  { code: '1215033035', name: '회룡리', level: 'RI', parentCode: '12150330', lat: 35.107668, lng: 127.487294 },
  { code: '1215033036', name: '덕림리', level: 'RI', parentCode: '12150330', lat: 35.101202, lng: 127.513841 },
  { code: '12150340', name: '월등면', level: 'EMD', parentCode: '12150', lat: 35.093401, lng: 127.380538 },
  { code: '1215034021', name: '대평리', level: 'RI', parentCode: '12150340', lat: 35.097827, lng: 127.378707 },
  { code: '1215034022', name: '농선리', level: 'RI', parentCode: '12150340', lat: 35.104708, lng: 127.41683 },
  { code: '1215034023', name: '월용리', level: 'RI', parentCode: '12150340', lat: 35.113899, lng: 127.396092 },
  { code: '1215034024', name: '신월리', level: 'RI', parentCode: '12150340', lat: 35.089974, lng: 127.353993 },
  { code: '1215034025', name: '운월리', level: 'RI', parentCode: '12150340', lat: 35.076472, lng: 127.34982 },
  { code: '1215034026', name: '갈평리', level: 'RI', parentCode: '12150340', lat: 35.07931, lng: 127.370587 },
  { code: '1215034027', name: '송천리', level: 'RI', parentCode: '12150340', lat: 35.082609, lng: 127.384335 },
  { code: '1215034028', name: '망용리', level: 'RI', parentCode: '12150340', lat: 35.080425, lng: 127.407382 },
  { code: '1215034029', name: '계월리', level: 'RI', parentCode: '12150340', lat: 35.065262, lng: 127.414103 },
  { code: '1215034030', name: '월림리', level: 'RI', parentCode: '12150340', lat: 35.077291, lng: 127.393345 },
  { code: '12150350', name: '주암면', level: 'EMD', parentCode: '12150', lat: 35.076789, lng: 127.235071 },
  { code: '1215035021', name: '행정리', level: 'RI', parentCode: '12150350', lat: 35.030488, lng: 127.301408 },
  { code: '1215035022', name: '갈마리', level: 'RI', parentCode: '12150350', lat: 35.057803, lng: 127.2928 },
  { code: '1215035023', name: '주암리', level: 'RI', parentCode: '12150350', lat: 35.064884, lng: 127.305998 },
  { code: '1215035024', name: '오산리', level: 'RI', parentCode: '12150350', lat: 35.0744, lng: 127.286285 },
  { code: '1215035025', name: '창촌리', level: 'RI', parentCode: '12150350', lat: 35.05623, lng: 127.283955 },
  { code: '1215035026', name: '복다리', level: 'RI', parentCode: '12150350', lat: 35.044398, lng: 127.282116 },
  { code: '1215035028', name: '요곡리', level: 'RI', parentCode: '12150350', lat: 35.061961, lng: 127.262413 },
  { code: '1215035029', name: '구산리', level: 'RI', parentCode: '12150350', lat: 35.070155, lng: 127.245771 },
  { code: '1215035030', name: '죽림리', level: 'RI', parentCode: '12150350', lat: 35.075821, lng: 127.252178 },
  { code: '1215035031', name: '고산리', level: 'RI', parentCode: '12150350', lat: 35.081366, lng: 127.265818 },
  { code: '1215035032', name: '대광리', level: 'RI', parentCode: '12150350', lat: 35.051073, lng: 127.220323 },
  { code: '1215035033', name: '광천리', level: 'RI', parentCode: '12150350', lat: 35.07493, lng: 127.226676 },
  { code: '1215035034', name: '비룡리', level: 'RI', parentCode: '12150350', lat: 35.07882, lng: 127.200358 },
  { code: '1215035035', name: '한곡리', level: 'RI', parentCode: '12150350', lat: 35.088014, lng: 127.232735 },
  { code: '1215035036', name: '어왕리', level: 'RI', parentCode: '12150350', lat: 35.091356, lng: 127.223024 },
  { code: '1215035037', name: '백록리', level: 'RI', parentCode: '12150350', lat: 35.107409, lng: 127.220422 },
  { code: '1215035038', name: '대구리', level: 'RI', parentCode: '12150350', lat: 35.104853, lng: 127.237139 },
  { code: '1215035039', name: '궁각리', level: 'RI', parentCode: '12150350', lat: 35.09471, lng: 127.252065 },
  { code: '1215035040', name: '운룡리', level: 'RI', parentCode: '12150350', lat: 35.106145, lng: 127.198372 },
  { code: '1215035041', name: '문길리', level: 'RI', parentCode: '12150350', lat: 35.046476, lng: 127.267002 },
  { code: '12150360', name: '송광면', level: 'EMD', parentCode: '12150', lat: 34.974081, lng: 127.263841 },
  { code: '1215036021', name: '오봉리', level: 'RI', parentCode: '12150360', lat: 35.034139, lng: 127.251523 },
  { code: '1215036022', name: '신흥리', level: 'RI', parentCode: '12150360', lat: 35.020097, lng: 127.274284 },
  { code: '1215036023', name: '신평리', level: 'RI', parentCode: '12150360', lat: 35.001863, lng: 127.266564 },
  { code: '1215036024', name: '낙수리', level: 'RI', parentCode: '12150360', lat: 35.027285, lng: 127.239195 },
  { code: '1215036025', name: '삼청리', level: 'RI', parentCode: '12150360', lat: 35.028487, lng: 127.206845 },
  { code: '1215036026', name: '후곡리', level: 'RI', parentCode: '12150360', lat: 35.011223, lng: 127.209607 },
  { code: '1215036027', name: '월산리', level: 'RI', parentCode: '12150360', lat: 34.990832, lng: 127.195333 },
  { code: '1215036028', name: '대곡리', level: 'RI', parentCode: '12150360', lat: 34.998552, lng: 127.232083 },
  { code: '1215036029', name: '우산리', level: 'RI', parentCode: '12150360', lat: 34.964966, lng: 127.222681 },
  { code: '1215036030', name: '덕산리', level: 'RI', parentCode: '12150360', lat: 34.971996, lng: 127.245429 },
  { code: '1215036031', name: '봉산리', level: 'RI', parentCode: '12150360', lat: 34.987475, lng: 127.259192 },
  { code: '1215036032', name: '이읍리', level: 'RI', parentCode: '12150360', lat: 34.973379, lng: 127.269787 },
  { code: '1215036033', name: '장안리', level: 'RI', parentCode: '12150360', lat: 34.975836, lng: 127.299893 },
  { code: '1215036034', name: '구룡리', level: 'RI', parentCode: '12150360', lat: 34.947624, lng: 127.258681 },
  { code: '1215036035', name: '대흥리', level: 'RI', parentCode: '12150360', lat: 34.934498, lng: 127.252703 },
  { code: '12150370', name: '외서면', level: 'EMD', parentCode: '12150', lat: 34.913715, lng: 127.277401 },
  { code: '1215037021', name: '신덕리', level: 'RI', parentCode: '12150370', lat: 34.914361, lng: 127.297218 },
  { code: '1215037022', name: '쌍율리', level: 'RI', parentCode: '12150370', lat: 34.936698, lng: 127.295386 },
  { code: '1215037023', name: '금성리', level: 'RI', parentCode: '12150370', lat: 34.937455, lng: 127.275309 },
  { code: '1215037024', name: '월암리', level: 'RI', parentCode: '12150370', lat: 34.916367, lng: 127.268795 },
  { code: '1215037025', name: '도신리', level: 'RI', parentCode: '12150370', lat: 34.909646, lng: 127.248421 },
  { code: '1215037026', name: '반용리', level: 'RI', parentCode: '12150370', lat: 34.897489, lng: 127.244192 },
  { code: '1215037027', name: '화전리', level: 'RI', parentCode: '12150370', lat: 34.908906, lng: 127.277363 },
  { code: '1215037028', name: '장산리', level: 'RI', parentCode: '12150370', lat: 34.89952, lng: 127.280824 },
  { code: '12150380', name: '낙안면', level: 'EMD', parentCode: '12150', lat: 34.908062, lng: 127.346251 },
  { code: '1215038021', name: '동내리', level: 'RI', parentCode: '12150380', lat: 34.914048, lng: 127.355836 },
  { code: '1215038022', name: '남내리', level: 'RI', parentCode: '12150380', lat: 34.901772, lng: 127.334049 },
  { code: '1215038023', name: '서내리', level: 'RI', parentCode: '12150380', lat: 34.914991, lng: 127.340143 },
  { code: '1215038024', name: '성북리', level: 'RI', parentCode: '12150380', lat: 34.915809, lng: 127.34522 },
  { code: '1215038025', name: '상송리', level: 'RI', parentCode: '12150380', lat: 34.920785, lng: 127.336118 },
  { code: '1215038026', name: '하송리', level: 'RI', parentCode: '12150380', lat: 34.917353, lng: 127.320105 },
  { code: '1215038027', name: '검암리', level: 'RI', parentCode: '12150380', lat: 34.900634, lng: 127.319957 },
  { code: '1215038028', name: '옥산리', level: 'RI', parentCode: '12150380', lat: 34.89094, lng: 127.326146 },
  { code: '1215038029', name: '평촌리', level: 'RI', parentCode: '12150380', lat: 34.897452, lng: 127.339458 },
  { code: '1215038030', name: '교촌리', level: 'RI', parentCode: '12150380', lat: 34.896285, lng: 127.345506 },
  { code: '1215038031', name: '신기리', level: 'RI', parentCode: '12150380', lat: 34.871508, lng: 127.357765 },
  { code: '1215038032', name: '이곡리', level: 'RI', parentCode: '12150380', lat: 34.878955, lng: 127.349787 },
  { code: '1215038033', name: '용능리', level: 'RI', parentCode: '12150380', lat: 34.886532, lng: 127.362521 },
  { code: '1215038034', name: '내운리', level: 'RI', parentCode: '12150380', lat: 34.896278, lng: 127.36031 },
  { code: '1215038035', name: '창녕리', level: 'RI', parentCode: '12150380', lat: 34.920428, lng: 127.381616 },
  { code: '1215038036', name: '금산리', level: 'RI', parentCode: '12150380', lat: 34.940684, lng: 127.354029 },
  { code: '1215038037', name: '평사리', level: 'RI', parentCode: '12150380', lat: 34.955922, lng: 127.331886 },
  { code: '1215038038', name: '목촌리', level: 'RI', parentCode: '12150380', lat: 34.940097, lng: 127.322606 },
  { code: '1215038039', name: '석흥리', level: 'RI', parentCode: '12150380', lat: 34.967068, lng: 127.334108 },
  { code: '12150390', name: '별량면', level: 'EMD', parentCode: '12150', lat: 34.874363, lng: 127.451941 },
  { code: '1215039021', name: '봉림리', level: 'RI', parentCode: '12150390', lat: 34.874017, lng: 127.444174 },
  { code: '1215039022', name: '운천리', level: 'RI', parentCode: '12150390', lat: 34.889731, lng: 127.427722 },
  { code: '1215039023', name: '송학리', level: 'RI', parentCode: '12150390', lat: 34.890741, lng: 127.449769 },
  { code: '1215039024', name: '덕정리', level: 'RI', parentCode: '12150390', lat: 34.89516, lng: 127.463547 },
  { code: '1215039025', name: '우산리', level: 'RI', parentCode: '12150390', lat: 34.880111, lng: 127.474497 },
  { code: '1215039026', name: '쌍림리', level: 'RI', parentCode: '12150390', lat: 34.874036, lng: 127.468026 },
  { code: '1215039027', name: '학산리', level: 'RI', parentCode: '12150390', lat: 34.858957, lng: 127.487314 },
  { code: '1215039028', name: '대곡리', level: 'RI', parentCode: '12150390', lat: 34.862404, lng: 127.469876 },
  { code: '1215039029', name: '무풍리', level: 'RI', parentCode: '12150390', lat: 34.849947, lng: 127.468034 },
  { code: '1215039030', name: '마산리', level: 'RI', parentCode: '12150390', lat: 34.843841, lng: 127.448394 },
  { code: '1215039031', name: '동송리', level: 'RI', parentCode: '12150390', lat: 34.858992, lng: 127.452146 },
  { code: '1215039032', name: '원창리', level: 'RI', parentCode: '12150390', lat: 34.86787, lng: 127.430059 },
  { code: '1215039033', name: '두고리', level: 'RI', parentCode: '12150390', lat: 34.860664, lng: 127.427471 },
  { code: '1215039034', name: '구룡리', level: 'RI', parentCode: '12150390', lat: 34.839166, lng: 127.422624 },
  { code: '1215039035', name: '송기리', level: 'RI', parentCode: '12150390', lat: 34.858288, lng: 127.415941 },
  { code: '1215039036', name: '죽산리', level: 'RI', parentCode: '12150390', lat: 34.858285, lng: 127.406165 },
  { code: '1215039037', name: '금치리', level: 'RI', parentCode: '12150390', lat: 34.855, lng: 127.389852 },
  { code: '1215039038', name: '대룡리', level: 'RI', parentCode: '12150390', lat: 34.88571, lng: 127.394967 },
  { code: '12150400', name: '상사면', level: 'EMD', parentCode: '12150', lat: 34.939114, lng: 127.455186 },
  { code: '1215040021', name: '흘산리', level: 'RI', parentCode: '12150400', lat: 34.943952, lng: 127.45453 },
  { code: '1215040022', name: '응령리', level: 'RI', parentCode: '12150400', lat: 34.940111, lng: 127.444039 },
  { code: '1215040023', name: '용계리', level: 'RI', parentCode: '12150400', lat: 34.953783, lng: 127.423824 },
  { code: '1215040024', name: '도월리', level: 'RI', parentCode: '12150400', lat: 34.971844, lng: 127.40114 },
  { code: '1215040025', name: '봉래리', level: 'RI', parentCode: '12150400', lat: 34.950668, lng: 127.381524 },
  { code: '1215040026', name: '쌍지리', level: 'RI', parentCode: '12150400', lat: 34.932529, lng: 127.41013 },
  { code: '1215040027', name: '초곡리', level: 'RI', parentCode: '12150400', lat: 34.909955, lng: 127.408958 },
  { code: '1215040028', name: '용암리', level: 'RI', parentCode: '12150400', lat: 34.929556, lng: 127.437403 },
  { code: '1215040029', name: '비촌리', level: 'RI', parentCode: '12150400', lat: 34.913051, lng: 127.433192 },
  { code: '1215040030', name: '오곡리', level: 'RI', parentCode: '12150400', lat: 34.909656, lng: 127.458306 },
  { code: '1215040031', name: '마륜리', level: 'RI', parentCode: '12150400', lat: 34.923475, lng: 127.458444 },
];

const BY_CODE: ReadonlyMap<string, SuncheonRegion> = new Map(
  SUNCHEON_REGIONS.map((r) => [r.code, r]),
);

/** "전남광주통합특별시 순천시 조례동" / "전남광주통합특별시 순천시 해룡면 신대리". */
export function suncheonRegionFullName(r: SuncheonRegion): string {
  const parent = r.level === 'RI' ? BY_CODE.get(r.parentCode) : undefined;
  return [SUNCHEON_SGG.fullName, parent?.name, r.name].filter(Boolean).join(' ');
}

/**
 * The 법정동 called `name`: a 읍면동 ("조례동"), a 리 written with its 읍면 ("해룡면 신대리"), or a
 * 리 name that is unique in the city ("신대리"). Undefined when unknown or ambiguous ("신성리").
 */
export function findSuncheonRegion(name: string): SuncheonRegion | undefined {
  const parts = name.trim().split(/\s+/);
  const leaf = parts.at(-1) ?? '';
  const parentName = parts.length > 1 ? parts.at(-2) : undefined;
  const hits = SUNCHEON_REGIONS.filter(
    (r) =>
      r.name === leaf &&
      (parentName === undefined || BY_CODE.get(r.parentCode)?.name === parentName),
  );
  return hits.length === 1 ? hits[0] : undefined;
}
