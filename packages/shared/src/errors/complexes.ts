// Owned by the complexes module team.
export const ComplexesErrorCode = {
  COMPLEX_NOT_FOUND: 'COMPLEX_NOT_FOUND',
  TRADE_SYNC_FAILED: 'TRADE_SYNC_FAILED',
} as const;

export const COMPLEXES_ERROR_MESSAGES: Record<keyof typeof ComplexesErrorCode, string> = {
  COMPLEX_NOT_FOUND: '단지를 찾을 수 없습니다.',
  TRADE_SYNC_FAILED: '실거래가 동기화에 실패했습니다.',
};
