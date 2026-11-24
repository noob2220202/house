import { HOME_SECTION_KEYS, type HomeLayout, type HomeSectionKey } from '../api/schemas';

export type HomeSection = HomeLayout['sections'][number];

/** Design order of the home page (Main.dc.html); the app band is off until the app ships. */
export const DEFAULT_HOME_SECTIONS: readonly HomeSection[] = HOME_SECTION_KEYS.map((key) => ({
  key,
  visible: key !== 'APP_BAND',
}));

/** Sections that cannot be hidden or moved away from the top. */
export const LOCKED_SECTIONS: readonly HomeSectionKey[] = ['HERO_SEARCH'];

/**
 * Makes a stored layout safe to edit: unknown / duplicate keys are dropped, sections that were
 * added to the product later are appended (hidden → visible per default), and locked sections are
 * forced to the top and visible.
 */
export function normalizeHomeLayout(stored: HomeLayout | null | undefined): HomeSection[] {
  const seen = new Set<HomeSectionKey>();
  const out: HomeSection[] = [];
  for (const section of stored?.sections ?? []) {
    if (!HOME_SECTION_KEYS.includes(section.key) || seen.has(section.key)) continue;
    seen.add(section.key);
    out.push({ key: section.key, visible: section.visible });
  }
  for (const section of DEFAULT_HOME_SECTIONS) {
    if (!seen.has(section.key)) out.push({ ...section });
  }
  const locked = LOCKED_SECTIONS.map((key) => ({ key, visible: true }));
  return [...locked, ...out.filter((sec) => !LOCKED_SECTIONS.includes(sec.key))];
}

/** Index range a section may move within (locked sections keep the first slots). */
export function canMoveSection(
  sections: readonly HomeSection[],
  index: number,
  delta: -1 | 1,
): boolean {
  const section = sections[index];
  if (!section || LOCKED_SECTIONS.includes(section.key)) return false;
  const target = index + delta;
  return target >= LOCKED_SECTIONS.length && target < sections.length;
}

export function sameLayout(a: readonly HomeSection[], b: readonly HomeSection[]): boolean {
  return (
    a.length === b.length && a.every((s, i) => s.key === b[i]?.key && s.visible === b[i]?.visible)
  );
}
