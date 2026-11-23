// Owned by the listings module team. Pure listing rules shared by the API and the frontends.
import {
  AssetType,
  BuildingUse,
  DealType,
  FloorClass,
  FloorDisplay,
  ListingStatus,
  type AssetType as AssetTypeValue,
  type BuildingUse as BuildingUseValue,
  type DealType as DealTypeValue,
  type FloorClass as FloorClassValue,
  type ListingStatus as ListingStatusValue,
} from '../enums/listing';

const FLOOR_CLASS_SHORT: Record<FloorClassValue, string> = {
  LOW: '저',
  MID: '중',
  HIGH: '고',
};

/**
 * 저/중/고층 class of a floor. Basements and the 1st floor are LOW, the top floor is HIGH,
 * otherwise thirds of the building height. Null when the floor is unknown.
 */
export function floorClassOf(
  floor: number | null | undefined,
  totalFloors: number | null | undefined,
): FloorClassValue | null {
  if (floor === null || floor === undefined) return null;
  if (floor <= 1) return FloorClass.LOW;
  if (!totalFloors || totalFloors < floor) return null;
  if (floor === totalFloors) return FloorClass.HIGH;
  const ratio = floor / totalFloors;
  if (ratio <= 1 / 3) return FloorClass.LOW;
  if (ratio <= 2 / 3) return FloorClass.MID;
  return FloorClass.HIGH;
}

/** "5/15층", "B1/3층", or "중/15층" when only the floor class may be shown. */
export function floorLabel(
  floor: number | null | undefined,
  totalFloors: number | null | undefined,
  display: FloorDisplay = FloorDisplay.EXACT,
): string | null {
  const total = totalFloors ? `${totalFloors}층` : null;
  if (floor === null || floor === undefined) return total ? `-/${total}` : null;
  let head: string;
  if (display === FloorDisplay.CLASS) {
    const cls = floorClassOf(floor, totalFloors);
    if (!cls) return total ? `-/${total}` : null;
    head = FLOOR_CLASS_SHORT[cls];
  } else {
    head = floor < 0 ? `B${-floor}` : String(floor);
  }
  return total ? `${head}/${total}` : `${head}층`;
}

export interface ListingPriceFields {
  salePrice?: number | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  presalePrice?: number | null;
  premium?: number | null;
}

/** Price fields that apply to each deal type; the others are stored and shown as null. */
export const DEAL_TYPE_PRICE_FIELDS: Record<DealTypeValue, readonly (keyof ListingPriceFields)[]> =
  {
    SALE: ['salePrice'],
    JEONSE: ['deposit'],
    MONTHLY: ['deposit', 'monthlyRent'],
    PRESALE: ['presalePrice', 'premium'],
  };

/** The five price fields with those that don't apply to `dealType` nulled out. */
export function applicablePrices(
  dealType: DealTypeValue,
  p: ListingPriceFields,
): Required<{ [K in keyof ListingPriceFields]: number | null }> {
  const keep = DEAL_TYPE_PRICE_FIELDS[dealType];
  const pick = (k: keyof ListingPriceFields): number | null =>
    keep.includes(k) ? (p[k] ?? null) : null;
  return {
    salePrice: pick('salePrice'),
    deposit: pick('deposit'),
    monthlyRent: pick('monthlyRent'),
    presalePrice: pick('presalePrice'),
    premium: pick('premium'),
  };
}

/** Sort/filter price key in 만원: 매매가, 분양가+프리미엄, or 보증금(전세금) for 전세/월세. */
export function priceSortOf(dealType: DealTypeValue, p: ListingPriceFields): number | null {
  switch (dealType) {
    case DealType.SALE:
      return p.salePrice ?? null;
    case DealType.PRESALE:
      return p.presalePrice === null || p.presalePrice === undefined
        ? null
        : p.presalePrice + (p.premium ?? 0);
    case DealType.JEONSE:
    case DealType.MONTHLY:
      return p.deposit ?? null;
  }
}

export interface ListingAreaFields {
  exclusiveArea?: number | null;
  supplyArea?: number | null;
  landArea?: number | null;
  totalFloorArea?: number | null;
}

/** Area used for search/sort (㎡): 전용 → 연면적 → 대지 → 공급. */
export function searchAreaOf(a: ListingAreaFields): number | null {
  return a.exclusiveArea ?? a.totalFloorArea ?? a.landArea ?? a.supplyArea ?? null;
}

/** Asset types that are buildings (everything except 토지). */
export function isBuildingAsset(assetType: AssetTypeValue): boolean {
  return assetType !== AssetType.LAND;
}

/**
 * 건축물 용도 implied by the site category where it is unambiguous (아파트, 오피스텔). 원룸·투룸,
 * 주택, 상업·업무 can be many uses (다가구/다세대/근린생활시설…), so the agent must state it.
 */
const IMPLIED_BUILDING_USE: Partial<Record<AssetTypeValue, BuildingUseValue>> = {
  APT: BuildingUse.APARTMENT,
  OFFICETEL: BuildingUse.OFFICETEL,
};

/** The 건축물 용도 to show: the stated one, else the one implied by the asset type, else null. */
export function effectiveBuildingUse(
  assetType: AssetTypeValue | null | undefined,
  buildingUse: BuildingUseValue | null | undefined,
): BuildingUseValue | null {
  if (buildingUse) return buildingUse;
  if (!assetType || !isBuildingAsset(assetType)) return null;
  return IMPLIED_BUILDING_USE[assetType] ?? null;
}

/**
 * Manual status changes an agency may make (POST /agency/listings/:id/status).
 * DRAFT → ACTIVE goes through /publish (validated); HIDDEN is set and cleared by admins only.
 */
export const AGENCY_STATUS_TRANSITIONS: Record<ListingStatusValue, readonly ListingStatusValue[]> =
  {
    DRAFT: [],
    ACTIVE: [ListingStatus.RESERVED, ListingStatus.CLOSED, ListingStatus.DRAFT],
    RESERVED: [ListingStatus.ACTIVE, ListingStatus.CLOSED, ListingStatus.DRAFT],
    CLOSED: [ListingStatus.DRAFT],
    HIDDEN: [],
  };

/** Statuses an agency can request through the status endpoint. */
export const AGENCY_SETTABLE_STATUSES = [
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
  ListingStatus.CLOSED,
  ListingStatus.DRAFT,
] as const;

export function canAgencyTransition(from: ListingStatusValue, to: ListingStatusValue): boolean {
  return AGENCY_STATUS_TRANSITIONS[from].includes(to);
}

/**
 * Statuses in which an agency may still edit the listing content. HIDDEN is excluded: an admin
 * hid it (e.g. 허위매물 신고) and its content is evidence until the admin un-hides it to DRAFT.
 */
export const AGENCY_EDITABLE_STATUSES: readonly ListingStatusValue[] = [
  ListingStatus.DRAFT,
  ListingStatus.ACTIVE,
  ListingStatus.RESERVED,
];
