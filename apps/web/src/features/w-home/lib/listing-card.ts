import { AssetType, DEAL_TYPE_LABEL, DIRECTION_LABEL, DealType } from '@house/shared';
import { dealKindOf, photoKindForAsset, type DealKind, type PhotoKind } from '@house/ui';
import { ROUTES } from '@/config/nav';
import { formatAreaPair } from '@/lib/format/area';
import { formatDateShort } from '@/lib/format/date';
import { formatFloor } from '@/lib/format/floor';
import { formatDealPrice } from '@/lib/format/price';
import { ROOM_TYPE_LABEL, listingDisplayName } from '@/lib/api/schemas/listing';
import type { ListingItem } from '../api/schemas';

export interface ListingCardModel {
  id: string;
  href: string;
  deal: DealKind;
  dealLabel: string;
  /** "4억 4,500" · "500/42" */
  price: string;
  /** 분양권 premium (만원). */
  premium?: number;
  title: string;
  /** 동 / room type / location hint shown lighter after the title. */
  subtitle?: string;
  meta: string[];
  /** "26.11.22" */
  verifiedDate?: string;
  brokerCount: number;
  placeholder: PhotoKind;
  coverPhotoUrl: string | null;
  /** Accessible summary: "신대 레이크파크 1단지 103동 매매 4억 4,500". */
  label: string;
}

/** "85㎡(26평)": the legal unit first, 평 alongside (계량법). */
const area = (sqm: number) => formatAreaPair(sqm);

/** 분양권 headline = 분양가 + 프리미엄; everything else comes from `formatDealPrice`. */
export function listingPriceText(l: ListingItem): string {
  if (l.dealType === DealType.PRESALE) {
    if (l.presalePrice === null || l.presalePrice === undefined) {
      return formatDealPrice({ dealType: l.dealType, price: l.salePrice });
    }
    return formatDealPrice({ dealType: l.dealType, price: l.presalePrice + (l.premium ?? 0) });
  }
  return formatDealPrice({
    dealType: l.dealType,
    price: l.dealType === DealType.SALE ? l.salePrice : l.deposit,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
}

function roomTypeOf(l: ListingItem): string | undefined {
  if (l.roomType) return ROOM_TYPE_LABEL[l.roomType];
  if (l.rooms === null || l.rooms === undefined) return undefined;
  return l.rooms <= 1 ? '원룸' : l.rooms === 2 ? '투룸' : `방 ${l.rooms}`;
}

function floorText(l: ListingItem): string {
  return formatFloor({
    floor: l.floor,
    totalFloors: l.totalFloors,
    floorClass: l.floorClass ?? undefined,
    showExact: l.floor !== null && l.floor !== undefined,
  });
}

/**
 * Short facts under the title, per asset type ("전용 85㎡(26평) · 고/25층 · 남향", "투룸 · 3/4층 ·
 * 2019년 준공"). Areas are the 전용면적 (토지: 대지면적) in ㎡ with 평 alongside.
 */
export function listingMeta(l: ListingItem): string[] {
  const out: (string | undefined | false)[] = [];
  const direction = l.direction ? DIRECTION_LABEL[l.direction] : undefined;
  switch (l.assetType) {
    case AssetType.ONEROOM:
      out.push(roomTypeOf(l), floorText(l), !!l.builtYear && `${l.builtYear}년 준공`);
      break;
    case AssetType.LAND:
      out.push(!!l.landArea && area(l.landArea));
      break;
    case AssetType.HOUSE:
      out.push(
        !!l.exclusiveArea && `전용 ${area(l.exclusiveArea)}`,
        l.rooms ? `방 ${l.rooms}` : undefined,
        direction,
      );
      break;
    case AssetType.COMMERCIAL:
      out.push(!!l.exclusiveArea && `전용 ${area(l.exclusiveArea)}`, floorText(l), direction);
      break;
    default: {
      // 아파트·오피스텔: the 전용면적 (the 명시사항 figure); the 공급면적 only without it.
      const size = l.exclusiveArea
        ? `전용 ${area(l.exclusiveArea)}`
        : l.supplyArea
          ? `공급 ${area(l.supplyArea)}`
          : undefined;
      out.push(size, floorText(l), direction);
    }
  }
  return out.filter((v): v is string => typeof v === 'string' && v !== '');
}

/** Maps an API listing to the props of `<ListingCard>` / the mobile mini card. */
export function toListingCard(l: ListingItem): ListingCardModel {
  const title = listingDisplayName(l);
  const subtitle = l.dong || l.locationNote || undefined;
  const price = listingPriceText(l);
  const dealLabel = DEAL_TYPE_LABEL[l.dealType];
  return {
    id: l.id,
    href: ROUTES.listing(l.id),
    deal: dealKindOf(l.dealType),
    dealLabel,
    price,
    premium:
      l.dealType === DealType.PRESALE && l.premium !== null && l.premium !== undefined
        ? l.premium
        : undefined,
    title,
    subtitle,
    meta: listingMeta(l),
    verifiedDate: l.verifiedAt ? formatDateShort(l.verifiedAt) : undefined,
    brokerCount: l.agencyCount,
    placeholder: photoKindForAsset(l.assetType),
    coverPhotoUrl: l.coverPhotoUrl ?? null,
    label: [title, l.dong, dealLabel, price].filter(Boolean).join(' '),
  };
}
