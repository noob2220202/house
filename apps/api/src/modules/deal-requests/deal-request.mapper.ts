import {
  AgencyMemberStatus,
  DEAL_REQUEST_CONTACT_STATUSES,
  DEAL_REQUEST_LIMITS,
  DealRequestType,
  coarseDealRequestPoint,
  dealRequestAreaRange,
  isAdvertisableMember,
  maskPhone,
  publicDealRequestDescription,
  type AdminDealRequestView,
  type AgencyDealRequestView,
  type AgencyDisclosure,
  type AgencyProposalView,
  type DealRequestBaseView,
  type DealRequestContactView,
  type MyDealRequestView,
  type NotificationView,
  type ProposalListingView,
  type ProposalView,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { decimalToNumber } from '../../common/utils/decimal';
import type {
  DealRequestAdminRow,
  DealRequestAgencyRow,
  DealRequestBaseRow,
  DealRequestContactRow,
  DealRequestOwnerRow,
  NotificationRow,
  ProposalAgencyRow,
  ProposalOwnerRow,
} from './deal-request.selects';
import { DEAL_REQUEST_MEDIA, type DealRequestMediaPort } from './ports/media.port';

/**
 * The admin moderation view: shared `AdminDealRequestView` + the spam flag (admin m-moderation
 * `adminDealRequestDetailSchema`). No automatic abuse signals exist yet, so `spamSignalCount` is 0
 * and `spamSignals` is empty. Local until shared has it.
 */
export interface AdminDealRequestModerationView extends AdminDealRequestView {
  spamFlaggedAt: string | null;
  spamReason: string | null;
  spamSignalCount: number;
  spamSignals: string[];
}

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

/** "홍길동" → "홍*동", "홍길" → "홍*"; empty (scrubbed) stays empty. */
export function maskName(name: string): string {
  const chars = [...name.trim()];
  if (chars.length === 0) return '';
  if (chars.length === 1) return '*';
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

/**
 * Row → response mapping with explicit field picking per audience. Contact and 동·호 appear only
 * in the owner view, and in the agency view when `contact` was loaded for an active grant.
 */
@Injectable()
export class DealRequestMapper {
  constructor(@Inject(DEAL_REQUEST_MEDIA) private readonly media: DealRequestMediaPort) {}

  base(r: DealRequestBaseRow): DealRequestBaseView {
    return {
      id: r.id,
      type: r.type,
      status: r.status,
      assetType: r.assetType,
      dealTypes: r.dealTypes,
      visibility: r.visibility,
      sggCode: r.sggCode,
      emdCode: r.emdCode,
      roadAddress: r.roadAddress,
      complex: r.complex ? { id: r.complex.id, name: r.complex.name } : null,
      lat: r.lat,
      lng: r.lng,
      exclusiveArea: decimalToNumber(r.exclusiveArea),
      floor: r.floor,
      desiredSalePrice: r.desiredSalePrice,
      desiredDeposit: r.desiredDeposit,
      desiredMonthlyRent: r.desiredMonthlyRent,
      regionCodes: r.regionCodes,
      complexIds: r.complexIds,
      priceMin: r.priceMin,
      priceMax: r.priceMax,
      depositMin: r.depositMin,
      depositMax: r.depositMax,
      rentMin: r.rentMin,
      rentMax: r.rentMax,
      areaMin: decimalToNumber(r.areaMin),
      areaMax: decimalToNumber(r.areaMax),
      roomsMin: r.roomsMin,
      moveInDate: dateOnly(r.moveInDate),
      description: r.description,
      photos: r.photos.map((p) => ({
        mediaId: p.media.id,
        url: this.media.publicUrl(p.media, 'large'),
        thumbUrl: this.media.publicUrl(p.media, 'thumb'),
      })),
      proposalCount: r.proposalCount,
      expiresAt: iso(r.expiresAt),
      closedAt: iso(r.closedAt),
      createdAt: r.createdAt.toISOString(),
    };
  }

  owner(r: DealRequestOwnerRow): MyDealRequestView {
    return {
      ...this.base(r),
      contactName: r.contactName,
      contactPhone: r.contactPhone,
      addressDetail: r.addressDetail,
      targetAgencyIds: r.targets.map((t) => t.agencyId),
      closeReason: r.closeReason,
      extensionCount: r.extensionCount,
      contactGrants: r.contactGrants.map((g) => ({
        agencyId: g.agencyId,
        agencyName: g.agency.name,
        grantedAt: g.grantedAt.toISOString(),
      })),
    };
  }

  /**
   * `contact` must only be passed when the agency holds an active grant (see canSeeContact) and
   * the requester is ACTIVE (AgencyInboxService.contactsFor). Without it, a 내놓기 request is
   * reduced to the pre-grant 제공 항목 of the DEAL_REQUEST_PROVIDE notice: 읍면동 / 단지, a
   * ~200 m grid point, the area band, prices and conditions, the form's flag lines — no road
   * address, exact position, floor, exact area, photos or free-text description.
   */
  agency(
    r: DealRequestAgencyRow,
    contact: DealRequestContactRow | null,
    now: Date = new Date(),
  ): AgencyDealRequestView {
    const proposal = r.proposals[0];
    const shared = contact !== null && canSeeContact(r, now);
    const full = this.base(r);
    const area = decimalToNumber(r.exclusiveArea);
    const common = {
      targeted: r.targets.length > 0,
      myProposal: proposal
        ? { id: proposal.id, status: proposal.status, createdAt: proposal.createdAt.toISOString() }
        : null,
      contact: shared ? toContact(contact) : null,
      detailsShared: shared,
      areaRange: dealRequestAreaRange(area),
      photoCount: r.photos.length,
    };
    if (shared || r.type !== DealRequestType.SELL_OR_LEASE) return { ...full, ...common };
    return {
      ...full,
      ...coarseDealRequestPoint(r.lat, r.lng),
      roadAddress: null,
      exclusiveArea: null,
      floor: null,
      description: publicDealRequestDescription(r.description),
      photos: [],
      ...common,
    };
  }

  admin(r: DealRequestAdminRow): AdminDealRequestModerationView {
    return {
      ...this.base(r),
      userId: r.userId,
      contactNameMasked: maskName(r.contactName),
      contactPhoneMasked: r.contactPhone ? maskPhone(r.contactPhone) : '',
      targetAgencyIds: r.targets.map((t) => t.agencyId),
      closeReason: r.closeReason,
      contactScrubbedAt: iso(r.contactScrubbedAt),
      deletedAt: iso(r.deletedAt),
      spamFlaggedAt: iso(r.spamFlaggedAt),
      spamReason: r.spamFlaggedAt ? r.spamReason : null,
      spamSignalCount: 0,
      spamSignals: [],
    };
  }

  proposalForOwner(
    p: ProposalOwnerRow,
    agency: AgencyDisclosure | null,
    contactShared: boolean,
  ): ProposalView {
    return {
      id: p.id,
      dealRequestId: p.dealRequestId,
      status: p.status,
      message: p.message,
      suggestedPrice: p.suggestedPrice,
      suggestedDeposit: p.suggestedDeposit,
      suggestedMonthlyRent: p.suggestedMonthlyRent,
      agencyId: p.agencyId,
      agency,
      // A 중개보조원 is labelled as such and never shows their own number (공인중개사법
      // 제18조의4): the requester calls the office number of the agency disclosure.
      agent:
        p.member && p.member.status === AgencyMemberStatus.ACTIVE
          ? isAdvertisableMember(p.member)
            ? { displayName: p.member.displayName, isAssistant: false, phone: p.member.phone }
            : { displayName: p.member.displayName, isAssistant: true, phone: null }
          : null,
      listings: p.listings
        .map((l) => l.listing)
        .filter((l) => l.deletedAt === null)
        .map(
          (l): ProposalListingView => ({
            id: l.id,
            title: l.title,
            assetType: l.assetType,
            dealType: l.dealType,
            status: l.status,
            salePrice: l.salePrice,
            deposit: l.deposit,
            monthlyRent: l.monthlyRent,
            presalePrice: l.presalePrice,
            premium: l.premium,
            exclusiveArea: decimalToNumber(l.exclusiveArea),
          }),
        ),
      contactShared,
      viewedAt: iso(p.viewedAt),
      respondedAt: iso(p.respondedAt),
      createdAt: p.createdAt.toISOString(),
    };
  }

  proposalForAgency(p: ProposalAgencyRow): AgencyProposalView {
    return {
      id: p.id,
      dealRequestId: p.dealRequestId,
      status: p.status,
      message: p.message,
      suggestedPrice: p.suggestedPrice,
      suggestedDeposit: p.suggestedDeposit,
      suggestedMonthlyRent: p.suggestedMonthlyRent,
      listingIds: p.listings.map((l) => l.listingId),
      memberId: p.memberId,
      viewedAt: iso(p.viewedAt),
      respondedAt: iso(p.respondedAt),
      createdAt: p.createdAt.toISOString(),
      dealRequest: {
        type: p.dealRequest.type,
        status: p.dealRequest.status,
        assetType: p.dealRequest.assetType,
        dealTypes: p.dealRequest.dealTypes,
      },
    };
  }

  notification(n: NotificationRow): NotificationView {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      data: jsonObject(n.data),
      readAt: iso(n.readAt),
      createdAt: n.createdAt.toISOString(),
    };
  }
}

/**
 * Contact and full details are visible to an agency with an active grant while the request is live
 * or completed — a completed (CLOSED) one only until CONTACT_RETENTION_DAYS after it ended, the
 * period the notices state (the scrub job then erases the data and revokes the grant).
 */
export function canSeeContact(
  r: Pick<DealRequestAgencyRow, 'status' | 'contactScrubbedAt' | 'contactGrants' | 'closedAt'>,
  now: Date = new Date(),
): boolean {
  return (
    r.contactGrants.length > 0 &&
    r.contactScrubbedAt === null &&
    DEAL_REQUEST_CONTACT_STATUSES.includes(r.status) &&
    !retentionOver(r.closedAt, now)
  );
}

/** True once CONTACT_RETENTION_DAYS have passed since the request ended. */
export function retentionOver(closedAt: Date | null, now: Date): boolean {
  return (
    closedAt !== null &&
    closedAt.getTime() <= now.getTime() - DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS * 86_400_000
  );
}

function toContact(c: DealRequestContactRow): DealRequestContactView {
  return { name: c.contactName, phone: c.contactPhone, addressDetail: c.addressDetail };
}
