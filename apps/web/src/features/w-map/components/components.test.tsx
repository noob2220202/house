import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultFilters } from '@/lib/map';
import type { ListingSummary } from '../api/schemas';
import { ASSETS } from '../config/assets';
import { FILTER_SPEC, type MapFilters } from '../lib/filters';
import { FilterControl, QuickOptionChips } from './filters/FilterBar';
import { ListingPhotoCard, ListingRow } from './panel/ListingItems';
import { ListingList, SortTabs, type ListingListQuery } from './panel/ListingList';

const DEFAULTS = defaultFilters(FILTER_SPEC);
const filters = (patch: Partial<MapFilters> = {}): MapFilters => ({ ...DEFAULTS, ...patch });
const categoryHref = (slug: string) => `/map/${slug}`;

describe('원룸 inline filter groups', () => {
  it('shows every option on when no filter is set and narrows on click', async () => {
    const onChange = vi.fn();
    render(
      <FilterControl
        kind="roomType"
        inline
        asset={ASSETS.oneroom}
        filters={filters()}
        unit="sqm"
        onChange={onChange}
        categoryHref={categoryHref}
      />,
    );
    const group = screen.getByRole('group', { name: '방 종류' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true']);
    await userEvent.click(within(group).getByRole('button', { name: '투룸' }));
    expect(onChange).toHaveBeenCalledWith({ roomTypes: ['ONE_ROOM', 'ONE_HALF_ROOM'] });
  });

  it('treats "everything on" and "last one off" as no filter', async () => {
    const onChange = vi.fn();
    render(
      <FilterControl
        kind="deal"
        inline
        asset={ASSETS.oneroom}
        filters={filters({ dealTypes: ['MONTHLY'] })}
        unit="sqm"
        onChange={onChange}
        categoryHref={categoryHref}
      />,
    );
    const group = screen.getByRole('group', { name: '거래종류' });
    expect(within(group).getByRole('button', { name: '전세' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(within(group).getByRole('button', { name: '전세' }));
    expect(onChange).toHaveBeenLastCalledWith({ dealTypes: [] });
    await userEvent.click(within(group).getByRole('button', { name: '월세' }));
    expect(onChange).toHaveBeenLastCalledWith({ dealTypes: [] });
  });

  it('toggles 풀옵션 as three options', async () => {
    const onChange = vi.fn();
    render(<QuickOptionChips filters={filters({ options: ['PARKING'] })} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '주차' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: '풀옵션' }));
    expect(onChange).toHaveBeenCalledWith({
      options: ['PARKING', 'AIR_CONDITIONER', 'REFRIGERATOR', 'WASHER'],
    });
  });
});

describe('sort tabs', () => {
  it('flips the direction when the active 금액순 is pressed again', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <SortTabs sorts={ASSETS.oneroom.sorts} value="VERIFIED" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole('button', { name: '금액순' }));
    expect(onChange).toHaveBeenLastCalledWith('PRICE_ASC');
    rerender(<SortTabs sorts={ASSETS.oneroom.sorts} value="PRICE_ASC" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /금액순/ }));
    expect(onChange).toHaveBeenLastCalledWith('PRICE_DESC');
  });
});

const room: ListingSummary = {
  id: 'r1',
  assetType: 'ONEROOM',
  dealType: 'MONTHLY',
  status: 'ACTIVE',
  buildingName: '해오름빌',
  emdName: '석현동',
  locationNote: '순천대 정문 도보 6분',
  deposit: 500,
  monthlyRent: 42,
  exclusiveArea: 36,
  floor: 3,
  totalFloors: 4,
  roomType: 'TWO_ROOM',
  builtYear: 2019,
  maintenanceFeeWon: 70000,
  options: [],
  verifiedAt: '2026-11-21T10:00:00+09:00',
  agencyCount: 4,
  photoCount: 9,
  sameBuildingCount: 3,
  coverPhotoUrl: null,
};

describe('listing items', () => {
  it('renders the photo card like the design and links to the listing', async () => {
    const onFavorite = vi.fn();
    render(<ListingPhotoCard listing={room} unit="sqm" favorite={false} onFavorite={onFavorite} />);
    const link = screen.getByRole('link', { name: /월세 500\/42/ });
    expect(link).toHaveAttribute('href', '/listing/r1');
    expect(screen.getByText('투룸')).toBeInTheDocument();
    expect(screen.getByText('전용 36㎡(11평)')).toBeInTheDocument();
    expect(screen.getByText('관리비 7만')).toBeInTheDocument();
    expect(screen.getByText('석현동 · 2019년 준공 · 해오름빌')).toBeInTheDocument();
    expect(screen.getByText('순천대 정문 도보 6분')).toBeInTheDocument();
    expect(screen.getByText(/실매물 확인 26\.11\.21/)).toBeInTheDocument();
    expect(screen.getByText(/중개사 4곳/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '해오름빌 관심 매물에 추가' }));
    expect(onFavorite).toHaveBeenCalledWith('r1');
  });

  it('marks the selected row and the favourite state', () => {
    render(
      <ListingRow listing={room} unit="pyeong" selected favorite onFavorite={() => {}} showName />,
    );
    expect(screen.getByRole('article')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: '해오름빌 관심 매물에서 빼기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('전용 11평(36㎡)')).toBeInTheDocument();
  });
});

describe('listing list', () => {
  const page = (ids: string[], n: number) => ({
    items: ids.map((id) => ({ ...room, id })),
    page: n,
    pageSize: ids.length,
    total: 40,
    totalPages: 2,
  });
  const query = (pages: ReturnType<typeof page>[]) =>
    ({
      data: { pages, pageParams: pages.map((p) => p.page) },
      isPending: false,
      isError: false,
      hasNextPage: pages.length < 2,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    }) as unknown as ListingListQuery;
  const props = {
    layout: 'row' as const,
    unit: 'pyeong' as const,
    isFavorite: () => false,
    onFavorite: () => {},
  };

  it('scrolls to the selected listing once per selection, not again when more pages arrive', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const first = page(['a', 'b', 'c'], 1);
    const { rerender } = render(<ListingList {...props} query={query([first])} selectedId="b" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    rerender(<ListingList {...props} query={query([first, page(['d', 'e'], 2)])} selectedId="b" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    rerender(<ListingList {...props} query={query([first, page(['d', 'e'], 2)])} selectedId="e" />);
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  it('leaves out the listings shown in the "선택한 위치" block', () => {
    render(
      <ListingList
        {...props}
        query={query([page(['a', 'b', 'c'], 1)])}
        excludeIds={new Set(['b'])}
      />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});
