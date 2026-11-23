// Owned by the ads module team.
export const AdsErrorCode = {
  BANNER_NOT_FOUND: 'BANNER_NOT_FOUND',
  BANNER_SLOT_FULL: 'BANNER_SLOT_FULL',
  BANNER_INVALID_LINK: 'BANNER_INVALID_LINK',
  BANNER_MEDIA_INVALID: 'BANNER_MEDIA_INVALID',
  BANNER_TARGET_INVALID: 'BANNER_TARGET_INVALID',
  BANNER_AGENCY_INVALID: 'BANNER_AGENCY_INVALID',
  BANNER_REORDER_INVALID: 'BANNER_REORDER_INVALID',
  BANNER_STATS_RANGE_INVALID: 'BANNER_STATS_RANGE_INVALID',
  POPUP_NOT_FOUND: 'POPUP_NOT_FOUND',
  POPUP_MEDIA_INVALID: 'POPUP_MEDIA_INVALID',
  POPUP_REORDER_INVALID: 'POPUP_REORDER_INVALID',
} as const;

export const ADS_ERROR_MESSAGES: Record<keyof typeof AdsErrorCode, string> = {
  BANNER_NOT_FOUND: '배너를 찾을 수 없습니다.',
  BANNER_SLOT_FULL: '해당 영역에 게시 가능한 배너 수를 초과했습니다.',
  BANNER_INVALID_LINK: '허용되지 않는 링크 주소입니다.',
  BANNER_MEDIA_INVALID:
    '배너 이미지가 올바르지 않습니다. 배너용으로 업로드된 이미지를 선택해 주세요.',
  BANNER_TARGET_INVALID: '타게팅 대상(지역 또는 단지)이 올바르지 않습니다.',
  BANNER_AGENCY_INVALID: '승인된 광고주 중개사무소를 찾을 수 없습니다.',
  BANNER_REORDER_INVALID: '정렬할 배너 목록이 올바르지 않습니다.',
  BANNER_STATS_RANGE_INVALID: '통계 조회 기간이 올바르지 않습니다.',
  POPUP_NOT_FOUND: '팝업을 찾을 수 없습니다.',
  POPUP_MEDIA_INVALID:
    '팝업 이미지가 올바르지 않습니다. 팝업용으로 업로드된 이미지를 선택해 주세요.',
  POPUP_REORDER_INVALID: '정렬할 팝업 목록이 올바르지 않습니다.',
};
