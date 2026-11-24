import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner } from '../../api/schemas';
import { BannerCarousel } from './BannerCarousel';

const post = vi.hoisted(() => vi.fn(() => Promise.resolve(undefined)));
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: { post },
}));
const impressions = () => post.mock.calls.map((c) => (c as unknown as [string])[0]);
vi.mock('next/image', () => ({
  getImageProps: ({ src, alt, sizes, loading }: Record<string, unknown>) => ({
    props: { src, alt, sizes, loading },
  }),
}));

type Entry = Pick<IntersectionObserverEntry, 'target' | 'isIntersecting' | 'intersectionRatio'>;
let observers: { callback: (entries: Entry[]) => void; targets: Element[] }[] = [];
const scrollTo = vi.fn();

class FakeObserver {
  private record: { callback: (entries: Entry[]) => void; targets: Element[] };
  constructor(callback: (entries: Entry[]) => void) {
    this.record = { callback, targets: [] };
    observers.push(this.record);
  }
  observe(el: Element) {
    this.record.targets.push(el);
  }
  unobserve(el: Element) {
    this.record.targets = this.record.targets.filter((t) => t !== el);
  }
  disconnect() {
    this.record.targets = [];
  }
}

const banner = (id: string, over: Partial<Banner> = {}): Banner => ({
  id,
  title: `배너 ${id}`,
  advertiserName: '[광고주]',
  imageUrl: `/media/banners/${id}.jpg`,
  mobileImageUrl: null,
  linkUrl: 'https://example.com/',
  agencyId: null,
  newWindow: false,
  ...over,
});

describe('BannerCarousel', () => {
  beforeEach(() => {
    observers = [];
    post.mockClear();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    scrollTo.mockReset();
    Element.prototype.scrollTo = scrollTo;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing without banners', () => {
    const { container } = render(<BannerCarousel banners={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('links every slide through the click-redirect endpoint with an AD label', () => {
    render(
      <BannerCarousel
        banners={[banner('t1'), banner('t2', { newWindow: true }), banner('t3', { linkUrl: null })]}
      />,
    );
    const first = screen.getByRole('link', { name: '광고: [광고주]: 배너 t1' });
    expect(first.getAttribute('href')).toMatch(/\/banners\/t1\/click$/);
    expect(first).toHaveAttribute('rel', 'sponsored');
    // inactive slides are inert → query hidden ones explicitly
    const second = screen.getByRole('link', { name: '광고: [광고주]: 배너 t2', hidden: true });
    expect(second).toHaveAttribute('target', '_blank');
    expect(second.getAttribute('rel')).toContain('noopener');
    // a banner without a link is not clickable
    expect(screen.queryByRole('link', { name: /배너 t3/, hidden: true })).not.toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('reports an impression once per banner, only when at least half visible', () => {
    render(<BannerCarousel banners={[banner('i1'), banner('i2')]} />);
    // One observer per slide (the shared `useAdImpression`).
    expect(observers).toHaveLength(2);
    const [a, b] = observers as [(typeof observers)[number], (typeof observers)[number]];
    const first = a.targets[0]!;
    const second = b.targets[0]!;
    act(() => {
      a.callback([{ target: first, isIntersecting: true, intersectionRatio: 0.3 }]);
      b.callback([{ target: second, isIntersecting: false, intersectionRatio: 0 }]);
    });
    expect(post).not.toHaveBeenCalled();
    act(() => {
      a.callback([{ target: first, isIntersecting: true, intersectionRatio: 1 }]);
      a.callback([{ target: first, isIntersecting: true, intersectionRatio: 1 }]);
    });
    expect(impressions()).toEqual(['/banners/i1/impression']);
    act(() => b.callback([{ target: second, isIntersecting: true, intersectionRatio: 0.8 }]));
    expect(impressions()).toEqual(['/banners/i1/impression', '/banners/i2/impression']);
  });

  it('moves with the arrow buttons and keys', () => {
    render(<BannerCarousel banners={[banner('n1'), banner('n2')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: '다음 광고' })[0]!);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '이전 광고' }));
    fireEvent.keyDown(screen.getByRole('region', { name: '광고' }), { key: 'ArrowRight' });
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it('names the advertiser of the slide on screen as chrome on the wide carousel only', () => {
    const { unmount } = render(
      <BannerCarousel banners={[banner('a1'), banner('a2', { advertiserName: null })]} />,
    );
    expect(screen.getByText('[광고주]')).toHaveAttribute('aria-hidden', 'true');
    unmount();
    render(<BannerCarousel banners={[banner('a3')]} variant="strip" />);
    expect(screen.queryByText('[광고주]')).not.toBeInTheDocument();
  });

  it('rotates on its own until the visitor pauses it or navigates by hand', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const rect = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockReturnValue({ top: 10, bottom: 200 } as DOMRect);
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    try {
      render(<BannerCarousel banners={[banner('r1'), banner('r2')]} />);
      act(() => void vi.advanceTimersByTime(6100));
      expect(scrollTo).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: '광고 자동 넘김 멈춤' }));
      act(() => void vi.advanceTimersByTime(13000));
      expect(scrollTo).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: '광고 자동 넘김 시작' }));
      act(() => void vi.advanceTimersByTime(6100));
      expect(scrollTo).toHaveBeenCalledTimes(2);
      // taking over with the arrows stops the rotation for good
      fireEvent.click(screen.getByRole('button', { name: '이전 광고' }));
      expect(scrollTo).toHaveBeenCalledTimes(3);
      act(() => void vi.advanceTimersByTime(13000));
      expect(scrollTo).toHaveBeenCalledTimes(3);
      expect(screen.getByRole('button', { name: '광고 자동 넘김 시작' })).toBeInTheDocument();
    } finally {
      rect.mockRestore();
      width.mockRestore();
      vi.useRealTimers();
    }
  });

  it('serves the mobile creative as an art-directed source of one lazy or eager image', () => {
    const { container, unmount } = render(
      <BannerCarousel
        banners={[banner('p1', { mobileImageUrl: '/media/banners/p1-m.jpg' }), banner('p2')]}
        eager
      />,
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[1]).toHaveAttribute('loading', 'lazy');
    const source = container.querySelector('picture source');
    expect(source).toHaveAttribute('media', '(max-width: 720px)');
    expect(source).toHaveAttribute('srcset', '/media/banners/p1-m.jpg');
    expect(container.querySelectorAll('picture')).toHaveLength(1);
    unmount();
    const lazy = render(<BannerCarousel banners={[banner('p3')]} />);
    expect(lazy.container.querySelector('img')).toHaveAttribute('loading', 'lazy');
  });

  it('announces slide changes only while the rotation is not automatic', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<BannerCarousel banners={[banner('l1'), banner('l2')]} />);
    const live = screen.getByText('광고 2개 중 1번째');
    expect(live).toHaveAttribute('aria-live', 'off');
    fireEvent.click(screen.getByRole('button', { name: '광고 자동 넘김 멈춤' }));
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('has no pager or arrows for a single banner', () => {
    render(<BannerCarousel banners={[banner('s1')]} variant="strip" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
