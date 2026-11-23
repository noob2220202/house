// Owned by the deal-requests module team.
export const DealRequestsErrorCode = {
  DEAL_REQUEST_NOT_FOUND: 'DEAL_REQUEST_NOT_FOUND',
  DEAL_REQUEST_CLOSED: 'DEAL_REQUEST_CLOSED',
  DEAL_REQUEST_NOT_TARGETED: 'DEAL_REQUEST_NOT_TARGETED',
  PROPOSAL_DUPLICATE: 'PROPOSAL_DUPLICATE',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
} as const;

export const DEAL_REQUESTS_ERROR_MESSAGES: Record<keyof typeof DealRequestsErrorCode, string> = {
  DEAL_REQUEST_NOT_FOUND: '요청을 찾을 수 없습니다.',
  DEAL_REQUEST_CLOSED: '종료된 요청입니다.',
  DEAL_REQUEST_NOT_TARGETED: '이 요청에 제안할 수 있는 중개사무소가 아닙니다.',
  PROPOSAL_DUPLICATE: '이미 제안을 보냈습니다.',
  PROPOSAL_NOT_FOUND: '제안을 찾을 수 없습니다.',
};
