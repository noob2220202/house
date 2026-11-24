import {
  AssetType,
  COMPLEX_ASSET_TYPES,
  DealType,
  FloorDisplay,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  MoveInType,
  isBuildingAsset,
  listingDraftSchema,
  type BuildingUse,
  type Direction,
  type DirectionBasis,
  type ListingOption,
} from '@house/shared';
import { parsePriceInput } from '@/lib/format';
import type { AgencyListing, MaintenanceFeeView } from '../api/schemas';
import { listingEmdCode } from './region';

/** Wizard steps, in order. `key` is also the `?step=` value. */
export const STEPS = [
  { key: 'property', label: '종류·소재지', title: '어떤 매물인가요?' },
  { key: 'deal', label: '거래·가격', title: '거래 조건을 알려 주세요' },
  { key: 'detail', label: '면적·상세', title: '면적과 상세 정보를 입력해 주세요' },
  { key: 'photos', label: '사진', title: '사진을 올려 주세요' },
  { key: 'description', label: '설명·옵션', title: '매물을 소개해 주세요' },
  { key: 'verify', label: '실매물 확인', title: '실매물 확인을 기록해 주세요' },
  { key: 'preview', label: '미리보기·게시', title: '공개될 화면을 확인해 주세요' },
] as const;
export type StepKey = (typeof STEPS)[number]['key'];
export const LAST_STEP = STEPS.length - 1;

export function stepIndexOf(key: string | null | undefined): number {
  const i = STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

/** 관리비 세부 항목 in the order the form lists them (shared `MaintenanceFeeKind`). */
export const FEE_KINDS: readonly MaintenanceFeeKind[] = Object.values(MaintenanceFeeKind);

/** One 관리비 항목 row of the form: 포함 여부 + 월 금액 (원, digits as typed). */
export interface FeeItemValue {
  kind: MaintenanceFeeKind;
  included: boolean;
  amount: string;
}

export const emptyFeeItems = (): FeeItemValue[] =>
  FEE_KINDS.map((kind) => ({ kind, included: false, amount: '' }));

/** All inputs are strings while editing; `toDraftPayload` converts them. */
export interface ListingFormValues {
  assetType: AssetType | '';
  complexId: string;
  /** Display only (not sent). */
  complexName: string;
  areaTypeId: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  dong: string;
  ho: string;
  lat: number | null;
  lng: number | null;
  /** 법정동코드 of the picked address / complex (10 digits, '' = not resolved). Not typed. */
  emdCode: string;
  /** 건축물대장상 용도 (「중개대상물 종류」); '' = not chosen (implied for 아파트·오피스텔). */
  buildingUse: BuildingUse | '';
  floor: string;
  totalFloors: string;
  floorDisplay: FloorDisplay;
  dealType: DealType;
  salePrice: string;
  deposit: string;
  monthlyRent: string;
  presalePrice: string;
  /** Signed 만원 ("-1,200" = 마이너스 프리미엄). */
  premium: string;
  maintenanceNone: boolean;
  /** 만원 / 월, one decimal allowed ("15", "8.5"). */
  maintenanceFee: string;
  /** 관리비 부과방식 (정액 / 실비 정산 / 확인불가). */
  feeBillingType: MaintenanceFeeBillingType | '';
  /** One row per `FEE_KINDS` entry. */
  feeItems: FeeItemValue[];
  /** Why the breakdown cannot be shown (required for 확인불가). */
  feeUnavailableReason: string;
  moveInType: MoveInType | '';
  moveInDate: string;
  exclusiveArea: string;
  supplyArea: string;
  landArea: string;
  rooms: string;
  baths: string;
  direction: Direction | '';
  directionBasis: DirectionBasis | '';
  approvalDate: string;
  parkingSpaces: string;
  title: string;
  description: string;
  options: ListingOption[];
}
export type FormField = keyof ListingFormValues;

export const FORM_DEFAULTS: ListingFormValues = {
  assetType: '',
  complexId: '',
  complexName: '',
  areaTypeId: '',
  roadAddress: '',
  jibunAddress: '',
  buildingName: '',
  dong: '',
  ho: '',
  lat: null,
  lng: null,
  emdCode: '',
  buildingUse: '',
  floor: '',
  totalFloors: '',
  floorDisplay: FloorDisplay.EXACT,
  dealType: DealType.SALE,
  salePrice: '',
  deposit: '',
  monthlyRent: '',
  presalePrice: '',
  premium: '',
  maintenanceNone: false,
  maintenanceFee: '',
  feeBillingType: '',
  feeItems: emptyFeeItems(),
  feeUnavailableReason: '',
  moveInType: '',
  moveInDate: '',
  exclusiveArea: '',
  supplyArea: '',
  landArea: '',
  rooms: '',
  baths: '',
  direction: '',
  directionBasis: '',
  approvalDate: '',
  parkingSpaces: '',
  title: '',
  description: '',
  options: [],
};

/** Step each form field lives on (focus / error routing). */
export const FIELD_STEP: Record<FormField, number> = {
  assetType: 0,
  complexId: 0,
  complexName: 0,
  roadAddress: 0,
  jibunAddress: 0,
  buildingName: 0,
  dong: 0,
  ho: 0,
  lat: 0,
  lng: 0,
  emdCode: 0,
  buildingUse: 0,
  floor: 0,
  totalFloors: 0,
  floorDisplay: 0,
  dealType: 1,
  salePrice: 1,
  deposit: 1,
  monthlyRent: 1,
  presalePrice: 1,
  premium: 1,
  maintenanceNone: 1,
  maintenanceFee: 1,
  feeBillingType: 1,
  feeItems: 1,
  feeUnavailableReason: 1,
  moveInType: 1,
  moveInDate: 1,
  areaTypeId: 2,
  exclusiveArea: 2,
  supplyArea: 2,
  landArea: 2,
  rooms: 2,
  baths: 2,
  direction: 2,
  directionBasis: 2,
  approvalDate: 2,
  parkingSpaces: 2,
  title: 4,
  description: 4,
  options: 4,
};

// ---- asset-type rules ------------------------------------------------------------------------------

export const isComplexAsset = (t: AssetType | '' | undefined): boolean =>
  !!t && COMPLEX_ASSET_TYPES.includes(t);
export const isLand = (t: AssetType | '' | undefined): boolean => t === AssetType.LAND;
/** 주거용 (방·욕실 wording; 상업·업무 asks for 방(룸)·화장실). */
export const isResidential = (t: AssetType | '' | undefined): boolean =>
  t === AssetType.APT ||
  t === AssetType.OFFICETEL ||
  t === AssetType.ONEROOM ||
  t === AssetType.HOUSE;
/** 대지면적 입력이 의미 있는 유형. */
export const hasLandArea = (t: AssetType | '' | undefined): boolean =>
  t === AssetType.HOUSE || t === AssetType.LAND || t === AssetType.COMMERCIAL;

/** Deal types offered for an asset type (분양권 is for 공동주택·오피스텔 only). */
export function dealTypesFor(t: AssetType | ''): DealType[] {
  if (isComplexAsset(t)) {
    return [DealType.SALE, DealType.JEONSE, DealType.MONTHLY, DealType.PRESALE];
  }
  if (isLand(t)) return [DealType.SALE, DealType.MONTHLY];
  return [DealType.SALE, DealType.JEONSE, DealType.MONTHLY];
}

// ---- parsing ---------------------------------------------------------------------------------------

/** '' → undefined, "25" → 25, "B1"/"지하 1"/"-1" → -1, anything else → null (invalid). */
export function parseFloor(input: string): number | undefined | null {
  const s = input.replace(/\s|층/g, '');
  if (s === '') return undefined;
  const basement = /^(?:B|b|지하|-)(\d{1,2})$/.exec(s);
  if (basement) return -Number(basement[1]);
  return /^\d{1,3}$/.test(s) ? Number(s) : null;
}

/** 관리비 항목 금액 in 원: '' → undefined, "70,000" → 70000, invalid → null. */
export function parseWon(input: string): number | undefined | null {
  const s = input.replace(/[\s,원]/g, '');
  if (s === '') return undefined;
  return /^\d{1,9}$/.test(s) ? Number(s) : null;
}

/** '' → undefined, non-negative integer → number, anything else → null. */
export function parseCount(input: string): number | undefined | null {
  const s = input.replace(/[\s,]/g, '');
  if (s === '') return undefined;
  return /^\d{1,7}$/.test(s) ? Number(s) : null;
}

/** Area in ㎡ with up to two decimals: '' → undefined, "84.98" → 84.98, invalid / ≤ 0 → null. */
export function parseArea(input: string): number | undefined | null {
  const s = input.replace(/[\s,㎡]/g, '');
  if (s === '') return undefined;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
}

/** Money in 만원: '' → undefined, "4억 2,000" / "44,500" → number, invalid → null. */
export function parseMoney(input: string): number | undefined | null {
  if (input.trim() === '') return undefined;
  return parsePriceInput(input);
}

/** Signed premium in 만원: "-1,200" → -1200, "+2,700" / "2700" → 2700. */
export function parsePremium(input: string): number | undefined | null {
  const s = input.replace(/[\s,]/g, '').replace(/^[−–]/, '-');
  // A lone sign (마이너스를 고르고 금액은 아직 안 적음) is still "not entered".
  if (s === '' || s === '-' || s === '+') return undefined;
  const sign = s.startsWith('-') ? -1 : 1;
  const abs = parsePriceInput(s.replace(/^[+-]/, ''));
  return abs === null ? null : sign * abs;
}

/** 관리비 in 만원 (one decimal) → 원: "15" → 150000, "8.5" → 85000. */
export function parseMaintenanceFee(input: string): number | undefined | null {
  const s = input.replace(/[\s,]/g, '').replace(/만원?$/, '');
  if (s === '') return undefined;
  if (!/^\d{1,4}(\.\d)?$/.test(s)) return null;
  return Math.round(Number(s) * 10_000);
}

/** 15,000 → "15,000" while typing (digits only, thousands separators). */
export function formatDigits(input: string): string {
  const digits = input.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  return digits === '' ? '' : Number(digits).toLocaleString('ko-KR');
}

/** Same as `formatDigits` but keeps a leading minus (premium). */
export function formatSignedDigits(input: string): string {
  const negative = /^\s*[-−–]/.test(input);
  const body = formatDigits(input);
  return negative ? `-${body}` : body;
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// ---- form → payload --------------------------------------------------------------------------------

/** Body of POST / PATCH /agency/listings: `listingDraftSchema` with every not-yet-known field omitted. */
export interface DraftPayload {
  dealType: DealType;
  title?: string;
  description?: string;
  salePrice?: number;
  deposit?: number;
  monthlyRent?: number;
  presalePrice?: number;
  premium?: number;
  maintenanceFeeWon?: number;
  /** 관리비 부과방식 + 항목별 내역 (shared `maintenanceFeeSchema`). */
  maintenanceFee?: {
    billingType: MaintenanceFeeBillingType;
    items: { kind: MaintenanceFeeKind; included: boolean; amountWon?: number }[];
    unavailableReason?: string;
  };
  moveInType?: MoveInType;
  moveInDate?: string;
  floorDisplay: FloorDisplay;
  options: ListingOption[];
  property: {
    assetType?: AssetType;
    complexId?: string;
    areaTypeId?: string;
    roadAddress?: string;
    jibunAddress?: string;
    buildingName?: string;
    dong?: string;
    ho?: string;
    lat?: number;
    lng?: number;
    /** 10-digit 법정동코드 (required to publish). */
    emdCode?: string;
    buildingUse?: BuildingUse;
    floor?: number;
    totalFloors?: number;
    exclusiveArea?: number;
    supplyArea?: number;
    landArea?: number;
    rooms?: number;
    baths?: number;
    direction?: Direction;
    directionBasis?: DirectionBasis;
    approvalDate?: string;
    parkingSpaces?: number;
  };
}

/** A format problem of one field (shown inline). */
export interface FieldIssue {
  field: FormField;
  message: string;
}

const text = (s: string) => (s.trim() === '' ? undefined : s.trim());

/** "103" → "103동", "1502" → "1502호" (the public page prints the stored text as is). */
export function withUnit(input: string, unit: '동' | '호'): string | undefined {
  const s = input.replace(/\s+/g, '');
  if (s === '') return undefined;
  return s.endsWith(unit) ? s : `${s}${unit}`;
}

/**
 * Converts the form into the draft payload. Fields that are empty or do not apply to the chosen
 * asset / deal type are omitted; malformed inputs are reported as `issues` (and omitted).
 */
export function toDraftPayload(v: ListingFormValues): {
  payload: DraftPayload;
  issues: FieldIssue[];
} {
  const issues: FieldIssue[] = [];
  const take = <T>(
    field: FormField,
    parsed: T | undefined | null,
    message: string,
  ): T | undefined => {
    if (parsed === null) {
      issues.push({ field, message });
      return undefined;
    }
    return parsed;
  };

  const asset = v.assetType || undefined;
  const land = isLand(asset);
  const complex = isComplexAsset(asset) && v.complexId !== '';
  const deal = dealTypesFor(v.assetType).includes(v.dealType) ? v.dealType : DealType.SALE;

  const property: DraftPayload['property'] = {
    assetType: asset,
    complexId: complex ? v.complexId : undefined,
    areaTypeId: complex ? text(v.areaTypeId) : undefined,
    roadAddress: text(v.roadAddress),
    jibunAddress: text(v.jibunAddress),
    buildingName: text(v.buildingName),
    dong: land ? undefined : withUnit(v.dong, '동'),
    ho: land ? undefined : withUnit(v.ho, '호'),
    lat: v.lat ?? undefined,
    lng: v.lng ?? undefined,
    emdCode: listingEmdCode(v.emdCode),
    buildingUse: asset && isBuildingAsset(asset) && v.buildingUse ? v.buildingUse : undefined,
  };

  if (!land) {
    property.floor = take('floor', parseFloor(v.floor), '층을 숫자로 입력해 주세요. (지하는 B1)');
    property.totalFloors = take(
      'totalFloors',
      parseCount(v.totalFloors),
      '총 층수를 숫자로 입력해 주세요.',
    );
    if (property.totalFloors === 0) {
      issues.push({ field: 'totalFloors', message: '총 층수는 1층 이상이어야 해요.' });
      property.totalFloors = undefined;
    }
    if (
      property.floor !== undefined &&
      property.totalFloors !== undefined &&
      property.floor > property.totalFloors
    ) {
      issues.push({ field: 'floor', message: '해당 층이 총 층수보다 높아요.' });
    }
    property.exclusiveArea = take(
      'exclusiveArea',
      parseArea(v.exclusiveArea),
      '전용면적을 ㎡ 숫자로 입력해 주세요. (예: 84.98)',
    );
    property.supplyArea = take(
      'supplyArea',
      parseArea(v.supplyArea),
      '공급면적을 ㎡ 숫자로 입력해 주세요. (예: 112.4)',
    );
    if (
      property.exclusiveArea !== undefined &&
      property.supplyArea !== undefined &&
      property.exclusiveArea > property.supplyArea
    ) {
      issues.push({ field: 'supplyArea', message: '공급면적이 전용면적보다 작아요.' });
    }
    // 방·욕실 수는 건축물 전부의 명시사항 (상업·업무는 0도 가능).
    property.rooms = take('rooms', parseCount(v.rooms), '방 수를 숫자로 입력해 주세요.');
    property.baths = take('baths', parseCount(v.baths), '욕실 수를 숫자로 입력해 주세요.');
    property.direction = v.direction || undefined;
    property.directionBasis = v.directionBasis || undefined;
    if (v.approvalDate !== '') {
      if (isDate(v.approvalDate)) property.approvalDate = v.approvalDate;
      else issues.push({ field: 'approvalDate', message: '사용승인일을 다시 선택해 주세요.' });
    }
    property.parkingSpaces = take(
      'parkingSpaces',
      parseCount(v.parkingSpaces),
      '주차대수를 숫자로 입력해 주세요.',
    );
  }
  if (hasLandArea(asset)) {
    property.landArea = take(
      'landArea',
      parseArea(v.landArea),
      '대지면적을 ㎡ 숫자로 입력해 주세요.',
    );
  }

  const payload: DraftPayload = {
    dealType: deal,
    title: text(v.title),
    description: text(v.description),
    floorDisplay: land ? FloorDisplay.EXACT : v.floorDisplay,
    options: land ? [] : v.options,
    property,
  };

  const money = (field: FormField, label: string) =>
    take(field, parseMoney(v[field] as string), `${label}을(를) 만원 단위 숫자로 입력해 주세요.`);
  if (deal === DealType.SALE) payload.salePrice = money('salePrice', '매매가');
  if (deal === DealType.JEONSE) payload.deposit = money('deposit', '전세 보증금');
  if (deal === DealType.MONTHLY) {
    payload.deposit = money('deposit', '보증금');
    payload.monthlyRent = money('monthlyRent', '월세');
  }
  if (deal === DealType.PRESALE) {
    payload.presalePrice = money('presalePrice', '분양가');
    payload.premium = take(
      'premium',
      parsePremium(v.premium),
      '프리미엄을 만원 단위 숫자로 입력해 주세요. (마이너스는 -1,200)',
    );
  }

  if (!land) {
    if (v.maintenanceNone) {
      payload.maintenanceFeeWon = 0;
    } else {
      payload.maintenanceFeeWon = take(
        'maintenanceFee',
        parseMaintenanceFee(v.maintenanceFee),
        '관리비를 만원 단위로 입력해 주세요. (예: 15 또는 8.5)',
      );
      if (payload.maintenanceFeeWon) {
        payload.maintenanceFee = toMaintenanceFee(v, issues);
      }
    }
    payload.moveInType = v.moveInType || undefined;
    if (v.moveInType === 'DATE' && v.moveInDate !== '') {
      if (isDate(v.moveInDate)) payload.moveInDate = v.moveInDate;
      else issues.push({ field: 'moveInDate', message: '입주가능일을 다시 선택해 주세요.' });
    }
  }

  return { payload, issues };
}

/**
 * 관리비 부과방식 + 포함 항목 (+ 금액). Omitted until a 부과방식 is chosen — and for 확인불가 until the
 * reason is written (the shared schema requires it) — so a half-filled draft still saves; the
 * publish check reports what is missing.
 */
function toMaintenanceFee(
  v: ListingFormValues,
  issues: FieldIssue[],
): DraftPayload['maintenanceFee'] {
  if (!v.feeBillingType) return undefined;
  const reason = text(v.feeUnavailableReason);
  if (v.feeBillingType === MaintenanceFeeBillingType.UNKNOWN) {
    return reason
      ? { billingType: v.feeBillingType, items: [], unavailableReason: reason }
      : undefined;
  }
  const items: NonNullable<DraftPayload['maintenanceFee']>['items'] = [];
  let bad = false;
  for (const row of v.feeItems) {
    if (!row.included) continue;
    const amount = parseWon(row.amount);
    if (amount === null) bad = true;
    items.push(
      typeof amount === 'number'
        ? { kind: row.kind, included: true, amountWon: amount }
        : { kind: row.kind, included: true },
    );
  }
  if (bad) issues.push({ field: 'feeItems', message: '항목 금액을 원 단위 숫자로 입력해 주세요.' });
  return { billingType: v.feeBillingType, items, ...(reason ? { unavailableReason: reason } : {}) };
}

/** PATCH body: the draft + `null` for every form-managed field left empty (null = clear). */
export type UpdatePayload = Omit<DraftPayload, keyof NullableListingFields | 'property'> & {
  [K in keyof NullableListingFields]?: NullableListingFields[K] | null;
} & {
  property: { [K in keyof DraftPayload['property']]?: DraftPayload['property'][K] | null };
  version?: number;
};
type NullableListingFields = Pick<
  DraftPayload,
  | 'title'
  | 'description'
  | 'salePrice'
  | 'deposit'
  | 'monthlyRent'
  | 'presalePrice'
  | 'premium'
  | 'maintenanceFeeWon'
  | 'maintenanceFee'
  | 'moveInType'
  | 'moveInDate'
>;

const NULLABLE_LISTING_KEYS: readonly (keyof NullableListingFields)[] = [
  'title',
  'description',
  'salePrice',
  'deposit',
  'monthlyRent',
  'presalePrice',
  'premium',
  'maintenanceFeeWon',
  'maintenanceFee',
  'moveInType',
  'moveInDate',
];
/** Property fields the wizard edits (others — 연면적, 용도지역 … — are left untouched). */
const NULLABLE_PROPERTY_KEYS: readonly (keyof DraftPayload['property'])[] = [
  'complexId',
  'areaTypeId',
  'jibunAddress',
  'buildingName',
  'dong',
  'ho',
  'emdCode',
  'buildingUse',
  'floor',
  'totalFloors',
  'exclusiveArea',
  'supplyArea',
  'landArea',
  'rooms',
  'baths',
  'direction',
  'directionBasis',
  'approvalDate',
  'parkingSpaces',
];

/**
 * `listingUpdateSchema` treats an omitted field as unchanged, so a value the broker deleted must
 * be sent as `null`. `version` (from the loaded listing) lets the server refuse a stale edit.
 */
export function toUpdatePayload(draft: DraftPayload, version?: number | null): UpdatePayload {
  const out: UpdatePayload = { ...draft, property: { ...draft.property } };
  const listing = out as Record<string, unknown>;
  for (const key of NULLABLE_LISTING_KEYS) if (listing[key] === undefined) listing[key] = null;
  const property = out.property as Record<string, unknown>;
  for (const key of NULLABLE_PROPERTY_KEYS) if (property[key] === undefined) property[key] = null;
  if (typeof version === 'number') out.version = version;
  return out;
}

/** The draft can be stored once the server-required property fields exist. */
export function canSaveDraft(p: DraftPayload): boolean {
  return (
    !!p.property.assetType &&
    !!p.property.roadAddress &&
    p.property.lat !== undefined &&
    p.property.lng !== undefined
  );
}

/** Price field that is missing for the deal type (the publish check reports one `price` item). */
function priceFieldOf(d?: Pick<DraftPayload, 'dealType' | 'deposit' | 'presalePrice'>): FormField {
  switch (d?.dealType) {
    case DealType.JEONSE:
      return 'deposit';
    case DealType.MONTHLY:
      return d.deposit === undefined ? 'deposit' : 'monthlyRent';
    case DealType.PRESALE:
      return (d.presalePrice ?? 0) > 0 ? 'premium' : 'presalePrice';
    default:
      return 'salePrice';
  }
}

/**
 * Server path ("property.exclusiveArea", "maintenanceFeeWon", publish fields such as "price" or
 * "property.area") → form field. The draft resolves the fields that depend on the deal / asset
 * type. Office fields ("agency.*") have no form field (null).
 */
export function formFieldOf(path: string, draft?: DraftPayload): FormField | null {
  if (path.startsWith('agency.')) return null;
  if (path.startsWith('maintenanceFee.')) {
    if (path === 'maintenanceFee.billingType') return 'feeBillingType';
    if (path === 'maintenanceFee.unavailableReason') return 'feeUnavailableReason';
    return 'feeItems';
  }
  const key = path.replace(/^property\./, '');
  switch (key) {
    case 'maintenanceFeeWon':
      return 'maintenanceFee';
    case 'lat':
    case 'lng':
    case 'location':
    case 'emdCode':
      return 'roadAddress';
    case 'price':
      return priceFieldOf(draft);
    case 'area':
      return isLand(draft?.property.assetType) ? 'landArea' : 'exclusiveArea';
    case 'moveIn':
      return draft?.moveInType === MoveInType.DATE ? 'moveInDate' : 'moveInType';
  }
  return key in FORM_DEFAULTS ? (key as FormField) : null;
}

/** Range / enum problems found by the shared draft schema, mapped back to form fields. */
export function schemaIssues(payload: DraftPayload): FieldIssue[] {
  if (!canSaveDraft(payload)) return [];
  const result = listingDraftSchema.safeParse(payload);
  if (result.success) return [];
  const out: FieldIssue[] = [];
  for (const issue of result.error.issues) {
    const field = formFieldOf(issue.path.map(String).join('.'));
    if (field && !out.some((o) => o.field === field)) {
      out.push({ field, message: '입력값의 범위를 확인해 주세요.' });
    }
  }
  return out;
}

// ---- listing → form --------------------------------------------------------------------------------

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const moneyStr = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : n.toLocaleString('ko-KR');

/** Stored 관리비 내역 → the form rows (every kind, in `FEE_KINDS` order). */
export function feeItemsOf(fee: MaintenanceFeeView | null | undefined): FeeItemValue[] {
  return FEE_KINDS.map((kind) => {
    const item = fee?.items.find((i) => i.kind === kind);
    return {
      kind,
      included: item?.included ?? false,
      amount:
        item?.amountWon === null || item?.amountWon === undefined
          ? ''
          : item.amountWon.toLocaleString('ko-KR'),
    };
  });
}

export function fromListing(l: AgencyListing): ListingFormValues {
  const p = l.property;
  const fee = l.maintenanceFeeWon;
  return {
    assetType: p.assetType,
    complexId: p.complexId ?? '',
    complexName: l.complex?.name ?? '',
    areaTypeId: p.areaTypeId ?? '',
    roadAddress: p.roadAddress,
    jibunAddress: p.jibunAddress ?? '',
    buildingName: p.buildingName ?? '',
    dong: p.dong ?? '',
    ho: p.ho ?? '',
    lat: p.lat,
    lng: p.lng,
    emdCode: p.emdCode ?? '',
    buildingUse: p.buildingUse ?? '',
    floor:
      p.floor === null || p.floor === undefined ? '' : p.floor < 0 ? `B${-p.floor}` : str(p.floor),
    totalFloors: str(p.totalFloors),
    floorDisplay: l.floorDisplay,
    dealType: l.dealType,
    salePrice: moneyStr(l.salePrice),
    deposit: moneyStr(l.deposit),
    monthlyRent: moneyStr(l.monthlyRent),
    presalePrice: moneyStr(l.presalePrice),
    premium: moneyStr(l.premium),
    maintenanceNone: fee === 0,
    maintenanceFee: fee ? String(Math.round(fee / 1000) / 10) : '',
    feeBillingType: l.maintenanceFee?.billingType ?? '',
    feeItems: feeItemsOf(l.maintenanceFee),
    feeUnavailableReason: l.maintenanceFee?.unavailableReason ?? '',
    moveInType: l.moveInType ?? '',
    moveInDate: l.moveInDate?.slice(0, 10) ?? '',
    exclusiveArea: str(p.exclusiveArea),
    supplyArea: str(p.supplyArea),
    landArea: str(p.landArea),
    rooms: str(p.rooms),
    baths: str(p.baths),
    direction: p.direction ?? '',
    directionBasis: p.directionBasis ?? '',
    approvalDate: p.approvalDate?.slice(0, 10) ?? '',
    parkingSpaces: str(p.parkingSpaces),
    title: l.title ?? '',
    description: l.description ?? '',
    options: l.options,
  };
}

const opt = <T>(v: T | null | undefined): T | undefined => v ?? undefined;

/** Stored listing → the draft payload shape (used by the publish checks on both sides). */
export function draftOfListing(l: AgencyListing): DraftPayload {
  const p = l.property;
  return {
    dealType: l.dealType,
    title: opt(l.title),
    description: opt(l.description),
    salePrice: opt(l.salePrice),
    deposit: opt(l.deposit),
    monthlyRent: opt(l.monthlyRent),
    presalePrice: opt(l.presalePrice),
    premium: opt(l.premium),
    maintenanceFeeWon: opt(l.maintenanceFeeWon),
    maintenanceFee: l.maintenanceFee
      ? {
          billingType: l.maintenanceFee.billingType,
          items: l.maintenanceFee.items.map((i) => ({
            kind: i.kind,
            included: i.included,
            ...(typeof i.amountWon === 'number' ? { amountWon: i.amountWon } : {}),
          })),
          ...(l.maintenanceFee.unavailableReason
            ? { unavailableReason: l.maintenanceFee.unavailableReason }
            : {}),
        }
      : undefined,
    moveInType: opt(l.moveInType),
    moveInDate: opt(l.moveInDate),
    floorDisplay: l.floorDisplay,
    options: l.options,
    property: {
      assetType: p.assetType,
      complexId: opt(p.complexId),
      areaTypeId: opt(p.areaTypeId),
      roadAddress: p.roadAddress,
      jibunAddress: opt(p.jibunAddress),
      buildingName: opt(p.buildingName),
      dong: opt(p.dong),
      ho: opt(p.ho),
      lat: p.lat,
      lng: p.lng,
      emdCode: opt(p.emdCode),
      buildingUse: opt(p.buildingUse),
      floor: opt(p.floor),
      totalFloors: opt(p.totalFloors),
      exclusiveArea: opt(p.exclusiveArea),
      supplyArea: opt(p.supplyArea),
      landArea: opt(p.landArea),
      rooms: opt(p.rooms),
      baths: opt(p.baths),
      direction: opt(p.direction),
      directionBasis: opt(p.directionBasis),
      approvalDate: opt(p.approvalDate),
      parkingSpaces: opt(p.parkingSpaces),
    },
  };
}
