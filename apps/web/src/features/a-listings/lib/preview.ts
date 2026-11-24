import {
  AssetType,
  BUILDING_USE_LABEL,
  DealType,
  FloorDisplay,
  ListingStatus,
  MAINTENANCE_FEE_KIND_LABEL,
  effectiveBuildingUse,
} from '@house/shared';
import type { ListingDetail } from '@/features/w-listing/api/schemas';
import { floorClassOf } from '@/lib/format';
import type {
  AgencyListing,
  AgencyListingAgency,
  AgencyListingVerification,
  ComplexForListing,
} from '../api/schemas';
import type { DraftPayload } from './form';
import type { PhotoValue } from './photos';
import { agencyIssues, type PublishAgency } from './requirements';

/** 「중개대상물 종류」 as the public page prints it (stated or implied 건축물 용도). */
function buildingUseLabel(
  assetType: DraftPayload['property']['assetType'],
  buildingUse: DraftPayload['property']['buildingUse'],
): string | null {
  const use = effectiveBuildingUse(assetType, buildingUse);
  return use ? BUILDING_USE_LABEL[use] : null;
}

export interface PreviewContext {
  /** Saved listing (null while it has never been saved). */
  listing: AgencyListing | null;
  /** Offices shown in the disclosure block — the caller's office first when nothing is saved yet. */
  agencies: readonly AgencyListingAgency[];
  complex: ComplexForListing | null;
  photos: readonly PhotoValue[];
  verifications: readonly AgencyListingVerification[];
  /** Today (KST, YYYY-MM-DD) — used as the publish date of a draft. */
  today: string;
}

/**
 * Builds the PUBLIC listing payload (`GET /listings/:id`, w-listing's `ListingDetail`) from the
 * wizard state, so the preview renders with the very components of the public page. Private fields
 * (호수, 실매물 확인 메모) are dropped and the exact floor is hidden when the broker chose 저/중/고 —
 * exactly what the API must do for visitors.
 */
export function buildPreviewDetail(draft: DraftPayload, ctx: PreviewContext): ListingDetail {
  const p = draft.property;
  const exact = draft.floorDisplay === FloorDisplay.EXACT;
  const floorClass =
    p.floor !== undefined && p.totalFloors !== undefined
      ? floorClassOf(p.floor, p.totalFloors)
      : null;
  const latest = [...ctx.verifications].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt))[0];
  const status = ctx.listing?.status ?? ListingStatus.DRAFT;

  return {
    id: ctx.listing?.id ?? 'preview',
    listingNo: ctx.listing?.listingNo ?? '저장 후 부여',
    // The public page never shows a draft — preview it the way it will look once live.
    status: status === ListingStatus.RESERVED ? ListingStatus.RESERVED : ListingStatus.ACTIVE,
    dealType: draft.dealType,
    assetType: p.assetType ?? AssetType.APT,
    title: draft.title ?? null,
    description: draft.description ?? null,
    highlights: [],
    salePrice: draft.salePrice ?? null,
    deposit: draft.deposit ?? null,
    monthlyRent: draft.monthlyRent ?? null,
    presalePrice: draft.presalePrice ?? null,
    premium: draft.premium ?? null,
    maintenanceFeeWon: draft.maintenanceFeeWon ?? null,
    maintenanceFeeItems: (draft.maintenanceFee?.items ?? [])
      .filter((i) => i.included)
      .map((i) => MAINTENANCE_FEE_KIND_LABEL[i.kind]),
    moveInType: draft.moveInType ?? null,
    moveInDate: draft.moveInDate ?? null,
    floorDisplay: draft.floorDisplay,
    floorClass,
    options: draft.options,
    publishedAt: ctx.listing?.publishedAt ?? ctx.today,
    updatedAt: ctx.listing?.updatedAt ?? null,
    verifiedAt: latest?.verifiedAt ?? null,
    viewCount: ctx.listing?.viewCount ?? 0,
    favoriteCount: ctx.listing?.favoriteCount ?? 0,
    property: {
      roadAddress: p.roadAddress ?? '',
      jibunAddress: p.jibunAddress ?? null,
      buildingName: p.buildingName ?? null,
      dong: p.dong ?? null,
      emdCode: p.emdCode ?? null,
      emdName: ctx.complex?.emdName ?? ctx.listing?.property.emdName ?? null,
      lat: p.lat ?? 34.9506,
      lng: p.lng ?? 127.4872,
      floor: exact ? (p.floor ?? null) : null,
      totalFloors: p.totalFloors ?? null,
      exclusiveArea: p.exclusiveArea ?? null,
      supplyArea: p.supplyArea ?? null,
      landArea: p.landArea ?? null,
      totalFloorArea: null,
      areaTypeId: p.areaTypeId ?? null,
      rooms: p.rooms ?? null,
      baths: p.baths ?? null,
      direction: p.direction ?? null,
      directionBasis: p.directionBasis ?? null,
      approvalDate: p.approvalDate ?? null,
      parkingSpaces: p.parkingSpaces ?? null,
      heatingType: ctx.complex?.heatingType ?? null,
      zoning: p.zoning ?? null,
      landCategory: p.landCategory ?? null,
      buildingUse: buildingUseLabel(p.assetType, p.buildingUse),
    },
    complex: ctx.complex
      ? {
          id: ctx.complex.id,
          name: ctx.complex.name,
          emdName: ctx.complex.emdName ?? null,
          households: ctx.complex.households ?? null,
          builtYear: ctx.complex.builtYear ?? null,
          approvalDate: ctx.complex.approvalDate ?? null,
          parkingPerHousehold: ctx.complex.parkingPerHousehold ?? null,
          heatingType: ctx.complex.heatingType ?? null,
          avgPricePerPyeong: ctx.complex.avgPricePerPyeong ?? null,
          areaTypes: ctx.complex.areaTypes.map((a) => ({
            id: a.id,
            exclusiveArea: a.exclusiveArea,
            supplyArea: a.supplyArea ?? null,
            pyeongLabel: a.pyeongLabel ?? null,
          })),
          latestTrade: null,
        }
      : null,
    photos: ctx.photos.map((photo, i) => ({
      id: photo.mediaId,
      url: photo.url,
      thumbUrl: photo.thumbUrl ?? null,
      caption: photo.caption.trim() || null,
      isCover: photo.isCover || i === 0,
    })),
    // The 메모 of a 실매물 확인 is office-internal ("임대인 12월 말 퇴거 예정" …) — never public.
    verifications: ctx.verifications.map((v) => ({
      method: v.method,
      verifiedAt: v.verifiedAt,
      note: null,
    })),
    agencies: ctx.agencies.map((a) => ({
      agencyId: a.agencyId,
      isPrimary: a.isPrimary,
      name: a.name,
      representativeName: a.representativeName,
      registrationNumber: a.registrationNumber,
      phone: a.phone,
      roadAddress: a.roadAddress,
      addressDetail: a.addressDetail ?? null,
      logoUrl: a.logoUrl ?? null,
      specialtyTag: null,
      activeListingCount: null,
      avgResponseMinutes: null,
      contactName: a.contactName ?? null,
      contactPhone: a.contactPhone ?? null,
    })),
    nearby: [],
  };
}

/** Office of a listing → the `agency` input of the shared publish validator. */
export function publishAgencyOf(agency: AgencyListingAgency | undefined): PublishAgency {
  return agency
    ? {
        name: agency.name,
        roadAddress: agency.roadAddress,
        phone: agency.phone,
        registrationNumber: agency.registrationNumber,
        representativeName: agency.representativeName,
      }
    : null;
}

/**
 * The office's own disclosure fields the publish validator would reject (shown as a warning before
 * publishing) — `checkPublishRequirements`' `agency.*` items, labelled without the "중개사무소" prefix.
 */
export function missingAgencyDisclosure(
  agency: AgencyListingAgency | undefined,
  draft: DraftPayload = {
    dealType: DealType.SALE,
    floorDisplay: FloorDisplay.EXACT,
    options: [],
    property: {},
  },
): string[] {
  if (!agency) return ['중개사무소 정보'];
  return agencyIssues(draft, publishAgencyOf(agency)).map((i) =>
    i.label.replace(/^중개사무소\s*/, ''),
  );
}
