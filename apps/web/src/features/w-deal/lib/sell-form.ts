import {
  type AssetType,
  COMPLEX_ASSET_TYPES,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  FLOOR_CLASS_LABEL,
  normalizePhone,
} from '@house/shared';
import type { AreaUnit } from '@/lib/format';
import { floorClassOf, toKstDateString } from '@/lib/format';
import type { DealRequestCreatePayload } from '../api/client';
import {
  AREA_LIMIT_SQM,
  areaLimitMessage,
  CONTACT_SCOPE_DEFAULTS,
  CONTACT_SCOPE_FIELDS,
  formSchemaOf,
  parseAreaToSqm,
  validateContactScope,
  validateMoney,
  validateMoveInDate,
  type ContactScopeValues,
  type FieldIssue,
  type UploadedPhoto,
} from './form-common';
import { dealTypesFor, MAX_REQUEST_PHOTOS } from './labels';

/** 내놓기 wizard values (strings as typed; converted by `toSellPayload`). */
export interface SellFormValues extends ContactScopeValues {
  assetType: AssetType | '';
  roadAddress: string;
  jibunAddress: string;
  zonecode: string;
  /** 법정동코드 (10 digits) from the postcode search. */
  bcode: string;
  buildingName: string;
  /** Matched complex (아파트·오피스텔). */
  complexId: string;
  complexName: string;
  /** PRIVATE: 동 / 호 of a complex unit. */
  dong: string;
  ho: string;
  /** PRIVATE: free-form detail address for non-complex assets (층·호, 지번 등). */
  addressDetail: string;
  /** Always one of `dealTypesFor(assetType)` (매매 preselected, as in the design). */
  dealType: DealType;
  /** 매매가 / 분양권 매매가 (만원). */
  salePrice: string;
  /** 전세 보증금 / 월세 보증금 (만원). */
  deposit: string;
  monthlyRent: string;
  priceNegotiable: boolean;
  /** Selected ComplexAreaType id when the complex is known ('' = typed by hand). */
  areaTypeId: string;
  /** Exact 전용면적 (㎡) of the selected area type — wins over `area`. */
  areaTypeSqm: string;
  /** 평형 label of the selected area type ("34평") — display only. */
  areaTypeLabel: string;
  /** 전용면적 typed by hand, in `areaUnit`. */
  area: string;
  areaUnit: AreaUnit;
  floor: string;
  moveInDate: string;
  moveInNegotiable: boolean;
  moveInNow: boolean;
  description: string;
  photos: UploadedPhoto[];
}

export const SELL_DEFAULTS: SellFormValues = {
  assetType: '',
  roadAddress: '',
  jibunAddress: '',
  zonecode: '',
  bcode: '',
  buildingName: '',
  complexId: '',
  complexName: '',
  dong: '',
  ho: '',
  addressDetail: '',
  dealType: DealType.SALE,
  salePrice: '',
  deposit: '',
  monthlyRent: '',
  priceNegotiable: false,
  areaTypeId: '',
  areaTypeSqm: '',
  areaTypeLabel: '',
  area: '',
  areaUnit: 'pyeong',
  floor: '',
  moveInDate: '',
  moveInNegotiable: false,
  moveInNow: false,
  description: '',
  photos: [],
  ...CONTACT_SCOPE_DEFAULTS,
};

export const SELL_STEPS = [
  { key: 'property', label: '매물 정보' },
  { key: 'terms', label: '거래 조건' },
  { key: 'contact', label: '사진 · 연락처' },
  { key: 'review', label: '확인 · 전달' },
] as const;

/** Fields validated when leaving each step. */
export const SELL_STEP_FIELDS: readonly (readonly (keyof SellFormValues)[])[] = [
  ['assetType', 'roadAddress', 'dong', 'ho', 'addressDetail'],
  ['dealType', 'salePrice', 'deposit', 'monthlyRent', 'area', 'floor', 'moveInDate', 'description'],
  ['photos', ...CONTACT_SCOPE_FIELDS],
  [],
];

function num(input: string): number | undefined {
  const n = Number(input.replace(/[,\s]/g, ''));
  return input.trim() !== '' && Number.isFinite(n) ? n : undefined;
}

export function isComplexAsset(assetType: AssetType | ''): boolean {
  return assetType !== '' && COMPLEX_ASSET_TYPES.includes(assetType);
}

/** Which price inputs a deal type needs. */
export function priceFieldsFor(dealType: DealType): {
  sale: boolean;
  deposit: boolean;
  rent: boolean;
} {
  return {
    sale: dealType === DealType.SALE || dealType === DealType.PRESALE,
    deposit: dealType === DealType.JEONSE || dealType === DealType.MONTHLY,
    rent: dealType === DealType.MONTHLY,
  };
}

export function sellPriceLabel(dealType: DealType): string {
  switch (dealType) {
    case DealType.JEONSE:
      return '희망 전세가';
    case DealType.MONTHLY:
      return '희망 보증금 / 월세';
    case DealType.PRESALE:
      return '희망 분양권 매매가';
    default:
      return '희망 매매가';
  }
}

/** 전용면적 in ㎡: the selected area type, else the typed value. undefined = empty, null = invalid. */
export function sellExclusiveSqm(v: SellFormValues): number | undefined | null {
  if (v.areaTypeId && v.areaTypeSqm) {
    const n = Number(v.areaTypeSqm);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return parseAreaToSqm(v.area, v.areaUnit);
}

/**
 * Floor of the unit: typed value, or derived from 호 for complex units (1502호 → 15층).
 * For complex units this is PRIVATE (it narrows the 동·호) — use it only for the 저/중/고 class.
 */
export function sellFloor(v: SellFormValues): number | undefined {
  const typed = num(v.floor);
  if (typed !== undefined && Number.isInteger(typed) && typed !== 0) return typed;
  if (!isComplexAsset(v.assetType)) return undefined;
  const ho = v.ho.trim().replace(/호$/, '');
  if (!/^\d{3,4}$/.test(ho)) return undefined;
  const floor = Math.floor(Number(ho) / 100);
  return floor >= 1 ? floor : undefined;
}

/**
 * 동 / 호 of a complex unit: numbers up to 4 digits ("103", "1502", optional 동·호 suffix), or a
 * short name ("A", "가", "B1"). null = valid.
 */
const UNIT_PART_TEXT = {
  동: { empty: '동을 입력해 주세요.', range: '동은 1~9999 사이 숫자로 입력해 주세요. (예: 103)', name: '동은 6자 이내의 숫자·한글·영문으로 입력해 주세요.' },
  호: { empty: '호수를 입력해 주세요.', range: '호수는 1~9999 사이 숫자로 입력해 주세요. (예: 1502)', name: '호수는 6자 이내의 숫자·한글·영문으로 입력해 주세요.' },
} as const;

export function unitPartIssue(input: string, part: '동' | '호'): string | null {
  const text = UNIT_PART_TEXT[part];
  const raw = input.trim();
  if (!raw) return text.empty;
  const value = raw.endsWith(part) ? raw.slice(0, -1).trim() : raw;
  if (/^\d+$/.test(value)) return value.length > 4 || Number(value) < 1 ? text.range : null;
  return /^[0-9A-Za-z가-힣-]{1,6}$/.test(value) ? null : text.name;
}

export function validateSell(v: SellFormValues, today = toKstDateString()): FieldIssue[] {
  const issues: FieldIssue[] = [];

  // Step 1 — property
  if (!v.assetType) issues.push({ path: 'assetType', message: '매물 유형을 선택해 주세요.' });
  if (!v.roadAddress.trim())
    issues.push({ path: 'roadAddress', message: '주소를 검색해서 선택해 주세요.' });
  if (isComplexAsset(v.assetType)) {
    const dongIssue = unitPartIssue(v.dong, '동');
    if (dongIssue) issues.push({ path: 'dong', message: dongIssue });
    const hoIssue = unitPartIssue(v.ho, '호');
    if (hoIssue) issues.push({ path: 'ho', message: hoIssue });
  } else if (v.addressDetail.trim().length > 100) {
    issues.push({ path: 'addressDetail', message: '상세 주소는 100자 이내로 입력해 주세요.' });
  }

  // Step 2 — terms
  if (!v.dealType) issues.push({ path: 'dealType', message: '거래 유형을 선택해 주세요.' });
  else if (v.assetType && !dealTypesFor(v.assetType).includes(v.dealType))
    issues.push({ path: 'dealType', message: '이 매물 유형에서 선택할 수 없는 거래 유형이에요.' });
  const need = priceFieldsFor(v.dealType);
  if (need.sale)
    validateMoney(issues, 'salePrice', v.salePrice, {
      required: true,
      label: '희망 가격을',
      kind: 'price',
    });
  if (need.deposit)
    validateMoney(issues, 'deposit', v.deposit, {
      required: true,
      label: '보증금을',
      kind: 'deposit',
    });
  if (need.rent) {
    const rent = validateMoney(issues, 'monthlyRent', v.monthlyRent, {
      required: true,
      label: '월세를',
      kind: 'rent',
    });
    if (rent === 0) issues.push({ path: 'monthlyRent', message: '월세는 1만원 이상이어야 해요.' });
  }
  const area = sellExclusiveSqm(v);
  if (area === undefined) issues.push({ path: 'area', message: '면적을 입력해 주세요.' });
  else if (area === null || area > 1_000_000)
    issues.push({ path: 'area', message: '면적을 숫자로 입력해 주세요. (예: 34)' });
  else if (v.assetType && area > AREA_LIMIT_SQM[v.assetType])
    issues.push({ path: 'area', message: areaLimitMessage(v.assetType) });
  if (v.floor.trim() !== '') {
    const floor = Number(v.floor);
    if (!Number.isInteger(floor) || floor < -10 || floor > 200 || floor === 0)
      issues.push({ path: 'floor', message: '층을 숫자로 입력해 주세요. (지하는 -1)' });
  }
  validateMoveInDate(issues, v.moveInNow ? '' : v.moveInDate, today, !v.moveInNow);
  if (v.description.length > 2800)
    issues.push({ path: 'description', message: '설명은 2,800자 이내로 입력해 주세요.' });

  // Step 3 — photos, contact, scope, consent
  if (v.photos.length > MAX_REQUEST_PHOTOS)
    issues.push({
      path: 'photos',
      message: `사진은 최대 ${MAX_REQUEST_PHOTOS}장까지 올릴 수 있어요.`,
    });
  validateContactScope(v, issues);
  return issues;
}

export const sellFormSchema = formSchemaOf<SellFormValues>((v) => validateSell(v));

/** PRIVATE detail address sent as `addressDetail`: "103동 1502호" or the free-form text. */
export function sellAddressDetail(v: SellFormValues): string {
  if (isComplexAsset(v.assetType)) {
    const dong = v.dong.trim();
    const ho = v.ho.trim();
    return [dong && `${dong.replace(/동$/, '')}동`, ho && `${ho.replace(/호$/, '')}호`]
      .filter(Boolean)
      .join(' ');
  }
  return v.addressDetail.trim();
}

/**
 * Flags the API has no column for (협의 가능, 즉시 입주, 저/중/고층, …) travel as leading lines of
 * `description` so the receiving agencies still see them. `extra` lines are added verbatim.
 */
export function composeDescription(
  text: string,
  flags: {
    priceNegotiable?: boolean;
    moveInNegotiable?: boolean;
    moveInNow?: boolean;
    extra?: readonly string[];
  },
): string | undefined {
  const lines: string[] = [];
  for (const line of flags.extra ?? []) lines.push(`· ${line}`);
  if (flags.priceNegotiable) lines.push('· 가격 협의 가능');
  if (flags.moveInNow) lines.push('· 즉시 입주 가능');
  else if (flags.moveInNegotiable) lines.push('· 입주일 협의 가능');
  const body = text.trim();
  const out = [lines.join('\n'), body].filter(Boolean).join('\n\n');
  return out || undefined;
}

/**
 * 저/중/고 class of a complex unit for the agencies ("중층 (총 25층)"), or null when the total floor
 * count of the complex is unknown. The exact floor is never sent before a contact grant.
 */
export function sellFloorClassText(
  v: SellFormValues,
  floorsMax: number | null | undefined,
): string | null {
  if (!isComplexAsset(v.assetType) || !floorsMax) return null;
  const floor = sellFloor(v);
  if (floor === undefined) return null;
  return `${FLOOR_CLASS_LABEL[floorClassOf(floor, floorsMax)]} (총 ${floorsMax}층)`;
}

/**
 * Form values → POST /deal-requests body (SELL_OR_LEASE). Call only after `validateSell` passes.
 * `floorsMax` (from the matched complex) turns the private 호 into a public 저/중/고 class line.
 */
export function toSellPayload(
  v: SellFormValues,
  ctx: { floorsMax?: number | null } = {},
): DealRequestCreatePayload {
  if (!v.assetType || !v.dealType) throw new Error('sell form is incomplete');
  const need = priceFieldsFor(v.dealType);
  const selected = v.visibility === DealRequestVisibility.SELECTED_AGENCIES;
  const detail = sellAddressDetail(v);
  const complexUnit = isComplexAsset(v.assetType);
  const floorClass = sellFloorClassText(v, ctx.floorsMax);
  return {
    type: DealRequestType.SELL_OR_LEASE,
    assetType: v.assetType,
    dealTypes: [v.dealType],
    visibility: v.visibility,
    targetAgencyIds: selected ? v.targetAgencies.map((a) => a.id) : [],
    contactName: v.contactName.trim(),
    contactPhone: normalizePhone(v.contactPhone),
    description: composeDescription(v.description, {
      ...v,
      extra: floorClass ? [floorClass] : [],
    }),
    roadAddress: v.roadAddress.trim(),
    addressDetail: detail || undefined,
    complexId: v.complexId || undefined,
    exclusiveArea: sellExclusiveSqm(v) ?? undefined,
    // A complex unit's floor comes from its 호 — PRIVATE, so it is not sent (the backend can derive
    // it from addressDetail after a contact grant). Other assets send the typed floor.
    floor: complexUnit ? undefined : sellFloor(v),
    desiredSalePrice: need.sale ? (validMoney(v.salePrice) ?? undefined) : undefined,
    desiredDeposit: need.deposit ? (validMoney(v.deposit) ?? undefined) : undefined,
    desiredMonthlyRent: need.rent ? (validMoney(v.monthlyRent) ?? undefined) : undefined,
    moveInDate: v.moveInNow ? undefined : v.moveInDate || undefined,
    photoMediaIds: v.photos.map((p) => p.id),
  };
}

function validMoney(input: string): number | undefined {
  const issues: FieldIssue[] = [];
  return validateMoney(issues, '_', input, { label: '' });
}

/** Required-field progress for the summary card ("필수 항목 7 / 9"). */
export function sellProgress(v: SellFormValues): { done: number; total: number } {
  const need = priceFieldsFor(v.dealType);
  const checks: boolean[] = [
    !!v.assetType,
    !!v.roadAddress.trim(),
    isComplexAsset(v.assetType) ? !!v.dong.trim() && !!v.ho.trim() : true,
    !!v.dealType,
    !!v.dealType &&
      (!need.sale || !!v.salePrice.trim()) &&
      (!need.deposit || !!v.deposit.trim()) &&
      (!need.rent || !!v.monthlyRent.trim()),
    !!sellExclusiveSqm(v),
    v.moveInNow || !!v.moveInDate,
    !!v.contactName.trim() && !!v.contactPhone.trim(),
    v.agreePrivacy && v.agreeProvide,
  ];
  return { done: checks.filter(Boolean).length, total: checks.length };
}
