import {
  AgencyDocumentType,
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  ErrorCode,
  LIVE_AGENCY_STATUSES,
  sggCodeOf,
  type AgencyDocumentInput,
  type AssetType,
  type AgencyDocumentView,
  type AgencyRegisterInput,
  type AgencyResubmitInput,
  type AgencyUpdateInput,
  type MyAgency,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgencyMapper, toDocumentView } from '../agency.mapper';
import { agencyDocumentSelect, myAgencySelect } from '../agency.selects';
import { MAX_AGENCY_DOCUMENTS } from '../constants';
import { lockAgency, lockUserMembership } from '../domain/locks';
import { isUniqueViolation } from '../domain/prisma-errors';
import { AGENCY_MEDIA, type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';
import { AgencySessionSyncService } from './agency-session-sync.service';

/** Profile statuses in which the owner may edit the public profile. */
const EDITABLE_STATUSES: AgencyStatus[] = [AgencyStatus.PENDING, AgencyStatus.APPROVED];
/** Documents can be removed only before approval (an approved agency keeps its evidence). */
const DOCUMENT_REMOVABLE_STATUSES: AgencyStatus[] = [AgencyStatus.PENDING, AgencyStatus.REJECTED];

type ProfileInput = Omit<AgencyUpdateInput, 'logoMediaId'>;

interface ProfileData {
  phone?: string;
  mobile?: string | null;
  email?: string | null;
  roadAddress?: string;
  jibunAddress?: string | null;
  addressDetail?: string | null;
  zipCode?: string | null;
  emdCode?: string | null;
  lat?: number;
  lng?: number;
  intro?: string | null;
  businessHours?: Prisma.InputJsonObject | Prisma.NullTypes.DbNull;
  specialties?: AssetType[];
}

/**
 * 중개사무소 등록 신청 (→ PENDING), 반려 후 재신청, the owner's own profile and private documents.
 * "Mine" is the agency the user owns (any status): pending applicants are still role USER.
 */
@Injectable()
export class AgencyRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mapper: AgencyMapper,
    private readonly cache: AgencyCacheService,
    private readonly sessions: AgencySessionSyncService,
    @Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort,
  ) {}

  async register(user: UserPrincipal, input: AgencyRegisterInput): Promise<MyAgency> {
    let agencyId: string;
    try {
      agencyId = await this.prisma.$transaction(async (tx) => {
        await lockUserMembership(tx, user.userId);
        await this.assertCanStartAgency(tx, user.userId);
        const taken = await tx.agency.findUnique({
          where: { registrationNumber: input.registrationNumber },
          select: { id: true },
        });
        if (taken) throw AppException.conflict(ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
        await this.media.assertDocumentsUsable(
          input.documents.map((d) => d.mediaId),
          user.userId,
          tx,
        );

        const agency = await tx.agency.create({
          data: {
            ownerUserId: user.userId,
            name: input.name,
            representativeName: input.representativeName,
            registrationNumber: input.registrationNumber,
            businessNumber: input.businessNumber,
            ...this.profileData(input),
            phone: input.phone,
            roadAddress: input.roadAddress,
            lat: input.lat,
            lng: input.lng,
            sggCode: this.sggCodeFor(input.emdCode),
            specialties: input.specialties ?? [],
            status: AgencyStatus.PENDING,
          },
          select: { id: true },
        });
        await tx.agencyMember.create({
          data: {
            agencyId: agency.id,
            userId: user.userId,
            role: AgencyMemberRole.OWNER,
            status: AgencyMemberStatus.ACTIVE,
            displayName: input.representativeName,
            phone: input.mobile ?? null,
            isLicensed: true,
          },
        });
        await this.createDocuments(tx, agency.id, user.userId, input.documents);
        await tx.agencyStatusHistory.create({
          data: { agencyId: agency.id, fromStatus: null, toStatus: AgencyStatus.PENDING },
        });
        return agency.id;
      });
    } catch (err) {
      if (isUniqueViolation(err, 'registrationNumber')) {
        throw AppException.conflict(ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
      }
      throw err;
    }
    // Pending owners act for their application (as UserSessionService computes on next login).
    await this.sessions.apply(user.userId, { agencyId });
    return this.loadMine(agencyId);
  }

  async getMine(user: UserPrincipal): Promise<MyAgency> {
    const { id } = await this.ownedAgency(user.userId);
    return this.loadMine(id);
  }

  async updateMine(user: UserPrincipal, input: AgencyUpdateInput): Promise<MyAgency> {
    const owned = await this.ownedAgency(user.userId);
    if (!EDITABLE_STATUSES.includes(owned.status)) {
      throw AppException.badRequest(ErrorCode.AGENCY_NOT_EDITABLE);
    }
    if (input.logoMediaId) await this.media.assertLogoUsable(input.logoMediaId, user.userId);
    const { logoMediaId, ...profile } = input;
    await this.prisma.agency.update({
      where: { id: owned.id },
      data: {
        ...this.profileData(profile),
        ...(profile.emdCode !== undefined ? { sggCode: this.sggCodeFor(profile.emdCode) } : {}),
        ...(logoMediaId !== undefined ? { logoMediaId } : {}),
      },
    });
    await this.cache.invalidatePublic();
    return this.loadMine(owned.id);
  }

  /** 반려된 신청 보완 후 재신청: REJECTED → PENDING with a history row. */
  async resubmit(user: UserPrincipal, input: AgencyResubmitInput): Promise<MyAgency> {
    const owned = await this.ownedAgency(user.userId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockAgency(tx, owned.id);
        const current = await tx.agency.findUniqueOrThrow({
          where: { id: owned.id },
          select: { status: true, registrationNumber: true },
        });
        if (current.status !== AgencyStatus.REJECTED) {
          throw AppException.badRequest(ErrorCode.AGENCY_INVALID_STATUS_TRANSITION, {
            from: current.status,
            to: AgencyStatus.PENDING,
          });
        }
        if (
          input.registrationNumber &&
          input.registrationNumber !== current.registrationNumber &&
          (await tx.agency.count({ where: { registrationNumber: input.registrationNumber } })) > 0
        ) {
          throw AppException.conflict(ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
        }
        if (input.documents?.length) {
          await this.assertDocumentRoom(tx, owned.id, input.documents.length);
          await this.media.assertDocumentsUsable(
            input.documents.map((d) => d.mediaId),
            user.userId,
            tx,
          );
          await this.createDocuments(tx, owned.id, user.userId, input.documents);
        }
        const { name, representativeName, registrationNumber, businessNumber } = input;
        await tx.agency.update({
          where: { id: owned.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(representativeName !== undefined ? { representativeName } : {}),
            ...(registrationNumber !== undefined ? { registrationNumber } : {}),
            ...(businessNumber !== undefined ? { businessNumber } : {}),
            ...this.profileData(input),
            ...(input.emdCode !== undefined ? { sggCode: this.sggCodeFor(input.emdCode) } : {}),
            status: AgencyStatus.PENDING,
            statusReason: null,
          },
        });
        await tx.agencyStatusHistory.create({
          data: {
            agencyId: owned.id,
            fromStatus: AgencyStatus.REJECTED,
            toStatus: AgencyStatus.PENDING,
            reason: input.message ?? null,
          },
        });
      });
    } catch (err) {
      if (isUniqueViolation(err, 'registrationNumber')) {
        throw AppException.conflict(ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
      }
      throw err;
    }
    await this.sessions.apply(user.userId, { agencyId: owned.id });
    return this.loadMine(owned.id);
  }

  async listDocuments(user: UserPrincipal): Promise<AgencyDocumentView[]> {
    const { id } = await this.ownedAgency(user.userId);
    const docs = await this.prisma.agencyDocument.findMany({
      where: { agencyId: id },
      select: agencyDocumentSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return docs.map(toDocumentView);
  }

  async addDocument(user: UserPrincipal, input: AgencyDocumentInput): Promise<AgencyDocumentView> {
    const owned = await this.ownedAgency(user.userId);
    const doc = await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, owned.id);
      await this.assertDocumentRoom(tx, owned.id, 1);
      await this.media.assertDocumentsUsable([input.mediaId], user.userId, tx);
      return tx.agencyDocument.create({
        data: {
          agencyId: owned.id,
          type: input.type,
          mediaId: input.mediaId,
          uploadedById: user.userId,
        },
        select: agencyDocumentSelect,
      });
    });
    return toDocumentView(doc);
  }

  async removeDocument(user: UserPrincipal, docId: string): Promise<void> {
    const owned = await this.ownedAgency(user.userId);
    await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, owned.id);
      const doc = await tx.agencyDocument.findFirst({
        where: { id: docId, agencyId: owned.id },
        select: { id: true, type: true },
      });
      if (!doc) throw AppException.notFound(ErrorCode.AGENCY_DOCUMENT_NOT_FOUND);
      const { status } = await tx.agency.findUniqueOrThrow({
        where: { id: owned.id },
        select: { status: true },
      });
      if (!DOCUMENT_REMOVABLE_STATUSES.includes(status)) {
        throw AppException.badRequest(ErrorCode.AGENCY_NOT_EDITABLE);
      }
      if (doc.type === AgencyDocumentType.REGISTRATION_CERT) {
        const certs = await tx.agencyDocument.count({
          where: { agencyId: owned.id, type: AgencyDocumentType.REGISTRATION_CERT },
        });
        if (certs <= 1) throw AppException.badRequest(ErrorCode.AGENCY_DOCUMENT_REQUIRED);
      }
      await tx.agencyDocument.delete({ where: { id: doc.id } });
    });
  }

  // ---------- internals ----------

  /** The user's own (not deleted) agency; 404 when they have none. */
  async ownedAgency(userId: string): Promise<{ id: string; status: AgencyStatus }> {
    const agency = await this.prisma.agency.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (!agency) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    return agency;
  }

  private async loadMine(agencyId: string): Promise<MyAgency> {
    const row = await this.prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: myAgencySelect,
    });
    return this.mapper.mine(row);
  }

  /** One application per user, and not while acting for another live agency. */
  private async assertCanStartAgency(tx: PrismaTx, userId: string): Promise<void> {
    const owned = await tx.agency.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (owned) {
      throw AppException.conflict(ErrorCode.AGENCY_ALREADY_REGISTERED, {
        agencyId: owned.id,
        status: owned.status,
      });
    }
    const member = await tx.agencyMember.count({
      where: {
        userId,
        status: AgencyMemberStatus.ACTIVE,
        agency: { deletedAt: null, status: { in: [...LIVE_AGENCY_STATUSES] } },
      },
    });
    if (member > 0) throw AppException.conflict(ErrorCode.AGENCY_ALREADY_MEMBER);
  }

  private async assertDocumentRoom(tx: PrismaTx, agencyId: string, adding: number): Promise<void> {
    const count = await tx.agencyDocument.count({ where: { agencyId } });
    if (count + adding > MAX_AGENCY_DOCUMENTS) {
      throw AppException.badRequest(ErrorCode.AGENCY_DOCUMENT_LIMIT, { max: MAX_AGENCY_DOCUMENTS });
    }
  }

  private async createDocuments(
    tx: PrismaTx,
    agencyId: string,
    userId: string,
    docs: readonly AgencyDocumentInput[],
  ): Promise<void> {
    await tx.agencyDocument.createMany({
      data: docs.map((d) => ({ agencyId, type: d.type, mediaId: d.mediaId, uploadedById: userId })),
    });
  }

  private sggCodeFor(emdCode: string | null | undefined): string {
    return emdCode ? sggCodeOf(emdCode) : this.config.get('REGION_SGG_CODE');
  }

  /** Optional profile fields → Prisma data; `undefined` leaves a column untouched. */
  private profileData(p: Partial<ProfileInput>): ProfileData {
    return {
      phone: p.phone,
      mobile: p.mobile,
      email: p.email,
      roadAddress: p.roadAddress,
      jibunAddress: p.jibunAddress,
      addressDetail: p.addressDetail,
      zipCode: p.zipCode,
      emdCode: p.emdCode,
      lat: p.lat,
      lng: p.lng,
      intro: p.intro,
      businessHours: p.businessHours === null ? Prisma.DbNull : p.businessHours,
      specialties: p.specialties,
    };
  }
}
