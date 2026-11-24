import {
  AssetType,
  BUILDING_USE_LABEL,
  BuildingUse,
  effectiveBuildingUse,
  isBuildingAsset,
} from '@house/shared';

/**
 * 건축물 용도 (건축물대장, 건축법 시행령 별표1) the broker picks for the ad's 「중개대상물 종류」.
 * The site category (원룸·투룸, 주택, 상업·업무) can be many uses, so the usual ones of each
 * category are offered first; every other use stays selectable below them.
 */
const COMMON_USES: Partial<Record<AssetType, readonly BuildingUse[]>> = {
  [AssetType.ONEROOM]: [
    BuildingUse.MULTI_FAMILY_HOUSE,
    BuildingUse.MULTIPLEX_HOUSE,
    BuildingUse.MULTI_UNIT_HOUSE,
    BuildingUse.DETACHED_HOUSE,
    BuildingUse.ROW_HOUSE,
    BuildingUse.OFFICETEL,
    BuildingUse.NEIGHBORHOOD_FACILITY_2,
    BuildingUse.DORMITORY,
  ],
  [AssetType.HOUSE]: [
    BuildingUse.DETACHED_HOUSE,
    BuildingUse.MULTI_FAMILY_HOUSE,
    BuildingUse.MULTI_UNIT_HOUSE,
    BuildingUse.ROW_HOUSE,
    BuildingUse.MULTIPLEX_HOUSE,
    BuildingUse.OFFICIAL_RESIDENCE,
  ],
  [AssetType.COMMERCIAL]: [
    BuildingUse.NEIGHBORHOOD_FACILITY_1,
    BuildingUse.NEIGHBORHOOD_FACILITY_2,
    BuildingUse.SALES,
    BuildingUse.OFFICE,
    BuildingUse.LODGING,
    BuildingUse.MEDICAL,
    BuildingUse.EDUCATION_RESEARCH,
    BuildingUse.FACTORY,
    BuildingUse.WAREHOUSE,
  ],
  [AssetType.APT]: [BuildingUse.APARTMENT],
  [AssetType.OFFICETEL]: [BuildingUse.OFFICETEL],
};

export interface BuildingUseChoices {
  common: readonly BuildingUse[];
  others: readonly BuildingUse[];
}

/** Options of the 건축물 용도 select for an asset type (empty for 토지 / no type yet). */
export function buildingUseChoices(asset: AssetType | '' | undefined): BuildingUseChoices {
  if (!asset || !isBuildingAsset(asset)) return { common: [], others: [] };
  const common = COMMON_USES[asset] ?? [];
  const others = (Object.values(BuildingUse) as BuildingUse[]).filter((u) => !common.includes(u));
  return { common, others };
}

/** 아파트·오피스텔: the use follows from the category, the broker does not have to pick it. */
export function impliedBuildingUse(asset: AssetType | '' | undefined): BuildingUse | null {
  return asset ? effectiveBuildingUse(asset, null) : null;
}

export const buildingUseLabel = (use: BuildingUse): string => BUILDING_USE_LABEL[use];
