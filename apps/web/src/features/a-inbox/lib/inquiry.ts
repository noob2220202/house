import {
  INQUIRY_LIMITS,
  INQUIRY_STATUS_LABEL,
  InquirySource,
  type InquiryChannel,
  type InquiryStatus,
} from '@house/shared';
import type { IconName } from '@house/ui';
import { formatPhone } from '@/lib/format';
import { inquiryListingText } from '@/features/w-inquiry/lib';
import type { AgencyInquiry } from '../api/schemas';

export { INQUIRY_STATUS_TONE } from '@/features/w-inquiry/lib';

/** 으로 after a final consonant other than ㄹ, 로 after a vowel or ㄹ (응대 중으로 · 응대 완료로). */
function roParticle(word: string): '으로' | '로' {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return '로';
  const final = (code - 0xac00) % 28;
  return final === 0 || final === 8 ? '로' : '으로';
}

/** Toast after a status change: "‘응대 중’으로 바꿨어요." */
export function statusChangedMessage(status: InquiryStatus): string {
  const label = INQUIRY_STATUS_LABEL[status];
  return `‘${label}’${roParticle(label)} 바꿨어요.`;
}

export interface ChannelMeta {
  label: string;
  icon: IconName;
  /** What happened, for rows without a message. */
  action: string;
}

export const INQUIRY_CHANNEL_META: Record<InquiryChannel, ChannelMeta> = {
  MESSAGE: { label: '문의글', icon: 'chat', action: '문의를 남겼어요' },
  CALL: { label: '전화', icon: 'phone', action: '전화 걸기를 눌렀어요' },
  SMS: { label: '문자', icon: 'mail', action: '문자 보내기를 눌렀어요' },
  COPY: { label: '번호 복사', icon: 'copy', action: '사무소 전화번호를 복사했어요' },
};

export const INQUIRY_MEMO_MAX = INQUIRY_LIMITS.MEMO_MAX;
export const INQUIRY_REPLY_MAX = INQUIRY_LIMITS.REPLY_MAX;
export const INQUIRY_DELETE_REASON_MAX = INQUIRY_LIMITS.DELETE_REASON_MAX;

/** "박서연 님", or "비회원 고객" for a contact event of a visitor who was not signed in. */
export function inquiryCustomer(i: Pick<AgencyInquiry, 'customerName'>): string {
  return i.customerName ? `${i.customerName} 님` : '비회원 고객';
}

/** Row title: "박서연 님의 문의" / "비회원 고객 · 전화". */
export function inquiryTitle(i: Pick<AgencyInquiry, 'customerName' | 'channel'>): string {
  return i.channel === 'MESSAGE'
    ? `${inquiryCustomer(i)}의 문의`
    : `${inquiryCustomer(i)} · ${INQUIRY_CHANNEL_META[i.channel].label}`;
}

/** Where the visitor was: a listing page, the office page, or the office's own 홈페이지. */
function placeOf(i: Pick<AgencyInquiry, 'listing' | 'source'>): string {
  if (i.source === InquirySource.SITE) return i.listing ? '홈페이지 매물에서' : '홈페이지에서';
  return i.listing ? '매물 상세에서' : '사무소 페이지에서';
}

/**
 * One-line preview: the latest text of the thread (a follow-up or our reply, else the customer's
 * first message), or what the visitor did.
 */
export function inquiryPreview(
  i: Pick<AgencyInquiry, 'channel' | 'message' | 'listing' | 'source'> &
    Partial<Pick<AgencyInquiry, 'messages'>>,
): string {
  const last = i.messages?.[i.messages.length - 1];
  if (last) return last.body;
  if (i.message) return i.message;
  return `${placeOf(i)} ${INQUIRY_CHANNEL_META[i.channel].action}`;
}

export function isInquiryUnread(i: Pick<AgencyInquiry, 'readAt'>): boolean {
  return !i.readAt;
}

/** "신대 레이크파크 1단지 103동 · 매매 4억 4,500", or the office page / 홈페이지. */
export function inquirySource(i: Pick<AgencyInquiry, 'listing' | 'source'>): string {
  if (i.listing) return inquiryListingText(i.listing);
  return i.source === InquirySource.SITE ? '사무소 홈페이지' : '사무소 페이지';
}

/** "010-4521-3387" for a written inquiry with a number, else null. */
export function inquiryPhone(i: Pick<AgencyInquiry, 'customerPhone'>): string | null {
  return i.customerPhone ? formatPhone(i.customerPhone) : null;
}

/** Number of answers the office sent in the thread. */
export function replyCount(i: Pick<AgencyInquiry, 'messages'>): number {
  return i.messages.filter((m) => m.author === 'AGENCY').length;
}
