import { DEAL_TYPE_LABEL } from '@house/shared';
import type { IconName, StatusTone } from '@house/ui';
import { formatDealPrice } from '@/lib/format';
import type { Inquiry, InquiryChannel, InquiryStatus } from '../api/schemas';

export interface ChannelMeta {
  label: string;
  icon: IconName;
  /** What happened, for rows without a message. */
  action: string;
}

export const INQUIRY_CHANNEL_META: Record<InquiryChannel, ChannelMeta> = {
  MESSAGE: { label: '메시지', icon: 'chat', action: '문의 메시지를 남겼어요' },
  CALL: { label: '전화', icon: 'phone', action: '전화 걸기를 눌렀어요' },
  SMS: { label: '문자', icon: 'mail', action: '문자 보내기를 눌렀어요' },
  COPY: { label: '번호 복사', icon: 'copy', action: '사무소 전화번호를 복사했어요' },
};

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: '새 문의',
  IN_PROGRESS: '응대 중',
  DONE: '응대 완료',
};

export const INQUIRY_STATUS_TONE: Record<InquiryStatus, StatusTone> = {
  NEW: 'review',
  IN_PROGRESS: 'scheduled',
  DONE: 'ended',
};

/** "박*연 님" or "비회원 고객" when the visitor was not signed in. */
export function inquiryCustomer(i: Pick<Inquiry, 'customerName'>): string {
  return i.customerName ? `${i.customerName} 님` : '비회원 고객';
}

/** Row title: "박*연 님의 문의" / "비회원 고객 · 전화". */
export function inquiryTitle(i: Pick<Inquiry, 'customerName' | 'channel'>): string {
  return i.channel === 'MESSAGE'
    ? `${inquiryCustomer(i)}의 문의`
    : `${inquiryCustomer(i)} · ${INQUIRY_CHANNEL_META[i.channel].label}`;
}

/** One-line preview: the customer's message, or what they did. */
export function inquiryPreview(i: Pick<Inquiry, 'channel' | 'message' | 'listing'>): string {
  if (i.message) return i.message;
  const where = i.listing ? '매물 상세에서' : '사무소 페이지에서';
  return `${where} ${INQUIRY_CHANNEL_META[i.channel].action}`;
}

export function isInquiryUnread(i: Pick<Inquiry, 'readAt'>): boolean {
  return !i.readAt;
}

export const INQUIRY_MEMO_MAX = 1000;
export const INQUIRY_REPLY_MAX = 1000;

/** "신대 레이크파크 1단지 103동 · 매매 4억 4,500" or the office page. */
export function inquirySource(i: Pick<Inquiry, 'listing'>): string {
  if (!i.listing) return '사무소 페이지';
  const l = i.listing;
  const price = formatDealPrice({
    dealType: l.dealType,
    price: l.price,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
  return `${l.title} · ${DEAL_TYPE_LABEL[l.dealType]} ${price}`;
}
