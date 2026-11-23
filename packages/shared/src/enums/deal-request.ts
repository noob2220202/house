import type { EnumValue } from './define';

/** 내놓기 (owner) / 구하기 (seeker). */
export const DealRequestType = {
  SELL_OR_LEASE: 'SELL_OR_LEASE',
  WANTED: 'WANTED',
} as const;
export type DealRequestType = EnumValue<typeof DealRequestType>;

export const DEAL_REQUEST_TYPE_LABEL: Record<DealRequestType, string> = {
  SELL_OR_LEASE: '내놓기',
  WANTED: '구하기',
};

export const DealRequestStatus = {
  OPEN: 'OPEN',
  MATCHED: 'MATCHED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type DealRequestStatus = EnumValue<typeof DealRequestStatus>;

export const DealRequestVisibility = {
  ALL_AGENCIES_IN_REGION: 'ALL_AGENCIES_IN_REGION',
  SELECTED_AGENCIES: 'SELECTED_AGENCIES',
} as const;
export type DealRequestVisibility = EnumValue<typeof DealRequestVisibility>;

export const ProposalStatus = {
  SENT: 'SENT',
  VIEWED: 'VIEWED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type ProposalStatus = EnumValue<typeof ProposalStatus>;
