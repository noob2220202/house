import type { EnumValue } from './define';

/** 실거래 거래유형 (국토교통부 매매 / 전월세 API). */
export const TradeDealType = {
  SALE: 'SALE',
  JEONSE: 'JEONSE',
  MONTHLY: 'MONTHLY',
} as const;
export type TradeDealType = EnumValue<typeof TradeDealType>;

export const TradeSyncKind = {
  APT_TRADE: 'APT_TRADE',
  APT_RENT: 'APT_RENT',
} as const;
export type TradeSyncKind = EnumValue<typeof TradeSyncKind>;

export const TradeSyncStatus = {
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
} as const;
export type TradeSyncStatus = EnumValue<typeof TradeSyncStatus>;

/** Who created a 단지 / 평형: an admin by hand, or the 실거래가 bootstrap. */
export const ComplexDataSource = {
  ADMIN: 'ADMIN',
  TRADE_BOOTSTRAP: 'TRADE_BOOTSTRAP',
} as const;
export type ComplexDataSource = EnumValue<typeof ComplexDataSource>;

export const COMPLEX_DATA_SOURCE_LABEL: Record<ComplexDataSource, string> = {
  ADMIN: '직접 등록',
  TRADE_BOOTSTRAP: '실거래가 자동 생성',
};
