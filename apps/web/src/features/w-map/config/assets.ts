import { AssetType, DealType, ListingSort } from '@house/shared';
import type { PhotoKind } from '@house/ui';
import type { MapAssetSlug } from '@/config/nav';

/** Filter controls a map page can show (see components/filters). */
export type FilterKind =
  | 'category'
  | 'deal'
  | 'roomType'
  | 'area'
  | 'price'
  | 'deposit'
  | 'rent'
  | 'direction'
  | 'rooms'
  | 'baths'
  | 'floor'
  | 'built'
  | 'options'
  | 'quickOptions'
  | 'landZone'
  | 'landCategory'
  | 'more';

/** Amount scales (만원). The last step means "no upper bound". */
export type ScaleKey =
  | 'priceApt'
  | 'priceHouse'
  | 'priceShop'
  | 'priceLand'
  | 'depositApt'
  | 'depositRoom'
  | 'depositShop'
  | 'rent'
  | 'rentShop'
  | 'areaApt'
  | 'areaRoom'
  | 'areaShop'
  | 'areaLand';

export interface SortTab {
  /** First click. */
  value: ListingSort;
  /** Second click toggles to this (가격 ↑↓, 면적 ↑↓). */
  alt?: ListingSort;
  label: string;
}

export interface AssetConfig {
  slug: MapAssetSlug;
  /** GNB label: "아파트·분양권". */
  label: string;
  /** Mobile category button: "아파트". */
  shortLabel: string;
  /** Counter noun in the list header: "원룸·투룸 86개". */
  noun: string;
  /** `assetTypes` sent to the API. */
  assetTypes: readonly AssetType[];
  /** Sub-types offered in the 매물종류 filter (아파트 / 오피스텔). */
  subTypes?: readonly { value: AssetType; label: string }[];
  /** Left panel: complexes with tabs (아파트) or listing cards (everything else). */
  listMode: 'complex' | 'listing';
  dealTypes: readonly DealType[];
  /** Desktop filter bar, left to right. */
  bar: readonly FilterKind[];
  /** Sections inside the "추가 필터" popover. */
  more: readonly FilterKind[];
  /** Mobile chip row (after the 필터 button). */
  chips: readonly FilterKind[];
  /** Every section of the mobile full filter sheet, top to bottom. */
  sheet: readonly FilterKind[];
  scales: { price?: ScaleKey; deposit?: ScaleKey; rent?: ScaleKey; area: ScaleKey };
  /** Label of the area filter: 면적 (공급/전용) or 토지면적. */
  areaLabel: string;
  sorts: readonly SortTab[];
  defaultSort: ListingSort;
  /**
   * 평/㎡ toggle default: ㎡ everywhere (계량법 법정단위; labels always carry 평 alongside, and 평 leads
   * only when the visitor picks it).
   */
  defaultUnit: 'pyeong' | 'sqm';
  searchPlaceholder: string;
  searchLabel: string;
  placeholder: PhotoKind;
  seo: { title: string; description: string };
}

const SORT = {
  verified: { value: ListingSort.VERIFIED, label: '매물확인순' },
  latest: { value: ListingSort.LATEST, label: '최신순' },
  price: { value: ListingSort.PRICE_ASC, alt: ListingSort.PRICE_DESC, label: '금액순' },
  area: { value: ListingSort.AREA_DESC, alt: ListingSort.AREA_ASC, label: '면적순' },
  built: { value: ListingSort.BUILT_YEAR_DESC, label: '준공년순' },
  photo: { value: ListingSort.PHOTO, label: '사진순' },
} satisfies Record<string, SortTab>;

const { SALE, JEONSE, MONTHLY, PRESALE } = DealType;

export const ASSETS: Record<MapAssetSlug, AssetConfig> = {
  apt: {
    slug: 'apt',
    label: '아파트·분양권',
    shortLabel: '아파트',
    noun: '아파트',
    assetTypes: [AssetType.APT, AssetType.OFFICETEL],
    subTypes: [
      { value: AssetType.APT, label: '아파트' },
      { value: AssetType.OFFICETEL, label: '오피스텔' },
    ],
    listMode: 'complex',
    dealTypes: [PRESALE, SALE, JEONSE, MONTHLY],
    bar: ['category', 'deal', 'area', 'price', 'direction', 'rooms', 'baths', 'more'],
    more: ['floor', 'built', 'options'],
    chips: ['deal', 'area', 'price', 'direction', 'rooms', 'baths'],
    sheet: ['deal', 'area', 'price', 'direction', 'rooms', 'baths', 'floor', 'built', 'options'],
    scales: { price: 'priceApt', deposit: 'depositApt', rent: 'rent', area: 'areaApt' },
    areaLabel: '면적',
    sorts: [SORT.verified, SORT.latest, SORT.price, SORT.area],
    defaultSort: ListingSort.VERIFIED,
    defaultUnit: 'sqm',
    searchPlaceholder: '지역 또는 단지명 (예: 신대지구, 오천 그린빌)',
    searchLabel: '지역 또는 단지명 검색',
    placeholder: 'tower',
    seo: {
      title: '아파트·분양권 지도',
      description:
        '순천 아파트·분양권 매물을 지도에서 단지별로 확인하세요. 매매·전세·월세·분양권 매물 수, 평당 시세, 최근 실거래가를 한 번에 봅니다.',
    },
  },
  oneroom: {
    slug: 'oneroom',
    label: '원룸·투룸',
    shortLabel: '원룸',
    noun: '원룸·투룸',
    assetTypes: [AssetType.ONEROOM],
    listMode: 'listing',
    dealTypes: [MONTHLY, JEONSE],
    bar: ['roomType', 'deal', 'deposit', 'rent', 'quickOptions', 'more'],
    more: ['area', 'floor', 'built', 'options'],
    chips: ['roomType', 'deal', 'deposit', 'rent', 'quickOptions'],
    sheet: ['roomType', 'deal', 'deposit', 'rent', 'area', 'floor', 'built', 'options'],
    scales: { deposit: 'depositRoom', rent: 'rent', area: 'areaRoom' },
    areaLabel: '전용면적',
    sorts: [SORT.verified, SORT.latest, SORT.price, SORT.built, SORT.photo],
    defaultSort: ListingSort.VERIFIED,
    defaultUnit: 'sqm',
    // Only regions can be searched (`GET /search/suggest` has no school / station / building
    // type yet) — the copy must not promise more than the field can find.
    searchPlaceholder: '동네 이름 (예: 석현동, 조례동)',
    searchLabel: '동네 이름 검색',
    placeholder: 'room',
    seo: {
      title: '원룸·투룸 지도',
      description:
        '순천대·청암대·순천역 주변 원룸, 1.5룸, 투룸 월세·전세 매물을 지도에서 보증금과 월세로 바로 비교하세요. 실매물 확인일을 함께 보여 드립니다.',
    },
  },
  house: {
    slug: 'house',
    label: '주택',
    shortLabel: '주택',
    noun: '주택',
    assetTypes: [AssetType.HOUSE],
    listMode: 'listing',
    dealTypes: [SALE, JEONSE, MONTHLY],
    bar: ['category', 'deal', 'price', 'area', 'rooms', 'baths', 'more'],
    more: ['direction', 'built', 'options'],
    chips: ['deal', 'price', 'area', 'rooms', 'baths'],
    sheet: ['deal', 'price', 'area', 'rooms', 'baths', 'direction', 'built', 'options'],
    scales: { price: 'priceHouse', deposit: 'depositApt', rent: 'rent', area: 'areaApt' },
    areaLabel: '전용면적',
    sorts: [SORT.verified, SORT.latest, SORT.price, SORT.area, SORT.built, SORT.photo],
    defaultSort: ListingSort.VERIFIED,
    defaultUnit: 'sqm',
    searchPlaceholder: '지역 또는 동네 이름 (예: 매곡동, 왕지동)',
    searchLabel: '지역 검색',
    placeholder: 'villa',
    seo: {
      title: '주택 지도',
      description:
        '순천 단독주택·다가구·빌라·전원주택 매매, 전세, 월세 매물을 지도에서 찾아보세요. 대지면적과 준공 연도, 실매물 확인일까지 한눈에 봅니다.',
    },
  },
  commercial: {
    slug: 'commercial',
    label: '상업·업무',
    shortLabel: '상가',
    noun: '상가·사무실',
    assetTypes: [AssetType.COMMERCIAL],
    listMode: 'listing',
    dealTypes: [MONTHLY, SALE, JEONSE],
    bar: ['category', 'deal', 'price', 'area', 'floor', 'more'],
    more: ['built', 'options'],
    chips: ['deal', 'price', 'area', 'floor'],
    sheet: ['deal', 'price', 'area', 'floor', 'built', 'options'],
    scales: { price: 'priceShop', deposit: 'depositShop', rent: 'rentShop', area: 'areaShop' },
    areaLabel: '전용면적',
    sorts: [SORT.verified, SORT.latest, SORT.price, SORT.area, SORT.photo],
    defaultSort: ListingSort.VERIFIED,
    defaultUnit: 'sqm',
    searchPlaceholder: '동네 이름 (예: 연향동, 조례동)',
    searchLabel: '동네 이름 검색',
    placeholder: 'shop',
    seo: {
      title: '상가·사무실 지도',
      description:
        '순천 상가, 사무실 임대·매매 매물을 상권별로 지도에서 확인하세요. 보증금과 월세, 전용면적, 해당 층을 바로 비교할 수 있습니다.',
    },
  },
  land: {
    slug: 'land',
    label: '토지',
    shortLabel: '토지',
    noun: '토지',
    assetTypes: [AssetType.LAND],
    listMode: 'listing',
    dealTypes: [SALE],
    bar: ['category', 'price', 'area', 'landZone', 'landCategory'],
    more: [],
    chips: ['price', 'area', 'landZone', 'landCategory'],
    sheet: ['price', 'area', 'landZone', 'landCategory'],
    scales: { price: 'priceLand', area: 'areaLand' },
    areaLabel: '토지면적',
    sorts: [SORT.verified, SORT.latest, SORT.price, SORT.area],
    defaultSort: ListingSort.VERIFIED,
    defaultUnit: 'sqm',
    searchPlaceholder: '지역 이름 (예: 해룡면, 서면, 왕지동)',
    searchLabel: '지역 검색',
    placeholder: 'land',
    seo: {
      title: '토지 지도',
      description:
        '순천 대지, 전, 답, 임야 매물을 지도에서 용도지역과 지목으로 걸러 보세요. 면적은 평과 ㎡로, 가격은 총액과 평당가로 보여 드립니다.',
    },
  },
};

export const ASSET_SLUGS = Object.keys(ASSETS) as MapAssetSlug[];

export function isAssetSlug(value: string): value is MapAssetSlug {
  return value in ASSETS;
}
