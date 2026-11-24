import { AssetType, DEFAULT_SGG_CODE, type ComplexSummary } from '@house/shared';
import type { FavoriteComplex, ListingSummary } from '@/features/w-me/schemas';
import { findMockListingSummary } from '../listings/_catalog';
import { COMPLEX_SUMMARIES } from '../map/_fixtures';
import { COMPLEXES, LISTINGS } from './_fixtures';

/**
 * Card lookups of the my-page mocks. The my-page catalog (mockdata.md rows, incl. a 거래완료 one)
 * comes first; any other listing / complex id the site shows (map, home, agency pages) is accepted
 * too, so a heart clicked anywhere can be stored and listed here.
 */
export function findMeListing(id: string): ListingSummary | undefined {
  return LISTINGS.find((l) => l.id === id) ?? findMockListingSummary(id)?.listing;
}

type ComplexCard = Omit<FavoriteComplex, 'favoritedAt'>;

export function findMeComplex(id: string): ComplexCard | undefined {
  const own = COMPLEXES.find((c) => c.id === id);
  if (own) return own;
  const c = COMPLEX_SUMMARIES.find((x) => x.id === id);
  return c
    ? {
        id: c.id,
        name: c.name,
        emdName: c.emdName,
        households: c.households,
        builtYear: c.builtYear,
        moveInYm: c.moveInYm,
        pyeongLabels: c.pyeongLabels,
        salePrice: c.salePrice,
        jeonsePrice: c.jeonsePrice,
        presalePrice: c.presalePrice,
        counts: c.counts,
        pricePerPyeong: c.pricePerPyeong,
        coverPhotoUrl: c.coverPhotoUrl,
      }
    : undefined;
}

/** 순천시청 — fallback position of my-page complex fixtures that carry no coordinates. */
const CITY_CENTER = { lat: 34.9506, lng: 127.4872 };

/** My-page complex card → the backend `ComplexSummary` (`FavoriteComplexItem.complex`). */
export function toComplexSummaryWire(c: ComplexCard): ComplexSummary {
  const counts = c.counts;
  return {
    id: c.id,
    name: c.name,
    assetType: AssetType.APT,
    roadAddress: null,
    jibunAddress: null,
    sggCode: DEFAULT_SGG_CODE,
    emdCode: null,
    emdName: c.emdName ?? null,
    lat: CITY_CENTER.lat,
    lng: CITY_CENTER.lng,
    households: c.households ?? null,
    buildings: null,
    builtYear: c.builtYear ?? null,
    approvalDate: null,
    activeListingCount: counts
      ? counts.presale + counts.sale + counts.jeonse + counts.monthly
      : (c.activeListingCount ?? 0),
    favoriteCount: 0,
    viewCount: 0,
  };
}
