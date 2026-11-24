import { BannerTargeting } from '@house/shared';
import type { AdminBanner } from '../api/schemas';

/** "신대지구" → "신대" — only used to keep long target lists short. */
const shortRegion = (name: string) => name.replace(/(지구|동|면|리)$/, '') || name;

/**
 * Target summary of a list row: 전체 · "신대지구" · "조례동·연향동" · "신대·선월·연향" (3+ names are
 * shortened, more than three collapse into "외 N") · "레이크파크 1단지 외 1".
 */
export function targetSummary(
  banner: Pick<AdminBanner, 'targeting' | 'targetRegions' | 'targetComplexes'>,
): string {
  if (banner.targeting === BannerTargeting.REGIONS) {
    const names = banner.targetRegions.map((r) => r.name);
    if (names.length === 0) return '지역 미지정';
    if (names.length <= 2) return names.join('·');
    const head = names.slice(0, 3).map(shortRegion).join('·');
    return names.length > 3 ? `${head} 외 ${names.length - 3}` : head;
  }
  if (banner.targeting === BannerTargeting.COMPLEXES) {
    const names = banner.targetComplexes.map((c) => c.name);
    if (names.length === 0) return '단지 미지정';
    return names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : (names[0] as string);
  }
  return '전체';
}

/** Second line of a row: the advertiser — for office banners titled with the office name, its 대표. */
export function advertiserLine(
  banner: Pick<AdminBanner, 'title' | 'advertiserName' | 'agency'>,
): string {
  const rep = banner.agency?.representativeName;
  if (banner.agency && rep && (!banner.advertiserName || banner.title.includes(banner.agency.name)))
    return `대표 ${rep}`;
  return banner.advertiserName ?? banner.agency?.name ?? '광고주 미지정';
}
