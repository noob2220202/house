import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LISTINGS } from '@/app/mock-api/v1/me/_fixtures';
import { ApiError, api } from '@/lib/api';
import {
  meKeys,
  useMarkNotificationsRead,
  useToggleFavoriteListing,
  type FavoriteToggle,
} from './api';
import { FavoritesView } from './components/FavoritesView';
import { MarketingConsentCard } from './components/MarketingConsentCard';
import { SoftButton } from './components/SoftButton';
import { UNDO_TOAST_MS, useFavoriteRemoval } from './hooks/useFavoriteRemoval';
import { listingFullName } from './lib/listing-card';
import { FAVORITES_PAGE_SIZE } from './queries';
import type {
  FavoriteComplexPage,
  FavoriteListing,
  FavoriteListingPage,
  Notification,
  NotificationPage,
  Profile,
} from './schemas';

const toast = vi.fn<(options: unknown) => number>();
const dismiss = vi.fn();
vi.mock('@house/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@house/ui')>()),
  useToast: () => ({ toast, dismiss }),
}));

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/me/favorites',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const apiGet = vi.mocked(api.get);
const apiPost = vi.mocked(api.post);
const apiPut = vi.mocked(api.put);
const apiPatch = vi.mocked(api.patch);
const apiDelete = vi.mocked(api.delete);

/** A promise the test settles by hand — lets two requests overlap. */
function deferred<T = undefined>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const favorites: FavoriteListing[] = LISTINGS.slice(0, 3).map((l, i) => ({
  ...l,
  isFavorite: true,
  favoritedAt: `2026-11-2${3 - i}T10:00:00+09:00`,
}));
const [first, second, third] = favorites as [FavoriteListing, FavoriteListing, FavoriteListing];
const nameOf = (l: FavoriteListing) => listingFullName(l);

const listingPage = (items: FavoriteListing[]): FavoriteListingPage => ({
  items,
  page: 1,
  pageSize: FAVORITES_PAGE_SIZE,
  total: items.length,
  totalPages: 1,
});
const listKey = meKeys.favoriteListings({ page: 1, pageSize: FAVORITES_PAGE_SIZE });
const complexKey = meKeys.favoriteComplexes({ page: 1, pageSize: FAVORITES_PAGE_SIZE });
const emptyComplexes: FavoriteComplexPage = {
  items: [],
  page: 1,
  pageSize: FAVORITES_PAGE_SIZE,
  total: 0,
  totalPages: 1,
};

function setup(seed?: (client: QueryClient) => void) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  seed?.(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const ids = (client: QueryClient) =>
  client.getQueryData<FavoriteListingPage>(listKey)?.items.map((l) => l.id);

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = '';
  let id = 0;
  toast.mockImplementation(() => (id += 1));
  apiGet.mockRejectedValue(new Error('unexpected GET'));
});

describe('useToggleFavoriteListing — overlapping removals', () => {
  it('resolves every call, syncs the list once, after the last one settled', async () => {
    const { client, wrapper } = setup((c) => c.setQueryData(listKey, listingPage(favorites)));
    const a = deferred();
    const b = deferred();
    apiDelete.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useToggleFavoriteListing(), { wrapper });

    let done: string[] = [];
    act(() => {
      void result.current.mutateAsync({ id: first.id, favorite: false }).then(() => done.push('a'));
      void result.current
        .mutateAsync({ id: second.id, favorite: false })
        .then(() => done.push('b'));
    });
    await waitFor(() => expect(ids(client)).toEqual([third.id]));
    expect(client.getQueryData<FavoriteListingPage>(listKey)?.total).toBe(1);

    // The first one settles while the second is still in flight: no refetch yet (it would bring
    // the second card back for a moment).
    await act(async () => {
      a.resolve(undefined);
      await a.promise;
    });
    await waitFor(() => expect(done).toEqual(['a']));
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      b.resolve(undefined);
      await b.promise;
    });
    await waitFor(() => expect(done).toEqual(['a', 'b']));
    // One sync for the whole burst: the shared favourites caches + my-page lists (['me-favorites']).
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['favorites'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: meKeys.favorites });
    done = [];
  });

  it('rolls back only the card whose request failed', async () => {
    const { client, wrapper } = setup((c) => c.setQueryData(listKey, listingPage(favorites)));
    const a = deferred();
    const b = deferred();
    apiDelete.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const { result } = renderHook(() => useToggleFavoriteListing(), { wrapper });

    const outcome: string[] = [];
    act(() => {
      result.current.mutateAsync({ id: first.id, favorite: false }).then(
        () => outcome.push('a ok'),
        () => outcome.push('a failed'),
      );
      result.current.mutateAsync({ id: second.id, favorite: false }).then(
        () => outcome.push('b ok'),
        () => outcome.push('b failed'),
      );
    });
    await waitFor(() => expect(ids(client)).toEqual([third.id]));

    await act(async () => {
      a.reject(new ApiError(500, { code: 'INTERNAL_ERROR', message: '일시적인 오류' }));
      await a.promise.catch(() => undefined);
    });
    await waitFor(() => expect(outcome).toEqual(['a failed']));
    // Card 1 is back at its old place; card 2 (still being removed) stays out.
    expect(ids(client)).toEqual([first.id, third.id]);
    expect(client.getQueryData<FavoriteListingPage>(listKey)?.total).toBe(2);

    await act(async () => {
      b.resolve(undefined);
      await b.promise;
    });
    await waitFor(() => expect(outcome).toEqual(['a failed', 'b ok']));
  });
});

describe('useFavoriteRemoval', () => {
  it('gives every removal its own undo toast, also when two overlap', async () => {
    const a = deferred();
    const b = deferred();
    const pending = [a, b];
    const calls: FavoriteToggle[] = [];
    const mutateAsync = vi.fn((vars: FavoriteToggle) => {
      calls.push(vars);
      return vars.favorite ? Promise.resolve() : (pending.shift()?.promise ?? Promise.resolve());
    });
    const { result } = renderHook(() => useFavoriteRemoval(mutateAsync, '매물을'));

    act(() => {
      void result.current.remove({ id: 'l1', name: '신대 레이크파크 1단지 103동' });
      void result.current.remove({ id: 'l2', name: '석현동 해오름빌 투룸' });
    });
    // The inline notice lists both at once (newest first), before either request answers.
    expect(result.current.removed.map((r) => r.id)).toEqual(['l2', 'l1']);
    expect(toast).not.toHaveBeenCalled();

    await act(async () => {
      a.resolve(undefined);
      b.resolve(undefined);
      await Promise.all([a.promise, b.promise]);
    });
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
    const shown = toast.mock.calls.map(
      ([o]) =>
        o as { message: string; duration: number; action: { label: string; onClick(): void } },
    );
    expect(shown.map((t) => t.message)).toEqual([
      '신대 레이크파크 1단지 103동 매물을 관심 목록에서 뺐어요.',
      '석현동 해오름빌 투룸 매물을 관심 목록에서 뺐어요.',
    ]);
    // Long enough to reach with a keyboard (the default 4 s is not).
    expect(shown.every((t) => t.duration === UNDO_TOAST_MS && t.duration >= 8000)).toBe(true);
    expect(shown.every((t) => t.action.label === '실행 취소')).toBe(true);

    // Undo of the FIRST removal still works after the second one.
    await act(async () => {
      shown[0]?.action.onClick();
      await Promise.resolve();
    });
    await waitFor(() => expect(calls).toContainEqual({ id: 'l1', favorite: true }));
    await waitFor(() => expect(result.current.removed.map((r) => r.id)).toEqual(['l2']));
    expect(toast).toHaveBeenLastCalledWith('신대 레이크파크 1단지 103동 매물을 다시 담았어요.');
  });

  it('reports a failed removal and a failed undo instead of failing silently', async () => {
    const error = new ApiError(500, {
      code: 'INTERNAL_ERROR',
      message: '일시적인 오류가 발생했습니다.',
    });
    const mutateAsync = vi
      .fn<(vars: FavoriteToggle) => Promise<unknown>>()
      .mockRejectedValueOnce(error) // remove fails
      .mockResolvedValueOnce(undefined) // remove ok
      .mockRejectedValueOnce(error); // undo fails
    const { result } = renderHook(() => useFavoriteRemoval(mutateAsync, '단지를'));

    await act(() => result.current.remove({ id: 'c1', name: '연향 센트럴' }));
    expect(toast).toHaveBeenLastCalledWith({
      message: '일시적인 오류가 발생했습니다.',
      tone: 'error',
    });
    expect(result.current.removed).toEqual([]);

    await act(() => result.current.remove({ id: 'c1', name: '연향 센트럴' }));
    expect(result.current.removed).toEqual([{ id: 'c1', name: '연향 센트럴' }]);
    await act(() => result.current.restore({ id: 'c1', name: '연향 센트럴' }));
    expect(toast).toHaveBeenLastCalledWith({
      message: '일시적인 오류가 발생했습니다.',
      tone: 'error',
    });
    // The way back stays open for a retry.
    expect(result.current.removed).toEqual([{ id: 'c1', name: '연향 센트럴' }]);
  });
});

describe('<FavoritesView>', () => {
  const renderView = () => {
    const env = setup((c) => {
      c.setQueryData(listKey, listingPage(favorites));
      c.setQueryData(complexKey, emptyComplexes);
    });
    render(<FavoritesView />, { wrapper: env.wrapper });
    return env;
  };
  const heart = (l: FavoriteListing) =>
    screen.getByRole('button', { name: `${nameOf(l)} 관심 매물에서 빼기` });

  it('moves keyboard focus to the next card when a favourite is removed', async () => {
    apiDelete.mockResolvedValue(undefined);
    apiGet.mockImplementation(() => new Promise(() => undefined)); // refetch never answers
    renderView();
    heart(first).focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: `${nameOf(first)} 관심 매물에서 빼기` }),
      ).toBeNull(),
    );
    expect(document.activeElement).toBe(heart(second));

    // Last card of the list: focus goes to the one before it.
    heart(third).focus();
    await userEvent.keyboard(' ');
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: `${nameOf(third)} 관심 매물에서 빼기` }),
      ).toBeNull(),
    );
    expect(document.activeElement).toBe(heart(second));

    // No card left: the persistent "되돌리기" takes it — never <body>.
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByText('아직 담아 둔 매물이 없어요')).toBeInTheDocument());
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toHaveTextContent('되돌리기');
  });

  it('keeps a way back on the page after the undo toast is gone', async () => {
    apiDelete.mockResolvedValue(undefined);
    apiPut.mockResolvedValue(undefined);
    apiGet.mockImplementation(() => new Promise(() => undefined));
    renderView();
    await userEvent.click(heart(first));
    await userEvent.click(heart(second));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));

    const notice = screen.getByRole('list', { name: '방금 관심 목록에서 뺀 항목' });
    expect(within(notice).getAllByRole('listitem')).toHaveLength(2);
    await userEvent.click(
      within(notice).getByRole('button', { name: `되돌리기: ${nameOf(first)}` }),
    );
    expect(apiPut).toHaveBeenCalledWith(`/me/favorites/listings/${first.id}`);
  });

  it('describes what the page does today (no price-change promise) and follows ?tab=', () => {
    const env = setup((c) => {
      c.setQueryData(listKey, listingPage([]));
      c.setQueryData(complexKey, emptyComplexes);
    });
    const { unmount } = render(<FavoritesView />, { wrapper: env.wrapper });
    expect(screen.getByText(/거래가 끝난 매물도 표시해 드려요/)).toBeInTheDocument();
    expect(screen.queryByText(/가격이 바뀌/)).toBeNull();
    expect(screen.getByRole('link', { name: /관심 매물/ })).toHaveAttribute('aria-current', 'page');
    unmount();

    nav.search = 'tab=complexes';
    render(<FavoritesView />, { wrapper: env.wrapper });
    expect(screen.getByRole('link', { name: /관심 단지/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('아직 담아 둔 단지가 없어요')).toBeInTheDocument();
  });

  it('switches tabs on the client: the URL changes without a navigation', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    renderView();
    await userEvent.click(screen.getByRole('link', { name: /관심 단지/ }));
    expect(push).toHaveBeenCalledWith(null, '', '/me/favorites?tab=complexes');
    push.mockRestore();
  });
});

describe('useMarkNotificationsRead', () => {
  const row = (id: string, readAt: string | null = null): Notification => ({
    id,
    type: 'PROPOSAL_RECEIVED',
    title: `알림 ${id}`,
    data: { dealRequestId: 'dr1' },
    readAt,
    createdAt: '2026-11-23T02:42:00Z',
  });
  const feed = (items: Notification[]): InfiniteData<NotificationPage> => ({
    pages: [{ items, nextCursor: null, unreadCount: items.filter((n) => !n.readAt).length }],
    pageParams: [null],
  });
  type Feed = InfiniteData<NotificationPage>;
  const seed = (c: QueryClient) => {
    c.setQueryData(meKeys.notificationFeed('all'), feed([row('n1'), row('n2'), row('n3', 'x')]));
    c.setQueryData(meKeys.notificationFeed('unread'), feed([row('n1'), row('n2')]));
    c.setQueryData(meKeys.notificationUnread, 2);
  };

  it('drops read rows from the "안 읽음" feed at once and refreshes that feed', async () => {
    const { client, wrapper } = setup(seed);
    const answer = deferred<{ updated: number; unreadCount: number }>();
    apiPost.mockReturnValueOnce(answer.promise);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper });

    act(() => result.current.mutate({ all: true }));
    // Optimistic: the unread list is empty (→ "읽지 않은 알림이 없어요"), the full list keeps its rows.
    await waitFor(() =>
      expect(client.getQueryData<Feed>(meKeys.notificationFeed('unread'))?.pages[0]?.items).toEqual(
        [],
      ),
    );
    const all = client.getQueryData<Feed>(meKeys.notificationFeed('all'))?.pages[0]?.items ?? [];
    expect(all).toHaveLength(3);
    expect(all.every((n) => !!n.readAt)).toBe(true);
    expect(client.getQueryData(meKeys.notificationUnread)).toBe(0);

    await act(async () => {
      answer.resolve({ updated: 2, unreadCount: 0 });
      await answer.promise;
    });
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: meKeys.notificationFeed('unread') }),
    );
  });

  it('removes a single opened row from the unread feed and restores everything on failure', async () => {
    const { client, wrapper } = setup(seed);
    const answer = deferred<undefined>();
    apiPost.mockReturnValueOnce(answer.promise);
    const { result } = renderHook(() => useMarkNotificationsRead(), { wrapper });

    act(() => result.current.mutate({ ids: ['n1'] }));
    const unreadIds = () =>
      client
        .getQueryData<Feed>(meKeys.notificationFeed('unread'))
        ?.pages[0]?.items.map((n) => n.id);
    await waitFor(() => expect(unreadIds()).toEqual(['n2']));
    expect(client.getQueryData(meKeys.notificationUnread)).toBe(1);

    await act(async () => {
      answer.reject(new ApiError(500, { code: 'INTERNAL_ERROR', message: '오류' }));
      await answer.promise.catch(() => undefined);
    });
    await waitFor(() => expect(unreadIds()).toEqual(['n1', 'n2']));
    expect(client.getQueryData(meKeys.notificationUnread)).toBe(2);
  });
});

describe('focus-safe controls', () => {
  it('<SoftButton> stays focusable and ignores activation while unavailable or busy', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<SoftButton onClick={onClick}>모두 읽음</SoftButton>);
    const button = screen.getByRole('button', { name: '모두 읽음' });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <SoftButton onClick={onClick} unavailable>
        모두 읽음
      </SoftButton>,
    );
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);

    rerender(
      <SoftButton onClick={onClick} busy>
        모두 읽음
      </SoftButton>,
    );
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(document.activeElement).toBe(button);
  });

  it('the marketing switch keeps its focus while the change is being saved', async () => {
    const profile: Profile = {
      id: 'u1',
      role: 'USER',
      status: 'ACTIVE',
      nickname: '순천살이',
      marketingOptIn: false,
    };
    const answer = deferred<Profile>();
    apiPatch.mockReturnValue(answer.promise);
    const { wrapper } = setup();
    render(<MarketingConsentCard profile={profile} />, { wrapper });
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(apiPatch).toHaveBeenCalledTimes(1));
    expect(toggle).not.toBeDisabled();
    expect(toggle).toHaveAttribute('aria-busy', 'true');
    expect(toggle).toBeChecked();
    expect(document.activeElement).toBe(toggle);
    // A second press while saving is ignored instead of queuing another request.
    await userEvent.keyboard(' ');
    expect(apiPatch).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer.resolve({
        ...profile,
        marketingOptIn: true,
        marketingOptInAt: '2026-11-23T05:02:00Z',
      });
      await answer.promise;
    });
    await waitFor(() => expect(toggle).not.toHaveAttribute('aria-busy'));
    expect(document.activeElement).toBe(toggle);
  });
});
