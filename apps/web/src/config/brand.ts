/**
 * THE brand config. Service name decided by the owner on 2026-11-24: 순천부동산지도 (the mark SVG
 * is still the abstract placeholder).
 * To rebrand: change the values here and in apps/admin/src/config/brand.ts, the mark SVG in
 * packages/ui/src/brand/BrandMark.tsx (and --brand colours in packages/ui/src/styles/tokens.css if
 * the colour changes). Put Korean particles after the name with `josa()` so they follow the
 * name's final sound (순천부동산지도"는").
 */
export const BRAND = {
  /** Wordmark text. */
  name: '순천부동산지도',
  /** Service descriptor used in titles: "{name} | {tagline}". */
  tagline: '공인중개사 공동중개 플랫폼',
  /** One-line description (footer, meta description default). */
  description: '순천 공인중개사들이 함께 만드는 공동중개 부동산 서비스',
  /** Utility-bar slogan. */
  slogan: '순천 공인중개사들이 함께 올리는 공동중개 매물',
  /** Service region (display). */
  region: '순천시',
  regionFull: '전남광주통합특별시 순천시',
  /** 동네TV channel name. */
  tvName: '순천 동네TV',
  /** Browser theme colour (= --brand). */
  themeColor: '#1D4FF2',
  locale: 'ko_KR',
} as const;

export type Brand = typeof BRAND;

/**
 * Appends the Korean particle that fits the word's final sound: josa('순천부동산지도', '은', '는')
 * → '순천부동산지도는'. `withFinal` is used after a final consonant, `withoutFinal` otherwise.
 */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasFinal = isHangul && (last - 0xac00) % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}
