import { AssetType, DIRECTION_LABEL, DealType, formatPhone, normalizePhone } from '@house/shared';
import { dealKindOf, photoKindForAsset, type DealKind, type PhotoKind } from '@house/ui';
import {
  formatDateShort,
  formatDealPrice,
  formatFloor,
  formatPyeong,
  type DealPrice,
} from '@/lib/format';
import { listingDisplayName } from '@/lib/api/schemas/listing';
import type { AgencyListing, AgencySummary } from '../api/schemas';

/** Short specialty words used on chips, tags and markers (the shared labels are the long GNB ones). */
export const SPECIALTY_LABEL: Record<AssetType, string> = {
  APT: '아파트',
  OFFICETEL: '오피스텔',
  ONEROOM: '원룸·투룸',
  HOUSE: '주택',
  COMMERCIAL: '상가',
  LAND: '토지',
};

const NAME_SUFFIX =
  /\s*(공인중개사\s*사무소|부동산\s*중개\s*법인|부동산\s*중개|공인중개사|중개사무소|부동산)\s*$/;

/** "호수공원 공인중개사사무소" → "호수공원" (map marker / avatar). Falls back to the full name. */
export function shortAgencyName(name: string): string {
  const short = name.trim().replace(NAME_SUFFIX, '').trim();
  return short || name.trim();
}

/** Avatar initials: first `length` characters of the short name without spaces. */
export function agencyInitials(name: string, length = 1): string {
  return Array.from(shortAgencyName(name).replace(/\s+/g, '')).slice(0, length).join('');
}

/** `art` = the office illustration; the others are tinted initials. */
export type AvatarTone = 'art' | 'brand' | 'accent' | 'grey';
const TONES: readonly AvatarTone[] = ['art', 'brand', 'accent', 'grey'];

/** Stable avatar style per office (so the list does not reshuffle between renders). */
export function avatarTone(id: string): AvatarTone {
  // FNV-1a with a final mix: ids that differ by one character still spread over the tones.
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return TONES[(h >>> 0) % TONES.length] ?? 'brand';
}

/** "아파트 전문", "아파트·상가 전문" — from the registered specialties (max two). */
export function specialtyLabel(specialties: readonly AssetType[]): string | null {
  if (specialties.length === 0) return null;
  return `${specialties
    .slice(0, 2)
    .map((s) => SPECIALTY_LABEL[s])
    .join('·')} 전문`;
}

/** The office's own tagline, or one derived from its specialties. */
export function agencyTagline(
  agency: Pick<AgencySummary, 'tagline' | 'specialties'>,
): string | null {
  return agency.tagline?.trim() || specialtyLabel(agency.specialties);
}

const REGION_PREFIX = /^(전라남도|전남)\s+/;
const CITY_PREFIX = /^순천시\s+/;

type AddressLike = Pick<AgencySummary, 'roadAddress' | 'addressDetail'>;

/** "순천시 조례동 호수공원길 24, 1층" — road address + detail, without the province. */
export function fullAddress(agency: AddressLike): string {
  const road = agency.roadAddress.trim().replace(REGION_PREFIX, '');
  const detail = agency.addressDetail?.trim();
  return detail ? `${road}, ${detail}` : road;
}

/** List style without the city: "조례동 호수공원길 24, 1층". */
export function shortAddress(agency: AddressLike): string {
  return fullAddress(agency).replace(CITY_PREFIX, '');
}

/** 길찾기 link (Naver Map search by the office's public address). */
export function directionsUrl(agency: Pick<AgencySummary, 'roadAddress' | 'name'>): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(agency.roadAddress.trim())}`;
}

/** `tel:` href from any phone format; null when there is no dialable number. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = normalizePhone(phone);
  return /^\d{7,12}$/.test(digits) ? `tel:${digits}` : null;
}

/** "061-000-0000" */
export function displayPhone(phone: string): string {
  return formatPhone(phone) || phone;
}

// ---- listings ----------------------------------------------------------------------------------

/** Headline amounts of a listing. 분양권 = 분양가 + 프리미엄 unless a 매매가 is given. */
export function listingDealPrice(l: AgencyListing): DealPrice {
  if (l.dealType === DealType.MONTHLY)
    return { dealType: l.dealType, deposit: l.deposit ?? 0, monthlyRent: l.monthlyRent };
  if (l.dealType === DealType.JEONSE) return { dealType: l.dealType, price: l.deposit };
  if (l.dealType === DealType.PRESALE) {
    const total =
      l.salePrice ??
      (l.presalePrice !== null && l.presalePrice !== undefined
        ? l.presalePrice + (l.premium ?? 0)
        : null);
    return { dealType: l.dealType, price: total };
  }
  return { dealType: l.dealType, price: l.salePrice };
}

export function listingPriceText(l: AgencyListing): string {
  return formatDealPrice(listingDealPrice(l));
}

/** Area label per asset type: 토지 = 대지면적, otherwise 공급(없으면 전용) 평. */
export function listingAreaText(l: AgencyListing): string | null {
  const sqm =
    l.assetType === AssetType.LAND
      ? (l.landArea ?? l.supplyArea ?? l.exclusiveArea)
      : (l.supplyArea ?? l.exclusiveArea ?? l.landArea);
  return sqm ? formatPyeong(sqm) : null;
}

/** ["32평", "고/18층", "남향"] */
export function listingMeta(l: AgencyListing): string[] {
  const floor = formatFloor({
    floor: l.floor,
    totalFloors: l.totalFloors,
    floorClass: l.floorClass ?? undefined,
  });
  return [listingAreaText(l), floor || null, l.direction ? DIRECTION_LABEL[l.direction] : null]
    .filter((v): v is string => !!v)
    .slice(0, 3);
}

/** Card title: 단지명 → 건물명 → broker headline → kind word (the shared `listingDisplayName`). */
export const listingTitle = (l: AgencyListing): string => listingDisplayName(l);

export interface ListingCardModel {
  deal: DealKind;
  price: string;
  premium?: number;
  title: string;
  subtitle?: string;
  meta: string[];
  verifiedDate?: string;
  brokerCount?: number;
  placeholder: PhotoKind;
}

/** Maps an API listing to the presentational props of `ListingCard`. */
export function toListingCard(l: AgencyListing): ListingCardModel {
  return {
    deal: dealKindOf(l.dealType),
    price: listingPriceText(l),
    premium:
      l.dealType === DealType.PRESALE && l.premium !== null && l.premium !== undefined
        ? l.premium
        : undefined,
    title: listingTitle(l),
    subtitle: l.dong ?? undefined,
    meta: listingMeta(l),
    verifiedDate: l.verifiedAt ? formatDateShort(l.verifiedAt) : undefined,
    brokerCount: l.agencyCount > 1 ? l.agencyCount : undefined,
    placeholder: photoKindForAsset(l.assetType),
  };
}

/** "8분", "1시간 20분" */
export function formatResponseTime(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}시간 ${rest}분` : `${h}시간`;
}

/**
 * Fills `emdName` (cluster bubbles, card captions) from the 읍면동 facet of `GET /agencies/regions`
 * — the backend `AgencySummary` carries the code only. The longest matching code prefix wins.
 */
export function withEmdNames<T extends { emdCode?: string | null; emdName?: string | null }>(
  offices: readonly T[],
  regions: readonly { emdCode: string; name: string }[],
): T[] {
  if (regions.length === 0) return [...offices];
  const sorted = [...regions].sort((a, b) => b.emdCode.length - a.emdCode.length);
  return offices.map((o) => {
    if (o.emdName || !o.emdCode) return o;
    const code = o.emdCode;
    const hit = sorted.find((r) => code.startsWith(r.emdCode) || r.emdCode.startsWith(code));
    return hit ? { ...o, emdName: hit.name } : o;
  });
}
