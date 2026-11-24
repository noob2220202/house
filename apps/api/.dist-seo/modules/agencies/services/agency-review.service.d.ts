import { type AdminAgencyDetail, type AdminAgencyDetailQuery, type AdminAgencyListItem, type AdminAgencyListQuery, type AgencyAdminDeleteInput, type AgencyDecisionInput, type AgencyLocationUpdateInput, type AgencyRegistryCheck, type Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AdsInvalidationService } from '../../ads/services/ads-invalidation.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgencyMapper } from '../agency.mapper';
import { type BrokerRegistryClient } from '../clients/broker-registry.client';
import { type AgencyListingsSync } from '../ports/agency-listings.sync';
import { type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';
import { AgencyInviteStore } from './agency-invite.store';
import { AgencySessionSyncService } from './agency-session-sync.service';
/** statusReason of pending applications rejected because another office got the 등록번호. */
export declare const DUPLICATE_REGISTRATION_REJECT_REASON = "\uB3D9\uC77C\uD55C \uB4F1\uB85D\uBC88\uD638\uC758 \uB2E4\uB978 \uC911\uAC1C\uC0AC\uBB34\uC18C \uC2E0\uCCAD\uC774 \uC2B9\uC778\uB418\uC5B4 \uC790\uB3D9 \uBC18\uB824\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB4F1\uB85D\uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
export interface DocumentFile {
    path: string;
    mimeType: string;
    sizeBytes: number;
    filename: string;
    inline: boolean;
}
/** Admin review of agencies: queue, detail, decisions with history + audit, private documents. */
export declare class AgencyReviewService {
    private readonly prisma;
    private readonly mapper;
    private readonly audit;
    private readonly cache;
    private readonly jsonCache;
    private readonly sessions;
    private readonly invites;
    private readonly config;
    private readonly listings;
    private readonly media;
    private readonly registry;
    private readonly ads;
    constructor(prisma: PrismaService, mapper: AgencyMapper, audit: AuditService, cache: AgencyCacheService, jsonCache: CacheService, sessions: AgencySessionSyncService, invites: AgencyInviteStore, config: AppConfig, listings: AgencyListingsSync, media: AgencyMediaPort, registry: BrokerRegistryClient, ads: AdsInvalidationService);
    list(q: AdminAgencyListQuery): Promise<Paginated<AdminAgencyListItem>>;
    /**
     * Full agency record with owner and staff contacts unmasked. Viewing it is a 개인정보 접속기록
     * (안전성 확보조치 기준 제8조), so it writes an `agency.pii-view` audit row naming the fields shown,
     * never their values. REMOVED staff are included only on request, with phones masked.
     */
    detail(agencyId: string, q: AdminAgencyDetailQuery): Promise<AdminAgencyDetail>;
    private build;
    /** Mutation responses carry the masked detail; the full view is GET /admin/agencies/:id. */
    private maskedDetail;
    /** 승인 / 반려 / 정지 / 정지 해제, with status history, notification and audit in one transaction. */
    decide(agencyId: string, input: AgencyDecisionInput, admin: AdminPrincipal): Promise<AdminAgencyDetail>;
    /**
     * Rejects the other PENDING applications for a 등록번호 that just went live (one office, one
     * number), with history, notification and audit. Conditional on PENDING, so a concurrent owner
     * edit or admin decision on a competitor simply wins or loses its row lock; no agency lock is
     * taken here (lock order). Returns the owners whose sessions must drop the application.
     */
    private rejectCompetitors;
    /**
     * Soft-deletes an application that never went live (PENDING / REJECTED), e.g. a fake one, so
     * nothing of it lingers in the queue or the applicant's account. A pending one is rejected
     * first (history row). Staff rows are closed, the applicant is notified, the action audited.
     * Documents are kept as evidence (not released to media cleanup).
     */
    remove(agencyId: string, input: AgencyAdminDeleteInput, admin: AdminPrincipal): Promise<void>;
    /**
     * 소재지 변경 of an approved / suspended office after the admin checked its 이전신고 (the owner
     * cannot edit these fields once approved). Audited with before/after; the owner is notified.
     */
    updateLocation(agencyId: string, input: AgencyLocationUpdateInput): Promise<AdminAgencyDetail>;
    /** Resolves a private document file for the authorized admin download. */
    documentFile(agencyId: string, docId: string): Promise<DocumentFile>;
    /** Compares the application with the public broker registry (cached a day; `refresh` bypasses). */
    registryCheck(agencyId: string, refresh: boolean): Promise<AgencyRegistryCheck>;
    private notificationFor;
}
