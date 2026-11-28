import { AGENCY_SITE_COLORS } from '@house/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findAgencyDetail, toAgencyProfileWire } from '@/app/mock-api/v1/agencies/_fixtures';
import {
  findServableSite,
  liveSiteUrlOf,
  mockSiteUrl,
  officeAgencyId,
  resetSiteState,
  siteState,
} from '@/app/mock-api/v1/sites/_state';
import { agencyDetailSchema } from '@/features/w-agencies/api/schemas';
import { agencyListingsQuery } from '@/features/w-agencies/api/queries';
import * as inquiryApi from '@/features/w-inquiry/api';
import { officeSiteSchema } from './api/schemas';
import { OfficeContactActions } from './components/OfficeContactActions';
import { OfficeNotFound } from './components/OfficeNotFound';
import { officeSlugFromHost, publicHostOf } from './lib/host';
import { officeBrandCss, officeContactAgency, officeHomeTitle, officeHomeUrl } from './lib/site';

vi.mock('@/features/w-inquiry/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/w-inquiry/api')>()),
  logContactEvent: vi.fn(),
}));
const logContactEvent = vi.mocked(inquiryApi.logContactEvent);

/** `GET /sites/:slug` of the mock, built from the fixtures (the handler needs mock mode on). */
function publicSite(slug: string) {
  const row = findServableSite(slug);
  if (!row?.slug) return null;
  const agency = findAgencyDetail(officeAgencyId(row.officeKey));
  if (!agency) return null;
  return {
    slug: row.slug,
    color: row.color,
    tagline: row.tagline,
    url: mockSiteUrl(row.slug),
    agency: toAgencyProfileWire(agency),
  };
}

beforeEach(() => {
  resetSiteState();
  logContactEvent.mockClear();
});

describe('office host routing helpers', () => {
  it('reads the office slug of a host under the root domain', () => {
    expect(officeSlugFromHost('sindae.suncheonmap.kr', 'suncheonmap.kr')).toBe('sindae');
    expect(officeSlugFromHost('sindae.localhost:3143', 'localhost')).toBe('sindae');
    expect(officeSlugFromHost('Hosu.SuncheonMap.kr.', 'suncheonmap.kr')).toBe('hosu');
  });

  it('treats the main host, reserved / malformed / nested labels and foreign hosts as the main site', () => {
    for (const host of [
      'suncheonmap.kr',
      'www.suncheonmap.kr',
      'api.suncheonmap.kr',
      'demo.suncheonmap.kr',
      'xn--h32b.suncheonmap.kr',
      'a--b.suncheonmap.kr',
      'x.y.suncheonmap.kr',
      'sindae.suncheonmap.kr.evil.com',
      'sindae.evil.kr',
      'sindae.suncheonmap.kr/path',
      '',
    ]) {
      expect(officeSlugFromHost(host, 'suncheonmap.kr'), host).toBeNull();
    }
    expect(officeSlugFromHost('sindae.suncheonmap.kr', '')).toBeNull();
  });

  it('takes the first X-Forwarded-Host value, else Host, and refuses anything but host[:port]', () => {
    const h = (init: Record<string, string>) => new Headers(init);
    expect(publicHostOf(h({ 'x-forwarded-host': 'a.kr, b.kr', host: 'c.kr' }))).toBe('a.kr');
    expect(publicHostOf(h({ host: 'c.kr:3000' }))).toBe('c.kr:3000');
    expect(publicHostOf(h({ host: 'c.kr/x' }))).toBeNull();
    expect(publicHostOf(h({}))).toBeNull();
  });
});

describe('office site helpers', () => {
  it('puts the brand palette on :root and falls back to BLUE for unknown colours', () => {
    expect(officeBrandCss('GREEN')).toContain(`--brand:${AGENCY_SITE_COLORS.GREEN.brand}`);
    expect(officeBrandCss('GREEN')).toMatch(/^:root\{[^<>{}]+\}$/);
    expect(officeBrandCss('NO_SUCH')).toContain(`--brand:${AGENCY_SITE_COLORS.BLUE.brand}`);
  });

  it('titles the home with the office name and canonicalises its URL with one slash', () => {
    expect(officeHomeTitle('신대중앙 공인중개사사무소')).toBe(
      '신대중앙 공인중개사사무소 | 순천 부동산',
    );
    expect(officeHomeUrl({ url: 'https://sindae.suncheonmap.kr' })).toBe(
      'https://sindae.suncheonmap.kr/',
    );
    expect(officeHomeUrl({ url: 'https://sindae.suncheonmap.kr//' })).toBe(
      'https://sindae.suncheonmap.kr/',
    );
  });

  it('queries only the listings the office registered first', () => {
    const q = agencyListingsQuery('a1', { page: 2 }, { primaryOnly: true });
    expect(q).toMatchObject({ primaryAgencyId: 'a1', page: 2 });
    expect(q).not.toHaveProperty('agencyId');
    expect(agencyListingsQuery('a1', {})).toMatchObject({ agencyId: 'a1' });
  });
});

describe('mock ↔ schema', () => {
  it('parses the fixture sites like GET /sites/:slug answers them', () => {
    const site = officeSiteSchema.parse(publicSite('sindae'));
    expect(site).toMatchObject({ slug: 'sindae', color: 'GREEN' });
    expect(site.agency.name).toBe('신대중앙 공인중개사사무소');
    expect(site.agency.site?.url).toBe(site.url);
    expect(officeSiteSchema.parse(publicSite('hosu')).color).toBe('NAVY');
  });

  it('serves only ACTIVE sites (requested / suspended / unknown → 404)', () => {
    expect(publicSite('yeonhyang-central')).toBeNull();
    expect(publicSite('seonwol')).toBeNull();
    expect(publicSite('nope')).toBeNull();
  });

  it('links the profile to the site only while it is live, and honours the subscription gate', () => {
    const b01 = officeAgencyId('B01');
    expect(liveSiteUrlOf(b01)).toBe(mockSiteUrl('sindae'));
    const parsed = agencyDetailSchema.parse(toAgencyProfileWire(findAgencyDetail(b01)!));
    expect(parsed.site?.url).toBe(mockSiteUrl('sindae'));

    siteState().subscriptionRequired = true;
    expect(liveSiteUrlOf(b01)).toBeNull();
    expect(publicSite('sindae')).toBeNull();
    siteState().subscriptionActive = true;
    expect(publicSite('sindae')).not.toBeNull();
    // B02 holds no subscription in the mocks.
    expect(publicSite('hosu')).toBeNull();
  });

  it('keeps an unknown colour readable and ignores a malformed site link', () => {
    const raw = publicSite('sindae')!;
    expect(officeSiteSchema.parse({ ...raw, color: 42 }).color).toBe('BLUE');
    const agency = agencyDetailSchema.parse({
      ...raw.agency,
      site: { url: 'javascript:alert(1)' },
    });
    expect(agency.site ?? null).toBeNull();
  });
});

describe('<OfficeContactActions>', () => {
  const site = officeSiteSchema.parse(publicSite('sindae'));
  const agency = officeContactAgency(site);

  it('shows the number and 문의하기 in the header; the call link dials the office', () => {
    render(<OfficeContactActions agency={agency} variant="header" />);
    const call = screen.getByRole('link', { name: /신대중앙 공인중개사사무소에 전화하기/ });
    expect(call).toHaveAttribute('href', 'tel:0610000000');
    expect(call).toHaveTextContent('061-000-0000');
    expect(screen.getByRole('button', { name: '문의하기' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
  });

  it('logs a CALL from the office site when a phone dials', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    render(<OfficeContactActions agency={agency} variant="icon" />);
    const call = screen.getByRole('link', { name: /전화하기/ });
    call.addEventListener('click', (e) => e.preventDefault()); // jsdom cannot open tel:
    await userEvent.click(call);
    expect(logContactEvent).toHaveBeenCalledWith({
      agencyId: site.agency.id,
      listingId: null,
      channel: 'CALL',
      source: 'SITE',
    });
    expect(screen.queryByRole('button', { name: '문의하기' })).toBeNull();
  });
});

describe('<OfficeNotFound>', () => {
  it('sends visitors of an unknown site to the main site', () => {
    render(<OfficeNotFound kind="site" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      '홈페이지를 찾을 수 없어요',
    );
    expect(screen.getByRole('link', { name: /중개사무소 찾기/ }).getAttribute('href')).toMatch(
      /^https?:\/\/[^/]+\/agencies$/,
    );
  });

  it('keeps visitors of a missing listing on the office site', () => {
    render(<OfficeNotFound kind="page" />);
    expect(screen.getByRole('link', { name: '매물 보러 가기' })).toHaveAttribute(
      'href',
      '/#listings',
    );
    expect(screen.getByRole('link', { name: '사무소 홈' })).toHaveAttribute('href', '/');
  });
});
