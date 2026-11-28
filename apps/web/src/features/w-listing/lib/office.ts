/**
 * The listing page as part of an office's own 홈페이지 (`https://<slug>.<root>/listing/<id>`):
 * contact goes to that office only, the signed-in actions (관심, 허위매물 신고) live on the main
 * site (sessions are host-only there), breadcrumbs lead back to the office home.
 */
export interface ListingOfficeVariant {
  /** Office name — root of the breadcrumbs. */
  name: string;
  /** Office home on the office host ("/"). */
  homeHref: string;
  /** The office's listing section ("/#listings"). */
  listingsHref: string;
  /** Absolute URL of this listing on the main site (신고, the canonical page). */
  mainListingUrl: string;
  /** Absolute origin of the main site (map links). */
  mainSiteUrl: string;
}
