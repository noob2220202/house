// Owned by the admin module team.
export const AdminErrorCode = {
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  REPORT_ALREADY_HANDLED: 'REPORT_ALREADY_HANDLED',
  NOTICE_NOT_FOUND: 'NOTICE_NOT_FOUND',
  FAQ_NOT_FOUND: 'FAQ_NOT_FOUND',
  VIDEO_NOT_FOUND: 'VIDEO_NOT_FOUND',
  TERMS_NOT_FOUND: 'TERMS_NOT_FOUND',
  SETTING_INVALID: 'SETTING_INVALID',
} as const;

export const ADMIN_ERROR_MESSAGES: Record<keyof typeof AdminErrorCode, string> = {
  REPORT_NOT_FOUND: '신고를 찾을 수 없습니다.',
  REPORT_ALREADY_HANDLED: '이미 처리된 신고입니다.',
  NOTICE_NOT_FOUND: '공지사항을 찾을 수 없습니다.',
  FAQ_NOT_FOUND: 'FAQ를 찾을 수 없습니다.',
  VIDEO_NOT_FOUND: '영상을 찾을 수 없습니다.',
  TERMS_NOT_FOUND: '약관을 찾을 수 없습니다.',
  SETTING_INVALID: '설정값이 올바르지 않습니다.',
};
