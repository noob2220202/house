import { HomeSectionKey, homeLayoutSettingSchema } from '@house/shared';

/**
 * HOME_LAYOUT (D9, `GET /site-settings/public`): which home sections show, in which order.
 *
 * - Without a (valid) setting the page keeps the approved design order (`DESIGN_ORDER`).
 * - Listed keys come first, in their order; keys the setting does not list (e.g. a section added
 *   in a later release) keep their design position after them and stay visible — the shared
 *   schema's rule, so the site never loses a section by omission.
 * - 히어로 검색 is locked in the admin editor: always first and always shown.
 */

/** Section order of the approved home design (Main.dc.html / MobileHome.dc.html). */
export const DESIGN_ORDER: readonly HomeSectionKey[] = [
  HomeSectionKey.HERO_SEARCH,
  HomeSectionKey.CATEGORY_TILES,
  HomeSectionKey.MAIN_BANNER,
  HomeSectionKey.POPULAR_COMPLEXES,
  HomeSectionKey.NEW_LISTINGS,
  HomeSectionKey.DEAL_REQUEST_CTA,
  HomeSectionKey.LOCAL_VIDEOS,
  HomeSectionKey.FEATURED_AGENCIES,
  HomeSectionKey.NOTICES,
  HomeSectionKey.APP_BAND,
];

export interface HomeSection {
  key: HomeSectionKey;
  visible: boolean;
}

/** Ordered sections (hidden ones included, so neighbours can anchor to their slot). */
export function resolveHomeLayout(setting: unknown): HomeSection[] {
  const parsed = homeLayoutSettingSchema.safeParse(setting);
  const listed = parsed.success ? parsed.data.sections : [];
  const seen = new Set(listed.map((s) => s.key));
  const ordered: HomeSection[] = [
    ...listed,
    ...DESIGN_ORDER.filter((key) => !seen.has(key)).map((key) => ({ key, visible: true })),
  ];
  const rest = ordered.filter((s) => s.key !== HomeSectionKey.HERO_SEARCH);
  return [{ key: HomeSectionKey.HERO_SEARCH, visible: true }, ...rest];
}

export function isSectionVisible(layout: readonly HomeSection[], key: HomeSectionKey): boolean {
  return layout.find((s) => s.key === key)?.visible ?? true;
}
