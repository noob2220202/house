// Owned by the media module team.
export const MediaErrorCode = {
  MEDIA_NOT_FOUND: 'MEDIA_NOT_FOUND',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_UNSUPPORTED_TYPE: 'MEDIA_UNSUPPORTED_TYPE',
  MEDIA_PROCESSING_FAILED: 'MEDIA_PROCESSING_FAILED',
  MEDIA_FILE_REQUIRED: 'MEDIA_FILE_REQUIRED',
  MEDIA_UPLOAD_INVALID: 'MEDIA_UPLOAD_INVALID',
  MEDIA_PURPOSE_NOT_ALLOWED: 'MEDIA_PURPOSE_NOT_ALLOWED',
  MEDIA_DIMENSIONS_INVALID: 'MEDIA_DIMENSIONS_INVALID',
  MEDIA_HEIC_UNSUPPORTED: 'MEDIA_HEIC_UNSUPPORTED',
  MEDIA_QUOTA_EXCEEDED: 'MEDIA_QUOTA_EXCEEDED',
  MEDIA_TOO_MANY_PENDING: 'MEDIA_TOO_MANY_PENDING',
  MEDIA_IN_USE: 'MEDIA_IN_USE',
  MEDIA_NOT_READY: 'MEDIA_NOT_READY',
  MEDIA_INVALID: 'MEDIA_INVALID',
} as const;

export const MEDIA_ERROR_MESSAGES: Record<keyof typeof MediaErrorCode, string> = {
  MEDIA_NOT_FOUND: '파일을 찾을 수 없습니다.',
  MEDIA_TOO_LARGE: '파일 크기가 너무 큽니다.',
  MEDIA_UNSUPPORTED_TYPE: '지원하지 않는 파일 형식입니다.',
  MEDIA_PROCESSING_FAILED: '파일 처리 중 오류가 발생했습니다.',
  MEDIA_FILE_REQUIRED: '업로드할 파일을 선택해 주세요.',
  MEDIA_UPLOAD_INVALID: '업로드 요청 형식이 올바르지 않습니다. 파일은 한 번에 하나씩 올려 주세요.',
  MEDIA_PURPOSE_NOT_ALLOWED: '이 용도로 파일을 올릴 권한이 없습니다.',
  MEDIA_DIMENSIONS_INVALID: '이미지 해상도가 허용 범위를 벗어났습니다.',
  MEDIA_HEIC_UNSUPPORTED:
    'HEIC 사진을 변환할 수 없습니다. JPEG 또는 PNG로 저장해 다시 올려 주세요.',
  MEDIA_QUOTA_EXCEEDED:
    '업로드 가능한 저장 용량을 초과했습니다. 사용하지 않는 파일을 삭제해 주세요.',
  MEDIA_TOO_MANY_PENDING: '처리 중인 파일이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  MEDIA_IN_USE: '사용 중인 파일은 삭제할 수 없습니다. 먼저 연결된 곳에서 제거해 주세요.',
  MEDIA_NOT_READY: '파일이 아직 처리 중입니다.',
  MEDIA_INVALID: '사용할 수 없는 파일입니다.',
};
