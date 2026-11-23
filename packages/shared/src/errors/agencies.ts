// Owned by the agencies module team.
export const AgenciesErrorCode = {
  AGENCY_NOT_FOUND: 'AGENCY_NOT_FOUND',
  AGENCY_NOT_APPROVED: 'AGENCY_NOT_APPROVED',
  AGENCY_REGISTRATION_DUPLICATE: 'AGENCY_REGISTRATION_DUPLICATE',
  AGENCY_MEMBER_NOT_FOUND: 'AGENCY_MEMBER_NOT_FOUND',
  AGENCY_INVALID_STATUS_TRANSITION: 'AGENCY_INVALID_STATUS_TRANSITION',
} as const;

export const AGENCIES_ERROR_MESSAGES: Record<keyof typeof AgenciesErrorCode, string> = {
  AGENCY_NOT_FOUND: '중개사무소를 찾을 수 없습니다.',
  AGENCY_NOT_APPROVED: '승인된 중개사무소만 이용할 수 있습니다.',
  AGENCY_REGISTRATION_DUPLICATE: '이미 등록된 중개사무소 등록번호입니다.',
  AGENCY_MEMBER_NOT_FOUND: '소속 중개사를 찾을 수 없습니다.',
  AGENCY_INVALID_STATUS_TRANSITION: '현재 상태에서는 변경할 수 없습니다.',
};
