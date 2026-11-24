import { AssetType, DealType, MoveInType } from '@house/shared';
import {
  FIELD_STEP,
  formFieldOf,
  isLand,
  isResidential,
  type DraftPayload,
  type FormField,
} from './form';

/**
 * 공인중개사법 제18조의2 + 「중개대상물의 표시·광고 명시사항 세부기준」 — the items a listing must carry
 * before it can be advertised. The same rules run in the wizard (inline, per step), in the checklist
 * and in the mock publish validator; the backend's publish validator is authoritative.
 */
export interface Requirement {
  /** Server field path, e.g. "property.exclusiveArea". */
  field: string;
  /** Form field that receives the focus / error. */
  formField: FormField;
  /** 명시사항 이름. */
  label: string;
  step: number;
  done: boolean;
  /** Inline error when missing. */
  message: string;
}

const has = (v: unknown) => v !== undefined && v !== null && v !== '';

/** 정액 관리비 that must be broken down into its items (원 / 월). */
export const FEE_ITEMS_THRESHOLD_WON = 100_000;

/**
 * 소규모 주택·오피스텔 (원룸·투룸, 오피스텔, 주택)은 월 10만원 이상 정액 관리비의 부과 항목(일반관리비,
 * 사용료 …)을 함께 표시해야 한다. 아파트(공동주택관리법 단지)는 월 평균 관리비 표시로 충분하다.
 */
export function needsFeeItems(asset: AssetType | undefined, feeWon: number | undefined): boolean {
  return (
    (asset === AssetType.ONEROOM || asset === AssetType.OFFICETEL || asset === AssetType.HOUSE) &&
    (feeWon ?? 0) >= FEE_ITEMS_THRESHOLD_WON
  );
}

/** Every 명시사항 that applies to this draft, with its completion state. */
export function publishRequirements(d: DraftPayload): Requirement[] {
  const p = d.property;
  const asset = p.assetType;
  const land = isLand(asset);
  const out: Requirement[] = [];
  const add = (field: string, label: string, done: boolean, message: string) => {
    const formField = formFieldOf(field) ?? 'assetType';
    out.push({ field, formField, label, step: FIELD_STEP[formField], done, message });
  };

  add('property.assetType', '중개대상물 종류', has(asset), '매물 종류를 선택해 주세요.');
  add(
    'property.roadAddress',
    '소재지',
    has(p.roadAddress) && has(p.lat) && has(p.lng),
    asset === AssetType.APT || asset === AssetType.OFFICETEL
      ? '단지를 검색해서 선택해 주세요.'
      : '주소를 검색해서 선택하고 지도에서 위치를 확인해 주세요.',
  );
  if (!land) {
    if (asset !== AssetType.HOUSE) {
      add('property.floor', '해당 층', has(p.floor), '해당 층을 입력해 주세요.');
    }
    add('property.totalFloors', '총 층수', has(p.totalFloors), '총 층수를 입력해 주세요.');
  }

  add('dealType', '거래 형태', has(d.dealType), '거래 형태를 선택해 주세요.');
  switch (d.dealType) {
    case DealType.SALE:
      add('salePrice', '가격 (매매가)', (d.salePrice ?? 0) > 0, '매매가를 입력해 주세요.');
      break;
    case DealType.JEONSE:
      add('deposit', '가격 (전세 보증금)', (d.deposit ?? 0) > 0, '전세 보증금을 입력해 주세요.');
      break;
    case DealType.MONTHLY:
      add(
        'deposit',
        '가격 (보증금)',
        has(d.deposit),
        '보증금을 입력해 주세요. 없으면 0을 입력해요.',
      );
      add('monthlyRent', '가격 (월세)', (d.monthlyRent ?? 0) > 0, '월세를 입력해 주세요.');
      break;
    case DealType.PRESALE:
      add('presalePrice', '가격 (분양가)', (d.presalePrice ?? 0) > 0, '분양가를 입력해 주세요.');
      add(
        'premium',
        '가격 (프리미엄)',
        has(d.premium),
        '프리미엄을 입력해 주세요. 없으면 0, 마이너스는 -로 입력해요.',
      );
      break;
  }
  if (!land) {
    add(
      'maintenanceFeeWon',
      '관리비',
      has(d.maintenanceFeeWon),
      '월 관리비를 입력하거나 ‘관리비 없음’을 선택해 주세요.',
    );
    if (needsFeeItems(asset, d.maintenanceFeeWon)) {
      add(
        'maintenanceFeeItems',
        '관리비 포함 항목',
        (d.maintenanceFeeItems?.length ?? 0) > 0,
        '월 10만원 이상 관리비는 포함된 항목을 함께 골라 주세요.',
      );
    }
    add(
      'moveInType',
      '입주가능일',
      has(d.moveInType) && (d.moveInType !== MoveInType.DATE || has(d.moveInDate)),
      d.moveInType === MoveInType.DATE
        ? '입주 가능한 날짜를 선택해 주세요.'
        : '입주가능일을 선택해 주세요.',
    );
  }

  if (land) {
    add('property.landArea', '면적 (대지면적)', has(p.landArea), '대지면적을 입력해 주세요.');
  } else {
    add(
      'property.exclusiveArea',
      '면적 (전용면적)',
      has(p.exclusiveArea),
      '전용면적을 입력해 주세요.',
    );
    if (isResidential(asset)) {
      add('property.rooms', '방 수', has(p.rooms), '방 수를 입력해 주세요.');
      add('property.baths', '욕실 수', has(p.baths), '욕실 수를 입력해 주세요.');
    }
    add('property.direction', '방향', has(p.direction), '방향을 선택해 주세요.');
    add(
      'property.directionBasis',
      '방향 기준',
      has(p.directionBasis),
      '방향을 어디 기준으로 봤는지 선택해 주세요.',
    );
    // 분양권(미준공)은 사용승인일이 없다 — 입주예정일을 입주가능일에 적는다.
    if (d.dealType !== DealType.PRESALE) {
      add(
        'property.approvalDate',
        '사용승인일',
        has(p.approvalDate),
        '사용승인일을 입력해 주세요.',
      );
    }
    add(
      'property.parkingSpaces',
      '주차대수',
      has(p.parkingSpaces),
      '총 주차대수를 입력해 주세요. 없으면 0을 입력해요.',
    );
  }
  return out;
}

export const missingRequirements = (d: DraftPayload): Requirement[] =>
  publishRequirements(d).filter((r) => !r.done);

/** { done, total } for the progress meter. */
export function requirementProgress(reqs: readonly Requirement[]): { done: number; total: number } {
  return { done: reqs.filter((r) => r.done).length, total: reqs.length };
}

/** One entry of `details` in a `LISTING_PUBLISH_REQUIREMENTS` (or validation) error. */
export interface ServerFieldDetail {
  field?: string;
  path?: string;
  label?: string;
  message?: string;
}

export interface MappedFieldError {
  formField: FormField;
  step: number;
  message: string;
}

/**
 * Maps the publish validator's `details: [{ field, label }]` (or validation `details[].path`) to
 * wizard fields. Unknown fields are returned in `unmapped` so they can still be shown as text.
 */
export function mapServerFieldErrors(details: readonly ServerFieldDetail[] | undefined): {
  errors: MappedFieldError[];
  unmapped: string[];
} {
  const errors: MappedFieldError[] = [];
  const unmapped: string[] = [];
  for (const d of details ?? []) {
    const path = d.field ?? d.path ?? '';
    const formField = path ? formFieldOf(path) : null;
    const message =
      d.message ??
      (d.label ? `${d.label} 항목을 입력해 주세요.` : '필수 표시사항을 입력해 주세요.');
    if (!formField) {
      unmapped.push(d.label ?? d.message ?? path);
      continue;
    }
    if (!errors.some((e) => e.formField === formField)) {
      errors.push({ formField, step: FIELD_STEP[formField], message });
    }
  }
  errors.sort((a, b) => a.step - b.step);
  return { errors, unmapped: unmapped.filter(Boolean) };
}
