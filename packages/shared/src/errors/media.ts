// Owned by the media module team.
export const MediaErrorCode = {
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_UNSUPPORTED_TYPE: 'MEDIA_UNSUPPORTED_TYPE',
  MEDIA_PROCESSING_FAILED: 'MEDIA_PROCESSING_FAILED',
} as const;

export const MEDIA_ERROR_MESSAGES: Record<keyof typeof MediaErrorCode, string> = {
  MEDIA_NOT_FOUND: '파일을 찾을 수 없습니다.',
  MEDIA_TOO_LARGE: '파일 크기가 너무 큽니다.',
  MEDIA_UNSUPPORTED_TYPE: '지원하지 않는 파일 형식입니다.',
  MEDIA_PROCESSING_FAILED: '파일 처리 중 오류가 발생했습니다.',
};
