import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { listingSummarySchema, type ListingSummary, type Notification } from '../schemas';
import { favoritesHref } from './FavoritesView';
import { ListingMiniRow } from './ListingMiniRow';
import { MeListingCard } from './MeListingCard';
import { NotificationRow } from './NotificationRow';
import { recentHref } from './RecentView';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/me',
  useSearchParams: () => new URLSearchParams(),
}));

const now = new Date('2026-11-23T03:00:00Z');
const notification = (over: Partial<Notification>): Notification => ({
  id: 'n1',
  type: 'PROPOSAL_RECEIVED',
  title: '신대중앙 공인중개사사무소가 제안을 보냈어요',
  body: '매물 2건을 제안했습니다.',
  data: { dealRequestId: 'dr1' },
  readAt: null,
  createdAt: '2026-11-23T02:42:00Z',
  ...over,
});

describe('<NotificationRow>', () => {
  it('links to its destination and marks an unread notification read on open', async () => {
    const onRead = vi.fn();
    render(<NotificationRow notification={notification({})} onRead={onRead} now={now} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/me/requests/dr1');
    expect(link).toHaveTextContent('읽지 않음');
    expect(link).toHaveTextContent('제안 도착');
    expect(link).toHaveTextContent('18분 전');
    expect(link).toHaveTextContent('매물 2건을 제안했습니다.');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(onRead).toHaveBeenCalledWith('n1');
  });

  it('is a button when unread without a destination, plain text once read', async () => {
    const onRead = vi.fn();
    const n = notification({ type: 'REPORT_RESOLVED', data: { reportId: 'r1' } });
    const { rerender } = render(<NotificationRow notification={n} onRead={onRead} now={now} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onRead).toHaveBeenCalledTimes(1);
    rerender(
      <NotificationRow
        notification={{ ...n, readAt: '2026-11-23T02:50:00Z' }}
        onRead={onRead}
        now={now}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText(/읽지 않음/)).toBeNull();
  });

  it('opens the broker console for agency events, with the agency caption', () => {
    // The my-page list shows the same feed to brokers: a request that ARRIVED at their office must
    // not lead to /me/requests/{id} (a request they do not own).
    render(
      <NotificationRow
        notification={notification({
          type: 'DEAL_REQUEST_RECEIVED',
          title: '새 내놓기 요청이 도착했어요',
          data: { agencyId: 'a1', dealRequestId: 'req-01' },
        })}
        now={now}
      />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/agent/requests/req-01');
    expect(link).toHaveTextContent('새 요청 도착');
  });

  it('keeps the focus on the row when acknowledging swaps its button for plain text', async () => {
    const n = notification({ type: 'REPORT_RESOLVED', data: { reportId: 'r1' } });
    const { rerender } = render(<NotificationRow notification={n} onRead={vi.fn()} now={now} />);
    const button = screen.getByRole('button');
    button.focus();
    await userEvent.keyboard('{Enter}');
    rerender(
      <NotificationRow
        notification={{ ...n, readAt: '2026-11-23T02:50:00Z' }}
        onRead={vi.fn()}
        now={now}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveTextContent('신고 처리');
  });

  it('does not call onRead again for a read notification and hides the body when compact', async () => {
    const onRead = vi.fn();
    render(
      <NotificationRow
        notification={notification({ readAt: '2026-11-23T02:50:00Z' })}
        onRead={onRead}
        compact
        now={now}
      />,
    );
    const link = screen.getByRole('link');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    expect(onRead).not.toHaveBeenCalled();
    expect(screen.queryByText('매물 2건을 제안했습니다.')).toBeNull();
  });
});

const listing: ListingSummary = listingSummarySchema.parse({
  id: 'l1',
  assetType: 'APT',
  dealType: 'SALE',
  status: 'ACTIVE',
  complexName: '오천 그린빌',
  dong: '107동',
  complexId: 'c5',
  salePrice: 25200,
  supplyArea: 79.3,
  floorClass: 'HIGH',
  totalFloors: 20,
  direction: 'SOUTH',
  verifiedAt: '2026-11-20T10:00:00+09:00',
  agencyCount: 2,
});

describe('<MeListingCard>', () => {
  it('renders the listing and removes it from favourites with a labelled heart', async () => {
    const onFavoriteChange = vi.fn();
    render(<MeListingCard listing={listing} favorite onFavoriteChange={onFavoriteChange} />);
    expect(screen.getByRole('link', { name: /오천 그린빌\s*107동/ })).toHaveAttribute(
      'href',
      '/listing/l1',
    );
    expect(screen.getByText('2억 5,200')).toBeInTheDocument();
    expect(screen.getByText('24평')).toBeInTheDocument();
    expect(screen.getByText(/중개사 2곳/)).toBeInTheDocument();
    const heart = screen.getByRole('button', { name: '오천 그린빌 107동 관심 매물에서 빼기' });
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(heart);
    expect(onFavoriteChange).toHaveBeenCalledWith(false);
  });

  it('shows 거래완료 instead of the broker badge for closed listings and can add back', async () => {
    const onFavoriteChange = vi.fn();
    render(
      <MeListingCard
        listing={{ ...listing, status: 'CLOSED' }}
        favorite={false}
        onFavoriteChange={onFavoriteChange}
      />,
    );
    expect(screen.getByText('거래완료')).toBeInTheDocument();
    expect(screen.queryByText(/중개사 2곳/)).toBeNull();
    // A sold listing is not advertised as a verified real listing.
    expect(screen.queryByText(/실매물 확인/)).toBeNull();
    expect(screen.getByText('거래가 끝난 매물이에요')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: '오천 그린빌 107동 관심 매물에 추가' }),
    );
    expect(onFavoriteChange).toHaveBeenCalledWith(true);
  });
});

describe('<ListingMiniRow>', () => {
  it('renders a compact linked row with the trailing caption', () => {
    render(<ListingMiniRow listing={listing} trailing="12분 전" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/listing/l1');
    expect(link).toHaveTextContent('매매');
    expect(link).toHaveTextContent('2억 5,200');
    expect(link).toHaveTextContent('24평 · 고/20층 · 남향');
    expect(link).toHaveTextContent('12분 전');
  });
});

describe('list hrefs', () => {
  it('keeps defaults out of the URL', () => {
    expect(favoritesHref('listings')).toBe('/me/favorites');
    expect(favoritesHref('listings', 2)).toBe('/me/favorites?page=2');
    expect(favoritesHref('complexes')).toBe('/me/favorites?tab=complexes');
    expect(favoritesHref('complexes', 3)).toBe('/me/favorites?tab=complexes&page=3');
    expect(recentHref()).toBe('/me/recent');
    expect(recentHref(2)).toBe('/me/recent?page=2');
  });
});
