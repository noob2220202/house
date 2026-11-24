import { type ContactGrantView, type DealRequestCreateInput, type MyDealRequestDetail, type MyDealRequestView, type Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AddressMatchQueryDto, ContactGrantDto, ContactGrantParamDto, DealRequestCloseDto, IdParamDto, MyDealRequestListQueryDto, TargetAgencyQueryDto } from '../dto';
import { DealRequestsService } from '../services/deal-requests.service';
import { RequestFormService, type AddressMatchView, type TargetAgencyPage } from '../services/request-form.service';
/** 내놓기/구하기 registration (login required; no phone verification — contact is typed). */
export declare class DealRequestsController {
    private readonly requests;
    private readonly form;
    constructor(requests: DealRequestsService, form: RequestFormService);
    /** Offices a request for the area reaches (`total`) + the "선택한 중개사" picker (`q`). Public. */
    targetAgencies(q: TargetAgencyQueryDto): Promise<TargetAgencyPage>;
    /** Registered complex (평형, 시세 hints) of a postcode result. Public. */
    addressMatch(q: AddressMatchQueryDto): Promise<AddressMatchView>;
    create(user: UserPrincipal, dto: DealRequestCreateInput): Promise<MyDealRequestView>;
}
/** The requester's own requests (/api/v1/me/deal-requests). Not-owned ids answer 404. */
export declare class MyDealRequestsController {
    private readonly requests;
    constructor(requests: DealRequestsService);
    list(user: UserPrincipal, q: MyDealRequestListQueryDto): Promise<Paginated<MyDealRequestView>>;
    get(user: UserPrincipal, p: IdParamDto): Promise<MyDealRequestDetail>;
    cancel(user: UserPrincipal, p: IdParamDto): Promise<MyDealRequestView>;
    /** OPEN → expiry pushed out by TTL_DAYS; EXPIRED → OPEN again (limited number of times). */
    extend(user: UserPrincipal, p: IdParamDto): Promise<MyDealRequestView>;
    close(user: UserPrincipal, p: IdParamDto, dto: DealRequestCloseDto): Promise<MyDealRequestView>;
    grant(user: UserPrincipal, p: IdParamDto, dto: ContactGrantDto): Promise<ContactGrantView>;
    revoke(user: UserPrincipal, p: ContactGrantParamDto): Promise<void>;
}
