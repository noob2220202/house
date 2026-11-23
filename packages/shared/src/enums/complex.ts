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
