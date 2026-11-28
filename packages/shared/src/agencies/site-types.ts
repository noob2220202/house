// Owned by the agencies module team. Response shapes of 사무소 홈페이지 and office subscriptions.
import type { AgencySiteStatus, AgencyStatus, SubscriptionProduct } from '../enums/agency';
import type { AgencySiteColor, SiteSlugProblem } from './site';
import type { AgencySubscriptionState } from './subscriptions';
import type { AgencyProfile } from './types';

export interface AgencySiteView {
  id: string;
  agencyId: string;
  status: AgencySiteStatus;
  /** Approved slug (ACTIVE / SUSPENDED); null before the first approval. */
  slug: string | null;
  /** Slug asked for (REQUESTED), or that of the last rejected request. */
  requestedSlug: string | null;
  color: AgencySiteColor;
  tagline: string | null;
  /** `https://<slug>.<root>` when ACTIVE (even before https is ready); else null. */
  url: string | null;
  /** True when httpsReadyAt is set, or PUBLIC_BASE_URL is not https (dev). */
  httpsReady: boolean;
  /** ACTIVE && agency APPROVED && httpsReady && the subscription gate passes. */
  live: boolean;
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Subscription gate of a product as the console shows it. */
export interface AgencySiteSubscriptionStatus {
  /** FEATURES flag (siteSubscriptionRequired) is on. */
  required: boolean;
  /** An ACTIVE subscription covers today (KST). */
  active: boolean;
  /** Last day of the current subscription; null when open-ended or none. */
  endsOn: string | null;
}

/** GET /agencies/mine/site */
export interface MyAgencySiteResponse {
  site: AgencySiteView | null;
  /** e.g. "suncheonmap.kr" (dev: "localhost"). */
  rootDomain: string;
  subscription: AgencySiteSubscriptionStatus;
}

/** GET /agencies/mine/site/availability */
export interface SiteSlugAvailability {
  /** Normalised slug that was checked. */
  slug: string;
  available: boolean;
  /** TAKEN = another site's approved slug or another office's open request. */
  reason: null | SiteSlugProblem | 'TAKEN';
}

/** GET /sites/:slug — a servable office site. */
export interface PublicAgencySite {
  slug: string;
  color: AgencySiteColor;
  tagline: string | null;
  url: string;
  /** Exactly what GET /agencies/:id returns. */
  agency: AgencyProfile;
}

/** Row of GET /admin/agency-sites */
export interface AdminAgencySiteListItem {
  site: AgencySiteView;
  agency: { id: string; name: string; representativeName: string; status: AgencyStatus };
}

/** GET /admin/agencies/:id/site */
export interface AdminAgencySiteResponse {
  site: AgencySiteView | null;
}

export interface AgencySubscriptionView {
  id: string;
  agencyId: string;
  product: SubscriptionProduct;
  /** "YYYY-MM-DD" */
  startsOn: string;
  /** "YYYY-MM-DD"; null = open-ended. */
  endsOn: string | null;
  /** 원 */
  amountWon: number | null;
  memo: string | null;
  canceledAt: string | null;
  /** Derived in KST days (`subscriptionState`). */
  state: AgencySubscriptionState;
  createdByName: string | null;
  createdAt: string;
}

/** GET /admin/agencies/:id/subscriptions */
export interface AgencySubscriptionsResponse {
  items: AgencySubscriptionView[];
  /** Whether an ACTIVE subscription covers today, per product. */
  current: Record<SubscriptionProduct, boolean>;
}
