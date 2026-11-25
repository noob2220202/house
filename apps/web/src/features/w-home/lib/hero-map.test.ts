import { DEFAULT_MAP_CENTER } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { kakaoMetresPerPx } from '@/lib/map/kakao-level';
import {
  HERO_KAKAO_LEVEL,
  HERO_MAP_FRAME,
  HERO_STATIC_CARD,
  HERO_STATIC_INSETS,
  HERO_STATIC_TOP_BAR,
} from '../config';
import {
  chipWidth,
  fitCenter,
  fitKakaoLevel,
  fitMetresPerPx,
  geoBox,
  heroCandidates,
  highlightCandidate,
  kakaoHeroLayout,
  projectToFrame,
  staticHeroLayout,
  type HeroRegionChip,
  type HeroRegionInput,
  type Rect,
} from './hero-map';

// Real 순천 coordinates (법정동 / 지구 centroids, as the API sends them).
const REGIONS: HeroRegionInput[] = [
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
    avgPricePerPyeong: 940,
  },
  {
    code: 'oc',
    name: '오천지구',
    emdName: '오천동',
    lat: 34.927,
    lng: 127.506,
    listingCount: 201,
    avgPricePerPyeong: null,
  },
  {
    code: 'wj',
    name: '왕지동',
    emdName: '왕지동',
    lat: 34.97,
    lng: 127.53,
    listingCount: 154,
    avgPricePerPyeong: null,
  },
  {
    code: 'sh',
    name: '석현동',
    emdName: '석현동',
    lat: 34.969,
    lng: 127.483,
    listingCount: 121,
    avgPricePerPyeong: null,
  },
  {
    code: 'sw',
    name: '선월지구',
    emdName: '해룡면 선월리',
    lat: 34.92,
    lng: 127.57,
    listingCount: 97,
    avgPricePerPyeong: null,
  },
  {
    code: 'dy',
    name: '덕연동',
    emdName: '덕연동',
    lat: 34.949,
    lng: 127.502,
    listingCount: 88,
    avgPricePerPyeong: null,
  },
];
const byCode = (code: string) => REGIONS.find((r) => r.code === code)!;

const CHIP_H = 36;
const chipRect = (c: HeroRegionChip, on: boolean, toPx = (x: number, y: number) => ({ x, y })) => {
  const p = toPx(c.x, c.y);
  const per =
    on && c.avgPricePerPyeong ? `${c.avgPricePerPyeong.toLocaleString('ko-KR')}만/평` : null;
  const w = chipWidth(c.name, c.count, per);
  return { x: p.x - w / 2, y: p.y - CHIP_H / 2, width: w, height: CHIP_H };
};
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The chips keep the real compass relations of their regions (east is right, north is up). */
function expectRealGeography(chips: readonly HeroRegionChip[]) {
  for (const a of chips)
    for (const b of chips) {
      if (a === b) continue;
      if (a.lng < b.lng) expect(a.x, `${a.name} west of ${b.name}`).toBeLessThan(b.x);
      if (a.lat > b.lat) expect(a.y, `${a.name} north of ${b.name}`).toBeLessThan(b.y);
    }
}

describe('hero map geometry', () => {
  it('takes the busiest regions with coordinates as candidates', () => {
    const regions = [...REGIONS, { ...byCode('yh'), code: 'nan', lat: Number.NaN }];
    const c = heroCandidates(regions, 3);
    expect(c.map((r) => r.code)).toEqual(['yh', 'sd', 'jr']);
    expect(heroCandidates([])).toEqual([]);
  });

  it('builds the bounding box of the regions', () => {
    expect(geoBox(REGIONS)).toEqual({ swLat: 34.92, swLng: 127.483, neLat: 34.97, neLng: 127.57 });
    expect(geoBox([])).toBeNull();
  });

  it('projects with the same scale on both axes, north up', () => {
    const c = { lat: 34.95, lng: 127.52 };
    const size = { width: 600, height: 540 };
    const origin = projectToFrame(c, c, 10, size);
    expect(origin).toEqual({ x: 300, y: 270 });
    // 1 km east and 1 km north at 10 m/px → 100 px right / up.
    const east = projectToFrame(
      { lat: c.lat, lng: c.lng + 1000 / (111_320 * Math.cos((c.lat * Math.PI) / 180)) },
      c,
      10,
      size,
    );
    const north = projectToFrame({ lat: c.lat + 1000 / 110_950, lng: c.lng }, c, 10, size);
    expect(east.x - origin.x).toBeCloseTo(100, 0);
    expect(origin.y - north.y).toBeCloseTo(100, 0);
  });

  it('fits the box into the inset area and centres it there', () => {
    const box = geoBox(REGIONS)!;
    const size = HERO_MAP_FRAME;
    const insets = HERO_STATIC_INSETS;
    const mpp = fitMetresPerPx(box, size, insets);
    const center = fitCenter(box, insets, mpp);
    const sw = projectToFrame({ lat: box.swLat, lng: box.swLng }, center, mpp, size);
    const ne = projectToFrame({ lat: box.neLat, lng: box.neLng }, center, mpp, size);
    // Inside the insets, touching them on the limiting axis.
    expect(sw.x).toBeGreaterThanOrEqual(insets.left - 0.5);
    expect(ne.x).toBeLessThanOrEqual(size.width - insets.right + 0.5);
    expect(ne.y).toBeGreaterThanOrEqual(insets.top - 0.5);
    expect(sw.y).toBeLessThanOrEqual(size.height - insets.bottom + 0.5);
    const touches = Math.abs(sw.x - insets.left) < 0.5 || Math.abs(ne.y - insets.top) < 0.5;
    expect(touches).toBe(true);
    // The box centre sits at the centre of the inset area, not of the frame.
    const mid = projectToFrame(
      { lat: (box.swLat + box.neLat) / 2, lng: (box.swLng + box.neLng) / 2 },
      center,
      mpp,
      size,
    );
    expect(mid.x).toBeCloseTo((insets.left + size.width - insets.right) / 2, 1);
    expect(mid.y).toBeCloseTo((insets.top + size.height - insets.bottom) / 2, 1);
  });

  it('picks the closest Kakao level that fits, within the hero range', () => {
    const box = geoBox(REGIONS)!;
    const size = { width: 600, height: 540 };
    const insets = { top: 110, right: 56, bottom: 30, left: 56 };
    const level = fitKakaoLevel(box, size, insets, 1);
    expect(kakaoMetresPerPx(level)).toBeGreaterThanOrEqual(fitMetresPerPx(box, size, insets));
    expect(kakaoMetresPerPx(level - 1)).toBeLessThan(fitMetresPerPx(box, size, insets));
    // A single point zooms in only to the minimum span; a whole province clamps to the max level.
    const one = geoBox([REGIONS[0]!])!;
    expect(fitKakaoLevel(one, size, insets)).toBe(HERO_KAKAO_LEVEL.MIN);
    const far = geoBox([REGIONS[0]!, { lat: 37.5, lng: 127 }])!;
    expect(fitKakaoLevel(far, size, insets)).toBe(HERO_KAKAO_LEVEL.MAX);
  });

  it("highlights the featured listing's region, else the busiest", () => {
    expect(highlightCandidate(REGIONS, '해룡면 신대리')).toBe('sd');
    expect(highlightCandidate(REGIONS, '조례동')).toBe('jr');
    expect(highlightCandidate(REGIONS, '없는 동')).toBe('yh');
    expect(highlightCandidate([], null)).toBeNull();
  });
});

describe('static hero layout', () => {
  const toPx = (x: number, y: number) => ({
    x: (x / 100) * HERO_MAP_FRAME.width,
    y: (y / 100) * HERO_MAP_FRAME.height,
  });

  it('places chips at their real relative positions, in % of the frame', () => {
    const { chips, onCode } = staticHeroLayout(REGIONS, { featuredEmdName: '해룡면 신대리' });
    expect(onCode).toBe('sd');
    expect(chips.length).toBeGreaterThanOrEqual(5);
    expect(chips.map((c) => c.count)).toEqual([...chips.map((c) => c.count)].sort((a, b) => b - a));
    for (const c of chips) {
      expect(c.x).toBeGreaterThan(0);
      expect(c.x).toBeLessThan(100);
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(100);
      expect(c).toMatchObject({ lat: byCode(c.code).lat, lng: byCode(c.code).lng });
    }
    expectRealGeography(chips);
  });

  it('keeps chips off the top bar, the featured card and each other', () => {
    const { chips, onCode } = staticHeroLayout(REGIONS, { hasCard: true });
    expect(chips.length).toBeGreaterThanOrEqual(5);
    const rects = chips.map((c) => chipRect(c, c.code === onCode, toPx));
    for (const r of rects) {
      expect(intersects(r, HERO_STATIC_TOP_BAR)).toBe(false);
      expect(intersects(r, HERO_STATIC_CARD)).toBe(false);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(intersects(rects[i]!, rects[j]!)).toBe(false);
    expectRealGeography(chips);
  });

  it('drops a region that would sit on a busier one and keeps the top five for narrow layouts', () => {
    const twin = {
      ...byCode('yh'),
      code: 'twin',
      name: '연향 옆',
      lat: 34.9441,
      lng: 127.5221,
      listingCount: 300,
    };
    const { chips } = staticHeroLayout([...REGIONS, twin]);
    expect(chips.some((c) => c.code === 'twin')).toBe(false);
    expect(chips.some((c) => c.code === 'yh')).toBe(true);
    expect(chips.slice(0, 5).every((c) => !c.wideOnly)).toBe(true);
    expect(chips.slice(5).every((c) => c.wideOnly)).toBe(true);
  });

  it('is empty without regions', () => {
    expect(staticHeroLayout([])).toEqual({ chips: [], onCode: null });
  });
});

describe('kakao hero layout', () => {
  it('still shows the real city (no chips) when there are no regions yet', () => {
    const layout = kakaoHeroLayout([], {
      size: { width: 600, height: 540 },
      insets: { top: 80, right: 20, bottom: 20, left: 20 },
      obstacles: [],
    });
    expect(layout).toEqual({
      chips: [],
      onCode: null,
      center: { ...DEFAULT_MAP_CENTER },
      level: HERO_KAKAO_LEVEL.EMPTY,
    });
  });

  const size = { width: 600, height: 540 };
  const top: Rect = { x: 20, y: 20, width: 560, height: 44 };
  const card: Rect = { x: 20, y: 350, width: 316, height: 170 };
  const copyright: Rect = { x: 410, y: 510, width: 190, height: 30 };
  const insets = { top: 90, right: 56, bottom: 30, left: 56 };

  it('fits the regions at a hero level and puts each chip at its real coordinate', () => {
    const layout = kakaoHeroLayout(REGIONS, {
      size,
      insets,
      card,
      obstacles: [top, card, copyright],
      featuredEmdName: '해룡면 신대리',
    })!;
    expect(layout.level).toBeGreaterThanOrEqual(HERO_KAKAO_LEVEL.MIN);
    expect(layout.level).toBeLessThanOrEqual(HERO_KAKAO_LEVEL.MAX);
    expect(layout.chips.length).toBeGreaterThanOrEqual(4);
    expect(layout.onCode).toBe('sd');
    const mpp = kakaoMetresPerPx(layout.level);
    const rects = layout.chips.map((c) => {
      const p = projectToFrame({ lat: c.lat, lng: c.lng }, layout.center, mpp, size);
      expect(c.x).toBeCloseTo(p.x, 6);
      expect(c.y).toBeCloseTo(p.y, 6);
      return chipRect(c, c.code === layout.onCode);
    });
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(size.width);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(size.height);
      for (const ob of [top, card, copyright]) expect(intersects(r, ob)).toBe(false);
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++)
        expect(intersects(rects[i]!, rects[j]!)).toBe(false);
    expectRealGeography(layout.chips);
  });

  it('centres on the regions when nothing is in the way', () => {
    const layout = kakaoHeroLayout(REGIONS, { size, insets, obstacles: [] })!;
    const box = geoBox(REGIONS)!;
    expect(layout.center.lat).toBeGreaterThan(box.swLat);
    expect(layout.center.lat).toBeLessThan(box.neLat);
    expect(layout.center.lng).toBeGreaterThan(box.swLng);
    expect(layout.center.lng).toBeLessThan(box.neLng);
    expect(layout.chips.length).toBeGreaterThanOrEqual(5);
  });

  it('falls back to the busiest placed chip when the featured region is hidden', () => {
    // A card over the whole lower half hides 신대지구 (south-east of the centre).
    const big: Rect = { x: 0, y: 300, width: 600, height: 240 };
    const layout = kakaoHeroLayout(REGIONS, {
      size,
      insets,
      obstacles: [top, big],
      featuredEmdName: '해룡면 신대리',
    })!;
    expect(layout.chips.length).toBeGreaterThan(0);
    if (!layout.chips.some((c) => c.code === 'sd'))
      expect(layout.onCode).toBe(layout.chips[0]!.code);
  });

  it('returns null before the frame has a size', () => {
    expect(
      kakaoHeroLayout(REGIONS, { size: { width: 0, height: 0 }, insets, obstacles: [] }),
    ).toBeNull();
    expect(
      kakaoHeroLayout([], { size: { width: 0, height: 0 }, insets, obstacles: [] }),
    ).toBeNull();
  });
});
