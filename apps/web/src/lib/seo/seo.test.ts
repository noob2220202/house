import { describe, expect, it } from 'vitest';
import { BRAND } from '@/config/brand';
import ROBOTS from '@/app/robots';
import {
  aggregateOfferJsonLd,
  complexJsonLd,
  complexNodeId,
  datasetJsonLd,
  faqJsonLd,
  listingJsonLd,
  organizationJsonLd,
  placeJsonLd,
} from './jsonld';
import {
  DEFAULT_OG_IMAGE,
  absoluteUrl,
  buildMetadata,
  clipDescription,
  siteVerification,
} from './metadata';

describe('buildMetadata', () => {
  it('builds absolute titles (no double brand suffix), canonical and OG', () => {
    const home = buildMetadata({ path: '/' });
    expect(home.title).toEqual({ absolute: `${BRAND.name} | ${BRAND.tagline}` });
    const page = buildMetadata({
      title: '아파트·분양권 지도',
      path: '/map/apt',
      image: '/media/og.jpg',
    });
    expect(page.title).toEqual({ absolute: `아파트·분양권 지도 | ${BRAND.name}` });
    expect(page.alternates?.canonical).toBe(absoluteUrl('/map/apt'));
    expect(page.openGraph?.images).toEqual([{ url: absoluteUrl('/media/og.jpg') }]);
    expect(page.robots).toBeUndefined();
  });
  it('falls back to the branded default image, always as a large card', () => {
    const home = buildMetadata({ path: '/' });
    expect(home.openGraph?.images).toEqual([{ url: absoluteUrl(DEFAULT_OG_IMAGE) }]);
    expect(home.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    });
    const page = buildMetadata({ title: 'x', path: '/x', image: '/media/og.jpg' });
    expect(page.twitter).toMatchObject({ card: 'summary_large_image' });
  });
  it('supports noindex pages (nofollow) and thin pages (noindex, follow)', () => {
    expect(buildMetadata({ title: '내 정보', path: '/me', noindex: true }).robots).toEqual({
      index: false,
      follow: false,
    });
    expect(buildMetadata({ title: 'x', path: '/x', noindex: 'follow' }).robots).toEqual({
      index: false,
      follow: true,
    });
  });
  it('keeps titles that already name the place, and canonicalizes duplicates', () => {
    const m = buildMetadata({
      title: '신대 레이크파크 실거래가·시세·매물 | 순천 해룡면 신대리',
      brandSuffix: false,
      path: '/suncheon/해룡면/apt',
      canonicalPath: '/suncheon/해룡면-신대리/apt',
    });
    expect(m.title).toEqual({
      absolute: '신대 레이크파크 실거래가·시세·매물 | 순천 해룡면 신대리',
    });
    expect(m.alternates?.canonical).toBe(absoluteUrl('/suncheon/해룡면-신대리/apt'));
    expect(m.openGraph?.url).toBe(absoluteUrl('/suncheon/해룡면/apt'));
  });
  it('clips long descriptions to ~160 characters', () => {
    const d = buildMetadata({ title: 'x', path: '/x', description: '가'.repeat(300) }).description;
    expect(d).toHaveLength(160);
    expect(d?.endsWith('…')).toBe(true);
    expect(clipDescription('  a \n b  ')).toBe('a b');
  });
});

describe('absoluteUrl', () => {
  it('percent-encodes Korean paths exactly once', () => {
    const url = absoluteUrl('/suncheon/해룡면-신대리/apt');
    expect(url).toMatch(
      /\/suncheon\/%ED%95%B4%EB%A3%A1%EB%A9%B4-%EC%8B%A0%EB%8C%80%EB%A6%AC\/apt$/,
    );
    expect(absoluteUrl(url.replace(/^https?:\/\/[^/]+/, ''))).toBe(url);
    expect(absoluteUrl('https://example.com/x')).toBe('https://example.com/x');
  });
});

describe('siteVerification', () => {
  it('omits the tags when the env vars are empty', () => {
    expect(siteVerification({ google: '', naver: '  ' })).toBeUndefined();
    expect(siteVerification({})).toBeUndefined();
  });
  it('emits google and naver-site-verification', () => {
    expect(siteVerification({ google: 'g-123', naver: 'n-456' })).toEqual({
      google: 'g-123',
      other: { 'naver-site-verification': 'n-456' },
    });
    expect(siteVerification({ naver: 'n-1' })).toEqual({
      other: { 'naver-site-verification': 'n-1' },
    });
  });
});

describe('JSON-LD builders', () => {
  it('Organization carries only real NAP fields', () => {
    const empty = organizationJsonLd();
    expect(empty).toMatchObject({ '@type': 'Organization', name: BRAND.name });
    expect(empty.address).toBeUndefined();
    expect(empty.contactPoint).toBeUndefined();
    const full = organizationJsonLd({
      legalName: '주식회사 예시',
      address: '순천시 연향동 1',
      telephone: '061-000-0000',
      email: 'help@example.kr',
    });
    expect(full).toMatchObject({
      legalName: '주식회사 예시',
      address: { '@type': 'PostalAddress', streetAddress: '순천시 연향동 1', addressCountry: 'KR' },
      contactPoint: { telephone: '061-000-0000', email: 'help@example.kr' },
    });
  });

  it('ApartmentComplex with floor plans, inside the region landing place', () => {
    const node = complexJsonLd({
      path: '/complex/c1',
      name: '신대 레이크파크',
      households: 1412,
      builtYear: 2019,
      address: '순천시 해룡면 신대1로 30',
      emdName: '해룡면 신대리',
      floorPlans: [{ name: '84A', exclusiveAreaSqm: 84.98, rooms: 3, baths: 2, households: 600 }],
      regionPath: '/suncheon/해룡면-신대리/apt',
    });
    expect(node).toMatchObject({
      '@type': 'ApartmentComplex',
      '@id': complexNodeId('/complex/c1'),
      numberOfAccommodationUnits: 1412,
      accommodationFloorPlan: [
        { '@type': 'FloorPlan', name: '84A', floorSize: { value: 84.98, unitCode: 'MTK' } },
      ],
      containedInPlace: { '@id': `${absoluteUrl('/suncheon/해룡면-신대리/apt')}#place` },
    });
    expect(placeJsonLd({ path: '/suncheon/해룡면-신대리/apt', name: '해룡면 신대리' })['@id']).toBe(
      `${absoluteUrl('/suncheon/해룡면-신대리/apt')}#place`,
    );
  });

  it('AggregateOffer in 원 per deal type, none without listings', () => {
    expect(
      aggregateOfferJsonLd({
        itemId: 'x',
        url: '/complex/c1',
        sale: true,
        count: 0,
        lowPrice: null,
        highPrice: null,
        description: '',
      }),
    ).toBeNull();
    expect(
      aggregateOfferJsonLd({
        itemId: 'x',
        url: '/complex/c1',
        sale: true,
        count: 3,
        lowPrice: 39_000,
        highPrice: 48_500,
        description: '매매 매물 3건',
      }),
    ).toMatchObject({
      '@type': 'AggregateOffer',
      offerCount: 3,
      lowPrice: 390_000_000,
      highPrice: 485_000_000,
      priceCurrency: 'KRW',
      businessFunction: 'http://purl.org/goodrelations/v1#Sell',
    });
  });

  it('RealEstateListing marks 계약중 as Reserved and never carries 호', () => {
    const node = listingJsonLd({
      path: '/listing/l1',
      name: '신대 레이크파크 103동',
      offerType: 'sale',
      priceWon: 445_000_000,
      availability: 'reserved',
      itemType: 'Apartment',
      complexPath: '/complex/c1',
      address: { street: '해룡면 신대리' },
    });
    expect(node).toMatchObject({
      offers: { availability: 'https://schema.org/Reserved', price: 445_000_000 },
      about: { '@type': 'Apartment', containedInPlace: { '@id': complexNodeId('/complex/c1') } },
    });
    expect(JSON.stringify(node)).not.toMatch(/호/);
  });

  it('FAQPage and Dataset', () => {
    expect(faqJsonLd([{ question: 'Q?', answer: 'A.' }])).toMatchObject({
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { text: 'A.' } }],
    });
    expect(
      datasetJsonLd({
        path: '/reports/suncheon-apartment-trades',
        name: 'n',
        description: 'd',
        temporalCoverage: '2026-10',
        source: { name: '국토교통부', url: 'https://www.data.go.kr' },
        variables: ['거래량'],
      }),
    ).toMatchObject({
      '@type': 'Dataset',
      temporalCoverage: '2026-10',
      isBasedOn: { name: '국토교통부' },
      isAccessibleForFree: true,
    });
  });
});

describe('robots.txt', () => {
  it('disallows private areas without blocking /media photos', () => {
    const rules = ROBOTS().rules;
    const group = Array.isArray(rules) ? rules[0] : rules;
    const disallow = ([] as string[]).concat(group?.disallow ?? []);
    for (const p of ['/agent/', '/me/', '/api/', '/mock-api/', '/dev/']) {
      expect(disallow).toContain(p);
    }
    // robots.txt matches prefixes: nothing may be a prefix of /media/… or /agency/….
    const blocks = (path: string) =>
      disallow.some((d) => (d.endsWith('$') ? path === d.slice(0, -1) : path.startsWith(d)));
    expect(blocks('/media/abc.jpg')).toBe(false);
    expect(blocks('/agency/1')).toBe(false);
    expect(blocks('/me')).toBe(true);
    expect(blocks('/agent/listings')).toBe(true);
    expect(ROBOTS().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
