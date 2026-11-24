import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Modal } from '@house/ui';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Popup } from '../../api/schemas';
import { popupStorageKey } from '../../lib/popup';
import { NoticePopupHost } from './NoticePopupHost';

const state = vi.hoisted(() => ({ pathname: '/', popups: [] as Popup[] }));
const fetchPopups = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }));
vi.mock('next/image', () => ({
  default: ({ alt, src }: ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={typeof src === 'string' ? src : undefined} />
  ),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/dynamic', async () => {
  const mod = await import('./NoticePopup');
  return { default: () => mod.NoticePopup };
});
vi.mock('../../api/client', () => ({
  fetchPopups,
  homeKeys: { popups: (page: string) => ['popups', 'serve', { page }] },
}));

const popup = (id: string, over: Partial<Popup> = {}): Popup => ({
  id,
  title: `공지 ${id}`,
  imageUrl: `/media/popups/${id}.jpg`,
  linkUrl: null,
  newWindow: false,
  dismissDays: 7,
  updatedAt: '2026-11-10T09:00:00+09:00',
  ...over,
});

function mount(extra?: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NoticePopupHost />
      {extra}
    </QueryClientProvider>,
  );
}

/** A page modal (any `@house/ui` Modal / ConfirmDialog) the test opens and closes. */
let setOtherModal: (open: boolean) => void = () => undefined;
function OtherModal({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  setOtherModal = setOpen;
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="사무소 나가기">
      확인
    </Modal>
  );
}

const notice = () => screen.queryByRole('dialog', { name: /^공지:/ });

describe('NoticePopupHost', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    state.pathname = '/';
    state.popups = [popup('a'), popup('b', { dismissDays: 0, linkUrl: '/support/report' })];
    fetchPopups.mockReset();
    fetchPopups.mockImplementation(() => Promise.resolve({ items: state.popups, updatedAt: null }));
  });

  it('asks for the popups of the current page and shows them one at a time', async () => {
    mount();
    const dialog = await screen.findByRole('dialog', { name: '공지: 공지 a' });
    expect(fetchPopups).toHaveBeenCalledWith('MAIN', expect.anything());
    expect(dialog).toHaveTextContent('1 / 2');
    expect(screen.getByRole('button', { name: '일주일 동안 보지 않기' })).toBeInTheDocument();
    // Non-blocking card: the page keeps focus (the hero search stays usable).
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByRole('button', { name: '닫기' })).not.toHaveFocus();
  });

  it('"N일 동안 보지 않기" is stored per popup id + version and reveals the next popup', async () => {
    const first = mount();
    fireEvent.click(await screen.findByRole('button', { name: '일주일 동안 보지 않기' }));
    const until = Number(window.localStorage.getItem(popupStorageKey(state.popups[0]!)));
    expect(until).toBeGreaterThan(Date.now() + 6 * 86_400_000);

    // second popup: no dismiss option (dismissDays 0), links to the stored URL
    const second = await screen.findByRole('dialog', { name: '공지: 공지 b' });
    // the queue counter moves on instead of restarting at "1 / 1"
    expect(second).toHaveTextContent('2 / 2');
    expect(second).toHaveTextContent('공지 2개 중 2번째');
    expect(screen.queryByRole('button', { name: /보지 않기/ })).not.toBeInTheDocument();
    expect(second.querySelector('a')).toHaveAttribute('href', '/support/report');
    first.unmount();

    // next visit: "a" stays hidden, an edited "a" shows again
    mount();
    await screen.findByRole('dialog', { name: '공지: 공지 b' });
    expect(screen.queryByRole('dialog', { name: '공지: 공지 a' })).not.toBeInTheDocument();
  });

  it('plain close (button or Esc) hides the popup for the session only', async () => {
    state.popups = [popup('a')];
    const first = mount();
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem(popupStorageKey(state.popups[0]!))).not.toBeNull();
    first.unmount();

    window.sessionStorage.clear(); // new tab session
    mount();
    expect(await screen.findByRole('dialog', { name: '공지: 공지 a' })).toBeInTheDocument();
  });

  it('shows an edited popup again and skips excluded areas', async () => {
    state.popups = [popup('a')];
    window.localStorage.setItem(
      popupStorageKey(popup('a', { updatedAt: 'old' })),
      String(Date.now() + 1e9),
    );
    const first = mount();
    expect(await screen.findByRole('dialog', { name: '공지: 공지 a' })).toBeInTheDocument();
    first.unmount();

    fetchPopups.mockClear();
    state.pathname = '/agent/listings';
    mount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetchPopups).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('waits while another modal is open and never stacks on top of it', async () => {
    state.popups = [popup('a')];
    mount(<OtherModal initiallyOpen />);
    await waitFor(() => expect(fetchPopups).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.getByRole('dialog', { name: '사무소 나가기' })).toBeInTheDocument();
    expect(notice()).not.toBeInTheDocument();

    act(() => setOtherModal(false));
    expect(await screen.findByRole('dialog', { name: '공지: 공지 a' })).toBeInTheDocument();
  });

  it('steps aside (without being closed) when a modal opens over it', async () => {
    state.popups = [popup('a'), popup('b')];
    mount(<OtherModal />);
    await screen.findByRole('dialog', { name: '공지: 공지 a' });

    act(() => setOtherModal(true));
    await waitFor(() => expect(notice()).not.toBeInTheDocument());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // Esc belongs to the modal now: it closes the modal, not the (hidden) popup.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(window.sessionStorage.length).toBe(0);

    // Same popup, same queue position once the modal is gone.
    const back = await screen.findByRole('dialog', { name: '공지: 공지 a' });
    expect(back).toHaveTextContent('1 / 2');
  });

  it('maps other pages to their popup target', async () => {
    state.pathname = '/listing/abc';
    mount();
    await screen.findByRole('dialog');
    expect(fetchPopups).toHaveBeenCalledWith('LISTING_DETAIL', expect.anything());
  });
});
