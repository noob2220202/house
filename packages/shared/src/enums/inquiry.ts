import type { EnumValue } from './define';

/**
 * How a customer reached an office: a written inquiry (MESSAGE) or a logged contact event
 * (CALL / SMS / COPY of the number — no message, no PII).
 */
export const InquiryChannel = {
  MESSAGE: 'MESSAGE',
  CALL: 'CALL',
  SMS: 'SMS',
  COPY: 'COPY',
} as const;
export type InquiryChannel = EnumValue<typeof InquiryChannel>;

export const INQUIRY_CHANNEL_LABEL: Record<InquiryChannel, string> = {
  MESSAGE: '문의글',
  CALL: '전화',
  SMS: '문자',
  COPY: '번호 복사',
};

/** Contact-event channels (POST /inquiries/contact-events). */
export const INQUIRY_CONTACT_CHANNELS = [
  InquiryChannel.CALL,
  InquiryChannel.SMS,
  InquiryChannel.COPY,
] as const satisfies readonly InquiryChannel[];
export type InquiryContactChannel = (typeof INQUIRY_CONTACT_CHANNELS)[number];

export const InquiryStatus = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
} as const;
export type InquiryStatus = EnumValue<typeof InquiryStatus>;

export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  NEW: '새 문의',
  IN_PROGRESS: '응대 중',
  DONE: '응대 완료',
};

/** Where the inquiry was sent from: the main site or the office's own 홈페이지. */
export const InquirySource = {
  MAIN: 'MAIN',
  SITE: 'SITE',
} as const;
export type InquirySource = EnumValue<typeof InquirySource>;

export const INQUIRY_SOURCE_LABEL: Record<InquirySource, string> = {
  MAIN: '순천부동산지도',
  SITE: '사무소 홈페이지',
};

/** Author of a message in an inquiry thread. */
export const InquiryAuthor = {
  CUSTOMER: 'CUSTOMER',
  AGENCY: 'AGENCY',
} as const;
export type InquiryAuthor = EnumValue<typeof InquiryAuthor>;

export const INQUIRY_AUTHOR_LABEL: Record<InquiryAuthor, string> = {
  CUSTOMER: '고객',
  AGENCY: '중개사무소',
};
