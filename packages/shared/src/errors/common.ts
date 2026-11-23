export const CommonErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_FAILED: 'CSRF_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const COMMON_ERROR_MESSAGES: Record<keyof typeof CommonErrorCode, string> = {
  VALIDATION_FAILED: '입력값을 확인해 주세요.',
  BAD_REQUEST: '잘못된 요청입니다.',
  UNAUTHENTICATED: '로그인이 필요합니다.',
  FORBIDDEN: '권한이 없습니다.',
  CSRF_FAILED: '요청이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.',
  NOT_FOUND: '요청한 정보를 찾을 수 없습니다.',
  CONFLICT: '이미 처리되었거나 중복된 요청입니다.',
  PAYLOAD_TOO_LARGE: '요청 크기가 너무 큽니다.',
  UNSUPPORTED_MEDIA_TYPE: '지원하지 않는 형식입니다.',
  RATE_LIMITED: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  SERVICE_UNAVAILABLE: '일시적으로 서비스를 이용할 수 없습니다.',
  INTERNAL_ERROR: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
};
