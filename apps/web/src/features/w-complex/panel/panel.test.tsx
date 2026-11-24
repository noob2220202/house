import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { bannerSchema, complexListingItemSchema, type ComplexListingSummary } from '../api/schemas';
import { PANEL_FILTERS, type PanelFilterValues } from '../lib/filters';
import { featuredCardHref, featuredCardText } from './FeaturedAgencyCard';
import { ListingRow } from './ListingRow';
import { PanelFilterBar } from './PanelFilterBar';
import { PanelSummaryBar } from './PanelSummaryBar';
import { defaultFilters } from '@/lib/map';

const listing = complexListingItemSchema.parse({
  id: 'L01',
  dealType: 'SALE',
  salePrice: 44500,
  title: '올수리 · 호수공원 조망',
  dong: '103동',
  totalFloors: 25,
  floorClass: 'HIGH',
  exclusiveArea: 84.98,
  supplyArea: 112.4,
  pyeongLabel: '34평',
  rooms: 3,
  baths: 2,
  direction: 'SOUTH',
  verifiedAt: '2026-11-22T11:00:00+09:00',
  photoCount: 14,
  agencyCount: 2,
  agencies: [
    {
      agencyId: 'b01',
      name: '신대중앙 공인중개사사무소',
      representativeName: '김서진',
      phone: '0610000000',
      isPrimary: true,
      specialtyTag: '단지 전문',
      complexListingCount: 18,
      avgResponseMinutes: 12,
    },
    { agencyId: 'b02', name: '호수공원 공인중개사사무소', phone: '0610000000' },
  ],
});

function Row({ item = listing, client }: { item?: typeof listing; client?: QueryClient }) {
  const [open, setOpen] = useState(false);
  const [qc] = useState(
    () => client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={qc}>
      <ul>
        <ListingRow listing={item} unit="pyeong" open={open} onToggle={() => setOpen((o) => !o)} />
      </ul>
    </QueryClientProvider>
  );
}

describe('ListingRow', () => {
  it('links to the listing and shows price, specs and the verification date', () => {
    render(<Row />);
    const link = screen.getByRole('link', { name: /4억 4,500/ });
    expect(link).toHaveAttribute('href', '/listing/L01');
    expect(link).toHaveTextContent('103동');
    expect(link).toHaveTextContent('고/25층');
    expect(link).toHaveTextContent('34평 전용 84㎡');
    expect(screen.getByText('실매물 확인 26.11.22')).toBeInTheDocument();
  });

  it('explains a price range in code, whatever the title says', () => {
    render(
      <Row item={{ ...listing, priceMin: 42000, priceMax: 43000, title: '호수공원 도보 5분' }} />,
    );
    const link = screen.getByRole('link', { name: /4억 2,000\s*~\s*4억 3,000/ });
    expect(link).toHaveTextContent('중개사무소마다 호가가 달라요');
    expect(link).not.toHaveTextContent('호수공원 도보 5분');
  });

  it('discloses the co-brokering offices with call and inquiry actions', async () => {
    const user = userEvent.setup();
    render(<Row />);
    const toggle = screen.getByRole('button', { name: /중개사무소 2곳/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const region = screen.getByRole('region', {
      name: '103동 34평 매매 4억 4,500 매물을 중개하는 사무소',
    });
    expect(toggle).toHaveAttribute('aria-controls', region.id);
    expect(within(region).getByText('호가 모두 4억 4,500')).toBeInTheDocument();
    expect(within(region).getByText('단지 전문')).toBeInTheDocument();
    const call = within(region).getByRole('link', {
      name: /신대중앙 공인중개사사무소에 전화 문의/,
    });
    expect(call).toHaveAttribute('href', 'tel:0610000000');
    expect(within(region).getByRole('link', { name: '호수공원 공인중개사사무소' })).toHaveAttribute(
      'href',
      '/agency/b02',
    );
    expect(
      within(region).getByRole('button', { name: '호수공원 공인중개사사무소에 문의하기' }),
    ).toHaveAttribute('aria-haspopup', 'dialog');

    await user.click(toggle);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('closes the open office list with Esc and returns focus to its button', async () => {
    const user = userEvent.setup();
    render(<Row />);
    const toggle = screen.getByRole('button', { name: /중개사무소 2곳/ });
    await user.click(toggle);
    await user.tab();
    expect(screen.getByRole('region')).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });
});

describe('ListingRow (backend list row)', () => {
  /** `GET /listings?complexId=` row: nested complex, floorLabel, primaryAgency, no agencies[]. */
  const wire = complexListingItemSchema.parse({
    id: 'L09',
    dealType: 'SALE',
    assetType: 'APT',
    status: 'ACTIVE',
    salePrice: 44500,
    dong: '101동',
    floorLabel: '고/25',
    floorClass: 'HIGH',
    exclusiveArea: 84.98,
    supplyArea: 112.4,
    complex: { id: 'C01', name: '신대 레이크파크' },
    coverPhoto: null,
    primaryAgency: { id: 'b01', name: '신대중앙 공인중개사사무소' },
    agencyCount: 1,
  });

  afterEach(() => vi.unstubAllGlobals());

  it('parses the wire row (floor from floorLabel, complex name)', () => {
    expect(wire).toMatchObject({ complexId: 'C01', complexName: '신대 레이크파크', totalFloors: 25 });
    expect(wire.agencies).toEqual([]);
  });

  it('loads the offices of the listing when the row opens', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 'L09',
            dealType: 'SALE',
            assetType: 'APT',
            status: 'ACTIVE',
            lat: 34.93,
            lng: 127.55,
            photos: [],
            property: { roadAddress: '순천시 해룡면 신대리 1' },
            agencies: [
              {
                agencyId: 'b01',
                isPrimary: true,
                name: '신대중앙 공인중개사사무소',
                roadAddress: '순천시 해룡면 신대1로 1',
                addressDetail: null,
                phone: '0610000000',
                registrationNumber: '46150-2020-00001',
                representativeName: '김서진',
                contactName: null,
                contactPhone: null,
                logoUrl: null,
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Row item={wire} />);
    await user.click(screen.getByRole('button', { name: /중개사무소 1곳/ }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /신대중앙 공인중개사사무소에 전화 문의/ }),
      ).toHaveAttribute('href', 'tel:0610000000'),
    );
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/listings/L09');
  });
});

describe('PanelFilterBar', () => {
  const summary: ComplexListingSummary = {
    total: 56,
    byDealType: [
      {
        dealType: 'SALE',
        count: 38,
        priceMin: 39000,
        priceMax: 48500,
        rentMin: null,
        rentMax: null,
      },
      {
        dealType: 'JEONSE',
        count: 12,
        priceMin: 26000,
        priceMax: 31000,
        rentMin: null,
        rentMax: null,
      },
    ],
    dongs: ['101동', '103동'],
  };
  const base: PanelFilterValues = defaultFilters(PANEL_FILTERS);

  it('offers the options of this complex and resets 금액 when 거래 changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PanelFilterBar
        filters={{ ...base, 'c-price': '40000-45000' }}
        onChange={onChange}
        areaTypes={[]}
        summary={summary}
        unit="pyeong"
      />,
    );
    const deal = screen.getByLabelText('거래');
    expect(
      within(deal)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['전체', '매매', '전세']);
    expect(
      within(screen.getByLabelText('금액'))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['전체', '4억 미만', '4억~4억 5,000', '4억 5,000 이상']);
    await user.selectOptions(deal, '전세');
    expect(onChange).toHaveBeenCalledWith({ 'c-deal': 'JEONSE', 'c-price': null });

    await user.selectOptions(screen.getByLabelText('동'), '103동');
    expect(onChange).toHaveBeenLastCalledWith({ 'c-dong': '103동' });
  });

  it('shows 초기화 only when a filter is set', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <PanelFilterBar
        filters={base}
        onChange={onChange}
        areaTypes={[]}
        summary={summary}
        unit="pyeong"
      />,
    );
    expect(screen.queryByRole('button', { name: '초기화' })).not.toBeInTheDocument();
    rerender(
      <PanelFilterBar
        filters={{ ...base, 'c-rooms': 3 }}
        onChange={onChange}
        areaTypes={[]}
        summary={summary}
        unit="pyeong"
      />,
    );
    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ 'c-rooms': null, 'c-deal': null }),
    );
  });
});

describe('PanelSummaryBar sort', () => {
  it('is a radio group: arrows move and choose, Enter closes', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(
      <PanelSummaryBar
        total={56}
        summary={undefined}
        unit="pyeong"
        onUnitChange={() => undefined}
        sort="VERIFIED"
        onSortChange={onSortChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /확인일순/ }));
    const group = await screen.findByRole('radiogroup', { name: '정렬 기준' });
    const checked = within(group).getByRole('radio', { name: /확인일순/ });
    expect(checked).toHaveAttribute('aria-checked', 'true');
    expect(checked).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(group).getByRole('radio', { name: '최신순' })).toHaveFocus();
    expect(onSortChange).toHaveBeenLastCalledWith('LATEST');
    await user.keyboard('{End}');
    expect(onSortChange).toHaveBeenLastCalledWith('PHOTO');
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('radiogroup', { name: '정렬 기준' })).not.toBeInTheDocument();
  });
});

describe('featured agency card', () => {
  const banner = bannerSchema.parse({
    id: 'ad9',
    slot: 'COMPLEX_FEATURED_AGENCY',
    title: '신대중앙 공인중개사사무소',
    advertiserName: '신대중앙 공인중개사사무소',
    agencyId: 'b01',
    linkUrl: '/agency/b01',
  });

  it('combines the banner with the office stats of this complex', () => {
    expect(
      featuredCardText(banner, {
        agencyId: 'b01',
        name: '신대중앙 공인중개사사무소',
        representativeName: '김서진',
        phone: null,
        logoUrl: null,
        specialtyLabel: '레이크파크 단지 전문',
        complexListingCount: 18,
        avgResponseMinutes: 12,
      }),
    ).toEqual({
      name: '신대중앙 공인중개사사무소',
      kicker: '레이크파크 단지 전문',
      meta: '대표 김서진 · 이 단지 매물 18건 · 평균 응답 12분',
    });
  });

  it('degrades to the banner text alone', () => {
    expect(featuredCardText(banner, undefined)).toEqual({
      name: '신대중앙 공인중개사사무소',
      kicker: null,
      meta: '',
    });
  });

  it('routes the click through the tracked redirect, or to the office page without a link', () => {
    expect(featuredCardHref(banner)).toMatch(/\/banners\/ad9\/click$/);
    expect(featuredCardHref({ ...banner, linkUrl: null })).toBe('/agency/b01');
    expect(featuredCardHref({ ...banner, linkUrl: null, agencyId: null })).toBeNull();
  });
});
