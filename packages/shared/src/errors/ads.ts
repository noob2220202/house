// Owned by the ads module team.
export const AdsErrorCode = {
  BANNER_NOT_FOUND: 'BANNER_NOT_FOUND',
  BANNER_SLOT_FULL: 'BANNER_SLOT_FULL',
  BANNER_INVALID_LINK: 'BANNER_INVALID_LINK',
  POPUP_NOT_FOUND: 'POPUP_NOT_FOUND',
} as const;

export const ADS_ERROR_MESSAGES: Record<keyof typeof AdsErrorCode, string> = {
  BANNER_NOT_FOUND: '배너를 찾을 수 없습니다.',
  BANNER_SLOT_FULL: '해당 영역에 게시 가능한 배너 수를 초과했습니다.',
  BANNER_INVALID_LINK: '허용되지 않는 링크 주소입니다.',
  POPUP_NOT_FOUND: '팝업을 찾을 수 없습니다.',
};
