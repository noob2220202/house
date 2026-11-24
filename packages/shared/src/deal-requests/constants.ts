// Owned by the deal-requests module team.
import {
  DealRequestStatus,
  ProposalStatus,
  type DealRequestStatus as DealRequestStatusValue,
  type DealRequestVisibility as DealRequestVisibilityValue,
  type ProposalStatus as ProposalStatusValue,
} from '../enums/deal-request';

export const DEAL_REQUEST_LIMITS = {
  /** A request stays open this long, then the expiry job marks it EXPIRED. */
  TTL_DAYS: 30,
  /** How many times the requester may extend an OPEN request or reopen an EXPIRED one. */
  MAX_EXTENSIONS: 3,
  /**
   * Retention after a request ends (CLOSED / CANCELLED / EXPIRED): this many days after `closedAt`
   * the scrub job erases the contact name/phone, 동·호, road address, exact position, floor, area,
   * description and photos, and granted agencies stop seeing the contact and details (the same
   * period the DEAL_REQUEST_PRIVACY / DEAL_REQUEST_PROVIDE notices state).
   */
  CONTACT_RETENTION_DAYS: 30,
  /** OPEN + MATCHED requests one member may have at the same time (anti-spam). */
  MAX_ACTIVE_PER_USER: 10,
  MAX_TARGET_AGENCIES: 20,
  MAX_REGION_CODES: 20,
  MAX_COMPLEX_IDS: 20,
  MAX_PHOTOS: 10,
  MAX_PROPOSAL_LISTINGS: 10,
  CONTACT_NAME_MAX: 30,
  DESCRIPTION_MAX: 3000,
  PROPOSAL_MESSAGE_MAX: 2000,
  CLOSE_REASON_MAX: 500,
} as const;

/** Statuses in which a request is still "live" (agencies may act, contact may be shared). */
export const DEAL_REQUEST_ACTIVE_STATUSES: readonly DealRequestStatusValue[] = [
  DealRequestStatus.OPEN,
  DealRequestStatus.MATCHED,
];

/**
 * Statuses in which a granted agency may read the requester's contact and the full details — for an
 * ended (CLOSED) request only until CONTACT_RETENTION_DAYS after `closedAt`.
 */
export const DEAL_REQUEST_CONTACT_STATUSES: readonly DealRequestStatusValue[] = [
  DealRequestStatus.OPEN,
  DealRequestStatus.MATCHED,
  DealRequestStatus.CLOSED,
];

/** Proposals the requester has not answered yet (and the agency may still withdraw). */
export const PROPOSAL_PENDING_STATUSES: readonly ProposalStatusValue[] = [
  ProposalStatus.SENT,
  ProposalStatus.VIEWED,
];

export const DEAL_REQUEST_STATUS_LABEL: Record<DealRequestStatusValue, string> = {
  OPEN: '진행중',
  MATCHED: '연결됨',
  CLOSED: '완료',
  CANCELLED: '취소',
  EXPIRED: '기간만료',
};

export const DEAL_REQUEST_VISIBILITY_LABEL: Record<DealRequestVisibilityValue, string> = {
  ALL_AGENCIES_IN_REGION: '지역 내 모든 중개사무소',
  SELECTED_AGENCIES: '선택한 중개사무소',
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatusValue, string> = {
  SENT: '전송됨',
  VIEWED: '열람함',
  ACCEPTED: '수락',
  DECLINED: '거절',
  WITHDRAWN: '철회',
};

/** Inbox scopes for agencies. */
export const AgencyInboxScope = {
  /** Everything the agency can see. */
  ALL: 'ALL',
  /** Requests that selected this agency. */
  TARGETED: 'TARGETED',
  /** Requests this agency already proposed to. */
  PROPOSED: 'PROPOSED',
  /** OPEN requests without a proposal from this agency yet. */
  NEW: 'NEW',
} as const;
export type AgencyInboxScope = (typeof AgencyInboxScope)[keyof typeof AgencyInboxScope];
