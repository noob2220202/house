import {
  DealRequestType,
  DealRequestVisibility,
  DealType,
  normalizePhone,
  type AssetType,
} from '@house/shared';
import {
  formatManwon,
  formatPriceRange,
  formatSqm,
  toKstDateString,
  type AreaUnit,
} from '@/lib/format';
import type { DealRequestCreatePayload } from '../api/client';
import {
  CONTACT_SCOPE_DEFAULTS,
  CONTACT_SCOPE_FIELDS,
  formSchemaOf,
  parseAreaToSqm,
  validateContactScope,
  validateMoney,
  validateMoveInDate,
  type ContactScopeValues,
  type FieldIssue,
} from './form-common';
import { dealTypesFor } from './labels';
import { composeDescription, isComplexAsset } from './sell-form';

/** 구하기 wizard values. */
export interface FindFormValues extends ContactScopeValues {
  assetType: AssetType | '';
  dealTypes: DealType[];
  regionCodes: string[];
  /** 매매·분양권 예산 (만원). */
  priceMin: string;
  priceMax: string;
  /** 전세 보증금 (or the 월세 보증금 when only 월세 is selected). */
  depositMin: string;
  depositMax: string;
  /** 월세 보증금 when 전세 and 월세 are both selected (a 2억 전세 and a 3,000 월세 budget differ). */
  monthlyDepositMin: string;
  monthlyDepositMax: string;
  rentMin: string;
  rentMax: string;
  /** 아파트·오피스텔: 평형 bands (공급 평형, mapped to 전용 ranges). */
  areaBands: string[];
  /** 아파트·오피스텔: type a 전용 ㎡ range instead of picking bands. */
  areaCustom: boolean;
  /** Typed area range — 전용 ㎡ for 아파트·오피스텔, otherwise in `areaUnit` (실면적). */
  areaMin: string;
  areaMax: string;
  areaUnit: AreaUnit;
  /** '' = 상관없음, otherwise minimum room count. */
  roomsMin: string;
  moveInDate: string;
  moveInNegotiable: boolean;
  description: string;
}

export const FIND_DEFAULTS: FindFormValues = {
  assetType: '',
  dealTypes: [],
  regionCodes: [],
  priceMin: '',
  priceMax: '',
  depositMin: '',
  depositMax: '',
  monthlyDepositMin: '',
  monthlyDepositMax: '',
  rentMin: '',
  rentMax: '',
  areaBands: [],
  areaCustom: false,
  areaMin: '',
  areaMax: '',
  areaUnit: 'pyeong',
  roomsMin: '',
  moveInDate: '',
  moveInNegotiable: false,
  description: '',
  ...CONTACT_SCOPE_DEFAULTS,
};

export const FIND_STEPS = [
  { key: 'wanted', label: '찾는 조건' },
  { key: 'budget', label: '예산 · 면적' },
  { key: 'contact', label: '연락처 · 전달' },
  { key: 'review', label: '확인 · 등록' },
] as const;

export const FIND_STEP_FIELDS: readonly (readonly (keyof FindFormValues)[])[] = [
  ['assetType', 'dealTypes', 'regionCodes'],
  [
    'priceMin',
    'priceMax',
    'depositMin',
    'depositMax',
    'monthlyDepositMin',
    'monthlyDepositMax',
    'rentMin',
    'rentMax',
    'areaMin',
    'areaMax',
    'moveInDate',
    'description',
  ],
  [...CONTACT_SCOPE_FIELDS],
  [],
];

export const MAX_FIND_REGIONS = 20;

/**
 * 평형 bands of the 구하기 form. People mean 공급 평형 ("34평") while the API filters by 전용면적,
 * so each band maps to a 전용 ㎡ range (전용 59㎡ ≈ 25평형, 84㎡ ≈ 34평형, 114㎡ ≈ 45평형).
 */
export interface AreaBand {
  key: string;
  label: string;
  /** 전용 ㎡ (inclusive lower bound / upper bound). */
  min?: number;
  max?: number;
}
export const AREA_BANDS: readonly AreaBand[] = [
  { key: '10', label: '10평대', max: 40 },
  { key: '20', label: '20평대', min: 40, max: 62 },
  { key: '30', label: '30평대', min: 62, max: 95 },
  { key: '40', label: '40평대', min: 95, max: 125 },
  { key: '50', label: '50평 이상', min: 125 },
];

/** "~40㎡", "40~62㎡", "125㎡~" — 전용 range caption of a band. */
export function bandRangeText(b: Pick<AreaBand, 'min' | 'max'>): string {
  const n = (x: number) => formatSqm(x).replace('㎡', '');
  if (b.min !== undefined && b.max !== undefined) return `${n(b.min)}~${n(b.max)}㎡`;
  if (b.max !== undefined) return `~${n(b.max)}㎡`;
  if (b.min !== undefined) return `${n(b.min)}㎡~`;
  return '';
}

/** Selected bands in band order. */
export function selectedBands(keys: readonly string[]): AreaBand[] {
  return AREA_BANDS.filter((b) => keys.includes(b.key));
}

/** 전용 ㎡ range covering the selected bands (the API has one range); null when none is selected. */
export function bandsRange(keys: readonly string[]): { min?: number; max?: number } | null {
  const picked = selectedBands(keys);
  const first = picked[0];
  const last = picked[picked.length - 1];
  if (!first || !last) return null;
  return { min: first.min, max: last.max };
}

/** "20~30평대", "50평 이상", "10평대" for a 전용 range made of whole bands; null otherwise. */
export function bandLabelFor(min?: number | null, max?: number | null): string | null {
  const lo = AREA_BANDS.findIndex((b) => (b.min ?? null) === (min ?? null));
  const hi = AREA_BANDS.findIndex((b) => (b.max ?? null) === (max ?? null));
  if (lo < 0 || hi < 0 || hi < lo) return null;
  const a = AREA_BANDS[lo];
  const b = AREA_BANDS[hi];
  if (!a || !b) return null;
  if (lo === hi) return a.label;
  if (b.max === undefined) return `${a.label.replace('평대', '')}평 이상`;
  return `${a.label.replace('평대', '')}~${b.label}`;
}

/** How the area is asked: 평형 bands, a typed 전용 ㎡ range, or a free 평/㎡ range (실면적). */
export type FindAreaMode = 'bands' | 'custom' | 'free';
export function findAreaMode(v: Pick<FindFormValues, 'assetType' | 'areaCustom'>): FindAreaMode {
  if (!isComplexAsset(v.assetType)) return 'free';
  return v.areaCustom ? 'custom' : 'bands';
}
/** Unit of the typed range in the current mode (custom is always 전용 ㎡). */
export function findAreaUnit(v: Pick<FindFormValues, 'assetType' | 'areaCustom' | 'areaUnit'>) {
  return findAreaMode(v) === 'custom' ? 'sqm' : v.areaUnit;
}

/** Which budget rows the selected deal types need. */
export function budgetFieldsFor(dealTypes: readonly DealType[]): {
  price: boolean;
  /** depositMin/Max — labelled `depositLabel`. */
  deposit: boolean;
  depositLabel: string;
  /** A separate 월세 보증금 row (전세 and 월세 both selected). */
  monthlyDeposit: boolean;
  rent: boolean;
} {
  const jeonse = dealTypes.includes(DealType.JEONSE);
  const monthly = dealTypes.includes(DealType.MONTHLY);
  return {
    price: dealTypes.includes(DealType.SALE) || dealTypes.includes(DealType.PRESALE),
    deposit: jeonse || monthly,
    depositLabel: jeonse ? '전세 보증금' : '보증금',
    monthlyDeposit: jeonse && monthly,
    rent: monthly,
  };
}

function validateRange(
  issues: FieldIssue[],
  minPath: string,
  maxPath: string,
  minInput: string,
  maxInput: string,
  opts: { requireMax: boolean; label: string },
): void {
  const min = validateMoney(issues, minPath, minInput, { label: opts.label });
  const max = validateMoney(issues, maxPath, maxInput, {
    required: opts.requireMax,
    label: `${opts.label} 최대 금액을`,
  });
  if (min !== undefined && max !== undefined && min > max)
    issues.push({ path: maxPath, message: '최대 금액이 최소 금액보다 작아요.' });
}

export function validateFind(v: FindFormValues, today = toKstDateString()): FieldIssue[] {
  const issues: FieldIssue[] = [];

  // Step 1
  if (!v.assetType) issues.push({ path: 'assetType', message: '찾는 매물 유형을 선택해 주세요.' });
  if (v.dealTypes.length === 0)
    issues.push({ path: 'dealTypes', message: '거래 유형을 하나 이상 선택해 주세요.' });
  else if (v.assetType && v.dealTypes.some((d) => !dealTypesFor(v.assetType).includes(d)))
    issues.push({
      path: 'dealTypes',
      message: '이 매물 유형에서 선택할 수 없는 거래 유형이 있어요.',
    });
  if (v.regionCodes.length === 0)
    issues.push({ path: 'regionCodes', message: '희망 지역을 하나 이상 선택해 주세요.' });
  else if (v.regionCodes.length > MAX_FIND_REGIONS)
    issues.push({
      path: 'regionCodes',
      message: `지역은 최대 ${MAX_FIND_REGIONS}곳까지 선택할 수 있어요.`,
    });

  // Step 2
  const need = budgetFieldsFor(v.dealTypes);
  if (need.price)
    validateRange(issues, 'priceMin', 'priceMax', v.priceMin, v.priceMax, {
      requireMax: true,
      label: '매매 예산',
    });
  if (need.deposit)
    validateRange(issues, 'depositMin', 'depositMax', v.depositMin, v.depositMax, {
      requireMax: true,
      label: need.depositLabel,
    });
  if (need.monthlyDeposit)
    validateRange(
      issues,
      'monthlyDepositMin',
      'monthlyDepositMax',
      v.monthlyDepositMin,
      v.monthlyDepositMax,
      { requireMax: true, label: '월세 보증금' },
    );
  if (need.rent)
    validateRange(issues, 'rentMin', 'rentMax', v.rentMin, v.rentMax, {
      requireMax: true,
      label: '월세',
    });
  if (findAreaMode(v) !== 'bands') {
    const unit = findAreaUnit(v);
    const areaMin = parseAreaToSqm(v.areaMin, unit);
    const areaMax = parseAreaToSqm(v.areaMax, unit);
    if (areaMin === null) issues.push({ path: 'areaMin', message: '면적을 숫자로 입력해 주세요.' });
    if (areaMax === null) issues.push({ path: 'areaMax', message: '면적을 숫자로 입력해 주세요.' });
    if (areaMin && areaMax && areaMin > areaMax)
      issues.push({ path: 'areaMax', message: '최대 면적이 최소 면적보다 작아요.' });
  }
  validateMoveInDate(issues, v.moveInDate, today, false);
  if (v.description.length > 2800)
    issues.push({ path: 'description', message: '요청 사항은 2,800자 이내로 입력해 주세요.' });

  // Step 3
  validateContactScope(v, issues);
  return issues;
}

export const findFormSchema = formSchemaOf<FindFormValues>((v) => validateFind(v));

const money = (input: string): number | undefined => {
  const issues: FieldIssue[] = [];
  return validateMoney(issues, '_', input, { label: '' });
};

/** "2억 이하", "1억 ~ 2억", "3,000~" (만원). */
export function budgetRangeText(min?: number, max?: number): string {
  if (max !== undefined && min === undefined) return `${formatManwon(max)} 이하`;
  return formatPriceRange(min, max);
}

/** 전용 ㎡ range of the area answer (undefined = not given). */
export function findAreaRange(v: FindFormValues): { min?: number; max?: number } {
  if (findAreaMode(v) === 'bands') return bandsRange(v.areaBands) ?? {};
  const unit = findAreaUnit(v);
  return {
    min: parseAreaToSqm(v.areaMin, unit) ?? undefined,
    max: parseAreaToSqm(v.areaMax, unit) ?? undefined,
  };
}

/**
 * Lines the API has no column for, sent at the top of `description`: the exact 평형 bands and,
 * with 전세 + 월세, the per-type deposit ranges (the API has one deposit range).
 */
export function findExtraLines(v: FindFormValues): string[] {
  const lines: string[] = [];
  const bands = findAreaMode(v) === 'bands' ? selectedBands(v.areaBands) : [];
  if (bands.length > 0) lines.push(`희망 평형: ${bands.map((b) => b.label).join(', ')}`);
  const need = budgetFieldsFor(v.dealTypes);
  if (need.monthlyDeposit) {
    lines.push(`전세 보증금 ${budgetRangeText(money(v.depositMin), money(v.depositMax))}`);
    lines.push(
      `월세 보증금 ${budgetRangeText(money(v.monthlyDepositMin), money(v.monthlyDepositMax))}`,
    );
  }
  return lines;
}

/** depositMin/Max sent to the API: the union of the 전세 and 월세 ranges when both are asked. */
function depositRange(v: FindFormValues): { min?: number; max?: number } {
  const need = budgetFieldsFor(v.dealTypes);
  if (!need.deposit) return {};
  const a = { min: money(v.depositMin), max: money(v.depositMax) };
  if (!need.monthlyDeposit) return a;
  const b = { min: money(v.monthlyDepositMin), max: money(v.monthlyDepositMax) };
  const mins = [a.min, b.min];
  const maxes = [a.max, b.max];
  return {
    // An open lower bound on either side keeps the union open.
    min: mins.every((m) => m !== undefined) ? Math.min(...mins) : undefined,
    max: maxes.every((m) => m !== undefined) ? Math.max(...maxes) : undefined,
  };
}

/** Form values → POST /deal-requests body (WANTED). Call only after `validateFind` passes. */
export function toFindPayload(v: FindFormValues): DealRequestCreatePayload {
  if (!v.assetType || v.dealTypes.length === 0) throw new Error('find form is incomplete');
  const need = budgetFieldsFor(v.dealTypes);
  const selected = v.visibility === DealRequestVisibility.SELECTED_AGENCIES;
  const rooms = v.roomsMin === '' ? undefined : Number(v.roomsMin);
  const deposit = depositRange(v);
  const area = findAreaRange(v);
  return {
    type: DealRequestType.WANTED,
    assetType: v.assetType,
    dealTypes: v.dealTypes,
    visibility: v.visibility,
    targetAgencyIds: selected ? v.targetAgencies.map((a) => a.id) : [],
    contactName: v.contactName.trim(),
    contactPhone: normalizePhone(v.contactPhone),
    description: composeDescription(v.description, {
      moveInNegotiable: v.moveInNegotiable,
      extra: findExtraLines(v),
    }),
    regionCodes: v.regionCodes,
    complexIds: [],
    priceMin: need.price ? money(v.priceMin) : undefined,
    priceMax: need.price ? money(v.priceMax) : undefined,
    depositMin: deposit.min,
    depositMax: deposit.max,
    rentMin: need.rent ? money(v.rentMin) : undefined,
    rentMax: need.rent ? money(v.rentMax) : undefined,
    areaMin: area.min,
    areaMax: area.max,
    roomsMin: Number.isInteger(rooms) ? rooms : undefined,
    moveInDate: v.moveInDate || undefined,
  };
}

export function findProgress(v: FindFormValues): { done: number; total: number } {
  const need = budgetFieldsFor(v.dealTypes);
  const checks: boolean[] = [
    !!v.assetType,
    v.dealTypes.length > 0,
    v.regionCodes.length > 0,
    v.dealTypes.length > 0 &&
      (!need.price || !!v.priceMax.trim()) &&
      (!need.deposit || !!v.depositMax.trim()) &&
      (!need.monthlyDeposit || !!v.monthlyDepositMax.trim()) &&
      (!need.rent || !!v.rentMax.trim()),
    !!v.contactName.trim() && !!v.contactPhone.trim(),
    v.agreePrivacy && v.agreeProvide,
  ];
  return { done: checks.filter(Boolean).length, total: checks.length };
}
