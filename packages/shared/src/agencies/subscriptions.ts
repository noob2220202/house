// Owned by the agencies module team. Office subscriptions (사무소 홈페이지 / 메인 사이트 입점): both are
// free for now — admins record paid periods (offline bank transfer) and the enforcement switches
// below (site setting FEATURES) default to off.
import { kstDate } from '../ads/stats';
import type { SubscriptionProduct } from '../enums/agency';

/**
 * FEATURES flag that turns on enforcement of each product. SITE: a site is live only with an
 * ACTIVE SITE subscription. PLATFORM: stored and shown, not enforced yet (future work).
 */
export const SUBSCRIPTION_REQUIRED_FEATURE = {
  SITE: 'siteSubscriptionRequired',
  PLATFORM: 'platformSubscriptionRequired',
} as const satisfies Record<SubscriptionProduct, string>;

/** Derived state of a subscription period, in KST calendar days. */
export const AgencySubscriptionState = {
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELED: 'CANCELED',
} as const;
export type AgencySubscriptionState =
  (typeof AgencySubscriptionState)[keyof typeof AgencySubscriptionState];

export const AGENCY_SUBSCRIPTION_STATE_LABEL: Record<AgencySubscriptionState, string> = {
  SCHEDULED: '시작 전',
  ACTIVE: '이용 중',
  ENDED: '종료',
  CANCELED: '취소',
};

export interface SubscriptionPeriod {
  /** "YYYY-MM-DD" (KST day, inclusive). */
  startsOn: string;
  /** "YYYY-MM-DD" (KST day, inclusive); null = open-ended. */
  endsOn: string | null;
  canceledAt: string | Date | null;
}

/**
 * State of a period on `today` ("YYYY-MM-DD", default: today in KST). Canceled wins; otherwise
 * ACTIVE when startsOn ≤ today ≤ endsOn (or no end).
 */
export function subscriptionState(
  period: SubscriptionPeriod,
  today: string = kstDate(),
): AgencySubscriptionState {
  if (period.canceledAt) return AgencySubscriptionState.CANCELED;
  if (today < period.startsOn) return AgencySubscriptionState.SCHEDULED;
  if (period.endsOn !== null && today > period.endsOn) return AgencySubscriptionState.ENDED;
  return AgencySubscriptionState.ACTIVE;
}
