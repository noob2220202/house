// Owned by the deal-requests module team. Pure 내놓기/구하기 rules shared by the API and frontends.
import { DealRequestType, DealRequestVisibility } from '../enums/deal-request';
import {
  AssetType,
  COMPLEX_ASSET_TYPES,
  DealType,
  type AssetType as AssetTypeValue,
  type DealType as DealTypeValue,
} from '../enums/listing';

/** Deal types that make sense per asset type (분양권 only for 단지형 주거). */
export const DEAL_REQUEST_DEAL_TYPES_BY_ASSET: Record<AssetTypeValue, readonly DealTypeValue[]> = {
  APT: [DealType.SALE, DealType.JEONSE, DealType.MONTHLY, DealType.PRESALE],
  OFFICETEL: [DealType.SALE, DealType.JEONSE, DealType.MONTHLY, DealType.PRESALE],
  ONEROOM: [DealType.SALE, DealType.JEONSE, DealType.MONTHLY],
  HOUSE: [DealType.SALE, DealType.JEONSE, DealType.MONTHLY],
  COMMERCIAL: [DealType.SALE, DealType.JEONSE, DealType.MONTHLY],
  LAND: [DealType.SALE, DealType.MONTHLY],
};

/** Asset types with rooms (방 수 조건). */
export const ROOM_ASSET_TYPES: readonly AssetTypeValue[] = [
  AssetType.APT,
  AssetType.OFFICETEL,
  AssetType.ONEROOM,
  AssetType.HOUSE,
];

/** Asset types with a floor (토지 has none). */
export const FLOOR_ASSET_TYPES: readonly AssetTypeValue[] = [
  AssetType.APT,
  AssetType.OFFICETEL,
  AssetType.ONEROOM,
  AssetType.HOUSE,
  AssetType.COMMERCIAL,
];

const SALE_LIKE: readonly DealTypeValue[] = [DealType.SALE, DealType.PRESALE];
const DEPOSIT_LIKE: readonly DealTypeValue[] = [DealType.JEONSE, DealType.MONTHLY];

export interface DealRequestRuleIssue {
  path: (string | number)[];
  message: string;
}

/** Fields the rules look at (a structural subset of the create input). */
export interface DealRequestRuleInput {
  type: DealRequestType;
  assetType: AssetTypeValue;
  dealTypes: readonly DealTypeValue[];
  visibility: DealRequestVisibility;
  targetAgencyIds: readonly string[];
  description?: string | undefined;
  // SELL_OR_LEASE
  complexId?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  floor?: number | undefined;
  desiredSalePrice?: number | undefined;
  desiredDeposit?: number | undefined;
  desiredMonthlyRent?: number | undefined;
  photoMediaIds?: readonly string[] | undefined;
  // WANTED
  complexIds?: readonly string[] | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  depositMin?: number | undefined;
  depositMax?: number | undefined;
  rentMin?: number | undefined;
  rentMax?: number | undefined;
  areaMin?: number | undefined;
  areaMax?: number | undefined;
  roomsMin?: number | undefined;
}

/**
 * Korean mobile numbers (010-1234-5678, 010 1234 5678, 01012345678, +82 10-…) typed into free text.
 * The description is shown to every agency before any contact grant, so a number there would
 * bypass the requester's consent.
 */
export const FREE_TEXT_PHONE_PATTERN = /(?:\+?82[-\s.]?|0)1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;

const has = (v: unknown): boolean => v !== undefined && v !== null;
const anyOf = (dealTypes: readonly DealTypeValue[], set: readonly DealTypeValue[]): boolean =>
  dealTypes.some((d) => set.includes(d));

function range(
  issues: DealRequestRuleIssue[],
  minKey: string,
  min: number | undefined,
  max: number | undefined,
): void {
  if (has(min) && has(max) && (min as number) > (max as number)) {
    issues.push({ path: [minKey], message: '최소값이 최대값보다 클 수 없습니다.' });
  }
}

/**
 * Cross-field rules of a 내놓기/구하기 request: deal types allowed for the asset type, price fields
 * that match the chosen deal types, ranges, asset-specific fields and visibility targets.
 * Returns an empty array when the input is consistent.
 */
export function dealRequestRuleIssues(input: DealRequestRuleInput): DealRequestRuleIssue[] {
  const issues: DealRequestRuleIssue[] = [];
  const { assetType, dealTypes } = input;

  if (new Set(dealTypes).size !== dealTypes.length) {
    issues.push({ path: ['dealTypes'], message: '거래유형이 중복되었습니다.' });
  }
  const allowed = DEAL_REQUEST_DEAL_TYPES_BY_ASSET[assetType];
  dealTypes.forEach((d, i) => {
    if (!allowed.includes(d)) {
      issues.push({
        path: ['dealTypes', i],
        message: '선택한 매물 종류에 맞지 않는 거래유형입니다.',
      });
    }
  });

  if (input.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
    if (input.targetAgencyIds.length === 0) {
      issues.push({
        path: ['targetAgencyIds'],
        message: '요청을 받을 중개사무소를 선택해 주세요.',
      });
    }
  } else if (input.targetAgencyIds.length > 0) {
    issues.push({
      path: ['targetAgencyIds'],
      message: '지역 전체 공개 요청에는 중개사무소를 지정할 수 없습니다.',
    });
  }
  if (new Set(input.targetAgencyIds).size !== input.targetAgencyIds.length) {
    issues.push({ path: ['targetAgencyIds'], message: '중개사무소가 중복되었습니다.' });
  }
  if (input.description && FREE_TEXT_PHONE_PATTERN.test(input.description)) {
    issues.push({
      path: ['description'],
      message: '연락처는 설명란이 아닌 연락처 항목에 입력해 주세요.',
    });
  }

  const saleLike = anyOf(dealTypes, SALE_LIKE);
  const depositLike = anyOf(dealTypes, DEPOSIT_LIKE);
  const monthly = dealTypes.includes(DealType.MONTHLY);
  const complexType = COMPLEX_ASSET_TYPES.includes(assetType);

  if (input.type === DealRequestType.SELL_OR_LEASE) {
    if (has(input.complexId) && !complexType) {
      issues.push({ path: ['complexId'], message: '단지는 아파트·오피스텔만 선택할 수 있습니다.' });
    }
    if (has(input.lat) !== has(input.lng)) {
      issues.push({ path: ['lat'], message: '위치는 위도와 경도를 함께 입력해 주세요.' });
    }
    if (has(input.floor) && !FLOOR_ASSET_TYPES.includes(assetType)) {
      issues.push({ path: ['floor'], message: '토지에는 층수를 입력할 수 없습니다.' });
    }
    if (has(input.desiredSalePrice) && !saleLike) {
      issues.push({
        path: ['desiredSalePrice'],
        message: '매매·분양권 거래에만 매매가를 입력합니다.',
      });
    }
    if (has(input.desiredDeposit) && !depositLike) {
      issues.push({ path: ['desiredDeposit'], message: '전세·월세 거래에만 보증금을 입력합니다.' });
    }
    if (has(input.desiredMonthlyRent) && !monthly) {
      issues.push({ path: ['desiredMonthlyRent'], message: '월세 거래에만 월세를 입력합니다.' });
    }
    const photos = input.photoMediaIds ?? [];
    if (new Set(photos).size !== photos.length) {
      issues.push({ path: ['photoMediaIds'], message: '사진이 중복되었습니다.' });
    }
  } else {
    if ((input.complexIds?.length ?? 0) > 0 && !complexType) {
      issues.push({
        path: ['complexIds'],
        message: '단지는 아파트·오피스텔만 선택할 수 있습니다.',
      });
    }
    if (has(input.roomsMin) && !ROOM_ASSET_TYPES.includes(assetType)) {
      issues.push({
        path: ['roomsMin'],
        message: '선택한 매물 종류에는 방 수 조건을 둘 수 없습니다.',
      });
    }
    if ((has(input.priceMin) || has(input.priceMax)) && !saleLike) {
      issues.push({
        path: ['priceMin'],
        message: '매매·분양권 거래에만 매매가 조건을 입력합니다.',
      });
    }
    if ((has(input.depositMin) || has(input.depositMax)) && !depositLike) {
      issues.push({
        path: ['depositMin'],
        message: '전세·월세 거래에만 보증금 조건을 입력합니다.',
      });
    }
    if ((has(input.rentMin) || has(input.rentMax)) && !monthly) {
      issues.push({ path: ['rentMin'], message: '월세 거래에만 월세 조건을 입력합니다.' });
    }
    range(issues, 'priceMin', input.priceMin, input.priceMax);
    range(issues, 'depositMin', input.depositMin, input.depositMax);
    range(issues, 'rentMin', input.rentMin, input.rentMax);
    range(issues, 'areaMin', input.areaMin, input.areaMax);
  }
  return issues;
}

export interface ProposalTermsInput {
  suggestedPrice?: number | undefined;
  suggestedDeposit?: number | undefined;
  suggestedMonthlyRent?: number | undefined;
}

/** Suggested terms must fit the request's deal types (e.g. 월세 only for MONTHLY requests). */
export function proposalTermsIssues(
  dealTypes: readonly DealTypeValue[],
  terms: ProposalTermsInput,
): DealRequestRuleIssue[] {
  const issues: DealRequestRuleIssue[] = [];
  if (has(terms.suggestedPrice) && !anyOf(dealTypes, SALE_LIKE)) {
    issues.push({
      path: ['suggestedPrice'],
      message: '매매·분양권 요청에만 매매가를 제안할 수 있습니다.',
    });
  }
  if (has(terms.suggestedDeposit) && !anyOf(dealTypes, DEPOSIT_LIKE)) {
    issues.push({
      path: ['suggestedDeposit'],
      message: '전세·월세 요청에만 보증금을 제안할 수 있습니다.',
    });
  }
  if (has(terms.suggestedMonthlyRent) && !dealTypes.includes(DealType.MONTHLY)) {
    issues.push({
      path: ['suggestedMonthlyRent'],
      message: '월세 요청에만 월세를 제안할 수 있습니다.',
    });
  }
  return issues;
}

/** True when every region code lies inside the service's 시군구 (e.g. 46150 순천시). */
export function regionCodesWithinSgg(codes: readonly string[], sggCode: string): boolean {
  return codes.every((c) => c.length >= sggCode.length && c.startsWith(sggCode));
}

/** Expiry instant of a request created at `from`. */
export function dealRequestExpiry(from: Date, ttlDays: number): Date {
  return new Date(from.getTime() + ttlDays * 86_400_000);
}
