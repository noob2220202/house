import {
  AssetType,
  DealType,
  MAINTENANCE_FEE_BREAKDOWN_THRESHOLD_WON,
  MaintenanceFeeBillingType,
  MoveInType,
  PUBLISH_FIELD_LABEL,
  checkPublishRequirements,
  type PublishCheckInput,
  type PublishField,
  type PublishIssue,
} from '@house/shared';
import { FIELD_STEP, formFieldOf, isComplexAsset, type DraftPayload, type FormField } from './form';

/**
 * 공인중개사법 제18조의2 + 「중개대상물의 표시·광고 명시사항 세부기준」 — the items a listing must carry
 * before it can be advertised. The rules are NOT re-implemented here: every check runs the shared
 * `checkPublishRequirements` (the same function the API's publish validator runs), and this module
 * only maps its result onto the wizard (field to focus, step, inline message) and the checklist.
 */
export interface Requirement {
  /** Publish field of the shared validator, e.g. "property.area". */
  field: PublishField;
  /** Form field that receives the focus / error. */
  formField: FormField;
  /** 명시사항 이름 (`PUBLISH_FIELD_LABEL`). */
  label: string;
  step: number;
  done: boolean;
  /** Inline error when missing. */
  message: string;
}

/** The office (명칭·소재지·연락처·등록번호·대표자) — comes from the agency profile, not the wizard. */
export type PublishAgency = PublishCheckInput['agency'];

const isAgencyField = (field: PublishField) => field.startsWith('agency.');

/** Draft payload → input of the shared validator. */
export function toPublishInput(d: DraftPayload, agency: PublishAgency = null): PublishCheckInput {
  return {
    dealType: d.dealType,
    salePrice: d.salePrice,
    deposit: d.deposit,
    monthlyRent: d.monthlyRent,
    presalePrice: d.presalePrice,
    premium: d.premium,
    maintenanceFeeWon: d.maintenanceFeeWon,
    maintenanceFee: d.maintenanceFee
      ? {
          billingType: d.maintenanceFee.billingType,
          items: d.maintenanceFee.items,
          unavailableReason: d.maintenanceFee.unavailableReason,
        }
      : null,
    moveInType: d.moveInType,
    moveInDate: d.moveInDate,
    floorDisplay: d.floorDisplay,
    property: { ...d.property, assetType: d.property.assetType },
    agency,
  };
}

/** 정액관리비 10만원 이상: every included item needs its amount and they must add up (세부기준). */
export function needsFeeAmounts(
  billingType: MaintenanceFeeBillingType | '' | undefined,
  feeWon: number | null | undefined,
): boolean {
  return (
    billingType === MaintenanceFeeBillingType.FIXED &&
    (feeWon ?? 0) >= MAINTENANCE_FEE_BREAKDOWN_THRESHOLD_WON
  );
}

function messageOf(field: PublishField, d: DraftPayload): string {
  const p = d.property;
  switch (field) {
    case 'property.roadAddress':
      return isComplexAsset(p.assetType)
        ? '단지를 검색해서 선택해 주세요.'
        : '주소를 검색해서 선택하고 지도에서 위치를 확인해 주세요.';
    case 'property.emdCode':
      return '법정동을 확인하지 못했어요. 주소나 단지를 다시 검색해서 선택해 주세요.';
    case 'property.area':
      if (p.assetType === AssetType.LAND) return '대지면적을 입력해 주세요.';
      return '전용면적을 입력해 주세요.';
    case 'price':
      switch (d.dealType) {
        case DealType.JEONSE:
          return '전세 보증금을 입력해 주세요.';
        case DealType.MONTHLY:
          return d.deposit === undefined
            ? '보증금을 입력해 주세요. 없으면 0을 입력해요.'
            : '월세를 입력해 주세요.';
        case DealType.PRESALE:
          return (d.presalePrice ?? 0) > 0
            ? '프리미엄을 입력해 주세요. 없으면 0, 마이너스는 -로 입력해요.'
            : '분양가를 입력해 주세요.';
        default:
          return '매매가를 입력해 주세요.';
      }
    case 'property.assetType':
      return '매물 종류를 선택해 주세요.';
    case 'property.buildingUse':
      return '건축물대장에 적힌 용도를 선택해 주세요.';
    case 'dealType':
      return '거래 형태를 선택해 주세요.';
    case 'property.totalFloors':
      return '총 층수를 입력해 주세요.';
    case 'property.floor':
      return '해당 층을 입력해 주세요. 총 층수보다 높을 수 없어요.';
    case 'property.approvalDate':
      return '사용승인일을 입력해 주세요.';
    case 'property.direction':
      return '방향을 선택해 주세요.';
    case 'property.directionBasis':
      return '방향을 어디 기준으로 봤는지 선택해 주세요.';
    case 'property.rooms':
      return '방 수를 입력해 주세요. 없으면 0을 입력해요.';
    case 'property.baths':
      return '욕실 수를 입력해 주세요. 없으면 0을 입력해요.';
    case 'moveIn':
      return d.moveInType === MoveInType.DATE
        ? '입주 가능한 날짜를 선택해 주세요.'
        : '입주가능일을 선택해 주세요.';
    case 'property.parkingSpaces':
      return '총 주차대수를 입력해 주세요. 없으면 0을 입력해요.';
    case 'maintenanceFeeWon':
      return '월 관리비를 입력하거나 ‘관리비 없음’을 선택해 주세요.';
    case 'maintenanceFee.billingType':
      return '관리비 부과방식을 선택해 주세요. 확인할 수 없으면 사유를 적어 주세요.';
    case 'maintenanceFee.breakdown':
      return needsFeeAmounts(d.maintenanceFee?.billingType, d.maintenanceFeeWon)
        ? '월 10만원 이상 정액관리비는 포함 항목별 금액을 적고, 합계를 관리비와 맞춰 주세요.'
        : '관리비에 포함된 항목을 골라 주세요.';
    default:
      return `${PUBLISH_FIELD_LABEL[field]} 항목을 입력해 주세요.`;
  }
}

function toRequirement(field: PublishField, d: DraftPayload, done: boolean): Requirement {
  const formField = formFieldOf(field, d) ?? 'assetType';
  return {
    field,
    formField,
    label: PUBLISH_FIELD_LABEL[field],
    step: FIELD_STEP[formField],
    done,
    message: messageOf(field, d),
  };
}

/**
 * Every 명시사항 the wizard collects for this draft, with its completion state (office fields are
 * left out — see `agencyIssues`). Which items apply is also asked from the shared validator: an
 * empty draft of the same asset / deal type reports exactly the applicable fields; the 관리비 내역
 * items join once a 관리비 is entered. The draft's own missing items are always included.
 */
export function publishRequirements(d: DraftPayload): Requirement[] {
  const skeleton: PublishCheckInput = {
    dealType: d.dealType,
    floorDisplay: d.floorDisplay,
    // Only the type: a filled value (e.g. 건축물 용도) must not drop its item from the list.
    property: { assetType: d.property.assetType },
    agency: null,
  };
  // The items every listing has (종류·거래형태 included, even once chosen) + the type's own items.
  const base = checkPublishRequirements({
    dealType: null,
    property: { assetType: null },
    agency: null,
  });
  const applicable = [
    ...new Set([...base, ...checkPublishRequirements(skeleton)].map((i) => i.field)),
  ];
  if ((d.maintenanceFeeWon ?? 0) > 0) {
    const at = applicable.indexOf('maintenanceFeeWon');
    applicable.splice(
      at < 0 ? applicable.length : at + 1,
      0,
      'maintenanceFee.billingType',
      'maintenanceFee.breakdown',
    );
  }
  const missing = new Set(checkPublishRequirements(toPublishInput(d)).map((i) => i.field));
  const fields = [...applicable, ...[...missing].filter((f) => !applicable.includes(f))].filter(
    (f) => !isAgencyField(f),
  );
  return fields.map((f) => toRequirement(f, d, !missing.has(f)));
}

export const missingRequirements = (d: DraftPayload): Requirement[] =>
  publishRequirements(d).filter((r) => !r.done);

/** Office disclosure items (사무소 프로필) the publish validator would still reject. */
export function agencyIssues(d: DraftPayload, agency: PublishAgency): PublishIssue[] {
  return checkPublishRequirements(toPublishInput(d, agency)).filter((i) => isAgencyField(i.field));
}

/** Every issue the API's publish validator reports for this draft and office. */
export function publishIssues(d: DraftPayload, agency: PublishAgency): PublishIssue[] {
  return checkPublishRequirements(toPublishInput(d, agency));
}

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
 * wizard fields. Unknown fields (and the office fields) are returned in `unmapped` so they can
 * still be shown as text. `draft` resolves fields such as `price` / `property.area`.
 */
export function mapServerFieldErrors(
  details: readonly ServerFieldDetail[] | undefined,
  draft?: DraftPayload,
): {
  errors: MappedFieldError[];
  unmapped: string[];
} {
  const errors: MappedFieldError[] = [];
  const unmapped: string[] = [];
  for (const d of details ?? []) {
    const path = d.field ?? d.path ?? '';
    const formField = path ? formFieldOf(path, draft) : null;
    const known = draft && path in PUBLISH_FIELD_LABEL;
    const message =
      d.message ??
      (known
        ? messageOf(path as PublishField, draft)
        : d.label
          ? `${d.label} 항목을 입력해 주세요.`
          : '필수 표시사항을 입력해 주세요.');
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
