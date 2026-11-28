import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { findMockListingDetail } from '@/app/mock-api/v1/listings/_detail-fixtures';
import { toListingDetailWire } from '@/app/mock-api/v1/listings/_detail-wire';
import { listingDetailSchema } from '../api/schemas';
import type { ListingOfficeVariant } from '../lib/office';
import { BrokersCard } from './BrokersCard';
import { ListingInteractions } from './ListingInteractions';
import { ActionsBar, MobileFoot } from './SideActions';

// No session on an office host: the favourites / auth-gate hooks stay out of the picture.
vi.mock('@/lib/favorites/useFavorite', () => ({
  useFavoriteActions: () => ({
    has: () => false,
    toggle: vi.fn(),
    pending: false,
    isPending: false,
  }),
  favoriteLabel: (_kind: string, name: string) => `${name} 관심`,
}));
vi.mock('@/lib/auth/gate', () => ({
  useAuthGate: () => ({ gate: (fn: () => void) => fn(), status: 'unauthenticated' }),
  readIntent: () => null,
  clearIntent: vi.fn(),
}));

const detail = findMockListingDetail('L01');
if (!detail) throw new Error('fixture L01 missing');
const listing = listingDetailSchema.parse(toListingDetailWire(detail));
const primary = listing.agencies.find((a) => a.isPrimary) ?? listing.agencies[0]!;

const office: ListingOfficeVariant = {
  name: primary.name,
  homeHref: '/',
  listingsHref: '/#listings',
  mainListingUrl: `https://suncheonmap.kr/listing/${listing.id}`,
  mainSiteUrl: 'https://suncheonmap.kr',
};

function mount(variant: ListingOfficeVariant | null, first = primary) {
  const agencies = [first, ...listing.agencies.filter((a) => a.agencyId !== first.agencyId)];
  const l = variant ? { ...listing, agencies: [first] } : { ...listing, agencies };
  render(
    <ListingInteractions listing={l} office={variant} inquirySource={variant ? 'SITE' : 'MAIN'}>
      <ActionsBar />
      <BrokersCard agencies={l.agencies} idPrefix="t" />
      <MobileFoot listingNo="100412" viewCount={10} />
    </ListingInteractions>,
  );
}

describe('listing page, office-site variant', () => {
  it('main site: 관심 · 공유 · 허위매물 신고 buttons, office name links to its page', () => {
    mount(null);
    expect(screen.getByRole('button', { name: /관심/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '허위매물 신고' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: primary.name })).toHaveAttribute(
      'href',
      `/agency/${primary.agencyId}`,
    );
  });

  it('office site: no 관심, 신고 links to the main site, the office name leads home', () => {
    mount(office);
    expect(screen.queryByRole('button', { name: /관심/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '허위매물 신고' })).toBeNull();
    expect(screen.getByRole('button', { name: '공유' })).toBeInTheDocument();
    const reports = screen.getAllByRole('link', {
      name: /순천부동산지도에서 (허위매물 )?신고하기/,
    });
    expect(reports).toHaveLength(2);
    for (const a of reports) expect(a).toHaveAttribute('href', office.mainListingUrl);
    expect(screen.getByRole('link', { name: primary.name })).toHaveAttribute('href', '/');
  });

  it('office site: only this office is offered as a contact', () => {
    mount(office);
    const card = screen.getByRole('region', { name: /이 매물을 중개하는 사무소/ });
    expect(within(card).getAllByRole('listitem')).toHaveLength(1);
    expect(within(card).getByText('이 매물을 등록한 중개사무소예요.')).toBeInTheDocument();
  });

  // The office-wide count includes co-brokered listings; the office site counts its own only.
  const counted = { ...primary, activeListingCount: 57 };

  it('office site: no co-brokerage count or wording, no office-wide listing count', () => {
    mount(office, counted);
    const card = screen.getByRole('region', { name: '이 매물을 중개하는 사무소' });
    expect(within(card).queryByText(/공동중개/)).toBeNull();
    expect(within(card).queryByText(/곳$/)).toBeNull();
    expect(within(card).queryByText('57')).toBeNull();
  });

  it('main site keeps the count of offices and their listing counts', () => {
    mount(null, counted);
    const card = screen.getByRole('region', { name: /이 매물을 중개하는 사무소/ });
    expect(within(card).getByText(`${listing.agencies.length}곳`)).toBeInTheDocument();
    expect(within(card).getByText('57')).toBeInTheDocument();
  });
});
