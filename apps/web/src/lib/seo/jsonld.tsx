import { BRAND } from '@/config/brand';
import { DEFAULT_OG_IMAGE, absoluteUrl } from './metadata';

export type Json = string | number | boolean | null | undefined | Json[] | { [key: string]: Json };
export type JsonLdNode = Record<string, Json>;

const CONTEXT = 'https://schema.org';

/**
 * Renders a JSON-LD script. The payload is serialized with `<` escaped so listing text can never
 * break out of the script element. `undefined` fields are dropped by JSON.stringify.
 */
export function JsonLd({ data }: { data: JsonLdNode | JsonLdNode[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Stable node ids so pages can reference the site's Organization / WebSite. */
export const ORGANIZATION_ID = () => `${absoluteUrl('/')}#organization`;
export const WEBSITE_ID = () => `${absoluteUrl('/')}#website`;

/** 순천시 as a schema.org City (areaServed / containedInPlace of every local entity). */
export function cityPlace(): JsonLdNode {
  return {
    '@type': 'City',
    name: BRAND.region,
    containedInPlace: { '@type': 'AdministrativeArea', name: BRAND.seo.addressRegion },
  };
}

/** Korean postal address; `street` is the road / 지번 address without 호. */
export function postalAddress(street?: string | null, locality: string = BRAND.region): JsonLdNode {
  return {
    '@type': 'PostalAddress',
    addressCountry: 'KR',
    addressRegion: BRAND.seo.addressRegion,
    addressLocality: locality,
    streetAddress: street ?? undefined,
  };
}

const geo = (g?: { lat: number; lng: number } | null): JsonLdNode | undefined =>
  g ? { '@type': 'GeoCoordinates', latitude: g.lat, longitude: g.lng } : undefined;

export interface OrganizationInput {
  /** 상호 (사업자 정보). Falls back to the service name. */
  legalName?: string | null;
  address?: string | null;
  telephone?: string | null;
  email?: string | null;
  /** Page that describes the organization (/about). */
  aboutPath?: string;
}

/**
 * The publisher of the site. NAP fields come from 사이트 설정 (BUSINESS_INFO / CONTACT) and are
 * only included when the operator filled them in — never placeholders.
 */
export function organizationJsonLd(o: OrganizationInput = {}): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'Organization',
    '@id': ORGANIZATION_ID(),
    name: BRAND.name,
    legalName: o.legalName ?? undefined,
    url: absoluteUrl('/'),
    logo: absoluteUrl(DEFAULT_OG_IMAGE),
    description: BRAND.seo.summary,
    areaServed: cityPlace(),
    address: o.address ? postalAddress(o.address) : undefined,
    telephone: o.telephone ?? undefined,
    email: o.email ?? undefined,
    contactPoint:
      o.telephone || o.email
        ? {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            telephone: o.telephone ?? undefined,
            email: o.email ?? undefined,
            areaServed: 'KR',
            availableLanguage: 'Korean',
          }
        : undefined,
    knowsAbout: [...BRAND.seo.keywords],
    sameAs: BRAND.seo.sameAs.length ? [...BRAND.seo.sameAs] : undefined,
    subjectOf: o.aboutPath ? absoluteUrl(o.aboutPath) : undefined,
  };
}

/** Organization + WebSite (with SearchAction) — rendered once on the home page. */
export function siteJsonLd(): JsonLdNode[] {
  return [
    organizationJsonLd({ aboutPath: '/about' }),
    {
      '@context': CONTEXT,
      '@type': 'WebSite',
      '@id': WEBSITE_ID(),
      name: BRAND.name,
      url: absoluteUrl('/'),
      description: BRAND.description,
      inLanguage: 'ko-KR',
      publisher: { '@id': ORGANIZATION_ID() },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${absoluteUrl('/search')}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

export function breadcrumbJsonLd(items: readonly { name: string; path: string }[]): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** FAQPage from factual question / answer pairs (plain text answers). */
export function faqJsonLd(items: readonly { question: string; answer: string }[]): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** ItemList of internal links (단지 of a landing page, regions of the index). */
export function itemListJsonLd(
  name: string,
  items: readonly { name: string; path: string }[],
): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export interface PlaceJsonLdInput {
  path: string;
  /** "해룡면 신대리" */
  name: string;
  /** Also known as ("신대지구"). */
  alternateName?: string | null;
  description?: string;
  geo?: { lat: number; lng: number } | null;
}

/** A 읍면동 / 리 of the service city (landing pages). */
export function placeJsonLd(p: PlaceJsonLdInput): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'Place',
    '@id': `${absoluteUrl(p.path)}#place`,
    name: `${BRAND.region} ${p.name}`,
    alternateName: p.alternateName ?? undefined,
    description: p.description,
    url: absoluteUrl(p.path),
    geo: geo(p.geo),
    address: postalAddress(p.name),
    containedInPlace: cityPlace(),
  };
}

export interface ListingJsonLdInput {
  path: string;
  name: string;
  description?: string;
  images?: readonly string[];
  /**
   * Price in 원 (KRW): 매매가 / 분양가, 전세 보증금, and for 월세 the 보증금 (the rent goes in
   * `monthlyRentWon`) — the same figures the page's 거래 금액 shows.
   */
  priceWon?: number | null;
  /** 월세 only: monthly rent in 원. The offer then carries 보증금 + 월세 as two price specs. */
  monthlyRentWon?: number | null;
  address?: { region?: string; locality?: string; street?: string };
  geo?: { lat: number; lng: number } | null;
  floorSizeSqm?: number | null;
  rooms?: number | null;
  datePosted?: string;
  /** schema.org business function: sell vs lease. */
  offerType: 'sale' | 'rent';
  /** 광고중 = InStock, 계약중 = Reserved. */
  availability?: 'available' | 'reserved';
  /** What is offered: 아파트·오피스텔·원룸 → Apartment, 주택 → House, 상가·토지 → Place. */
  itemType?: 'Apartment' | 'House' | 'Place';
  /** The 단지 page the listing belongs to (`ApartmentComplex` @id). */
  complexPath?: string | null;
}

/** RealEstateListing JSON-LD for /listing/[id]. Never include private fields (호수, owner contact). */
export function listingJsonLd(l: ListingJsonLdInput): JsonLdNode {
  const itemType = l.itemType ?? 'Apartment';
  return {
    '@context': CONTEXT,
    '@type': 'RealEstateListing',
    name: l.name,
    description: l.description,
    url: absoluteUrl(l.path),
    image: l.images?.map((i) => absoluteUrl(i)),
    datePosted: l.datePosted,
    offers: listingOffer(l),
    about: {
      '@type': itemType,
      address: l.address
        ? {
            ...postalAddress(l.address.street, l.address.locality ?? BRAND.region),
            ...(l.address.region ? { addressRegion: l.address.region } : {}),
          }
        : undefined,
      geo: geo(l.geo),
      floorSize:
        itemType !== 'Place' && l.floorSizeSqm
          ? { '@type': 'QuantitativeValue', value: l.floorSizeSqm, unitCode: 'MTK' }
          : undefined,
      numberOfRooms: itemType !== 'Place' ? (l.rooms ?? undefined) : undefined,
      containedInPlace: l.complexPath ? { '@id': complexNodeId(l.complexPath) } : undefined,
    },
  };
}

/**
 * The Offer of a listing, with the prices the page states: one `price` for 매매 / 분양 / 전세; for
 * 월세 no single price (the rent alone would understate it) but 보증금 and 월세 (per month) as
 * separate price specifications. 계약중 = Reserved. Omitted when the price is undisclosed.
 */
function listingOffer(l: ListingJsonLdInput): JsonLdNode | undefined {
  const deal = {
    '@type': 'Offer',
    priceCurrency: 'KRW',
    businessFunction:
      l.offerType === 'sale'
        ? 'http://purl.org/goodrelations/v1#Sell'
        : 'http://purl.org/goodrelations/v1#LeaseOut',
    availability:
      l.availability === 'reserved' ? 'https://schema.org/Reserved' : 'https://schema.org/InStock',
  } satisfies JsonLdNode;
  const has = (n: number | null | undefined): n is number => n !== null && n !== undefined;
  if (has(l.monthlyRentWon)) {
    return {
      ...deal,
      priceSpecification: [
        ...(has(l.priceWon)
          ? [
              {
                '@type': 'PriceSpecification',
                name: '보증금',
                price: l.priceWon,
                priceCurrency: 'KRW',
              },
            ]
          : []),
        {
          '@type': 'UnitPriceSpecification',
          name: '월세',
          price: l.monthlyRentWon,
          priceCurrency: 'KRW',
          unitCode: 'MON',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
        },
      ],
    };
  }
  return has(l.priceWon) ? { ...deal, price: l.priceWon } : undefined;
}

export const complexNodeId = (path: string) => `${absoluteUrl(path)}#complex`;

export interface ComplexJsonLdInput {
  path: string;
  name: string;
  description?: string;
  image?: string | null;
  address?: string;
  /** 법정동 label ("해룡면 신대리") — the containing place. */
  emdName?: string | null;
  geo?: { lat: number; lng: number } | null;
  households?: number | null;
  builtYear?: number | null;
  /** 평형 (FloorPlan). */
  floorPlans?: readonly {
    name: string;
    exclusiveAreaSqm: number;
    rooms?: number | null;
    baths?: number | null;
    households?: number | null;
  }[];
  /** Landing page of the 단지's 읍면동 (containedInPlace @id) when it exists. */
  regionPath?: string | null;
}

/** ApartmentComplex (a Residence / Place) JSON-LD for /complex/[id]. */
export function complexJsonLd(c: ComplexJsonLdInput): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'ApartmentComplex',
    '@id': complexNodeId(c.path),
    name: c.name,
    description: c.description,
    url: absoluteUrl(c.path),
    image: c.image ? absoluteUrl(c.image) : undefined,
    address: c.address ? postalAddress(c.address) : undefined,
    geo: geo(c.geo),
    numberOfAccommodationUnits: c.households ?? undefined,
    yearBuilt: c.builtYear ?? undefined,
    accommodationFloorPlan: c.floorPlans?.length
      ? c.floorPlans.map((f) => ({
          '@type': 'FloorPlan',
          name: f.name,
          floorSize: { '@type': 'QuantitativeValue', value: f.exclusiveAreaSqm, unitCode: 'MTK' },
          numberOfRooms: f.rooms ?? undefined,
          numberOfBathroomsTotal: f.baths ?? undefined,
          numberOfAccommodationUnits: f.households ?? undefined,
        }))
      : undefined,
    containedInPlace: c.regionPath
      ? { '@id': `${absoluteUrl(c.regionPath)}#place` }
      : c.emdName
        ? { '@type': 'Place', name: `${BRAND.region} ${c.emdName}`, containedInPlace: cityPlace() }
        : cityPlace(),
  };
}

export interface AggregateOfferInput {
  /** What is offered (`complexNodeId(path)` or another node id). */
  itemId: string;
  url: string;
  sale: boolean;
  count: number;
  /** 만원 */
  lowPrice: number | null;
  highPrice: number | null;
  /** "매매 매물 12건" */
  description: string;
}

/** Live listings of one deal type for a 단지 (prices in 원). Omitted when there are none. */
export function aggregateOfferJsonLd(o: AggregateOfferInput): JsonLdNode | null {
  if (o.count <= 0) return null;
  return {
    '@context': CONTEXT,
    '@type': 'AggregateOffer',
    itemOffered: { '@id': o.itemId },
    url: absoluteUrl(o.url),
    offerCount: o.count,
    priceCurrency: 'KRW',
    lowPrice: o.lowPrice !== null ? o.lowPrice * 10_000 : undefined,
    highPrice: o.highPrice !== null ? o.highPrice * 10_000 : undefined,
    businessFunction: o.sale
      ? 'http://purl.org/goodrelations/v1#Sell'
      : 'http://purl.org/goodrelations/v1#LeaseOut',
    description: o.description,
  };
}

export interface DatasetJsonLdInput {
  path: string;
  name: string;
  description: string;
  /** ISO dates / YYYY-MM of the period covered. */
  temporalCoverage: string;
  dateModified?: string | null;
  /** Upstream data source. */
  source: { name: string; url: string };
  variables: readonly string[];
  keywords?: readonly string[];
}

/** Dataset JSON-LD for the monthly 실거래 report (Google Dataset Search, AI answer engines). */
export function datasetJsonLd(d: DatasetJsonLdInput): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'Dataset',
    name: d.name,
    description: d.description,
    url: absoluteUrl(d.path),
    inLanguage: 'ko-KR',
    temporalCoverage: d.temporalCoverage,
    dateModified: d.dateModified ?? undefined,
    spatialCoverage: cityPlace(),
    variableMeasured: [...d.variables],
    keywords: d.keywords ? [...d.keywords] : undefined,
    isAccessibleForFree: true,
    creator: { '@id': ORGANIZATION_ID() },
    publisher: { '@id': ORGANIZATION_ID() },
    isBasedOn: { '@type': 'Dataset', name: d.source.name, url: d.source.url },
  };
}

export interface AgencyJsonLdInput {
  path: string;
  name: string;
  description?: string;
  image?: string | null;
  /** Public office phone (대표번호) — E.164 or national format. */
  telephone?: string | null;
  address?: string;
  geo?: { lat: number; lng: number } | null;
  openingHours?: string;
}

/** RealEstateAgent JSON-LD for /agency/[id]. */
export function agencyJsonLd(a: AgencyJsonLdInput): JsonLdNode {
  return {
    '@context': CONTEXT,
    '@type': 'RealEstateAgent',
    name: a.name,
    description: a.description,
    url: absoluteUrl(a.path),
    image: a.image ? absoluteUrl(a.image) : undefined,
    telephone: a.telephone ?? undefined,
    address: a.address ? postalAddress(a.address) : undefined,
    geo: geo(a.geo),
    openingHours: a.openingHours,
    areaServed: cityPlace(),
  };
}
