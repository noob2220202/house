import { HomeSectionKey as K } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { DESIGN_ORDER, isSectionVisible, resolveHomeLayout } from './home-layout';

const keys = (setting: unknown) => resolveHomeLayout(setting).map((s) => s.key);

describe('resolveHomeLayout', () => {
  it('keeps the design order without a setting (or with an invalid one)', () => {
    expect(keys(undefined)).toEqual(DESIGN_ORDER);
    expect(keys({ sections: [] })).toEqual(DESIGN_ORDER);
    expect(keys({ sections: [{ key: 'NOPE', visible: true }] })).toEqual(DESIGN_ORDER);
    expect(resolveHomeLayout(null).every((s) => s.visible)).toBe(true);
  });

  it('follows the operator order and visibility, unlisted sections after them', () => {
    const layout = resolveHomeLayout({
      sections: [
        { key: K.NEW_LISTINGS, visible: true },
        { key: K.POPULAR_COMPLEXES, visible: false },
        { key: K.APP_BAND, visible: true },
      ],
    });
    expect(layout.slice(0, 4).map((s) => s.key)).toEqual([
      K.HERO_SEARCH,
      K.NEW_LISTINGS,
      K.POPULAR_COMPLEXES,
      K.APP_BAND,
    ]);
    expect(layout.slice(4).map((s) => s.key)).toEqual([
      K.CATEGORY_TILES,
      K.MAIN_BANNER,
      K.DEAL_REQUEST_CTA,
      K.LOCAL_VIDEOS,
      K.FEATURED_AGENCIES,
      K.NOTICES,
    ]);
    expect(isSectionVisible(layout, K.POPULAR_COMPLEXES)).toBe(false);
    expect(isSectionVisible(layout, K.CATEGORY_TILES)).toBe(true);
  });

  it('pins the locked hero search first and visible', () => {
    const layout = resolveHomeLayout({
      sections: [
        { key: K.CATEGORY_TILES, visible: true },
        { key: K.HERO_SEARCH, visible: false },
      ],
    });
    expect(layout[0]).toEqual({ key: K.HERO_SEARCH, visible: true });
    expect(layout.filter((s) => s.key === K.HERO_SEARCH)).toHaveLength(1);
  });
});
