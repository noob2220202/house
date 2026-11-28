// Pure rules of 사무소 홈페이지 and office subscriptions (no DB, no config): status transitions,
// the live / servable predicates, and the row → view mappers. Unit-tested in sites.spec.ts.
import {
  AgencySiteDecisionAction,
  AgencySiteStatus,
  AgencyStatus,
  AGENCY_SITE_COLORS,
  DEFAULT_AGENCY_SITE_COLOR,
  siteSlugProblem,
  subscriptionState,
  type SiteSlugProblem,
  type SubscriptionProduct,
  type AgencySiteColor,
  type AgencySiteSubscriptionStatus,
  type AgencySiteView,
  type AgencySubscriptionView,
} from '@house/shared';

/** "YYYY-MM-DD" of a `@db.Date` value (Prisma returns it as UTC midnight). */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A "YYYY-MM-DD" KST day as the Date Prisma writes to a `@db.Date` column. */
export function toDbDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Target status of an admin decision, or null when the current status does not allow it. */
export function siteDecisionTarget(
  from: AgencySiteStatus,
  action: AgencySiteDecisionAction,
): AgencySiteStatus | null {
  switch (action) {
    case AgencySiteDecisionAction.APPROVE:
      return from === AgencySiteStatus.REQUESTED ? AgencySiteStatus.ACTIVE : null;
    case AgencySiteDecisionAction.REJECT:
      return from === AgencySiteStatus.REQUESTED ? AgencySiteStatus.REJECTED : null;
    case AgencySiteDecisionAction.SUSPEND:
      return from === AgencySiteStatus.ACTIVE ? AgencySiteStatus.SUSPENDED : null;
    case AgencySiteDecisionAction.RESUME:
      return from === AgencySiteStatus.SUSPENDED ? AgencySiteStatus.ACTIVE : null;
    default:
      return null;
  }
}

/**
 * First DNS label of the admin host (`manage` of https://manage.suncheonmap.kr): an office slug
 * equal to it is never servable (deploy/sites.sh refuses `<slug>.<root>` = the admin host as
 * ADMIN_HOST, and nginx's exact admin server would catch the host anyway), so the API treats it
 * as reserved. null for an IP literal (no labels); a single-label host such as `localhost` is
 * its own label.
 */
export function adminHostLabel(adminBaseUrl: string): string | null {
  let host: string;
  try {
    host = new URL(adminBaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.startsWith('[') || /^[\d.]+$/.test(host)) return null;
  return host.split('.')[0] || null;
}

/** `siteSlugProblem` plus the admin host's label (RESERVED). */
export function siteSlugProblemFor(
  slug: string,
  adminLabel: string | null,
): SiteSlugProblem | null {
  return siteSlugProblem(slug) ?? (adminLabel !== null && slug === adminLabel ? 'RESERVED' : null);
}

/** The owner may (re-)request a slug: no site yet, a pending request, or a rejected one. */
export function canRequestSite(status: AgencySiteStatus | null | undefined): boolean {
  return !status || status === AgencySiteStatus.REQUESTED || status === AgencySiteStatus.REJECTED;
}

/** Fields of an agency_sites row the views need. */
export interface SiteRow {
  id: string;
  agencyId: string;
  status: AgencySiteStatus;
  slug: string | null;
  requestedSlug: string | null;
  color: string;
  tagline: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  decisionReason: string | null;
  httpsReadyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What decides whether a site is served / linked, besides the site row itself. */
export interface SiteContext {
  /** `slug → https://<slug>.<root>[:port]` */
  urlFor: (slug: string) => string;
  /** PUBLIC_BASE_URL is not https (dev): every site counts as https-ready. */
  httpsAlways: boolean;
  /** The agency is APPROVED and not deleted. */
  agencyLive: boolean;
  /** FEATURES.siteSubscriptionRequired is off, or an ACTIVE SITE subscription covers today. */
  subscriptionOk: boolean;
}

/**
 * GET /sites/:slug may serve it: ACTIVE with an approved slug, live agency, subscription gate.
 * https readiness is not required here (the office host only resolves once it is).
 */
export function isSiteServable(
  site: Pick<SiteRow, 'status' | 'slug'>,
  ctx: Pick<SiteContext, 'agencyLive' | 'subscriptionOk'>,
): boolean {
  return (
    site.status === AgencySiteStatus.ACTIVE && !!site.slug && ctx.agencyLive && ctx.subscriptionOk
  );
}

export function isHttpsReady(site: Pick<SiteRow, 'httpsReadyAt'>, httpsAlways: boolean): boolean {
  return httpsAlways || site.httpsReadyAt !== null;
}

/** Linked from the main site and the console as live: servable and https-ready. */
export function isSiteLive(
  site: Pick<SiteRow, 'status' | 'slug' | 'httpsReadyAt'>,
  ctx: Pick<SiteContext, 'agencyLive' | 'subscriptionOk' | 'httpsAlways'>,
): boolean {
  return isSiteServable(site, ctx) && isHttpsReady(site, ctx.httpsAlways);
}

/** A stored colour that left the palette is shown (and served) as the default. */
export function siteColor(color: string): AgencySiteColor {
  return Object.hasOwn(AGENCY_SITE_COLORS, color)
    ? (color as AgencySiteColor)
    : DEFAULT_AGENCY_SITE_COLOR;
}

export function toSiteView(row: SiteRow, ctx: SiteContext): AgencySiteView {
  const active = row.status === AgencySiteStatus.ACTIVE && row.slug !== null;
  return {
    id: row.id,
    agencyId: row.agencyId,
    status: row.status,
    slug: row.slug,
    requestedSlug: row.requestedSlug,
    color: siteColor(row.color),
    tagline: row.tagline,
    url: active && row.slug ? ctx.urlFor(row.slug) : null,
    httpsReady: isHttpsReady(row, ctx.httpsAlways),
    live: isSiteLive(row, ctx),
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decisionReason: row.decisionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Fields of an agency_subscriptions row the views need. */
export interface SubscriptionRow {
  id: string;
  agencyId: string;
  product: SubscriptionProduct;
  startsOn: Date;
  endsOn: Date | null;
  amountWon: number | null;
  memo: string | null;
  canceledAt: Date | null;
  createdAt: Date;
  createdBy: { name: string } | null;
}

export function toSubscriptionView(row: SubscriptionRow, today: string): AgencySubscriptionView {
  const startsOn = dateOnly(row.startsOn);
  const endsOn = row.endsOn ? dateOnly(row.endsOn) : null;
  return {
    id: row.id,
    agencyId: row.agencyId,
    product: row.product,
    startsOn,
    endsOn,
    amountWon: row.amountWon,
    memo: row.memo,
    canceledAt: row.canceledAt?.toISOString() ?? null,
    state: subscriptionState({ startsOn, endsOn, canceledAt: row.canceledAt }, today),
    createdByName: row.createdBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The console's subscription line of a product from the periods covering today (already filtered
 * to ACTIVE ones): `endsOn` is the latest last day, null when one of them is open-ended.
 */
export function subscriptionStatus(
  required: boolean,
  activeEnds: readonly (string | null)[],
): AgencySiteSubscriptionStatus {
  if (activeEnds.length === 0) return { required, active: false, endsOn: null };
  const endsOn = activeEnds.includes(null)
    ? null
    : (([...activeEnds].sort().at(-1) as string | undefined) ?? null);
  return { required, active: true, endsOn };
}

/** The agency can carry a live site: APPROVED and not deleted. */
export function isAgencyLive(agency: { status: AgencyStatus; deletedAt: Date | null }): boolean {
  return agency.status === AgencyStatus.APPROVED && agency.deletedAt === null;
}
