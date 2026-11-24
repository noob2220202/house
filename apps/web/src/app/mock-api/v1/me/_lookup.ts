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
