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
  /** Co-broker request awaiting the primary agency's acceptance. */
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  /** Left voluntarily (may request again). */
  WITHDRAWN: 'WITHDRAWN',
  /** Removed/rejected by the primary agency (cannot rejoin on its own). */
  REMOVED: 'REMOVED',
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

/**
 * 관리비 부과방식 (「중개대상물의 표시·광고 명시사항 세부기준」, 2023-09-21 시행).
 * UNKNOWN = 임대인 미고지 등으로 확인할 수 없음 (사유를 함께 표시해야 한다).
 */
export const MaintenanceFeeBillingType = {
  FIXED: 'FIXED',
  ACTUAL: 'ACTUAL',
  UNKNOWN: 'UNKNOWN',
} as const;
export type MaintenanceFeeBillingType = EnumValue<typeof MaintenanceFeeBillingType>;

export const MAINTENANCE_FEE_BILLING_TYPE_LABEL: Record<MaintenanceFeeBillingType, string> = {
  FIXED: '정액관리비',
  ACTUAL: '실비 정산(사용량 부과)',
  UNKNOWN: '확인불가',
};

/** 관리비 세부 항목: 일반관리비, 사용료(전기·수도·가스·난방·인터넷·TV), 기타관리비. */
export const MaintenanceFeeKind = {
  GENERAL: 'GENERAL',
  ELECTRICITY: 'ELECTRICITY',
  WATER: 'WATER',
  GAS: 'GAS',
  HEATING: 'HEATING',
  INTERNET: 'INTERNET',
  TV: 'TV',
  OTHER: 'OTHER',
} as const;
export type MaintenanceFeeKind = EnumValue<typeof MaintenanceFeeKind>;

export const MAINTENANCE_FEE_KIND_LABEL: Record<MaintenanceFeeKind, string> = {
  GENERAL: '일반관리비',
  ELECTRICITY: '전기료',
  WATER: '수도료',
  GAS: '가스사용료',
  HEATING: '난방비',
  INTERNET: '인터넷 사용료',
  TV: 'TV 사용료',
  OTHER: '기타관리비',
};

/** 정액관리비가 이 금액(원/월) 이상이면 항목별 금액을 표시해야 한다. */
export const MAINTENANCE_FEE_BREAKDOWN_THRESHOLD_WON = 100_000;

/**
 * 건축물 용도 (건축법 시행령 별표1, 건축물대장 기준). 표시·광고의 「중개대상물 종류」는 사이트
 * 분류(AssetType)가 아니라 이 용도로 표시한다. 주택은 세부 용도(다가구·다세대 등)까지 구분한다.
 */
export const BuildingUse = {
  DETACHED_HOUSE: 'DETACHED_HOUSE',
  MULTI_UNIT_HOUSE: 'MULTI_UNIT_HOUSE',
  MULTI_FAMILY_HOUSE: 'MULTI_FAMILY_HOUSE',
  OFFICIAL_RESIDENCE: 'OFFICIAL_RESIDENCE',
  APARTMENT: 'APARTMENT',
  ROW_HOUSE: 'ROW_HOUSE',
  MULTIPLEX_HOUSE: 'MULTIPLEX_HOUSE',
  DORMITORY: 'DORMITORY',
  NEIGHBORHOOD_FACILITY_1: 'NEIGHBORHOOD_FACILITY_1',
  NEIGHBORHOOD_FACILITY_2: 'NEIGHBORHOOD_FACILITY_2',
  CULTURE_ASSEMBLY: 'CULTURE_ASSEMBLY',
  RELIGIOUS: 'RELIGIOUS',
  SALES: 'SALES',
  TRANSPORTATION: 'TRANSPORTATION',
  MEDICAL: 'MEDICAL',
  EDUCATION_RESEARCH: 'EDUCATION_RESEARCH',
  ELDERLY_CHILD: 'ELDERLY_CHILD',
  TRAINING: 'TRAINING',
  SPORTS: 'SPORTS',
  OFFICE: 'OFFICE',
  OFFICETEL: 'OFFICETEL',
  LODGING: 'LODGING',
  AMUSEMENT: 'AMUSEMENT',
  FACTORY: 'FACTORY',
  WAREHOUSE: 'WAREHOUSE',
  HAZARDOUS_MATERIAL: 'HAZARDOUS_MATERIAL',
  AUTOMOBILE: 'AUTOMOBILE',
  ANIMAL_PLANT: 'ANIMAL_PLANT',
  RESOURCE_RECYCLING: 'RESOURCE_RECYCLING',
  CORRECTIONAL_MILITARY: 'CORRECTIONAL_MILITARY',
  BROADCASTING: 'BROADCASTING',
  POWER_PLANT: 'POWER_PLANT',
  CEMETERY: 'CEMETERY',
  TOURIST_REST: 'TOURIST_REST',
  FUNERAL: 'FUNERAL',
  CAMPING: 'CAMPING',
} as const;
export type BuildingUse = EnumValue<typeof BuildingUse>;

export const BUILDING_USE_LABEL: Record<BuildingUse, string> = {
  DETACHED_HOUSE: '단독주택',
  MULTI_UNIT_HOUSE: '다중주택',
  MULTI_FAMILY_HOUSE: '다가구주택',
  OFFICIAL_RESIDENCE: '공관',
  APARTMENT: '아파트',
  ROW_HOUSE: '연립주택',
  MULTIPLEX_HOUSE: '다세대주택',
  DORMITORY: '기숙사',
  NEIGHBORHOOD_FACILITY_1: '제1종 근린생활시설',
  NEIGHBORHOOD_FACILITY_2: '제2종 근린생활시설',
  CULTURE_ASSEMBLY: '문화 및 집회시설',
  RELIGIOUS: '종교시설',
  SALES: '판매시설',
  TRANSPORTATION: '운수시설',
  MEDICAL: '의료시설',
  EDUCATION_RESEARCH: '교육연구시설',
  ELDERLY_CHILD: '노유자시설',
  TRAINING: '수련시설',
  SPORTS: '운동시설',
  OFFICE: '업무시설',
  OFFICETEL: '오피스텔',
  LODGING: '숙박시설',
  AMUSEMENT: '위락시설',
  FACTORY: '공장',
  WAREHOUSE: '창고시설',
  HAZARDOUS_MATERIAL: '위험물 저장 및 처리 시설',
  AUTOMOBILE: '자동차 관련 시설',
  ANIMAL_PLANT: '동물 및 식물 관련 시설',
  RESOURCE_RECYCLING: '자원순환 관련 시설',
  CORRECTIONAL_MILITARY: '교정 및 군사 시설',
  BROADCASTING: '방송통신시설',
  POWER_PLANT: '발전시설',
  CEMETERY: '묘지 관련 시설',
  TOURIST_REST: '관광 휴게시설',
  FUNERAL: '장례시설',
  CAMPING: '야영장 시설',
};
