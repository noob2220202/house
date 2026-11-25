// Server-side data access lives in './api' (server-only) — import it directly.
export {
  absoluteUrl,
  buildMetadata,
  clipDescription,
  rootMetadata,
  siteVerification,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  type PageMetaInput,
} from './metadata';
export {
  JsonLd,
  agencyJsonLd,
  aggregateOfferJsonLd,
  breadcrumbJsonLd,
  complexJsonLd,
  complexNodeId,
  datasetJsonLd,
  faqJsonLd,
  itemListJsonLd,
  listingJsonLd,
  organizationJsonLd,
  placeJsonLd,
  siteJsonLd,
  type JsonLdNode,
} from './jsonld';
export {
  DISTRICT_ALIASES,
  districtAlias,
  LANDING_ASSETS,
  LANDING_ASSET_SLUGS,
  SEO_ROUTES,
  assetSlugOf,
  findRegionBySlug,
  indexableLandings,
  isLandingAsset,
  landingCounts,
  landingDecision,
  landingTitle,
  placeLabel,
  regionSlug,
  type LandingDecision,
} from './regions';
export { DATA_SOURCES } from './sources';
export { dateOnlyLabel, manwonText, percentChange, ymDot, ymLabel } from './text';
