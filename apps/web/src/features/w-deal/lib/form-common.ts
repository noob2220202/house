import { DealRequestVisibility, phoneSchema, sqmToPyeong, type AssetType } from '@house/shared';
import { z } from 'zod';
import { parsePriceInput, pyeongToSqm, type AreaUnit } from '@/lib/format';
import { MAX_TARGET_AGENCIES } from './labels';

/** One validation problem: dot path of the form field + Korean message. */
export interface FieldIssue {
  path: string;
  message: string;
}

/** Photo already uploaded through the media API (kept in the draft so a reload keeps it). */
export interface UploadedPhoto {
  id: string;
  /** Thumbnail URL from the media DTO. */
  url: string;
  name: string;
}

/** Agency chosen in the picker (name cached for the summary/review). */
export interface PickedAgency {
  id: string;
  name: string;
  specialty?: string | null;
}

/** Fields shared by both wizards: contact, delivery scope and consents. */
export interface ContactScopeValues {
  contactName: string;
  contactPhone: string;
  visibility: DealRequestVisibility;
  targetAgencies: PickedAgency[];
  agreePrivacy: boolean;
  agreeProvide: boolean;
}

export const CONTACT_SCOPE_DEFAULTS: ContactScopeValues = {
  contactName: '',
  contactPhone: '',
  visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
  targetAgencies: [],
  agreePrivacy: false,
  agreeProvide: false,
};

export const CONTACT_SCOPE_FIELDS = [
  'contactName',
  'contactPhone',
  'visibility',
  'targetAgencies',
  'agreePrivacy',
  'agreeProvide',
] as const;

/** Money field (만원): '' → undefined, "4억 2,000" / "44,500" → number, unparsable → null. */
export function parseMoney(input: string): number | undefined | null {
  if (input.trim() === '') return undefined;
  return parsePriceInput(input);
}

/** Thousands separators while typing a 만원 amount: "44500" → "44,500" (other text is left alone). */
export function formatMoneyInput(input: string): string {
  const digits = input.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(digits)) return input;
  return Number(digits).toLocaleString('ko-KR');
}

/** Area text in the chosen unit → ㎡ (2 decimals). '' → undefined, invalid → null. */
export function parseAreaToSqm(input: string, unit: AreaUnit): number | undefined | null {
  const s = input.trim().replace(/,/g, '');
  if (s === '') return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === 'pyeong' ? pyeongToSqm(n) : Math.round(n * 100) / 100;
}

/**
 * Sane upper bounds of the request forms (만원). Far below the API's technical limit (1조) so a
 * typo like 월세 3억 is caught with a clear message instead of reaching the agencies.
 */
export const MONEY_LIMITS = {
  /** 매매가 · 분양권 매매가: 500억. */
  price: 5_000_000,
  /** 전세 · 월세 보증금: 100억. */
  deposit: 1_000_000,
  /** 월세: 1억 / 월. */
  rent: 10_000,
} as const;
export type MoneyKind = keyof typeof MONEY_LIMITS;

/** "500억" / "1억" / "9,000만" — the limit as the user reads it. */
export function moneyLimitText(manwon: number): string {
  if (manwon >= 10_000 && manwon % 10_000 === 0)
    return `${(manwon / 10_000).toLocaleString('ko-KR')}억`;
  return `${manwon.toLocaleString('ko-KR')}만`;
}

/** 전용면적 upper bound (㎡) per asset type — 아파트 600㎡ ≈ 181평, 토지 = the API limit. */
export const AREA_LIMIT_SQM: Record<AssetType, number> = {
  APT: 600,
  OFFICETEL: 600,
  ONEROOM: 300,
  HOUSE: 3_000,
  COMMERCIAL: 30_000,
  LAND: 1_000_000,
};

/** Issue text when an area exceeds `AREA_LIMIT_SQM` ("600㎡(181평) 이하로 입력해 주세요."). */
export function areaLimitMessage(assetType: AssetType): string {
  const max = AREA_LIMIT_SQM[assetType];
  return `면적이 너무 커요. ${max.toLocaleString('ko-KR')}㎡(${Math.floor(sqmToPyeong(max, 1)).toLocaleString('ko-KR')}평) 이하로 입력해 주세요.`;
}

export function validateMoney(
  issues: FieldIssue[],
  path: string,
  input: string,
  opts: { required?: boolean; label: string; kind?: MoneyKind },
): number | undefined {
  const value = parseMoney(input);
  if (value === undefined) {
    if (opts.required) issues.push({ path, message: `${opts.label} 입력해 주세요.` });
    return undefined;
  }
  if (value === null || value > 100_000_000) {
    issues.push({ path, message: '금액을 만원 단위 숫자로 입력해 주세요. (예: 44,500)' });
    return undefined;
  }
  const limit = opts.kind ? MONEY_LIMITS[opts.kind] : undefined;
  if (limit !== undefined && value > limit) {
    issues.push({
      path,
      message: `금액이 너무 커요. ${moneyLimitText(limit)}원 이하로 입력해 주세요. (만원 단위)`,
    });
    return undefined;
  }
  return value;
}

export function validateContactScope(v: ContactScopeValues, issues: FieldIssue[]): void {
  const name = v.contactName.trim();
  if (!name) issues.push({ path: 'contactName', message: '연락받을 분의 이름을 입력해 주세요.' });
  else if (name.length > 30)
    issues.push({ path: 'contactName', message: '이름은 30자 이내로 입력해 주세요.' });

  if (!v.contactPhone.trim())
    issues.push({ path: 'contactPhone', message: '휴대폰 번호를 입력해 주세요.' });
  else if (!phoneSchema.safeParse(v.contactPhone).success)
    issues.push({
      path: 'contactPhone',
      message: '휴대폰 번호 형식을 확인해 주세요. (예: 010-1234-5678)',
    });

  if (v.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
    if (v.targetAgencies.length === 0)
      issues.push({ path: 'targetAgencies', message: '요청을 받을 중개사무소를 선택해 주세요.' });
    else if (v.targetAgencies.length > MAX_TARGET_AGENCIES)
      issues.push({
        path: 'targetAgencies',
        message: `중개사무소는 최대 ${MAX_TARGET_AGENCIES}곳까지 선택할 수 있어요.`,
      });
  }
  if (!v.agreePrivacy)
    issues.push({ path: 'agreePrivacy', message: '개인정보 수집·이용에 동의해 주세요.' });
  if (!v.agreeProvide)
    issues.push({ path: 'agreeProvide', message: '중개사무소 정보 제공에 동의해 주세요.' });
}

/** Wraps a plain validator as a zod schema so react-hook-form's zodResolver can run it. */
export function formSchemaOf<T extends object>(validate: (values: T) => FieldIssue[]) {
  return z
    .custom<T>((v) => typeof v === 'object' && v !== null)
    .superRefine((values, ctx) => {
      for (const issue of validate(values)) {
        ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path.split('.') });
      }
    });
}

/** YYYY-MM-DD and not in the past (KST "today" is passed in). */
export function validateMoveInDate(
  issues: FieldIssue[],
  value: string,
  today: string,
  required: boolean,
): void {
  if (!value) {
    if (required)
      issues.push({
        path: 'moveInDate',
        message: '입주 가능일을 선택하거나 즉시 입주를 체크해 주세요.',
      });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
    issues.push({ path: 'moveInDate', message: '날짜 형식을 확인해 주세요.' });
  else if (value < today)
    issues.push({ path: 'moveInDate', message: '오늘 이후 날짜를 선택해 주세요.' });
}
