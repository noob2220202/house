// Owned by the inquiries module team. Statuses: *_NOT_FOUND 404 by convention; REPLY_NOT_ALLOWED
// is thrown with 409 and DAILY_LIMIT with 429 (explicit status at the throw site).
export const InquiriesErrorCode = {
  INQUIRY_NOT_FOUND: 'INQUIRY_NOT_FOUND',
  INQUIRY_AGENCY_NOT_FOUND: 'INQUIRY_AGENCY_NOT_FOUND',
  INQUIRY_LISTING_NOT_FOUND: 'INQUIRY_LISTING_NOT_FOUND',
  INQUIRY_PHONE_REQUIRED: 'INQUIRY_PHONE_REQUIRED',
  INQUIRY_REPLY_NOT_ALLOWED: 'INQUIRY_REPLY_NOT_ALLOWED',
  /** Honeypot field filled in (bot). Deliberately bland. */
  INQUIRY_REJECTED: 'INQUIRY_REJECTED',
  INQUIRY_DAILY_LIMIT: 'INQUIRY_DAILY_LIMIT',
} as const;

export const INQUIRIES_ERROR_MESSAGES: Record<keyof typeof InquiriesErrorCode, string> = {
  INQUIRY_NOT_FOUND: '문의를 찾을 수 없습니다.',
  INQUIRY_AGENCY_NOT_FOUND: '문의를 받을 수 있는 중개사무소를 찾을 수 없습니다.',
  INQUIRY_LISTING_NOT_FOUND: '문의할 매물을 찾을 수 없습니다. 이미 거래가 끝났을 수 있어요.',
  INQUIRY_PHONE_REQUIRED: '답변을 받을 연락처를 입력해 주세요.',
  INQUIRY_REPLY_NOT_ALLOWED:
    '이 문의에는 답변을 남길 수 없습니다. 남겨 주신 연락처로 직접 연락해 주세요.',
  INQUIRY_REJECTED: '문의를 보낼 수 없습니다. 잠시 후 다시 시도해 주세요.',
  INQUIRY_DAILY_LIMIT: '오늘 보낼 수 있는 문의 수를 모두 사용했습니다. 내일 다시 시도해 주세요.',
};
