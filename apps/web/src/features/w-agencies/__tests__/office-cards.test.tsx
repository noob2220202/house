import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listingSummarySchema } from '@/lib/api/schemas/listing';
import { AgencyListingCard } from '../components/AgencyListingCard';
import { AgencyListingItem } from '../components/AgencyListingItem';
import { OfficeCoverArt } from '../components/OfficeCoverArt';

const listing = listingSummarySchema.parse({
  id: 'l1',
  assetType: 'APT',
  dealType: 'SALE',
  status: 'ACTIVE',
  complexName: '신대 레이크파크',
  dong: '103동',
  complexId: 'c1',
  salePrice: 44500,
  supplyArea: 84.9,
  verifiedAt: '2026-11-20T10:00:00+09:00',
  agencyCount: 3,
});

// D-D / UX-06: on the office's own site the listing page names that office only, so the cards
// must not say "중개사 3곳" (it also told visitors that rival offices sell the same listing).
describe('office listing cards', () => {
  it('main site: grid item and card show the co-brokerage count', () => {
    render(
      <>
        <AgencyListingItem listing={listing} />
        <AgencyListingCard listing={listing} />
      </>,
    );
    expect(screen.getAllByText(/중개사 3곳/).length).toBeGreaterThanOrEqual(2);
  });

  it('office site: no co-brokerage count on either', () => {
    render(
      <>
        <AgencyListingItem listing={listing} showBrokerCount={false} />
        <AgencyListingCard listing={listing} showBrokerCount={false} />
      </>,
    );
    expect(screen.queryByText(/중개사 \d+곳/)).toBeNull();
    expect(screen.getAllByText('4억 4,500').length).toBe(2);
  });
});

describe('<OfficeCoverArt>', () => {
  it('paints its accents with the brand colour (the office colour on its own site)', () => {
    const { container } = render(<OfficeCoverArt />);
    expect(container.querySelector('[fill="#1D4FF2" i]')).toBeNull();
    const accents = [...container.querySelectorAll<SVGElement>('rect')].filter((r) =>
      r.style.fill.includes('--brand'),
    );
    expect(accents).toHaveLength(2);
  });
});
