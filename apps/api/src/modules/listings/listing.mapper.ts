import {
  AgencyStatus,
  FloorDisplay,
  floorLabel,
  sqmToPyeong,
  type AgencyListingDetail,
  type ListingAgencyDisclosure,
  type ListingDetail,
  type ListingSummary,
  type PhotoUrls,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { decimalToNumber } from '../../common/utils/decimal';
import { dateToDateOnly } from './domain/dates';
import type {
  ListingAgencyDetailRow,
  ListingPublicDetailRow,
  ListingSummaryRow,
} from './listing.selects';
import { LISTING_MEDIA, type ListingMediaPort, type MediaRef } from './ports/listing-media.port';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

interface PhotoRow {
  mediaId: string;
  caption: string | null;
  isCover: boolean;
  media: MediaRef;
}

interface AgencyLinkRow {
  agencyId: string;
  isPrimary: boolean;
  contactName: string | null;
  contactPhone: string | null;
  agency: {
    name: string;
    roadAddress: string;
    addressDetail: string | null;
    phone: string;
    registrationNumber: string;
    representativeName: string;
    status: string;
    deletedAt: Date | null;
    logo: MediaRef | null;
  };
}

/** Prisma rows → API responses with explicit field picking (PRIVATE fields only in agency views). */
@Injectable()
export class ListingMapper {
  constructor(@Inject(LISTING_MEDIA) private readonly media: ListingMediaPort) {}

  photo(p: PhotoRow): PhotoUrls {
    return {
      mediaId: p.mediaId,
      caption: p.caption,
      isCover: p.isCover,
      ...this.media.urls(p.media),
    };
  }

  summary(row: ListingSummaryRow): ListingSummary {
    const area = decimalToNumber(row.exclusiveArea);
    const cover = row.photos[0];
    return {
      id: row.id,
      dealType: row.dealType,
      assetType: row.assetType,
      status: row.status,
      title: row.title,
      salePrice: row.salePrice,
      deposit: row.deposit,
      monthlyRent: row.monthlyRent,
      presalePrice: row.presalePrice,
      premium: row.premium,
      priceSort: row.priceSort,
      maintenanceFeeWon: row.maintenanceFeeWon,
      exclusiveArea: area,
      exclusiveAreaPyeong: area === null ? null : sqmToPyeong(area),
      supplyArea: decimalToNumber(row.property.supplyArea),
      floorLabel: floorLabel(row.property.floor, row.property.totalFloors, row.floorDisplay),
      floorClass: row.floorClass,
      rooms: row.rooms,
      baths: row.baths,
      direction: row.direction,
      builtYear: row.builtYear,
      roadAddress: row.property.roadAddress,
      buildingName: row.property.buildingName,
      dong: row.property.dong,
      emdCode: row.emdCode,
      lat: row.lat,
      lng: row.lng,
      complex: row.complex ? { id: row.complex.id, name: row.complex.name } : null,
      coverPhoto: cover ? this.photo(cover) : null,
      photoCount: row.photoCount,
      options: row.options,
      verifiedAt: iso(row.verifiedAt),
      publishedAt: iso(row.publishedAt),
      primaryAgency: { id: row.primaryAgency.id, name: row.primaryAgency.name },
      agencyCount: row._count.agencies,
      viewCount: row.viewCount,
      favoriteCount: row.favoriteCount,
    };
  }

  disclosure(a: AgencyLinkRow): ListingAgencyDisclosure {
    return {
      agencyId: a.agencyId,
      isPrimary: a.isPrimary,
      name: a.agency.name,
      roadAddress: a.agency.roadAddress,
      addressDetail: a.agency.addressDetail,
      phone: a.agency.phone,
      registrationNumber: a.agency.registrationNumber,
      representativeName: a.agency.representativeName,
      contactName: a.contactName,
      contactPhone: a.contactPhone,
      logoUrl: a.agency.logo ? this.media.urls(a.agency.logo).thumbUrl : null,
    };
  }

  private detailBase(
    row: ListingPublicDetailRow | ListingAgencyDetailRow,
    exactFloor: boolean,
  ): Omit<ListingDetail, 'agencies' | 'isFavorite'> {
    const p = row.property;
    const latest = row.verifications[0];
    const cover = row.photos.find((ph) => ph.isCover) ?? null;
    const base = this.summary({ ...row, photos: cover ? [cover] : [] });
    return {
      ...base,
      complex: row.complex
        ? {
            id: row.complex.id,
            name: row.complex.name,
            households: row.complex.households,
            builtYear: row.complex.builtYear,
          }
        : null,
      description: row.description,
      maintenanceFeeItems: row.maintenanceFeeItems,
      moveInType: row.moveInType,
      moveInDate: dateToDateOnly(row.moveInDate),
      floorDisplay: row.floorDisplay,
      property: {
        assetType: p.assetType,
        roadAddress: p.roadAddress,
        jibunAddress: p.jibunAddress,
        buildingName: p.buildingName,
        dong: p.dong,
        floor: exactFloor || row.floorDisplay === FloorDisplay.EXACT ? p.floor : null,
        totalFloors: p.totalFloors,
        exclusiveArea: decimalToNumber(p.exclusiveArea),
        supplyArea: decimalToNumber(p.supplyArea),
        landArea: decimalToNumber(p.landArea),
        totalFloorArea: decimalToNumber(p.totalFloorArea),
        rooms: p.rooms,
        baths: p.baths,
        direction: p.direction,
        directionBasis: p.directionBasis,
        approvalDate: dateToDateOnly(p.approvalDate),
        parkingSpaces: p.parkingSpaces,
        heatingType: p.heatingType,
        zoning: p.zoning,
        landCategory: p.landCategory,
        buildingUse: p.buildingUse,
      },
      photos: row.photos.map((ph) => this.photo(ph)),
      latestVerification: latest
        ? { method: latest.method, verifiedAt: latest.verifiedAt.toISOString() }
        : null,
    };
  }

  /** Public detail: never includes 호, hidden reason or member ids. */
  publicDetail(row: ListingPublicDetailRow, isFavorite: boolean): ListingDetail {
    return {
      ...this.detailBase(row, false),
      agencies: row.agencies
        .filter((a) => a.agency.status === AgencyStatus.APPROVED && !a.agency.deletedAt)
        .map((a) => this.disclosure(a)),
      isFavorite,
    };
  }

  agencyDetail(row: ListingAgencyDetailRow, actingAgencyId: string): AgencyListingDetail {
    const p = row.property;
    const base = this.detailBase(row, true);
    return {
      ...base,
      property: {
        ...base.property,
        id: p.id,
        ho: p.ho,
        emdCode: p.emdCode,
        complexId: p.complexId,
        areaTypeId: p.areaTypeId,
      },
      hiddenReason: row.hiddenReason,
      closedAt: iso(row.closedAt),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      isPrimaryAgency: row.primaryAgencyId === actingAgencyId,
      agencies: row.agencies.map((a) => ({
        ...this.disclosure(a),
        status: a.status,
        contactMemberId: a.contactMemberId,
        joinedAt: a.joinedAt.toISOString(),
      })),
      verifications: row.verifications.map((v) => ({
        id: v.id,
        method: v.method,
        verifiedAt: v.verifiedAt.toISOString(),
        note: v.note,
        byAdmin: v.verifiedByAdminId !== null,
      })),
      isFavorite: false,
    };
  }
}
