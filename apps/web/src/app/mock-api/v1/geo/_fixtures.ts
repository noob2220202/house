/**
 * Fictional Suncheon addresses for the geocode mock (road names from
 * design/drafts/system/mockdata.md §4 plus a few neighbours). Coordinates sit inside the bbox of
 * the stylized Suncheon map (StaticMapView) so pins land in the right neighbourhood.
 */
export interface MockAddress {
  roadAddress: string;
  jibunAddress: string;
  zipCode: string;
  buildingName?: string;
  lat: number;
  lng: number;
}

export const MOCK_ADDRESSES: readonly MockAddress[] = [
  {
    roadAddress: '전라남도 순천시 해룡면 신대1로 18',
    jibunAddress: '전라남도 순천시 해룡면 신대리 1978',
    zipCode: '58027',
    buildingName: '신대프라자',
    lat: 34.9362,
    lng: 127.5551,
  },
  {
    roadAddress: '전라남도 순천시 해룡면 신대1로 42',
    jibunAddress: '전라남도 순천시 해룡면 신대리 1985',
    zipCode: '58027',
    buildingName: '레이크타워',
    lat: 34.9371,
    lng: 127.5568,
  },
  {
    roadAddress: '전라남도 순천시 해룡면 신대3길 9',
    jibunAddress: '전라남도 순천시 해룡면 신대리 2011',
    zipCode: '58028',
    lat: 34.9338,
    lng: 127.5532,
  },
  {
    roadAddress: '전라남도 순천시 해룡면 선월로 30',
    jibunAddress: '전라남도 순천시 해룡면 선월리 512',
    zipCode: '58031',
    buildingName: '선월 상가 B동',
    lat: 34.9262,
    lng: 127.5702,
  },
  {
    roadAddress: '전라남도 순천시 조례동 호수공원길 24',
    jibunAddress: '전라남도 순천시 조례동 1708',
    zipCode: '57982',
    lat: 34.9578,
    lng: 127.5241,
  },
  {
    roadAddress: '전라남도 순천시 조례동 호수공원길 31',
    jibunAddress: '전라남도 순천시 조례동 1712',
    zipCode: '57982',
    buildingName: '호수타운 상가',
    lat: 34.9573,
    lng: 127.5248,
  },
  {
    roadAddress: '전라남도 순천시 조례동 조례1길 12',
    jibunAddress: '전라남도 순천시 조례동 1620',
    zipCode: '57979',
    lat: 34.9596,
    lng: 127.5213,
  },
  {
    roadAddress: '전라남도 순천시 연향동 연향3로 41',
    jibunAddress: '전라남도 순천시 연향동 1335',
    zipCode: '57996',
    buildingName: '센트럴프라자',
    lat: 34.9457,
    lng: 127.5196,
  },
  {
    roadAddress: '전라남도 순천시 연향동 금당로 9',
    jibunAddress: '전라남도 순천시 연향동 1441',
    zipCode: '57999',
    lat: 34.9418,
    lng: 127.5262,
  },
  {
    roadAddress: '전라남도 순천시 연향동 연향번영길 55',
    jibunAddress: '전라남도 순천시 연향동 1372',
    zipCode: '57997',
    lat: 34.9471,
    lng: 127.5168,
  },
  {
    roadAddress: '전라남도 순천시 오천동 오천2길 7',
    jibunAddress: '전라남도 순천시 오천동 884',
    zipCode: '58005',
    lat: 34.9268,
    lng: 127.5108,
  },
  {
    roadAddress: '전라남도 순천시 오천동 오천5길 20',
    jibunAddress: '전라남도 순천시 오천동 902',
    zipCode: '58005',
    lat: 34.9249,
    lng: 127.5131,
  },
  {
    roadAddress: '전라남도 순천시 왕지동 왕지2로 33',
    jibunAddress: '전라남도 순천시 왕지동 811',
    zipCode: '57973',
    lat: 34.9684,
    lng: 127.5342,
  },
  {
    roadAddress: '전라남도 순천시 석현동 대학로 15',
    jibunAddress: '전라남도 순천시 석현동 302',
    zipCode: '57922',
    lat: 34.9672,
    lng: 127.4816,
  },
  {
    roadAddress: '전라남도 순천시 석현동 대학로 48',
    jibunAddress: '전라남도 순천시 석현동 318',
    zipCode: '57922',
    buildingName: '해오름빌',
    lat: 34.9689,
    lng: 127.4838,
  },
  {
    roadAddress: '전라남도 순천시 덕연동 덕연로 21',
    jibunAddress: '전라남도 순천시 덕연동 147',
    zipCode: '57954',
    lat: 34.9512,
    lng: 127.5012,
  },
  {
    roadAddress: '전라남도 순천시 장천동 역전길 8',
    jibunAddress: '전라남도 순천시 장천동 62',
    zipCode: '57945',
    lat: 34.9462,
    lng: 127.4931,
  },
  {
    roadAddress: '전라남도 순천시 풍덕동 동천로 77',
    jibunAddress: '전라남도 순천시 풍덕동 1280',
    zipCode: '57990',
    lat: 34.9391,
    lng: 127.5009,
  },
];
