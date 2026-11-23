// Owned by the listings module team.
export const ListingsErrorCode = {
  LISTING_NOT_FOUND: 'LISTING_NOT_FOUND',
  LISTING_PUBLISH_REQUIREMENTS: 'LISTING_PUBLISH_REQUIREMENTS',
  LISTING_INVALID_STATUS_TRANSITION: 'LISTING_INVALID_STATUS_TRANSITION',
  LISTING_NOT_AGENCY_MEMBER: 'LISTING_NOT_AGENCY_MEMBER',
  LISTING_PHOTO_LIMIT: 'LISTING_PHOTO_LIMIT',
} as const;

export const LISTINGS_ERROR_MESSAGES: Record<keyof typeof ListingsErrorCode, string> = {
  LISTING_NOT_FOUND: '매물을 찾을 수 없습니다.',
  LISTING_PUBLISH_REQUIREMENTS: '광고 게시에 필요한 필수 표시사항이 누락되었습니다.',
  LISTING_INVALID_STATUS_TRANSITION: '현재 상태에서는 변경할 수 없습니다.',
  LISTING_NOT_AGENCY_MEMBER: '해당 매물을 관리하는 중개사무소 소속이 아닙니다.',
  LISTING_PHOTO_LIMIT: '등록 가능한 사진 수를 초과했습니다.',
};
