import {
  DEAL_TYPE_LABEL,
  DealType,
  INQUIRY_LIMITS,
  type InquiryStatus,
  inquiryCreateSchema,
  normalizePhone,
  type InquiryCreateInput,
  type InquirySource,
} from '@house/shared';
import type { StatusTone } from '@house/ui';
import { BRAND } from '@/config/brand';
import { formatDealPrice } from '@/lib/format';
import type { InquiryListing, MyInquiry } from './schemas';

/** Values of the 문의 남기기 form, as typed. */
export interface InquiryFormValues {
  name: string;
  phone: string;
  message: string;
  agree: boolean;
  /** Honeypot: hidden from people, a bot fills it in (the server refuses the submission). */
  website: string;
}

export type InquiryFormField = 'name' | 'phone' | 'message' | 'agree';
export type InquiryFormErrors = Partial<Record<InquiryFormField, string>>;

export const EMPTY_INQUIRY_FORM: InquiryFormValues = {
  name: '',
  phone: '',
  message: '',
  agree: false,
  website: '',
};

/** One-tap starters that are appended to the message (the customer still edits the text). */
export const INQUIRY_STARTERS = [
  '집을 직접 보고 싶어요. 언제 방문할 수 있을까요?',
  '가격 조정이 가능한지 궁금해요.',
  '입주 가능한 날짜를 알려 주세요.',
] as const;

/** Adds a starter sentence on its own line (skips it when the text already contains it). */
export function appendStarter(message: string, starter: string): string {
  if (message.includes(starter)) return message;
  const base = message.trimEnd();
  return base ? `${base}\n${starter}` : starter;
}

export const PHONE_REQUIRED_MESSAGE = '답변을 받을 연락처를 입력해 주세요.';
export const AGREE_REQUIRED_MESSAGE = '개인정보 수집·이용 및 제공에 동의해 주세요.';

/**
 * Client-side check of the form with the shared `inquiryCreateSchema` messages, plus the two rules
 * the schema leaves to the server: a guest must leave a phone number (INQUIRY_PHONE_REQUIRED) and
 * the consent box must be ticked. Returns {} when the form can be sent.
 */
export function validateInquiryForm(
  values: InquiryFormValues,
  opts: { member: boolean },
): InquiryFormErrors {
  const errors: InquiryFormErrors = {};
  const phone = values.phone.trim();
  const parsed = inquiryCreateSchema
    .pick({ name: true, phone: true, message: true })
    .safeParse({ name: values.name, phone: phone || null, message: values.message });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === 'name' || key === 'phone' || key === 'message') && !errors[key]) {
        errors[key] = issue.message;
      }
    }
  }
  if (!phone && !opts.member) errors.phone = PHONE_REQUIRED_MESSAGE;
  if (!values.agree) errors.agree = AGREE_REQUIRED_MESSAGE;
  return errors;
}

/** First field with an error, in form order (focus target after a failed submit). */
export function firstErrorField(errors: InquiryFormErrors): InquiryFormField | null {
  return (['name', 'phone', 'message', 'agree'] as const).find((k) => errors[k]) ?? null;
}

export interface InquiryContext {
  agencyId: string;
  listingId?: string | null;
  source: InquirySource;
}

/** Body of POST /inquiries (`consents` = the versions of the documents the form showed). */
export function toInquiryBody(
  values: InquiryFormValues,
  ctx: InquiryContext,
  consents: InquiryCreateInput['consents'],
): InquiryCreateInput {
  const phone = normalizePhone(values.phone.trim());
  return {
    agencyId: ctx.agencyId,
    listingId: ctx.listingId ?? null,
    name: values.name.trim(),
    phone: phone || null,
    message: values.message.trim(),
    source: ctx.source,
    consents,
    // Only ever non-empty when a bot filled the hidden field; sent as is so the server refuses it.
    ...(values.website ? { website: values.website } : {}),
  };
}

/** "123/1,000" — characters typed in the message box. */
export function messageCounter(message: string): string {
  return `${message.trim().length.toLocaleString('ko-KR')}/${INQUIRY_LIMITS.MESSAGE_MAX.toLocaleString('ko-KR')}`;
}

/** Pre-filled text of the 문자 보내기 action. */
export function smsMessage(listing?: { no: string; label: string } | null): string {
  return listing
    ? `[${BRAND.name}] 매물번호 ${listing.no} (${listing.label}) 보고 문의드립니다.`
    : `[${BRAND.name}] 보고 문의드립니다.`;
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, '');
export const telHref = (phone: string) => `tel:${digits(phone)}`;
export const smsHref = (phone: string, body: string) =>
  `sms:${digits(phone)}?&body=${encodeURIComponent(body)}`;

/** Headline price of an inquiry's listing: "4억 4,500", "500/45". */
export function inquiryListingPrice(l: InquiryListing): string {
  return formatDealPrice({
    dealType: l.dealType,
    price: l.dealType === DealType.PRESALE ? (l.presalePrice ?? l.salePrice) : l.salePrice,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
}

/** "신대 레이크파크 1단지 103동 · 매매 4억 4,500" */
export function inquiryListingText(l: InquiryListing): string {
  return `${l.title} · ${DEAL_TYPE_LABEL[l.dealType]} ${inquiryListingPrice(l)}`;
}

/** Status pill tone: 새 문의 / 응대 중 / 응대 완료. */
export const INQUIRY_STATUS_TONE: Record<InquiryStatus, StatusTone> = {
  NEW: 'review',
  IN_PROGRESS: 'scheduled',
  DONE: 'ended',
};

/** Customer-facing status words ("새 문의" reads oddly from the customer's side). */
export const MY_INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: '답변 대기',
  IN_PROGRESS: '응대 중',
  DONE: '응대 완료',
};

/**
 * Whether the API still takes a follow-up in this thread: its own flag when it sends one, else
 * "not erased by retention" (a written inquiry always has a message until then). An office that
 * is no longer approved is only known from the 409 of a send; the thread view then closes the box.
 */
export function canFollowUp(i: Pick<MyInquiry, 'canFollowUp' | 'message'>): boolean {
  return i.canFollowUp ?? i.message.trim() !== '';
}

/** Shown instead of the follow-up box (and after a 409 INQUIRY_REPLY_NOT_ALLOWED). */
export const FOLLOW_UP_CLOSED_MESSAGE =
  '이 문의에는 더 이상 메시지를 남길 수 없어요. 중개사무소에 전화로 문의해 주세요.';
