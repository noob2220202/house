import {
  businessHoursSchema,
  type AgencyDocumentView,
  type AgencyMemberView,
  type AgencyStatusHistoryView,
  type AgencySummary,
  type BusinessHours,
  type MyAgency,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AgencyDocumentRow,
  AgencyMemberRow,
  AgencySummaryRow,
  MyAgencyRow,
} from './agency.selects';
import { AGENCY_MEDIA, type AgencyMediaPort, type MediaRef } from './ports/agency-media.port';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function toBusinessHours(value: Prisma.JsonValue | null): BusinessHours | null {
  if (value === null) return null;
  const parsed = businessHoursSchema.safeParse(value);
  return parsed.success ? (parsed.data as BusinessHours) : null;
}

export function toDocumentView(d: AgencyDocumentRow): AgencyDocumentView {
  return {
    id: d.id,
    type: d.type,
    mediaId: d.mediaId,
    mimeType: d.media.mimeType,
    sizeBytes: d.media.sizeBytes,
    originalFilename: d.media.originalFilename,
    createdAt: d.createdAt.toISOString(),
  };
}

export function toMemberView(m: AgencyMemberRow): AgencyMemberView {
  return {
    id: m.id,
    userId: m.userId,
    role: m.role,
    status: m.status,
    displayName: m.displayName,
    title: m.title,
    phone: m.phone,
    isLicensed: m.isLicensed,
    licenseNumber: m.licenseNumber,
    joinedAt: m.joinedAt.toISOString(),
    removedAt: iso(m.removedAt),
  };
}

/** DB rows → API shapes. Explicit field picking: documents' storage keys never leave the API. */
@Injectable()
export class AgencyMapper {
  constructor(@Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort) {}

  logoUrl(logo: (MediaRef & { deletedAt: Date | null }) | null): string | null {
    return logo && !logo.deletedAt ? this.media.publicUrl(logo, 'thumb') : null;
  }

  summary(a: AgencySummaryRow): AgencySummary {
    return {
      id: a.id,
      name: a.name,
      representativeName: a.representativeName,
      registrationNumber: a.registrationNumber,
      phone: a.phone,
      roadAddress: a.roadAddress,
      addressDetail: a.addressDetail,
      emdCode: a.emdCode,
      lat: a.lat,
      lng: a.lng,
      specialties: a.specialties,
      logoUrl: this.logoUrl(a.logo),
      activeListingCount: a.activeListingCount,
    };
  }

  mine(a: MyAgencyRow): MyAgency {
    const history: AgencyStatusHistoryView[] = a.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      reason: h.reason,
      decidedBy: h.decidedBy ? { id: h.decidedBy.id, name: h.decidedBy.name } : null,
      createdAt: h.createdAt.toISOString(),
    }));
    return {
      ...this.summary(a),
      businessNumber: a.businessNumber,
      mobile: a.mobile,
      email: a.email,
      jibunAddress: a.jibunAddress,
      zipCode: a.zipCode,
      intro: a.intro,
      businessHours: toBusinessHours(a.businessHours),
      logoMediaId: a.logoMediaId,
      status: a.status,
      statusReason: a.statusReason,
      approvedAt: iso(a.approvedAt),
      suspendedAt: iso(a.suspendedAt),
      memberCount: a._count.members,
      documents: a.documents.map(toDocumentView),
      statusHistory: history,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  }
}
