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
  /**
   * Search / AI-answer-engine copy (lib/seo: titles, llms.txt, /about, JSON-LD). Never repeat the
   * service name here — every page derives it from `name`, so a rename stays one edit.
   */
  seo: {
    /** Short place name used in search titles: "순천 신대지구 아파트 매매·전세 시세". */
    regionShort: '순천',
    /** 시도 part of postal addresses (schema.org addressRegion). */
    addressRegion: '전남광주통합특별시',
    /** What the service is, in one sentence (llms.txt, /about, Organization JSON-LD). */
    summary:
      '순천시 아파트·분양권, 원룸·투룸, 주택, 상가·사무실, 토지 매물과 국토교통부 실거래가를 지도와 지역별 시세로 보여 주는 순천 지역 부동산 정보 서비스',
    /** Who publishes the listings. */
    publisher: '순천 지역 공인중개사무소(중개사 회원)',
    /** Search phrases the site is about (llms.txt, about page keywords). */
    keywords: [
      '순천 부동산',
      '순천 아파트 시세',
      '순천 아파트 실거래가',
      '순천 신대지구 아파트',
      '순천 원룸',
      '순천 상가 임대',
      '순천 토지 매매',
      '순천 공인중개사',
    ],
    /** Official profiles of the service (schema.org sameAs). Empty until they exist. */
    sameAs: [] as readonly string[],
  },
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
