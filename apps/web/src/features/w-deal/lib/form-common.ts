import { DealRequestVisibility, phoneSchema } from '@house/shared';
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

export function validateMoney(
  issues: FieldIssue[],
  path: string,
  input: string,
  opts: { required?: boolean; label: string },
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
