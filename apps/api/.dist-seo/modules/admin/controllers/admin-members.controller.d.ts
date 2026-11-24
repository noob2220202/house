import type { MemberDetail, MemberListItem, Paginated } from '@house/shared';
import { IdParamDto, MemberListQueryDto, MemberSuspendDto } from '../dto';
import { MembersService } from '../services/members.service';
/**
 * Site members: search/detail for operators, suspension for ADMIN+. GET /:id shows unmasked
 * contacts and is logged as `member.pii-view`; suspension is audited inside its transaction.
 */
export declare class AdminMembersController {
    private readonly members;
    constructor(members: MembersService);
    list(q: MemberListQueryDto): Promise<Paginated<MemberListItem>>;
    detail(p: IdParamDto): Promise<MemberDetail>;
    suspend(p: IdParamDto, dto: MemberSuspendDto): Promise<MemberDetail>;
    unsuspend(p: IdParamDto): Promise<MemberDetail>;
}
