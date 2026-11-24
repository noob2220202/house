import { type AgencyListingDetail, type AgencyListingRow, type CoBrokerRequestResult, type Paginated, type PhotoUrls } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AgencyListingListQueryDto, CoBrokerCandidatesQueryDto, CoBrokerJoinDto, CoBrokerParamDto, CreateListingDto, IdParamDto, ListingPhotosDto, ListingStatusChangeDto, ListingVerificationDto, UpdateListingDto } from '../dto';
import { AgencyConsoleService, type AgencyListingSummaryView, type CoBrokerCandidateView } from '../services/agency-console.service';
import { AgencyListingsService } from '../services/agency-listings.service';
import { CoBrokerageService } from '../services/co-brokerage.service';
/** 중개사무소 매물 관리. Membership and ownership are checked in the services (404 if not ours). */
export declare class AgencyListingsController {
    private readonly listings;
    private readonly coBrokerage;
    private readonly console;
    constructor(listings: AgencyListingsService, coBrokerage: CoBrokerageService, console: AgencyConsoleService);
    /** Counters of the status tabs and reminder chips (실매물 확인 due, 광고 기간 ending, 공동중개). */
    summary(user: UserPrincipal): Promise<AgencyListingSummaryView>;
    /** Other offices' public listings in a 단지 that this agency may ask to co-broker. */
    coBrokerCandidates(user: UserPrincipal, q: CoBrokerCandidatesQueryDto): Promise<Paginated<CoBrokerCandidateView>>;
    list(user: UserPrincipal, q: AgencyListingListQueryDto): Promise<Paginated<AgencyListingRow>>;
    create(user: UserPrincipal, dto: CreateListingDto): Promise<AgencyListingDetail>;
    get(user: UserPrincipal, p: IdParamDto): Promise<AgencyListingDetail>;
    update(user: UserPrincipal, p: IdParamDto, dto: UpdateListingDto): Promise<AgencyListingDetail>;
    remove(user: UserPrincipal, p: IdParamDto): Promise<void>;
    publish(user: UserPrincipal, p: IdParamDto): Promise<AgencyListingDetail>;
    changeStatus(user: UserPrincipal, p: IdParamDto, dto: ListingStatusChangeDto): Promise<AgencyListingDetail>;
    addVerification(user: UserPrincipal, p: IdParamDto, dto: ListingVerificationDto): Promise<AgencyListingDetail>;
    replacePhotos(user: UserPrincipal, p: IdParamDto, dto: ListingPhotosDto): Promise<PhotoUrls[]>;
    /** The caller's agency requests to co-broker this listing (공동중개); the primary must accept. */
    joinCoBroker(user: UserPrincipal, p: IdParamDto, dto: CoBrokerJoinDto): Promise<CoBrokerRequestResult>;
    /** The primary agency accepts a co-broker request (or takes back a removed agency). */
    acceptCoBroker(user: UserPrincipal, p: CoBrokerParamDto): Promise<AgencyListingDetail>;
    /** The primary agency rejects a pending co-broker request. */
    rejectCoBroker(user: UserPrincipal, p: CoBrokerParamDto): Promise<void>;
    /** The caller's agency leaves the co-brokerage (or cancels its pending request). */
    leaveCoBroker(user: UserPrincipal, p: IdParamDto): Promise<void>;
    /** The primary agency removes a co-broker. */
    removeCoBroker(user: UserPrincipal, p: CoBrokerParamDto): Promise<void>;
}
