/** 읍면동 / 지구 of 순천시 (mockdata.md §0) — same codes as the user-site map mock. */
export interface MockRegion {
  code: string;
  name: string;
  parentName: string | null;
  lat: number;
  lng: number;
}

export const REGIONS: readonly MockRegion[] = [
  { code: '4615033028', name: '신대지구', parentName: '해룡면', lat: 34.9215, lng: 127.58 },
  { code: '4615033029', name: '선월지구', parentName: '해룡면', lat: 34.912, lng: 127.57 },
  { code: '4615012100', name: '연향동', parentName: null, lat: 34.947, lng: 127.53 },
  { code: '4615012000', name: '조례동', parentName: null, lat: 34.9645, lng: 127.529 },
  { code: '4615012200', name: '왕지동', parentName: null, lat: 34.978, lng: 127.551 },
  { code: '4615011900', name: '오천동', parentName: null, lat: 34.9175, lng: 127.501 },
  { code: '4615011800', name: '풍덕동', parentName: null, lat: 34.93, lng: 127.514 },
  { code: '4615011500', name: '덕연동', parentName: null, lat: 34.9555, lng: 127.506 },
  { code: '4615011000', name: '석현동', parentName: null, lat: 34.9715, lng: 127.486 },
  { code: '4615010900', name: '매곡동', parentName: null, lat: 34.962, lng: 127.4815 },
  { code: '4615010400', name: '장천동', parentName: null, lat: 34.945, lng: 127.4925 },
  { code: '4615011700', name: '덕월동', parentName: null, lat: 34.938, lng: 127.4765 },
  { code: '4615031000', name: '서면', parentName: null, lat: 34.9855, lng: 127.474 },
];

export const regionCodeOf = (name: string): string => {
  const region = REGIONS.find((r) => r.name === name);
  if (!region) throw new Error(`unknown mock region ${name}`);
  return region.code;
};
