import { type ContactGrantView, type DealRequestCloseInput, type DealRequestCreateInput, type MyDealRequestDetail, type MyDealRequestListQuery, type MyDealRequestView, type Paginated } from '@house/shared';
import type { Queue } from 'bullmq';
import type { UserPrincipal } from '../../../common/auth/principal';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TermsService } from '../../auth';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { type DealRequestAgencyDirectory } from '../ports/agency-directory.port';
import { type DealRequestComplexesPort } from '../ports/complexes.port';
import { type DealRequestMediaPort } from '../ports/media.port';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';
/**
 * 내놓기/구하기 from the requester's side: create (login + rate limit + daily cap + active cap),
 * own list/detail with proposals, cancel/close, and per-agency contact consent.
 */
export declare class DealRequestsService {
    private readonly prisma;
    private readonly config;
    private readonly dailyCaps;
    private readonly mapper;
    private readonly notifications;
    private readonly lifecycle;
    private readonly agencyService;
    private readonly terms;
    private readonly agencies;
    private readonly complexes;
    private readonly media;
    private readonly queue;
    private readonly logger;
    constructor(prisma: PrismaService, config: AppConfig, dailyCaps: DailyCapService, mapper: DealRequestMapper, notifications: NotificationsService, lifecycle: DealRequestLifecycleService, agencyService: AgenciesService, terms: TermsService, agencies: DealRequestAgencyDirectory, complexes: DealRequestComplexesPort, media: DealRequestMediaPort, queue: Queue);
    create(user: UserPrincipal, input: DealRequestCreateInput, now?: Date): Promise<MyDealRequestView>;
    listMine(user: UserPrincipal, q: MyDealRequestListQuery): Promise<Paginated<MyDealRequestView>>;
    /** Own request with its proposals; opening it marks SENT proposals as VIEWED (read receipt). */
    getMine(user: UserPrincipal, id: string, now?: Date): Promise<MyDealRequestDetail>;
    cancel(user: UserPrincipal, id: string, now?: Date): Promise<MyDealRequestView>;
    /**
     * Extends an OPEN request, or reopens an EXPIRED one, for another TTL_DAYS (at most
     * MAX_EXTENSIONS times). Reopening counts toward MAX_ACTIVE_PER_USER; requests whose contact was
     * already erased cannot come back. Serialized per member so concurrent calls cannot exceed caps.
     */
    extend(user: UserPrincipal, id: string, now?: Date): Promise<MyDealRequestView>;
    close(user: UserPrincipal, id: string, input: DealRequestCloseInput, now?: Date): Promise<MyDealRequestView>;
    /**
     * The requester's consent to reveal contact name/phone and 동·호 to one agency. Allowed for agencies
     * the requester selected or that sent a (non-withdrawn) proposal. Idempotent.
     */
    grantContact(user: UserPrincipal, id: string, agencyId: string, now?: Date): Promise<ContactGrantView>;
    revokeContact(user: UserPrincipal, id: string, agencyId: string, now?: Date): Promise<void>;
    private end;
    private findOwned;
    private loadOwned;
    private resolveSellPlace;
    private validateWanted;
    private createData;
    /** Fan-out runs in the worker; a failed enqueue only delays agency notifications. */
    private enqueueFanout;
}
