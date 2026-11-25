import { AssetType, DealType } from '@house/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeSummarySchema, listingItemSchema } from '../../api/schemas';
import { HeroMap } from './HeroMap';

const env = vi.hoisted(() => ({ kakaoMapKey: '', apiMock: true, isProd: false, siteUrl: '' }));
vi.mock('@/config/env', () => ({ env }));
const loadKakaoMaps = vi.hoisted(() => vi.fn());
vi.mock('@/components/map/kakao', () => ({ loadKakaoMaps }));

const summary = homeSummarySchema.parse({
  regionName: '순천시',
  listingCount: 1677,
  agencyCount: 86,
  regions: [
    {
      code: 'yh',
      name: '연향동',
      emdName: '연향동',
      lat: 34.944,
      lng: 127.522,
      listingCount: 412,
      avgPricePerPyeong: 1090,
    },
    {
      code: 'sd',
      name: '신대지구',
      emdName: '해룡면 신대리',
      lat: 34.9335,
      lng: 127.556,
      listingCount: 318,
      avgPricePerPyeong: 1180,
    },
    {
      code: 'jr',
      name: '조례동',
      emdName: '조례동',
      lat: 34.9585,
      lng: 127.5245,
      listingCount: 286,
    },
    {
      code: 'oc',
      name: '오천지구',
      emdName: '오천동',
      lat: 34.927,
      lng: 127.506,
      listingCount: 201,
    },
    { code: 'wj', name: '왕지동', emdName: '왕지동', lat: 34.97, lng: 127.53, listingCount: 154 },
    { code: 'sh', name: '석현동', emdName: '석현동', lat: 34.969, lng: 127.483, listingCount: 121 },
  ],
});
const regionsByCode = new Map(summary.regions.map((r) => [r.code, r]));
const featured = listingItemSchema.parse({
  id: 'l1',
  assetType: AssetType.APT,
  dealType: DealType.SALE,
  salePrice: 44500,
  complexName: '신대 테스트 단지',
  emdName: '해룡면 신대리',
});

/** Landmarks the old illustrated map printed on invented geography. */
const FAKE_LABELS = ['동천', '조례호수공원', '봉화산', '순천역', '순천만국가정원', '순천만'];

const chipLinks = (root: HTMLElement) =>
  within(root)
    .getAllByRole('link')
    .filter((a) => a.getAttribute('aria-label')?.endsWith('지도에서 보기'));

// jsdom has no layout: give the frame, its top bar and the card the design's sizes.
const FRAME = { left: 0, top: 0, width: 600, height: 540 };
function fakeRect(this: Element): DOMRect {
  const kind = this.getAttribute('data-hero-obstacle');
  const r =
    kind === 'top'
      ? { left: 20, top: 20, width: 560, height: 44 }
      : kind === 'card'
        ? { left: 20, top: 350, width: 316, height: 170 }
        : FRAME;
  return {
    ...r,
    x: r.left,
    y: r.top,
    right: r.left + r.width,
    bottom: r.top + r.height,
    toJSON: () => r,
  };
}

describe('HeroMap', () => {
  beforeEach(() => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(fakeRect);
    env.kakaoMapKey = '';
    loadKakaoMaps.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('without a key: abstract art, real-data chips as links, no invented landmarks', () => {
    const { container } = render(<HeroMap summary={summary} featured={featured} />);
    const region = screen.getByRole('region', { name: /동네별 매물 지도/ });
    for (const text of FAKE_LABELS) expect(region.textContent).not.toContain(text);
    const chips = chipLinks(region);
    expect(chips.length).toBeGreaterThanOrEqual(4);
    for (const a of chips) {
      const code = a.getAttribute('data-region')!;
      const r = regionsByCode.get(code)!;
      expect(a.getAttribute('href')).toBe(
        `/map/apt?c=${encodeURIComponent(`${r.lat},${r.lng}`)}&z=15`,
      );
      expect(a.style.left).toMatch(/%$/);
    }
    // Highlighted chip = the featured listing's 동, with its 평당가.
    expect(screen.getByRole('link', { name: /신대지구 매물 318건/ })).toHaveTextContent(
      '1,180만/평',
    );
    expect(screen.getByRole('link', { name: /지도에서 찾기/ })).toHaveAttribute('href', '/map/apt');
    expect(screen.getByRole('link', { name: /상세 보기/ })).toBeInTheDocument();
    expect(container.querySelector('[data-hero-map]')).toHaveAttribute('data-hero-map', 'static');
    expect(container.querySelector('svg[viewBox="0 0 600 540"]')).toBeInTheDocument();
    expect(loadKakaoMaps).not.toHaveBeenCalled();
  });

  it('server HTML has the chip links (also with a key) and hydrates without a mismatch', async () => {
    env.kakaoMapKey = 'test-key';
    loadKakaoMaps.mockReturnValue(new Promise(() => {}));
    const html = renderToString(<HeroMap summary={summary} featured={featured} />);
    for (const text of FAKE_LABELS) expect(html).not.toContain(text);
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.appendChild(host);
    const ssrChips = chipLinks(host);
    expect(ssrChips.length).toBeGreaterThanOrEqual(4);
    expect(host.querySelector('[data-hero-map]')).toHaveAttribute('data-hero-map', 'static');
    expect(loadKakaoMaps).not.toHaveBeenCalled();

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recoverable: unknown[] = [];
    const root = await act(async () =>
      hydrateRoot(host, <HeroMap summary={summary} featured={featured} />, {
        onRecoverableError: (e) => recoverable.push(e),
      }),
    );
    expect(recoverable).toEqual([]);
    expect(error).not.toHaveBeenCalled();
    // Same nodes kept (no client re-render of the chips).
    expect(chipLinks(host)).toEqual(ssrChips);
    act(() => root.unmount());
    host.remove();
  });

  it('with a key: keeps the static map when the SDK fails (bad key / 401)', async () => {
    env.kakaoMapKey = 'test-key';
    loadKakaoMaps.mockRejectedValue(new Error('Failed to load the Kakao Maps SDK'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<HeroMap summary={summary} featured={featured} />);
    // Deferred: nothing is requested during the first render.
    expect(loadKakaoMaps).not.toHaveBeenCalled();
    await waitFor(() => expect(loadKakaoMaps).toHaveBeenCalledWith('test-key'));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(container.querySelector('[data-hero-map]')).toHaveAttribute('data-hero-map', 'static');
    expect(chipLinks(screen.getByRole('region')).length).toBeGreaterThanOrEqual(4);
    warn.mockRestore();
  });

  it('with a key: swaps to a non-interactive Kakao map with chips at real coordinates', async () => {
    env.kakaoMapKey = 'test-key';
    const sdk = fakeKakao();
    loadKakaoMaps.mockResolvedValue(sdk.maps);
    const { container } = render(<HeroMap summary={summary} featured={featured} />);
    await waitFor(() => expect(sdk.mapOptions).toHaveLength(1));
    expect(sdk.mapOptions[0]).toMatchObject({
      draggable: false,
      scrollwheel: false,
      disableDoubleClickZoom: true,
      keyboardShortcuts: false,
    });
    expect(sdk.map!.setZoomable).toHaveBeenCalledWith(false);
    expect(sdk.map!.setCopyrightPosition).toHaveBeenCalledWith(
      sdk.maps.CopyrightPosition.BOTTOMRIGHT,
      true,
    );
    // Until the tiles are in, the static version stays.
    expect(container.querySelector('[data-hero-map]')).toHaveAttribute('data-hero-map', 'static');
    expect(sdk.overlays).toHaveLength(0);

    act(() => sdk.fire('tilesloaded'));

    expect(container.querySelector('[data-hero-map]')).toHaveAttribute('data-hero-map', 'kakao');
    // The art stays under the (opaque) map so the fade-in never shows an empty card.
    expect(container.querySelector('svg[viewBox="0 0 600 540"]')).toBeInTheDocument();
    expect(sdk.overlays.length).toBeGreaterThanOrEqual(4);
    const live = sdk.overlays.filter((o) => o.attached);
    const chips = chipLinks(screen.getByRole('region'));
    expect(chips).toHaveLength(live.length);
    for (const o of live) {
      const a = o.content.querySelector('a')!;
      const r = regionsByCode.get(a.getAttribute('data-region')!)!;
      // At the region's real coordinate, not a projected % position.
      expect(o.position.getLat()).toBe(r.lat);
      expect(o.position.getLng()).toBe(r.lng);
      expect(a.style.left).toBe('');
      expect(o.clickable).toBe(true);
    }
    const region = screen.getByRole('region');
    for (const text of FAKE_LABELS) expect(region.textContent).not.toContain(text);
    expect(screen.getByRole('link', { name: /지도에서 찾기/ })).toBeInTheDocument();
  });
});

interface FakeOverlay {
  position: { getLat(): number; getLng(): number };
  content: HTMLElement;
  clickable?: boolean;
  attached: boolean;
}

function fakeKakao() {
  const listeners = new Map<string, () => void>();
  const mapOptions: Record<string, unknown>[] = [];
  const overlays: FakeOverlay[] = [];
  const state: { map: FakeMap | null; el: HTMLElement | null } = { map: null, el: null };

  class LatLng {
    constructor(
      private lat: number,
      private lng: number,
    ) {}
    getLat() {
      return this.lat;
    }
    getLng() {
      return this.lng;
    }
  }
  class FakeMap {
    setZoomable = vi.fn();
    setCopyrightPosition = vi.fn();
    relayout = vi.fn();
    setLevel = vi.fn();
    setCenter = vi.fn();
    constructor(el: HTMLElement, options: Record<string, unknown>) {
      mapOptions.push(options);
      state.map = this;
      state.el = el;
    }
  }
  class CustomOverlay {
    o: FakeOverlay;
    constructor(options: Omit<FakeOverlay, 'attached'> & { map?: unknown }) {
      this.o = { ...options, attached: !!options.map };
      overlays.push(this.o);
      if (options.map) state.el!.appendChild(options.content);
    }
    setMap(map: unknown) {
      this.o.attached = !!map;
      if (!map) this.o.content.remove();
    }
    setZIndex() {}
    setPosition() {}
  }
  const maps = {
    load: (cb: () => void) => cb(),
    Map: FakeMap,
    LatLng,
    CustomOverlay,
    CopyrightPosition: { BOTTOMLEFT: 0, BOTTOMRIGHT: 1 },
    event: {
      addListener: (_t: object, type: string, h: () => void) => listeners.set(type, h),
      removeListener: (_t: object, type: string) => listeners.delete(type),
    },
  };
  return {
    maps,
    mapOptions,
    overlays,
    get map() {
      return state.map;
    },
    fire: (type: string) => listeners.get(type)?.(),
  };
}
