import { AssetType } from '@house/shared';
import { BRAND } from '@/config/brand';
import type { MapAssetSlug } from '@/config/nav';
import type { SeoRegion } from './schemas';

/**
 * Search landing pages per 지역 × 매물 종류: `/suncheon/<지역 slug>/<asset>`, e.g.
 * `/suncheon/해룡면-신대리/apt` ("순천 신대지구 아파트 매매·전세 시세"). The asset segment is the
 * map's asset slug (`/map/<asset>`), the 지역 slug the 법정동 label with "-" for spaces.
 */
export const SEO_ROUTES = {
  /** 순천 지역별 시세 (index of every landing). */
  regions: '/suncheon',
  region: (region: Pick<SeoRegion, 'emdName'>, asset: MapAssetSlug) =>
    `/suncheon/${regionSlug(region)}/${asset}`,
  about: '/about',
  report: '/reports/suncheon-apartment-trades',
  reportMonth: (ym: number) => `/reports/suncheon-apartment-trades/${ym}`,
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
} as const;

export interface LandingAsset {
  slug: MapAssetSlug;
  /** `assetTypes` of the map page with the same slug (features/w-map/config/assets.ts). */
  assetTypes: readonly AssetType[];
  /** Noun in copy: "아파트" / "원룸·투룸". */
  noun: string;
  /** Title / H1 tail after the place: "아파트 매매·전세 시세". */
  topic: string;
  /** Whether 단지 + 실거래 sections apply. */
  complexes: boolean;
}

export const LANDING_ASSETS: Record<MapAssetSlug, LandingAsset> = {
  apt: {
    slug: 'apt',
    assetTypes: [AssetType.APT, AssetType.OFFICETEL],
    noun: '아파트',
    topic: '아파트 매매·전세 시세',
    complexes: true,
  },
  oneroom: {
    slug: 'oneroom',
    assetTypes: [AssetType.ONEROOM],
    noun: '원룸·투룸',
    topic: '원룸·투룸 월세·전세 매물',
    complexes: false,
  },
  house: {
    slug: 'house',
    assetTypes: [AssetType.HOUSE],
    noun: '주택',
    topic: '주택 매매·전월세 매물',
    complexes: false,
  },
  commercial: {
    slug: 'commercial',
    assetTypes: [AssetType.COMMERCIAL],
    noun: '상가·사무실',
    topic: '상가·사무실 임대·매매 매물',
    complexes: false,
  },
  land: {
    slug: 'land',
    assetTypes: [AssetType.LAND],
    noun: '토지',
    topic: '토지 매매 매물',
    complexes: false,
  },
};
export const LANDING_ASSET_SLUGS = Object.keys(LANDING_ASSETS) as MapAssetSlug[];

/** Landing / map slug of a listing's asset type (오피스텔 → apt). */
export function assetSlugOf(assetType: AssetType): MapAssetSlug {
  return (
    LANDING_ASSET_SLUGS.find((slug) => LANDING_ASSETS[slug].assetTypes.includes(assetType)) ?? 'apt'
  );
}

export function isLandingAsset(value: string): value is MapAssetSlug {
  return Object.prototype.hasOwnProperty.call(LANDING_ASSETS, value);
}

/**
 * Well-known 택지지구 names people search for instead of the 법정 리 ("신대지구 아파트"), keyed
 * by region key. Only add a name when the 지구 lies within that one 리.
 */
export const DISTRICT_ALIASES: Readonly<Record<string, string>> = {
  /** 해룡면 신대리 — 신대지구 (광양만권 신대배후단지). */
  '1215037021': '신대지구',
  /** 해룡면 선월리 — 선월지구. */
  '1215037022': '선월지구',
};

/** "해룡면 신대리" → "해룡면-신대리"; "연향동" → "연향동". */
export function regionSlug(region: Pick<SeoRegion, 'emdName'>): string {
  return region.emdName.trim().replace(/\s+/g, '-');
}

/** Route param → slug (Next may hand over the percent-encoded form). */
export function decodeSlug(param: string): string {
  try {
    return decodeURIComponent(param).normalize('NFC');
  } catch {
    return param;
  }
}

export function findRegionBySlug<R extends Pick<SeoRegion, 'emdName'>>(
  regions: readonly R[],
  param: string,
): R | undefined {
  const slug = decodeSlug(param);
  return regions.find((r) => regionSlug(r) === slug);
}

/** Name used in titles: the 지구 alias, else the 법정동 label ("해룡면 신대리" / "연향동"). */
export function placeLabel(region: Pick<SeoRegion, 'code' | 'emdName'>): string {
  return DISTRICT_ALIASES[region.code] ?? region.emdName;
}

/** "순천 신대지구 아파트 매매·전세 시세" */
export function landingTitle(
  region: Pick<SeoRegion, 'code' | 'emdName'>,
  asset: MapAssetSlug,
): string {
  return `${BRAND.seo.regionShort} ${placeLabel(region)} ${LANDING_ASSETS[asset].topic}`;
}

export interface LandingCounts {
  listings: number;
  complexes: number;
  trades: number;
}

/** What the index says a landing page would show. 단지 / 실거래 only count for 아파트. */
export function landingCounts(region: SeoRegion, asset: MapAssetSlug): LandingCounts {
  const cfg = LANDING_ASSETS[asset];
  return {
    listings: cfg.assetTypes.reduce((n, t) => n + (region.listingCounts[t] ?? 0), 0),
    complexes: cfg.complexes ? region.complexCount : 0,
    trades: cfg.complexes ? region.saleTradeCount : 0,
  };
}

/** Thin-content guard: below this a landing page renders but stays out of the index. */
export const LANDING_MIN = {
  /** Listings for any asset type. */
  listings: 3,
  /** 아파트 without enough listings: at least one 단지 and this many 매매 실거래 (12 months). */
  trades: 5,
} as const;

export type LandingDecision =
  /** No data at all → 404. */
  | { kind: 'empty' }
  /** Same content as one 리 of this 읍·면 → canonical to that page (not indexed itself). */
  | { kind: 'duplicate'; canonical: SeoRegion }
  /** Too little to be useful → `noindex, follow`. */
  | { kind: 'thin' }
  | { kind: 'index' };

const sameCounts = (a: LandingCounts, b: LandingCounts) =>
  a.listings === b.listings && a.complexes === b.complexes && a.trades === b.trades;

/**
 * Decides whether a landing page exists and is indexable (no thin or duplicate pages): an 읍·면
 * whose data all comes from one of its 리 duplicates that 리's page.
 */
export function landingDecision(
  regions: readonly SeoRegion[],
  region: SeoRegion,
  asset: MapAssetSlug,
): LandingDecision {
  const counts = landingCounts(region, asset);
  if (counts.listings === 0 && counts.complexes === 0 && counts.trades === 0) {
    return { kind: 'empty' };
  }
  if (region.code.length === 8) {
    const children = regions.filter(
      (r) => r.code.length === 10 && r.code.startsWith(region.code),
    );
    const withData = children.filter((c) => {
      const n = landingCounts(c, asset);
      return n.listings + n.complexes + n.trades > 0;
    });
    const only = withData.length === 1 ? withData[0] : undefined;
    if (only && sameCounts(landingCounts(only, asset), counts)) {
      return { kind: 'duplicate', canonical: only };
    }
  }
  const enough =
    counts.listings >= LANDING_MIN.listings ||
    (counts.complexes > 0 && counts.trades >= LANDING_MIN.trades);
  return enough ? { kind: 'index' } : { kind: 'thin' };
}

/** Every indexable landing page of the index (sitemap, llms.txt, /suncheon). */
export function indexableLandings(
  regions: readonly SeoRegion[],
): { region: SeoRegion; asset: MapAssetSlug; counts: LandingCounts }[] {
  return regions.flatMap((region) =>
    LANDING_ASSET_SLUGS.flatMap((asset) =>
      landingDecision(regions, region, asset).kind === 'index'
        ? [{ region, asset, counts: landingCounts(region, asset) }]
        : [],
    ),
  );
}
