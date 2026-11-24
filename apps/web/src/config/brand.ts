/**
 * THE brand config. Service name decided on 2026-11-24: 순천부동산 (the mark SVG is still the
 * abstract placeholder).
 * To rebrand: change the values here and in apps/admin/src/config/brand.ts, the mark SVG in
 * packages/ui/src/brand/BrandMark.tsx (and --brand colours in packages/ui/src/styles/tokens.css if
 * the colour changes). Korean particles after the name are written for a final consonant
 * (순천부동산"은"); check them if the name changes.
 */
export const BRAND = {
  /** Wordmark text. */
  name: '순천부동산',
  /** Service descriptor used in titles: "{name} | {tagline}". */
  tagline: '공인중개사 공동중개 플랫폼',
  /** One-line description (footer, meta description default). */
  description: '순천 공인중개사들이 함께 만드는 공동중개 부동산 서비스',
  /** Utility-bar slogan. */
  slogan: '순천 공인중개사들이 함께 올리는 공동중개 매물',
  /** Service region (display). */
  region: '순천시',
  regionFull: '전라남도 순천시',
  /** 동네TV channel name. */
  tvName: '순천 동네TV',
  /** Browser theme colour (= --brand). */
  themeColor: '#1D4FF2',
  locale: 'ko_KR',
} as const;

export type Brand = typeof BRAND;
