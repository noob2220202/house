import {
  COMPLEX_ASSET_TYPES,
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  DealType,
  LISTING_STATUS_LABEL,
  ListingStatus,
} from '@house/shared';
import { dealKindOf, photoKindForAsset, type DealKind, type PhotoKind } from '@house/ui';
import { ROUTES } from '@/config/nav';
import {
  formatDateShort,
  formatDealPrice,
  formatFloor,
  formatPriceRange,
  formatPyeong,
} from '@/lib/format';
import { ROOM_TYPE_LABEL, listingDisplayName } from '@/lib/api/schemas/listing';
import type { FavoriteComplex, ListingSummary } from '../schemas';

/** Card name parts: the display name, then the lighter 동 / 방 종류. */
export function listingNameParts(listing: ListingSummary): { title: string; subtitle?: string } {
  const subtitle =
    listing.dong ?? (listing.roomType ? ROOM_TYPE_LABEL[listing.roomType] : undefined);
  return { title: listingDisplayName(listing), subtitle: subtitle ?? undefined };
}

/** "신대 레이크파크 1단지 103동" — accessible / toast name of a listing card. */
export function listingFullName(listing: ListingSummary): string {
  const { title, subtitle } = listingNameParts(listing);
  return subtitle ? `${title} ${subtitle}` : title;
}

/** Headline amount of a listing in 만원 (분양권 = 분양가 + 프리미엄, same as the backend `priceSort`). */
export function listingHeadlineAmount(listing: ListingSummary): number | null {
  switch (listing.dealType) {
    case DealType.SALE:
      return listing.salePrice ?? null;
    case DealType.PRESALE:
      return listing.presalePrice === null || listing.presalePrice === undefined
        ? null
        : listing.presalePrice + (listing.premium ?? 0);
    default:
      return listing.deposit ?? null;
  }
}

export function listingPriceText(listing: ListingSummary): string {
  return formatDealPrice({
    dealType: listing.dealType,
    price: listing.dealType === DealType.MONTHLY ? null : listingHeadlineAmount(listing),
    deposit: listing.deposit,
    monthlyRent: listing.monthlyRent,
  });
}

/** Short facts under the title: 아파트 → 평 · 층 · 향, 그 외 → 위치 · 층 · 준공년. */
export function listingMeta(listing: ListingSummary): string[] {
  const floor = formatFloor({
    floor: listing.floor,
    totalFloors: listing.totalFloors,
    floorClass: listing.floorClass ?? undefined,
  });
  const inComplex = COMPLEX_ASSET_TYPES.includes(listing.assetType) && !!listing.complexId;
  const area = listing.supplyArea ?? listing.exclusiveArea;
  const parts: (string | null | undefined)[] = inComplex
    ? [
        area ? formatPyeong(area) : null,
        floor,
        listing.direction && DIRECTION_LABEL[listing.direction],
      ]
    : [
        listing.locationNote ?? listing.emdName,
        floor,
        listing.builtYear ? `${listing.builtYear}년` : null,
      ];
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0);
}

/** A listing that is no longer on the market (거래완료 / 숨김) — shown with a status label. */
export function listingInactiveLabel(listing: ListingSummary): string | null {
  if (listing.status === ListingStatus.CLOSED) return LISTING_STATUS_LABEL.CLOSED;
  if (listing.status === ListingStatus.HIDDEN || listing.status === ListingStatus.DRAFT)
    return '광고 종료';
  return null;
}

/** Foot text of an off-market card, shown where live listings carry the 실매물 확인 badge. */
export function listingInactiveNote(listing: ListingSummary): string | null {
  if (listing.status === ListingStatus.CLOSED) return '거래가 끝난 매물이에요';
  if (listing.status === ListingStatus.HIDDEN || listing.status === ListingStatus.DRAFT)
    return '광고가 끝난 매물이에요';
  return null;
}

export interface ListingCardModel {
  href: string;
  deal: DealKind;
  dealLabel: string;
  price: string;
  premium?: number;
  title: string;
  subtitle?: string;
  meta: string[];
  /** 실매물 확인 date — only while the listing is live (never next to 거래완료 / 광고 종료). */
  verifiedDate?: string;
  brokerCount?: number;
  placeholder: PhotoKind;
  photoUrl: string | null;
  photoAlt: string;
  /** 거래완료 / 광고 종료, or null while the listing is live. */
  inactiveLabel: string | null;
  /** Sentence for the card foot of an off-market listing, or null while it is live. */
  inactiveNote: string | null;
  /** 계약중 */
  reserved: boolean;
}

/** Maps the API listing summary to the props of `<ListingCard>` (+ photo / status extras). */
export function toListingCardModel(listing: ListingSummary): ListingCardModel {
  const name = listingFullName(listing);
  const { title, subtitle } = listingNameParts(listing);
  const inactiveLabel = listingInactiveLabel(listing);
  return {
    href: ROUTES.listing(listing.id),
    deal: dealKindOf(listing.dealType),
    dealLabel: DEAL_TYPE_LABEL[listing.dealType],
    price: listingPriceText(listing),
    premium:
      listing.dealType === DealType.PRESALE &&
      listing.premium !== null &&
      listing.premium !== undefined
        ? listing.premium
        : undefined,
    title,
    subtitle,
    meta: listingMeta(listing),
    verifiedDate:
      listing.verifiedAt && !inactiveLabel ? formatDateShort(listing.verifiedAt) : undefined,
    brokerCount: listing.agencyCount > 0 ? listing.agencyCount : undefined,
    placeholder: photoKindForAsset(listing.assetType),
    photoUrl: listing.coverPhotoUrl ?? null,
    photoAlt: `${name} 대표 사진`,
    inactiveLabel,
    inactiveNote: listingInactiveNote(listing),
    reserved: listing.status === ListingStatus.RESERVED,
  };
}

/** One-line summary for compact rows: "매매 4억 4,500 · 34평 · 고/25층". */
export function listingOneLiner(listing: ListingSummary): string {
  return [
    `${DEAL_TYPE_LABEL[listing.dealType]} ${listingPriceText(listing)}`,
    ...listingMeta(listing).slice(0, 2),
  ].join(' · ');
}

// ---------- complexes ----------

/** "1,412세대 · 2019년 · 25·34·41평" (분양 단지: "2027.03 입주"). */
export function complexMeta(complex: FavoriteComplex): string {
  const parts: string[] = [];
  if (complex.households) parts.push(`${complex.households.toLocaleString('ko-KR')}세대`);
  if (complex.builtYear) parts.push(`${complex.builtYear}년`);
  else if (complex.moveInYm) parts.push(`${complex.moveInYm} 입주`);
  if (complex.pyeongLabels.length > 0) parts.push(`${complex.pyeongLabels.join('·')}평`);
  return parts.join(' · ');
}

/** Headline price range of a complex: 매매 first, then 분양권, then 전세. */
export function complexHeadlinePrice(
  complex: FavoriteComplex,
): { deal: DealKind; label: string; text: string } | null {
  if (complex.salePrice)
    return {
      deal: 'sale',
      label: '매매',
      text: formatPriceRange(complex.salePrice.min, complex.salePrice.max),
    };
  if (complex.presalePrice)
    return {
      deal: 'presale',
      label: '분양권',
      text: formatPriceRange(complex.presalePrice.min, complex.presalePrice.max),
    };
  if (complex.jeonsePrice)
    return {
      deal: 'jeonse',
      label: '전세',
      text: formatPriceRange(complex.jeonsePrice.min, complex.jeonsePrice.max),
    };
  return null;
}

export function complexListingTotal(complex: FavoriteComplex): number {
  if (!complex.counts) return complex.activeListingCount ?? 0;
  const { presale, sale, jeonse, monthly } = complex.counts;
  return presale + sale + jeonse + monthly;
}
