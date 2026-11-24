// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { BANNER_SLOT_SPECS, BannerSlot } from '@house/shared';
import { describe, expect, it } from 'vitest';

/** D4: MAIN_HERO frame 1240×220 on desktop (upload 2×), 358×160 on mobile (upload 3×). */
const css = (file: string) => readFileSync(file, 'utf8');
const ratio = (w: number, h: number) => w / h;
const ratiosIn = (source: string) =>
  [...source.matchAll(/aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/g)].map((m) => [
    Number(m[1]),
    Number(m[2]),
  ]);

describe('home banner frame (DECISIONS D4)', () => {
  const ui = css(
    path.resolve(
      import.meta.dirname,
      '../../../../../../../packages/ui/src/components/AdFrame.module.css',
    ),
  );
  const carousel = css(path.resolve(import.meta.dirname, 'BannerCarousel.module.css'));
  const hero = BANNER_SLOT_SPECS[BannerSlot.MAIN_HERO];

  it('desktop frame is 1240×220, the upload size at 2×', () => {
    expect(/\.main\s*\{\s*aspect-ratio:\s*1240\s*\/\s*220;/.test(ui)).toBe(true);
    expect(ratio(hero.pc.width, hero.pc.height)).toBeCloseTo(ratio(1240, 220), 5);
    expect(hero.pc).toEqual({ width: 1240 * 2, height: 220 * 2 });
  });

  it('mobile frame (≤ 720px) is 358×160, the upload size at 3×', () => {
    const mobileBlock =
      /@media \(max-width: 720px\)\s*\{\s*\.root \.frame\s*\{\s*aspect-ratio:\s*358\s*\/\s*160;/;
    expect(mobileBlock.test(carousel)).toBe(true);
    expect(hero.mobile).toEqual({ width: 358 * 3, height: 160 * 3 });
    // The carousel sets no other ratio for the main variant (only the strip has its own).
    const others = ratiosIn(carousel).filter(([w, h]) => !(w === 358 && h === 160));
    for (const [w, h] of others) {
      const strip = BANNER_SLOT_SPECS[BannerSlot.MAIN_STRIP];
      expect([
        ratio(strip.pc.width, strip.pc.height),
        ratio(strip.mobile!.width, strip.mobile!.height),
      ]).toContainEqual(ratio(w!, h!));
    }
  });
});
