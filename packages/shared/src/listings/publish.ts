// Owned by the listings module team.
// 공인중개사법 제18조의2 + 「중개대상물의 표시·광고 명시사항 세부기준」: what an online listing ad must show.
import {
  AssetType,
  DealType,
  MoveInType,
  type AssetType as AssetTypeValue,
  type DealType as DealTypeValue,
  type Direction,
  type DirectionBasis,
  type MoveInType as MoveInTypeValue,
} from '../enums/listing';
import { isBuildingAsset } from './rules';

/** Korean label of every item the validator can report (shown to agents as-is). */
export const PUBLISH_FIELD_LABEL = {
  'property.roadAddress': '소재지',
  'property.area': '면적',
  price: '가격',
  'property.assetType': '중개대상물 종류',
  dealType: '거래형태',
  'property.totalFloors': '총 층수',
  'property.floor': '해당 층',
  'property.approvalDate': '사용승인일',
  'property.direction': '방향',
  'property.directionBasis': '방향 기준',
  'property.rooms': '방 수',
  'property.baths': '욕실 수',
  moveIn: '입주가능일',
  'property.parkingSpaces': '주차대수',
  maintenanceFeeWon: '관리비',
  'agency.name': '중개사무소 명칭',
  'agency.roadAddress': '중개사무소 소재지',
  'agency.phone': '중개사무소 연락처',
  'agency.registrationNumber': '중개사무소 등록번호',
  'agency.representativeName': '개업공인중개사 성명',
} as const;
export type PublishField = keyof typeof PUBLISH_FIELD_LABEL;

export interface PublishIssue {
  field: PublishField;
  label: string;
}

export interface PublishCheckInput {
  dealType: DealTypeValue | null | undefined;
  salePrice?: number | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  presalePrice?: number | null;
  premium?: number | null;
  maintenanceFeeWon?: number | null;
  moveInType?: MoveInTypeValue | null;
  moveInDate?: string | Date | null;
  property: {
    assetType: AssetTypeValue | null | undefined;
    roadAddress?: string | null;
    floor?: number | null;
    totalFloors?: number | null;
    exclusiveArea?: number | null;
    supplyArea?: number | null;
    landArea?: number | null;
    totalFloorArea?: number | null;
    rooms?: number | null;
    baths?: number | null;
    direction?: Direction | null;
    directionBasis?: DirectionBasis | null;
    approvalDate?: string | Date | null;
    parkingSpaces?: number | null;
  };
  /** The responsible (primary) agency; null when it could not be resolved. */
  agency: {
    name?: string | null;
    roadAddress?: string | null;
    phone?: string | null;
    registrationNumber?: string | null;
    representativeName?: string | null;
  } | null;
}

const present = (v: unknown): boolean =>
  v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === '');
const positive = (v: number | null | undefined): boolean => typeof v === 'number' && v > 0;

function priceComplete(i: PublishCheckInput): boolean {
  switch (i.dealType) {
    case DealType.SALE:
      return positive(i.salePrice);
    case DealType.JEONSE:
      return positive(i.deposit);
    case DealType.MONTHLY:
      // 보증금 0 (무보증) is allowed, 월세 must be set.
      return present(i.deposit) && positive(i.monthlyRent);
    case DealType.PRESALE:
      // 분양가 + 프리미엄 (0 or negative premium allowed, but it must be stated).
      return positive(i.presalePrice) && present(i.premium);
    default:
      return false;
  }
}

function areaComplete(p: PublishCheckInput['property']): boolean {
  switch (p.assetType) {
    case AssetType.LAND:
      return positive(p.landArea);
    case AssetType.HOUSE:
      return positive(p.exclusiveArea) || positive(p.totalFloorArea);
    default:
      return positive(p.exclusiveArea);
  }
}

/**
 * Returns every missing 명시사항 (empty array = publishable). 0 is a valid value for counts
 * (방/욕실/주차) and 관리비 (없음). 토지 needs only 소재지·면적·가격·종류·거래형태.
 */
export function checkPublishRequirements(i: PublishCheckInput): PublishIssue[] {
  const missing: PublishField[] = [];
  const p = i.property;
  if (!present(p.roadAddress)) missing.push('property.roadAddress');
  if (!areaComplete(p)) missing.push('property.area');
  if (!priceComplete(i)) missing.push('price');
  if (!present(p.assetType)) missing.push('property.assetType');
  if (!present(i.dealType)) missing.push('dealType');

  if (p.assetType && isBuildingAsset(p.assetType)) {
    if (!positive(p.totalFloors)) missing.push('property.totalFloors');
    // 단독주택은 건물 전체가 대상이므로 해당 층 생략 가능.
    if (p.assetType !== AssetType.HOUSE && !present(p.floor)) missing.push('property.floor');
    // 분양권은 아직 사용승인 전이다.
    if (i.dealType !== DealType.PRESALE && !present(p.approvalDate))
      missing.push('property.approvalDate');
    if (!present(p.direction)) missing.push('property.direction');
    if (!present(p.directionBasis)) missing.push('property.directionBasis');
    if (!present(p.rooms)) missing.push('property.rooms');
    if (!present(p.baths)) missing.push('property.baths');
    if (!present(i.moveInType) || (i.moveInType === MoveInType.DATE && !present(i.moveInDate)))
      missing.push('moveIn');
    if (!present(p.parkingSpaces)) missing.push('property.parkingSpaces');
    if (!present(i.maintenanceFeeWon)) missing.push('maintenanceFeeWon');
  }

  const a = i.agency;
  if (!a || !present(a.name)) missing.push('agency.name');
  if (!a || !present(a.roadAddress)) missing.push('agency.roadAddress');
  if (!a || !present(a.phone)) missing.push('agency.phone');
  if (!a || !present(a.registrationNumber)) missing.push('agency.registrationNumber');
  if (!a || !present(a.representativeName)) missing.push('agency.representativeName');

  return missing.map((field) => ({ field, label: PUBLISH_FIELD_LABEL[field] }));
}
