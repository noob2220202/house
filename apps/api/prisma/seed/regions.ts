/**
 * 순천시 읍·면·동 (+ the 리 of the 해룡면 new towns) with approximate centre points.
 *
 * SAMPLE DATA: the names are the real 법정동 names, but the 10-digit codes below are plausible
 * placeholders laid out like 법정동코드 (46150 + 3-digit 읍면동 + 2-digit 리). Before production,
 * replace them with the official list from the 행정표준코드관리시스템 (code.go.kr) — listing
 * emdCode, 단지 emdCode, region clustering and ad targeting all key on these codes.
 */
export interface SeedRegion {
  code: string;
  name: string;
  level: 'EMD' | 'RI';
  lat: number;
  lng: number;
}

export const SUNCHEON_REGIONS: readonly SeedRegion[] = [
  // 동 (도심)
  { code: '4615010100', name: '행동', level: 'EMD', lat: 34.9528, lng: 127.4862 },
  { code: '4615010200', name: '저전동', level: 'EMD', lat: 34.9555, lng: 127.4826 },
  { code: '4615010300', name: '장천동', level: 'EMD', lat: 34.9498, lng: 127.4905 },
  { code: '4615010400', name: '남내동', level: 'EMD', lat: 34.9478, lng: 127.4846 },
  { code: '4615010500', name: '옥천동', level: 'EMD', lat: 34.9446, lng: 127.4812 },
  { code: '4615010600', name: '영동', level: 'EMD', lat: 34.952, lng: 127.489 },
  { code: '4615010700', name: '매곡동', level: 'EMD', lat: 34.9619, lng: 127.48 },
  { code: '4615010800', name: '석현동', level: 'EMD', lat: 34.9696, lng: 127.4806 },
  { code: '4615010900', name: '가곡동', level: 'EMD', lat: 34.962, lng: 127.4703 },
  { code: '4615011000', name: '용당동', level: 'EMD', lat: 34.9556, lng: 127.495 },
  { code: '4615011100', name: '조곡동', level: 'EMD', lat: 34.9408, lng: 127.4972 },
  { code: '4615011200', name: '생목동', level: 'EMD', lat: 34.9371, lng: 127.5072 },
  { code: '4615011300', name: '덕암동', level: 'EMD', lat: 34.945, lng: 127.504 },
  { code: '4615011400', name: '연향동', level: 'EMD', lat: 34.9472, lng: 127.515 },
  { code: '4615011500', name: '풍덕동', level: 'EMD', lat: 34.9403, lng: 127.515 },
  { code: '4615011600', name: '오천동', level: 'EMD', lat: 34.9372, lng: 127.484 },
  { code: '4615011700', name: '덕월동', level: 'EMD', lat: 34.931, lng: 127.495 },
  { code: '4615011800', name: '왕지동', level: 'EMD', lat: 34.9695, lng: 127.5132 },
  { code: '4615011900', name: '조례동', level: 'EMD', lat: 34.9605, lng: 127.5232 },
  // 읍·면
  { code: '4615025000', name: '승주읍', level: 'EMD', lat: 35.008, lng: 127.412 },
  { code: '4615031000', name: '주암면', level: 'EMD', lat: 35.057, lng: 127.265 },
  { code: '4615032000', name: '송광면', level: 'EMD', lat: 35.004, lng: 127.258 },
  { code: '4615033000', name: '외서면', level: 'EMD', lat: 34.988, lng: 127.288 },
  { code: '4615034000', name: '낙안면', level: 'EMD', lat: 34.908, lng: 127.342 },
  { code: '4615035000', name: '별량면', level: 'EMD', lat: 34.875, lng: 127.427 },
  { code: '4615036000', name: '상사면', level: 'EMD', lat: 34.956, lng: 127.57 },
  { code: '4615037000', name: '해룡면', level: 'EMD', lat: 34.915, lng: 127.54 },
  { code: '4615038000', name: '서면', level: 'EMD', lat: 35.005, lng: 127.469 },
  { code: '4615039000', name: '황전면', level: 'EMD', lat: 35.088, lng: 127.452 },
  { code: '4615040000', name: '월등면', level: 'EMD', lat: 35.068, lng: 127.383 },
  // 해룡면의 리 (신도시)
  { code: '4615037021', name: '신대리', level: 'RI', lat: 34.9248, lng: 127.5448 },
  { code: '4615037022', name: '선월리', level: 'RI', lat: 34.916, lng: 127.5588 },
  { code: '4615037023', name: '복성리', level: 'RI', lat: 34.928, lng: 127.533 },
];

export const REGION = Object.fromEntries(SUNCHEON_REGIONS.map((r) => [r.name, r])) as Record<
  string,
  SeedRegion
>;
