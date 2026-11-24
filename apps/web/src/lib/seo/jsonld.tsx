import { BRAND } from '@/config/brand';
import { absoluteUrl } from './metadata';

type Json = string | number | boolean | null | undefined | Json[] | { [key: string]: Json };

/**
 * Renders a JSON-LD script. The payload is serialized with `<` escaped so listing text can never
 * break out of the script element.
 */
export function JsonLd({ data }: { data: Record<string, Json> | Record<string, Json>[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Organization + WebSite (with SearchAction) — rendered once on the home page. */
export function siteJsonLd(): Record<string, Json>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: BRAND.name,
      url: absoluteUrl('/'),
      description: BRAND.description,
      areaServed: BRAND.regionFull,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: BRAND.name,
      url: absoluteUrl('/'),
      inLanguage: 'ko-KR',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${absoluteUrl('/search')}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

export function breadcrumbJsonLd(
  items: readonly { name: string; path: string }[],
): Record<string, Json> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export interface ListingJsonLdInput {
  path: string;
  name: string;
  description?: string;
  images?: readonly string[];
  /** Price in 원 (KRW). For 월세 pass the monthly rent. */
  priceWon?: number | null;
  address?: { region?: string; locality?: string; street?: string };
  geo?: { lat: number; lng: number } | null;
  floorSizeSqm?: number | null;
  rooms?: number | null;
  datePosted?: string;
  /** schema.org business function: sell vs lease. */
  offerType: 'sale' | 'rent';
}

/** RealEstateListing JSON-LD for /listing/[id]. Never include private fields (호수, owner contact). */
export function listingJsonLd(l: ListingJsonLdInput): Record<string, Json> {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: l.name,
    description: l.description,
    url: absoluteUrl(l.path),
    image: l.images?.map((i) => absoluteUrl(i)),
    datePosted: l.datePosted,
    offers:
      l.priceWon !== null && l.priceWon !== undefined
        ? {
            '@type': 'Offer',
            price: l.priceWon,
            priceCurrency: 'KRW',
            businessFunction:
              l.offerType === 'sale'
                ? 'http://purl.org/goodrelations/v1#Sell'
                : 'http://purl.org/goodrelations/v1#LeaseOut',
            availability: 'https://schema.org/InStock',
          }
        : undefined,
    about: {
      '@type': 'Residence',
      address: l.address
        ? {
            '@type': 'PostalAddress',
            addressCountry: 'KR',
            addressRegion: l.address.region ?? '전라남도',
            addressLocality: l.address.locality ?? '순천시',
            streetAddress: l.address.street,
          }
        : undefined,
      geo: l.geo
        ? { '@type': 'GeoCoordinates', latitude: l.geo.lat, longitude: l.geo.lng }
        : undefined,
      floorSize: l.floorSizeSqm
        ? { '@type': 'QuantitativeValue', value: l.floorSizeSqm, unitCode: 'MTK' }
        : undefined,
      numberOfRooms: l.rooms ?? undefined,
    },
  };
}

export interface ComplexJsonLdInput {
  path: string;
  name: string;
  description?: string;
  image?: string | null;
  address?: string;
  geo?: { lat: number; lng: number } | null;
  households?: number | null;
  builtYear?: number | null;
}

/** ApartmentComplex JSON-LD for /complex/[id]. */
export function complexJsonLd(c: ComplexJsonLdInput): Record<string, Json> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ApartmentComplex',
    name: c.name,
    description: c.description,
    url: absoluteUrl(c.path),
    image: c.image ? absoluteUrl(c.image) : undefined,
    address: c.address
      ? { '@type': 'PostalAddress', addressCountry: 'KR', streetAddress: c.address }
      : undefined,
    geo: c.geo
      ? { '@type': 'GeoCoordinates', latitude: c.geo.lat, longitude: c.geo.lng }
      : undefined,
    numberOfAccommodationUnits: c.households ?? undefined,
    yearBuilt: c.builtYear ?? undefined,
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
export function agencyJsonLd(a: AgencyJsonLdInput): Record<string, Json> {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: a.name,
    description: a.description,
    url: absoluteUrl(a.path),
    image: a.image ? absoluteUrl(a.image) : undefined,
    telephone: a.telephone ?? undefined,
    address: a.address
      ? { '@type': 'PostalAddress', addressCountry: 'KR', streetAddress: a.address }
      : undefined,
    geo: a.geo
      ? { '@type': 'GeoCoordinates', latitude: a.geo.lat, longitude: a.geo.lng }
      : undefined,
    openingHours: a.openingHours,
    areaServed: BRAND.regionFull,
  };
}
