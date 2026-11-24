import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalSearch } from './GlobalSearch';

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: '/',
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
}));

const searchAdmin = vi.hoisted(() => vi.fn());
vi.mock('../../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api')>()),
  searchAdmin,
}));

const RESULT = {
  query: '신대',
  listings: {
    total: 2,
    items: [
      { id: 'l1', listingNo: '26110001', title: '신대 레이크파크 1단지 103동 34평' },
      { id: 'l2', listingNo: '26110006', title: '신대 레이크파크 3단지 301동 39평' },
    ],
  },
  agencies: { total: 1, items: [{ id: 'a1', name: '신대중앙 공인중개사사무소' }] },
  users: { total: 0, items: [] },
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  nav.push.mockReset();
  nav.pathname = '/';
  nav.params = new URLSearchParams();
  searchAdmin.mockReset();
});

describe('<GlobalSearch>', () => {
  it('suggests matches while typing and opens the picked one', async () => {
    searchAdmin.mockResolvedValue(RESULT);
    render(<GlobalSearch />, { wrapper });
    const input = screen.getByRole('combobox', { name: '관리자 검색' });
    await userEvent.type(input, '신대');
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      '신대 레이크파크 1단지 103동 34평매물 26110001',
      '신대 레이크파크 3단지 301동 39평매물 26110006',
      '신대중앙 공인중개사사무소중개사',
      '‘신대’ 전체 결과 보기3건',
    ]);
    // debounced: one request for the final text, not one per keystroke
    expect(searchAdmin).toHaveBeenCalledTimes(1);
    expect(searchAdmin.mock.calls[0]![0]).toBe('신대');
    expect(searchAdmin.mock.calls[0]![2]).toBe(3);

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/agencies/a1');
    expect(input).toHaveValue('');
  });

  it('does not search below two characters', async () => {
    render(<GlobalSearch />, { wrapper });
    await userEvent.type(screen.getByRole('combobox', { name: '관리자 검색' }), '신');
    await act(() => new Promise((r) => setTimeout(r, 350)));
    expect(searchAdmin).not.toHaveBeenCalled();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('opens the results page on Enter', async () => {
    searchAdmin.mockResolvedValue(RESULT);
    render(<GlobalSearch />, { wrapper });
    await userEvent.type(
      screen.getByRole('combobox', { name: '관리자 검색' }),
      '  46150-2026  {Enter}',
    );
    expect(nav.push).toHaveBeenCalledWith('/search?q=46150-2026');
  });

  it('says so when nothing matches', async () => {
    const empty = { total: 0, items: [] };
    searchAdmin.mockResolvedValue({
      query: '없음',
      listings: empty,
      agencies: empty,
      users: empty,
    });
    render(<GlobalSearch />, { wrapper });
    await userEvent.type(screen.getByRole('combobox', { name: '관리자 검색' }), '없음');
    expect(await screen.findByText('‘없음’ 검색 결과가 없어요')).toBeInTheDocument();
  });

  it('mirrors the query of the results page without suggesting it again', async () => {
    nav.pathname = '/search';
    nav.params = new URLSearchParams({ q: '신대' });
    render(<GlobalSearch />, { wrapper });
    const input = screen.getByRole('combobox', { name: '관리자 검색' });
    await waitFor(() => expect(input).toHaveValue('신대'));
    await act(() => new Promise((r) => setTimeout(r, 350)));
    expect(searchAdmin).not.toHaveBeenCalled();
  });

  it('offers a link to the search page for phones', () => {
    render(<GlobalSearch />, { wrapper });
    expect(screen.getByRole('link', { name: '통합 검색' })).toHaveAttribute('href', '/search');
  });
});
