import type { EnumValue } from './define';

export const DealType = {
  SALE: 'SALE',
  JEONSE: 'JEONSE',
  MONTHLY: 'MONTHLY',
  PRESALE: 'PRESALE',
} as const;
export type DealType = EnumValue<typeof DealType>;

export const DEAL_TYPE_LABEL: Record<DealType, string> = {
  SALE: '매매',
  JEONSE: '전세',
  MONTHLY: '월세',
  PRESALE: '분양권',
};

export const AssetType = {
  APT: 'APT',
  OFFICETEL: 'OFFICETEL',
  ONEROOM: 'ONEROOM',
  HOUSE: 'HOUSE',
  COMMERCIAL: 'COMMERCIAL',
  LAND: 'LAND',
} as const;
export type AssetType = EnumValue<typeof AssetType>;

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  APT: '아파트',
  OFFICETEL: '오피스텔',
  ONEROOM: '원룸·투룸',
  HOUSE: '주택',
  COMMERCIAL: '상업·업무',
  LAND: '토지',
};

/** Asset types that belong to a 단지 (complex). */
export const COMPLEX_ASSET_TYPES: readonly AssetType[] = [AssetType.APT, AssetType.OFFICETEL];

export const ListingStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  CLOSED: 'CLOSED',
  HIDDEN: 'HIDDEN',
} as const;
export type ListingStatus = EnumValue<typeof ListingStatus>;

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: '작성중',
  ACTIVE: '광고중',
  RESERVED: '계약중',
  CLOSED: '거래완료',
  HIDDEN: '숨김',
};

/** Statuses visible on the public site. */
export const PUBLIC_LISTING_STATUSES: readonly ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
];

export const Direction = {
  EAST: 'EAST',
  WEST: 'WEST',
  SOUTH: 'SOUTH',
  NORTH: 'NORTH',
  SOUTH_EAST: 'SOUTH_EAST',
  SOUTH_WEST: 'SOUTH_WEST',
  NORTH_EAST: 'NORTH_EAST',
  NORTH_WEST: 'NORTH_WEST',
} as const;
export type Direction = EnumValue<typeof Direction>;

export const DIRECTION_LABEL: Record<Direction, string> = {
  EAST: '동향',
  WEST: '서향',
  SOUTH: '남향',
  NORTH: '북향',
  SOUTH_EAST: '남동향',
  SOUTH_WEST: '남서향',
  NORTH_EAST: '북동향',
  NORTH_WEST: '북서향',
};

/** 방향 기준 (표시·광고 명시사항: 방향과 그 기준을 함께 표시). */
export const DirectionBasis = {
  LIVING_ROOM: 'LIVING_ROOM',
  MAIN_ROOM: 'MAIN_ROOM',
  ENTRANCE: 'ENTRANCE',
  OTHER: 'OTHER',
} as const;
export type DirectionBasis = EnumValue<typeof DirectionBasis>;

export const DIRECTION_BASIS_LABEL: Record<DirectionBasis, string> = {
  LIVING_ROOM: '거실 기준',
  MAIN_ROOM: '안방 기준',
  ENTRANCE: '주된 출입구 기준',
  OTHER: '기타',
};

export const FloorClass = {
  LOW: 'LOW',
  MID: 'MID',
  HIGH: 'HIGH',
} as const;
export type FloorClass = EnumValue<typeof FloorClass>;

export const FLOOR_CLASS_LABEL: Record<FloorClass, string> = {
  LOW: '저층',
  MID: '중층',
  HIGH: '고층',
};

/** Whether the public page shows the exact floor or only 저/중/고. */
export const FloorDisplay = {
  EXACT: 'EXACT',
  CLASS: 'CLASS',
} as const;
export type FloorDisplay = EnumValue<typeof FloorDisplay>;

export const MoveInType = {
  IMMEDIATE: 'IMMEDIATE',
  NEGOTIABLE: 'NEGOTIABLE',
  DATE: 'DATE',
} as const;
export type MoveInType = EnumValue<typeof MoveInType>;

export const MOVE_IN_TYPE_LABEL: Record<MoveInType, string> = {
  IMMEDIATE: '즉시입주',
  NEGOTIABLE: '협의가능',
  DATE: '날짜지정',
};

export const VerificationMethod = {
  OWNER_CONFIRMED: 'OWNER_CONFIRMED',
  DOCUMENT: 'DOCUMENT',
  SITE_VISIT: 'SITE_VISIT',
  OWNER_CALL: 'OWNER_CALL',
  REGISTRY: 'REGISTRY',
} as const;
export type VerificationMethod = EnumValue<typeof VerificationMethod>;

export const VERIFICATION_METHOD_LABEL: Record<VerificationMethod, string> = {
  OWNER_CONFIRMED: '소유자 확인',
  DOCUMENT: '서류 확인',
  SITE_VISIT: '현장 확인',
  OWNER_CALL: '소유자 통화 확인',
  REGISTRY: '등기부 확인',
};

export const ListingOption = {
  AIR_CONDITIONER: 'AIR_CONDITIONER',
  REFRIGERATOR: 'REFRIGERATOR',
  WASHER: 'WASHER',
  DRYER: 'DRYER',
  BED: 'BED',
  DESK: 'DESK',
  CLOSET: 'CLOSET',
  BUILT_IN_WARDROBE: 'BUILT_IN_WARDROBE',
  SHOE_RACK: 'SHOE_RACK',
  INDUCTION: 'INDUCTION',
  GAS_RANGE: 'GAS_RANGE',
  MICROWAVE: 'MICROWAVE',
  DISHWASHER: 'DISHWASHER',
  TV: 'TV',
  WIFI: 'WIFI',
  ELEVATOR: 'ELEVATOR',
  PARKING: 'PARKING',
  PET_ALLOWED: 'PET_ALLOWED',
  SECURITY: 'SECURITY',
  CCTV: 'CCTV',
  VERANDA: 'VERANDA',
  BALCONY: 'BALCONY',
} as const;
export type ListingOption = EnumValue<typeof ListingOption>;

export const LISTING_OPTION_LABEL: Record<ListingOption, string> = {
  AIR_CONDITIONER: '에어컨',
  REFRIGERATOR: '냉장고',
  WASHER: '세탁기',
  DRYER: '건조기',
  BED: '침대',
  DESK: '책상',
  CLOSET: '옷장',
  BUILT_IN_WARDROBE: '붙박이장',
  SHOE_RACK: '신발장',
  INDUCTION: '인덕션',
  GAS_RANGE: '가스레인지',
  MICROWAVE: '전자레인지',
  DISHWASHER: '식기세척기',
  TV: 'TV',
  WIFI: '인터넷',
  ELEVATOR: '엘리베이터',
  PARKING: '주차가능',
  PET_ALLOWED: '반려동물',
  SECURITY: '경비',
  CCTV: 'CCTV',
  VERANDA: '베란다',
  BALCONY: '발코니',
};

export const ListingAgencyStatus = {
  ACTIVE: 'ACTIVE',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type ListingAgencyStatus = EnumValue<typeof ListingAgencyStatus>;

/** List sort keys (최신순, 실매물확인순, 가격순, 면적순, 준공년순, 사진순). */
export const ListingSort = {
  LATEST: 'LATEST',
  VERIFIED: 'VERIFIED',
  PRICE_ASC: 'PRICE_ASC',
  PRICE_DESC: 'PRICE_DESC',
  AREA_ASC: 'AREA_ASC',
  AREA_DESC: 'AREA_DESC',
  BUILT_YEAR_DESC: 'BUILT_YEAR_DESC',
  PHOTO: 'PHOTO',
} as const;
export type ListingSort = EnumValue<typeof ListingSort>;

export const LISTING_SORT_LABEL: Record<ListingSort, string> = {
  LATEST: '최신순',
  VERIFIED: '실매물확인순',
  PRICE_ASC: '낮은가격순',
  PRICE_DESC: '높은가격순',
  AREA_ASC: '작은면적순',
  AREA_DESC: '넓은면적순',
  BUILT_YEAR_DESC: '최근준공순',
  PHOTO: '사진많은순',
};

export const RecentViewTarget = {
  LISTING: 'LISTING',
  COMPLEX: 'COMPLEX',
  AGENCY: 'AGENCY',
} as const;
export type RecentViewTarget = EnumValue<typeof RecentViewTarget>;
