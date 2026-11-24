import {
  BuildingUse,
  FloorDisplay,
  MaintenanceFeeBillingType,
  MaintenanceFeeKind,
  type ListingDetail as WireListingDetail,
  type MaintenanceFee,
} from '@house/shared';
import type { ListingDetail } from '@/features/w-listing/api/schemas';
import { toListingSummary, toListingWire } from './_summary';

/**
 * Page-shaped detail fixture → the backend wire shape (`ListingDetail` of `@house/shared`,
 * listings mapper `publicDetail`). What the real API does not serve — 매물번호, highlights, 주변
 * 시설, the full verification history, 평형 / 실거래 of the complex — is left out; the page loads
 * the complex from `GET /complexes/:id` and hides the rest.
 */

const FEE_KIND_BY_LABEL: Record<string, MaintenanceFeeKind> = {
  일반관리비: MaintenanceFeeKind.GENERAL,
  인터넷: MaintenanceFeeKind.INTERNET,
  수도: MaintenanceFeeKind.WATER,
  '공용 전기': MaintenanceFeeKind.ELECTRICITY,
  전기: MaintenanceFeeKind.ELECTRICITY,
  가스: MaintenanceFeeKind.GAS,
  난방: MaintenanceFeeKind.HEATING,
  TV: MaintenanceFeeKind.TV,
};

function maintenanceFeeOf(d: ListingDetail): MaintenanceFee | null {
  if (d.maintenanceFeeWon === null || d.maintenanceFeeWon === undefined) return null;
  const kinds = [
    ...new Set(
      d.maintenanceFeeItems.map((label) => FEE_KIND_BY_LABEL[label] ?? MaintenanceFeeKind.OTHER),
    ),
  ];
  return {
    billingType: MaintenanceFeeBillingType.FIXED,
    items: kinds.map((kind) => ({ kind, included: true, amountWon: null })),
    unavailableReason: null,
  };
}

const BUILDING_USES = new Set<string>(Object.values(BuildingUse));

export function toListingDetailWire(d: ListingDetail): WireListingDetail {
  const p = d.property;
  const primary = d.agencies.find((a) => a.isPrimary) ?? d.agencies[0];
  const cover = d.photos.find((ph) => ph.isCover) ?? d.photos[0];
  const card = toListingSummary({
    id: d.id,
    assetType: d.assetType,
    dealType: d.dealType,
    status: d.status,
    title: d.title,
    complexId: d.complex?.id ?? null,
    complexName: d.complex?.name ?? null,
    buildingName: p.buildingName,
    dong: p.dong,
    emdCode: p.emdCode,
    emdName: p.emdName,
    roadAddress: p.roadAddress,
    lat: p.lat,
    lng: p.lng,
    salePrice: d.salePrice,
    deposit: d.deposit,
    monthlyRent: d.monthlyRent,
    presalePrice: d.presalePrice,
    premium: d.premium,
    exclusiveArea: p.exclusiveArea,
    supplyArea: p.supplyArea,
    floor: d.floorDisplay === FloorDisplay.EXACT ? p.floor : null,
    totalFloors: p.totalFloors,
    floorClass: d.floorClass,
    direction: p.direction,
    rooms: p.rooms,
    baths: p.baths,
    builtYear: d.complex?.builtYear ?? (p.approvalDate ? Number(p.approvalDate.slice(0, 4)) : null),
    maintenanceFeeWon: d.maintenanceFeeWon,
    options: d.options,
    verifiedAt: d.verifiedAt,
    publishedAt: d.publishedAt,
    agencyCount: d.agencies.length,
    photoCount: d.photos.length,
    coverPhotoUrl: cover?.url ?? null,
  });
  const latest = [...d.verifications].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0];
  return {
    ...toListingWire(card, {
      primaryAgency: primary ? { id: primary.agencyId, name: primary.name } : undefined,
      listingNo: d.listingNo ?? null,
    }),
    viewCount: d.viewCount,
    favoriteCount: d.favoriteCount,
    description: d.description ?? null,
    maintenanceFee: maintenanceFeeOf(d),
    moveInType: d.moveInType ?? null,
    moveInDate: d.moveInDate ?? null,
    floorDisplay: d.floorDisplay,
    property: {
      assetType: d.assetType,
      roadAddress: p.roadAddress,
      jibunAddress: p.jibunAddress ?? null,
      buildingName: p.buildingName ?? null,
      dong: p.dong ?? null,
      floor: d.floorDisplay === FloorDisplay.EXACT ? (p.floor ?? null) : null,
      totalFloors: p.totalFloors ?? null,
      exclusiveArea: p.exclusiveArea ?? null,
      supplyArea: p.supplyArea ?? null,
      landArea: p.landArea ?? null,
      totalFloorArea: p.totalFloorArea ?? null,
      rooms: p.rooms ?? null,
      // As stated by the broker; the fixtures carry only the effective type (in the summary).
      roomType: null,
      baths: p.baths ?? null,
      direction: p.direction ?? null,
      directionBasis: p.directionBasis ?? null,
      approvalDate: p.approvalDate ?? null,
      parkingSpaces: p.parkingSpaces ?? null,
      heatingType: p.heatingType ?? null,
      zoning: p.zoning ?? null,
      landCategory: p.landCategory ?? null,
      buildingUse:
        p.buildingUse && BUILDING_USES.has(p.buildingUse) ? (p.buildingUse as BuildingUse) : null,
    },
    complex: d.complex
      ? {
          id: d.complex.id,
          name: d.complex.name,
          households: d.complex.households ?? null,
          builtYear: d.complex.builtYear ?? null,
        }
      : null,
    photos: d.photos.map((ph) => ({
      mediaId: ph.id,
      thumbUrl: ph.thumbUrl ?? ph.url,
      mediumUrl: ph.url,
      largeUrl: ph.url,
      caption: ph.caption ?? null,
      isCover: ph.isCover,
    })),
    agencies: d.agencies.map((a) => ({
      agencyId: a.agencyId,
      isPrimary: a.isPrimary,
      name: a.name,
      roadAddress: a.roadAddress,
      addressDetail: a.addressDetail ?? null,
      phone: a.phone,
      registrationNumber: a.registrationNumber,
      representativeName: a.representativeName,
      contactName: a.contactName ?? null,
      contactPhone: a.contactPhone ?? null,
      logoUrl: a.logoUrl ?? null,
    })),
    latestVerification: latest ? { method: latest.method, verifiedAt: latest.verifiedAt } : null,
    isFavorite: false,
  };
}
